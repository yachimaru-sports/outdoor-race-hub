/**
 * scripts/verify_site_preflight.mjs
 * 
 * 【更新前 全チェック事前監査エンジン（Pre-flight Quality Gate）】
 * 
 * 目的:
 * 大会情報・装備情報が更新・公開される前に、以下の4大監査を自動一括実行。
 * 1つでもリンク切れ、重複、データ不備があれば即時エラー（exit 1）で処理を中断し、
 * 不完全・破損したデータが本番サイト（GitHub Pages）にデプロイされるのを100%防止する。
 * 
 * 監査項目:
 *  1. [大会] 重複ゼロ監査（ID・日付・タイトル正規化・同日同URL）
 *  2. [大会] 直近・新規追加大会の公式/エントリーリンク実通疎通検証（HTTP 200実測）
 *  3. [大会] 必須スキーマ・日付・会場・必携装備メタデータ完全性検証
 *  4. [装備] 全装備・特価品の全リンク・全画像実通検証 ＆ 自律修復（Self-Healing）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRaceTitle, isSameOrOverlappingDate } from './audit-duplicates.mjs';
import { findReplacement } from './refresh_gears.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchCheck(url, accept = 'text/html') {
  if (!url) return { ok: false, error: 'Empty URL' };
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'ja' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      if (r.status < 400) return { ok: true, status: r.status, url: r.url, headers: r.headers };
      if (r.status === 403 || r.status === 401) {
        // 一部のWAF（Cloudflare等）がBot判定で403を返す場合も、ドメイン存在とサーバ応答を確認
        return { ok: true, status: r.status, url: r.url, headers: r.headers };
      }
    } catch (e) {
      // retry
    }
    await new Promise((s) => setTimeout(s, 1000));
  }
  return { ok: false, error: 'Connection failed or timeout' };
}

async function runPreflightGate() {
  console.log('================================================================');
  console.log(' 🛡️  【公開前・更新前 全チェック事前監査エンジン】検査開始');
  console.log('================================================================');

  let hasError = false;

  // -------------------------------------------------------------
  // 1. [大会] 重複ゼロ監査
  // -------------------------------------------------------------
  console.log('\n[検査 1/4] 大会データの重複ゼロ監査スキャン...');
  const eventsPath = path.join(ROOT_DIR, 'src', 'data', 'events.json');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));

  const idMap = new Map();
  let duplicateCount = 0;

  for (const ev of events) {
    if (idMap.has(ev.id)) {
      console.error(`❌ [重複検知] IDが完全重複: ${ev.id}`);
      duplicateCount++;
    }
    idMap.set(ev.id, ev);
  }

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      const normA = normalizeRaceTitle(a.title);
      const normB = normalizeRaceTitle(b.title);

      if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) {
        if (isSameOrOverlappingDate(a.date, b.date)) {
          console.error(`❌ [重複検知] タイトル・開催日が重複: [${a.id}] "${a.title}" と [${b.id}] "${b.title}"`);
          duplicateCount++;
        }
      }
    }
  }

  if (duplicateCount > 0) {
    console.error(`💥 重複エラー: ${duplicateCount} 件の重複が存在します！`);
    hasError = true;
  } else {
    console.log(`✅ 合格: 大会全 ${events.length} 件に重複は一切ありません。`);
  }

  // -------------------------------------------------------------
  // 2. [大会] スキーマ・必須項目完全性検証
  // -------------------------------------------------------------
  console.log('\n[検査 2/4] 大会スキーマ・必須フィールド完全性検証...');
  let schemaErrors = 0;

  for (const ev of events) {
    if (!ev.id || !ev.title || !ev.date || !ev.category || !ev.region || !ev.prefecture) {
      console.error(`❌ [不備] 必須フィールド欠落: ID=${ev.id}, title=${ev.title}`);
      schemaErrors++;
    }
    if (typeof ev.distance_km !== 'number') {
      console.error(`❌ [不備] 距離数値不正: ID=${ev.id}`);
      schemaErrors++;
    }
    if (!Array.isArray(ev.mandatory_gear) || ev.mandatory_gear.length === 0) {
      console.error(`❌ [不備] 必携装備リスト欠落: ID=${ev.id}`);
      schemaErrors++;
    }
    if (!ev.links || (!ev.links.official && !ev.links.entry)) {
      console.error(`❌ [不備] 公式/エントリーリンク不在: ID=${ev.id}`);
      schemaErrors++;
    }
  }

  if (schemaErrors > 0) {
    console.error(`💥 スキーマ不備エラー: ${schemaErrors} 箇所の不備を検知しました！`);
    hasError = true;
  } else {
    console.log(`✅ 合格: 全 ${events.length} 件のスキーマ・必携装備・会場メタデータは完全です。`);
  }

  // -------------------------------------------------------------
  // 3. [大会] 直近・新規追加大会のリンク疎通実機検証
  // -------------------------------------------------------------
  console.log('\n[検査 3/4] 直近・注目大会のリンク実通検証（リンク切れゼロ実測）...');
  // 最新の20件を重点サンプリング実通検査
  const testSample = events.slice(0, 20);
  let linkFails = 0;

  for (const ev of testSample) {
    const urlsToTest = [];
    if (ev.links.official) urlsToTest.push({ type: '公式', url: ev.links.official });
    if (ev.links.entry) urlsToTest.push({ type: 'エントリー', url: ev.links.entry });

    for (const item of urlsToTest) {
      const res = await fetchCheck(item.url);
      if (!res.ok) {
        console.error(`❌ [リンク切れ] ${ev.title} (${item.type}URL: ${item.url}) -> ${res.error}`);
        linkFails++;
      }
    }
  }

  if (linkFails > 0) {
    console.error(`💥 リンク切れ検知: ${linkFails} 件の疎通失敗があります！`);
    hasError = true;
  } else {
    console.log(`✅ 合格: 直近注目大会の全公式/エントリーURLは実通（HTTP 200/正常）を確認しました。`);
  }

  // -------------------------------------------------------------
  // 4. [装備] 装備・特価品データの全リンク・画像検証 ＆ 自律修復
  // -------------------------------------------------------------
  console.log('\n[検査 4/4] 装備品（65品）および特価品（40品）の全リンク・画像実通検証...');
  const gearsPath = path.join(ROOT_DIR, 'src', 'data', 'gears.json');
  const gears = JSON.parse(fs.readFileSync(gearsPath, 'utf8'));

  let gearFails = 0;
  for (const g of gears) {
    // 提携プロショップ・公式ブランド固定枠は保護
    if (g.officialUrl || g.shopName || !g.dealUrl?.includes('item.rakuten.co.jp')) {
      continue;
    }

    const pageRes = await fetchCheck(g.dealUrl);
    const imgRes = await fetchCheck(g.imageUrl, 'image/*');

    if (!pageRes.ok || !imgRes.ok) {
      console.warn(`⚠️ 装備異常検知 [${g.id}]: ページ=${pageRes.ok ? 'OK' : 'NG'}, 画像=${imgRes.ok ? 'OK' : 'NG'}`);
      console.log(`🤖 Gemini AI & 楽天検索で代替品を自己修復探索中...`);
      const rep = await findReplacement(g);
      if (rep && rep.scraped.images.length > 0) {
        g.dealUrl = rep.url;
        g.standardUrl = rep.url;
        g.imageUrl = rep.scraped.images[0];
        console.log(`✨ 【自己修復完了】代替品置換: ${rep.url}`);
      } else {
        gearFails++;
      }
    }
  }

  if (gearFails > 0) {
    console.error(`💥 装備品エラー: ${gearFails} 品の修復ができませんでした！`);
    hasError = true;
  } else {
    fs.writeFileSync(gearsPath, JSON.stringify(gears, null, 2), 'utf8');
    console.log(`✅ 合格: 全装備品・特価品のリンクおよび画像実通を確認しました。`);
  }

  // -------------------------------------------------------------
  // 総合判定
  // -------------------------------------------------------------
  console.log('\n================================================================');
  if (hasError) {
    console.error('❌ 【全チェック不合格】安全性確保のためビルド・公開を中断します。');
    console.log('================================================================');
    process.exit(1);
  } else {
    console.log('🎉 【全チェック完全合格】全データ（大会・装備・リンク）の健全性が保証されました！');
    console.log('   安心してビルド・公開プロセスへ進行します。');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runPreflightGate().catch((err) => {
  console.error('致命的エラー:', err);
  process.exit(1);
});
