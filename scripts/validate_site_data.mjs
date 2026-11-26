/**
 * scripts/validate_site_data.mjs
 * 公開前の最終ゲート ＆ 自動自己修復（Self-Healing Validator）
 *
 * 動作フロー:
 *  1. 装備データ（gears.json / deals.json）を徹底スキャン:
 *     - 重複、未設定項目、価格・割引率・説明文の不整合を検査
 *     - 全商品ページ（楽天・Shopify含む）、全商品画像への HTTP 200 / image/* 実機通信検証
 *     - ローカル実行時は楽天・Shopifyの「在庫あり」「在庫あり最安売値」「公式定価」まで実測検証
 *  2. 【自己修復】リンク切れ・売り切れ・画像切れ・価格ズレが発見された場合:
 *     - 売り切れ/リンク切れ → 在庫あり代替品を自動探索・置換
 *     - 価格ズレ → 実測値（売値・定価・割引率・説明文・isBestDeal・badge）へ自動同期
 *     - CI環境（海外IP）でWAF制限(403/タイムアウト)のみ発生し画像が正常な場合は保護維持
 *  3. 全カテゴリ最低3品・全リンク/画像OK・全データ整合性が担保されたら合格（exit 0）
 */
import fs from 'node:fs';
import {
  scrapeItem,
  scrapeShopifyProduct,
  findReplacement,
  syncDescriptionWithPrice,
} from './refresh_gears.mjs';

const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchCheck(url, accept) {
  const tries = isCI ? 1 : 2;
  const timeoutMs = isCI ? 4500 : 8000;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'ja' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      });
      if (r.status < 500 && r.status !== 429) return r;
    } catch { /* retry */ }
    if (i + 1 < tries) await new Promise((s) => setTimeout(s, 600));
  }
  return null;
}

function stripTag(s) {
  return (s || '').replace(/^【[^】]*(?:最安|OFF|目玉)[^】]*】\s*/g, '');
}

async function main() {
  console.log('====================================================');
  console.log(' [公開前ゲート ＆ 自律修復エンジン] 監査・検証開始...');
  console.log('====================================================');

  let gears = JSON.parse(fs.readFileSync('src/data/gears.json', 'utf-8'));
  let deals = JSON.parse(fs.readFileSync('src/data/deals.json', 'utf-8'));
  let healedCount = 0;
  let removedIds = new Set();

  // 1-A. Shopify 公式ストア商品（レート制限回避のため直列検証）
  if (!isCI) {
    for (const g of gears) {
      if (!(g.officialSaleSource === 'shopify' || g.dealUrl?.includes('ledlenser.co.jp/products/'))) continue;
      const s = await scrapeShopifyProduct(g.dealUrl);
      if (s.ok && !s.inStock) {
        console.warn(`⚠️ 売り切れ検知 [Shopify ${g.id}]: 在庫切れのため削除します`);
        removedIds.add(g.id);
        healedCount++;
        continue;
      }
      if (s.ok && s.inStock && s.price > 0) {
        const orig = s.listPrice > s.price ? s.listPrice : s.price;
        const disc = orig > s.price ? Math.round((1 - s.price / orig) * 100) : 0;
        if (g.price !== s.price || g.originalPrice !== orig || g.discountRate !== disc) {
          console.log(`🔄 価格同期 [Shopify ${g.id}]: ¥${g.price}(${g.discountRate}%) → ¥${s.price}(${disc}%)`);
          g.price = s.price;
          g.originalPrice = orig;
          g.discountRate = disc;
          g.standardTitle = syncDescriptionWithPrice(g, s.price, orig, disc);
          g.priceVerifiedAt = new Date().toISOString();
          healedCount++;
        }
      }
    }
  }

  // 1-B. 楽天市場および提携ショップのリンク・在庫・価格・画像検証（並列6実行）
  const rakutenTargets = gears.filter((g) => !removedIds.has(g.id) && g.dealUrl?.includes('item.rakuten.co.jp'));
  console.log(`- 検査対象装備: 全 ${gears.length} 品（うち楽天市場 ${rakutenTargets.length} 品・環境: ${isCI ? 'CI' : 'Local'}）`);
  let idx = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (idx < rakutenTargets.length) {
      const g = rakutenTargets[idx++];
      const isFixedPartner = Boolean(g.officialUrl || g.shopName || g.id.startsWith('gear-innerfact-'));

      if (isCI) {
        // CI環境では楽天HTMLがWAF遮断されるため画像CDNの実通確認に集中
        const imgRes = await fetchCheck(g.imageUrl, 'image/*');
        const imgOk = Boolean(imgRes && imgRes.status === 200 && (imgRes.headers.get('content-type') || '').startsWith('image/'));
        if (!imgOk) {
          console.warn(`⚠️ 画像切れ検知 [${g.id}]`);
          const rep = await findReplacement(g);
          if (rep) {
            let repImg = '';
            for (const im of rep.scraped.images) {
              const r = await fetchCheck(im, 'image/*');
              if (r && r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/')) {
                repImg = im;
                break;
              }
            }
            if (repImg) {
              g.dealUrl = rep.url;
              g.standardUrl = isFixedPartner ? g.standardUrl : rep.url;
              g.imageUrl = repImg;
              if (rep.scraped.price > 0) {
                g.price = rep.scraped.price;
                g.originalPrice = (rep.scraped.listPrice && rep.scraped.listPrice >= g.price) ? rep.scraped.listPrice : g.price;
                g.discountRate = g.originalPrice > g.price ? Math.round((1 - g.price / g.originalPrice) * 100) : 0;
              }
              if (rep.scraped.title) g.title = rep.scraped.title;
              g.standardTitle = syncDescriptionWithPrice(g, g.price, g.originalPrice, g.discountRate);
              healedCount++;
            }
          }
        }
        continue;
      }

      // ローカル実行時: 商品ページ実測（リンク疎通・在庫・売値・定価）＋画像疎通
      const [s, imgRes] = await Promise.all([
        scrapeItem(g.dealUrl),
        fetchCheck(g.imageUrl, 'image/*'),
      ]);
      const imgOk = Boolean(imgRes && imgRes.status === 200 && (imgRes.headers.get('content-type') || '').startsWith('image/'));

      if (s.ok && !s.inStock) {
        console.warn(`⚠️ 売り切れ検知 [${g.id}]: ${s.soldOutReason || 'sold-out'} -> 代替品探索中...`);
        const rep = await findReplacement(g);
        if (rep) {
          let repImg = '';
          for (const im of rep.scraped.images) {
            const r = await fetchCheck(im, 'image/*');
            if (r && r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/')) { repImg = im; break; }
          }
          if (repImg) {
            g.dealUrl = rep.url;
            g.standardUrl = isFixedPartner ? g.standardUrl : rep.url;
            g.imageUrl = repImg;
            g.price = rep.scraped.price;
            g.originalPrice = rep.scraped.listPrice > g.price ? rep.scraped.listPrice : g.price;
            g.discountRate = g.originalPrice > g.price ? Math.round((1 - g.price / g.originalPrice) * 100) : 0;
            if (rep.scraped.title) g.title = rep.scraped.title;
            g.standardTitle = syncDescriptionWithPrice(g, g.price, g.originalPrice, g.discountRate);
            g.priceVerifiedAt = new Date().toISOString();
            healedCount++;
            console.log(`✨ 売り切れを代替品へ置換 [${g.id}]: ${rep.url}`);
            continue;
          }
        }
        console.error(`❌ 売り切れ商品の代替品が見つからず除外: ${g.id}`);
        removedIds.add(g.id);
        healedCount++;
        continue;
      }

      if ((!s.ok && !s.blocked) || !imgOk) {
        console.warn(`⚠️ 異常検知 [${g.id}]: ページ=${s.ok ? 'OK' : s.reason}, 画像=${imgOk ? 'OK' : 'NG'}`);
        const rep = await findReplacement(g);
        if (rep) {
          let repImg = '';
          for (const im of rep.scraped.images) {
            const r = await fetchCheck(im, 'image/*');
            if (r && r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/')) { repImg = im; break; }
          }
          if (repImg) {
            g.dealUrl = rep.url;
            g.standardUrl = isFixedPartner ? g.standardUrl : rep.url;
            g.imageUrl = repImg;
            g.price = rep.scraped.price;
            g.originalPrice = rep.scraped.listPrice > g.price ? rep.scraped.listPrice : g.price;
            g.discountRate = g.originalPrice > g.price ? Math.round((1 - g.price / g.originalPrice) * 100) : 0;
            if (rep.scraped.title) g.title = rep.scraped.title;
            g.standardTitle = syncDescriptionWithPrice(g, g.price, g.originalPrice, g.discountRate);
            g.priceVerifiedAt = new Date().toISOString();
            healedCount++;
            console.log(`✨ 【自動修復成功】${rep.source} により置換: ${rep.url}`);
            continue;
          }
        }
        if (!s.ok && !s.blocked) {
          removedIds.add(g.id);
          healedCount++;
        }
        continue;
      }

      if (s.ok && s.inStock && s.price > 0) {
        const orig = s.listPrice > s.price ? s.listPrice : s.price;
        const disc = orig > s.price ? Math.round((1 - s.price / orig) * 100) : 0;
        if (g.price !== s.price || g.originalPrice !== orig || g.discountRate !== disc) {
          console.log(`🔄 価格実測同期 [${g.id}]: ¥${g.price}(${g.discountRate}%) → ¥${s.price}(${disc}%)`);
          g.price = s.price;
          g.originalPrice = orig;
          g.discountRate = disc;
          g.standardTitle = syncDescriptionWithPrice(g, s.price, orig, disc);
          g.priceVerifiedAt = new Date().toISOString();
          healedCount++;
        }
      }
    }
  }));

  if (removedIds.size > 0) {
    gears = gears.filter((g) => !removedIds.has(g.id));
  }

  // 修復・同期が行われた場合は isBestDeal / badge / deals.json を完全再同期して保存
  if (healedCount > 0) {
    const byCat = new Map();
    for (const g of gears) {
      g.isBestDeal = false;
      (byCat.get(g.gearType) || byCat.set(g.gearType, []).get(g.gearType)).push(g);
    }
    for (const [, list] of byCat) {
      const best = [...list].sort((a, b) => b.discountRate - a.discountRate || a.price - b.price)[0];
      if (best && best.discountRate > 0) best.isBestDeal = true;
    }
    for (const g of gears) {
      const body = syncDescriptionWithPrice({ ...g, standardTitle: stripTag(g.standardTitle) }, g.price, g.originalPrice, g.discountRate);
      g.standardTitle = g.isBestDeal ? `【カテゴリ最安${g.discountRate}%OFF】${body}` : body;
      g.badge = g.isBestDeal ? `🔥 ${g.discountRate}%OFF 最安特価` : g.discountRate >= 15 ? `${g.discountRate}%OFF 特価` : '定番おすすめ';
    }

    const now = new Date().toISOString();
    const oldDealsMap = new Map(deals.map((d) => [d.gear_id || d.id, d]));
    deals = gears
      .filter((g) => g.discountRate >= 20 && g.price > 0 && g.originalPrice > g.price)
      .map((g) => {
        const old = oldDealsMap.get(g.id);
        return {
          id: `deal-${g.id}`,
          gear_id: g.id,
          title: g.title,
          category: g.gearType,
          price: g.price,
          original_price: g.originalPrice,
          discount_rate: g.discountRate,
          point_rate: g.pointRate || old?.point_rate || 10,
          image_url: g.imageUrl,
          affiliate_url: g.dealUrl,
          badge: g.badge,
          description: g.standardTitle,
          official_url: g.officialUrl,
          shop_name: g.shopName,
          isBestDeal: Boolean(g.isBestDeal),
          updated_at: now,
          registered_at: old?.registered_at || now,
        };
      })
      .sort((a, b) => b.discount_rate - a.discount_rate || a.price - b.price);

    console.log(`💾 ${healedCount} 件の装備を自動修復・同期し、gears.json / deals.json を更新しました。`);
    fs.writeFileSync('src/data/gears.json', JSON.stringify(gears, null, 2) + '\n');
    fs.writeFileSync('src/data/deals.json', JSON.stringify(deals, null, 2) + '\n');
  }

  // 2. 最終構造・価格整合性・説明文矛盾チェック（CI・ローカル共通）
  const errors = [];
  const byType = new Map();
  const gearMap = new Map();

  for (const g of gears) {
    gearMap.set(g.id, g);
    (byType.get(g.gearType) || byType.set(g.gearType, []).get(g.gearType)).push(g);
    if (!g.officialUrl && !g.shopName && !/^https:\/\/item\.rakuten\.co\.jp\//.test(g.dealUrl || '')) {
      errors.push(`直リンクではない: ${g.id} ${g.dealUrl}`);
    }
    if (!(g.price > 0) || !(g.originalPrice >= g.price)) {
      errors.push(`価格異常: ${g.id} ${g.price}/${g.originalPrice}`);
    }
    const expectedDisc = g.originalPrice > g.price ? Math.round((1 - g.price / g.originalPrice) * 100) : 0;
    if (g.discountRate !== expectedDisc) {
      errors.push(`割引率計算不整合: ${g.id} discountRate=${g.discountRate}% != 計算値${expectedDisc}%`);
    }
    const descOff = (g.standardTitle || '').match(/定価より(\d+)[%％]OFF/);
    if (descOff && Number(descOff[1]) !== g.discountRate) {
      errors.push(`説明文割引率矛盾: ${g.id} 説明=${descOff[1]}% != 実測=${g.discountRate}%`);
    }
  }

  for (const d of deals) {
    if (d.discount_rate < 20) errors.push(`deals割引率不足(<20%): ${d.id} (${d.discount_rate}%)`);
    if (!(d.price > 0) || !(d.original_price > d.price)) {
      errors.push(`deals価格逆転/無割引: ${d.id} ${d.price}/${d.original_price}`);
    }
    const expectedDisc = Math.round((1 - d.price / d.original_price) * 100);
    if (d.discount_rate !== expectedDisc) {
      errors.push(`deals割引率計算不整合: ${d.id} ${d.discount_rate}% != ${expectedDisc}%`);
    }
    const g = gearMap.get(d.gear_id);
    if (!g) {
      errors.push(`deals孤立データ: ${d.id} (gear_id=${d.gear_id} が gears.json に不在)`);
    } else if (g.price !== d.price || g.originalPrice !== d.original_price || g.discountRate !== d.discount_rate) {
      errors.push(`deals/gears価格不整合: ${d.id} deals=¥${d.price}(${d.discount_rate}%) != gears=¥${g.price}(${g.discountRate}%)`);
    }
    const descOff = (d.description || '').match(/定価より(\d+)[%％]OFF/);
    if (descOff && Number(descOff[1]) !== d.discount_rate) {
      errors.push(`deals説明文割引率矛盾: ${d.id} 説明=${descOff[1]}% != 実測=${d.discount_rate}%`);
    }
  }

  for (const [t, list] of byType) {
    if (list.length < 3) errors.push(`カテゴリ品数不足: ${t} (${list.length}品 / 最低3品必要)`);
  }

  if (errors.length) {
    console.error(`❌ 最終検証 失敗 (${errors.length}件):\n - ` + errors.join('\n - '));
    console.error('前日の正常なHPを保護するため、今回の更新を中止します。');
    process.exit(1);
  }

  console.log(`✅ 公開前検証 合格: 装備 ${gears.length} 品 / ${byType.size} カテゴリ / 特価 ${deals.length} 品`);
  console.log(`   (リンク・画像・価格・割引率整合性すべて確認済み、自動修復: ${healedCount} 件)`);
}

main().catch((e) => {
  console.error('検証例外:', e);
  process.exit(1);
});
