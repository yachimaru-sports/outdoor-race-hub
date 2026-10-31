/**
 * scripts/verify-links.mjs
 * 
 * 全大会データ（src/data/events.json）の全リンク（公式・申込）に対する
 * 実アクセス生存検証（Live HTTP Verification）スクリプト
 * 
 * 厳格基準:
 * 1. HTTP 200 OK であること（404, 500, 403, 401 等はすべて NG）
 * 2. ページ本文に「Page not found」「お探しのページは見つかりませんでした」
 *    等のソフト404文言が一切含まれていないこと
 * 
 * 終了コード:
 * - 全リンク生存確認（NGゼロ）: 0 (正常終了)
 * - 1件でも死んだリンクが存在: 1 (異常終了 / ビルド・CIをブロック)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');

export async function checkUrlLive(url) {
  if (!url || !url.startsWith('http')) {
    return { ok: false, status: 0, reason: '不正なURL形式' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (res.status >= 400) {
      return { ok: false, status: res.status, reason: `HTTPエラー ${res.status}` };
    }

    // 200 OK の場合でも、ソフト404（画面上は200だが本文に「見つかりませんでした」等と出るケース）を検知
    const text = await res.text();
    const notFoundKeywords = [
      'Page not found',
      'お探しのページは見つかりませんでした',
      '指定されたページは見つかりませんでした',
      'ページが見つかりません',
      'ご指定のページは見つかりません',
      '404 Not Found',
      'The requested URL was not found'
    ];

    for (const kw of notFoundKeywords) {
      if (text.includes(kw)) {
        return { ok: false, status: res.status, reason: `ソフト404検知 (${kw})` };
      }
    }

    return { ok: true, status: res.status, finalUrl: res.url };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, reason: 'タイムアウト (8秒)' };
    }
    return { ok: false, status: 0, reason: err.message };
  }
}

export async function verifyAllLinks() {
  if (!fs.existsSync(EVENTS_PATH)) {
    console.error(`エラー: イベントファイルが存在しません: ${EVENTS_PATH}`);
    process.exit(1);
  }

  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  console.log(`====================================================`);
  console.log(`[全大会リンク実機アクセス生存検証] 監査開始...`);
  console.log(`====================================================`);
  console.log(`- 対象大会数: ${events.length} 件`);

  const queue = [];
  for (const ev of events) {
    if (ev.links?.official) {
      queue.push({ id: ev.id, title: ev.title, type: 'official', url: ev.links.official });
    }
    if (ev.links?.entry) {
      queue.push({ id: ev.id, title: ev.title, type: 'entry', url: ev.links.entry });
    }
  }

  console.log(`- 検査対象URL総数: ${queue.length} 件`);

  const badLinks = [];
  const CONCURRENCY = 8;
  let completed = 0;

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const res = await checkUrlLive(item.url);
      completed++;
      if (!res.ok) {
        console.error(`\x1b[31m%s\x1b[0m`, `❌ [NG] [${item.type}] ${item.title} -> ${item.url} (${res.reason})`);
        badLinks.push({ ...item, ...res });
      } else {
        process.stdout.write(`.`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n----------------------------------------------------`);
  console.log(`検証結果サマリー:`);
  console.log(`- 検査完了URL総数: ${completed} 件`);
  console.log(`- 生存確認正常URL: ${completed - badLinks.length} 件`);
  console.log(`- 不正・死活エラーURL: ${badLinks.length} 件`);

  if (badLinks.length === 0) {
    console.log(`\x1b[32m%s\x1b[0m`, `✅ 全リンク実機アクセス確認完了: すべての公式・申込リンク（全 ${completed} 件）が正常に存在しています！`);
    return { success: true, count: completed, badLinks: [] };
  } else {
    console.error(`\x1b[31m%s\x1b[0m`, `❌ リンクエラー: ${badLinks.length} 件のリンク先が存在しないかエラーを返しています。`);
    return { success: false, count: completed, badLinks };
  }
}

// 直接実行された場合のハンドラ
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyAllLinks().then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  });
}
