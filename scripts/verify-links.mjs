import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsFilePath = path.resolve(__dirname, '../src/data/events.json');
const events = JSON.parse(fs.readFileSync(eventsFilePath, 'utf-8'));

console.log(`Checking URLs for ${events.length} events...`);

// タイムアウト付きフェッチ関数
async function checkUrl(url, timeoutMs = 8000) {
  if (!url || url === '#' || url.trim() === '') {
    return { ok: false, status: 0, error: 'Empty URL' };
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch {
      // HEAD拒否するサイトがあるためGETで再試行
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(id);
    }

    if (response.status < 400) {
      return { ok: true, status: response.status, finalUrl: response.url };
    } else {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function run() {
  const brokenLinks = [];
  let checkedCount = 0;

  // 10件ずつ並行処理
  const batchSize = 10;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (ev) => {
        checkedCount++;
        const official = ev.links?.official;
        const entry = ev.links?.entry;

        const [offRes, entryRes] = await Promise.all([
          checkUrl(official),
          checkUrl(entry),
        ]);

        if (!offRes.ok) {
          brokenLinks.push({
            eventId: ev.id,
            title: ev.title,
            type: 'official',
            url: official,
            error: offRes.error,
          });
        }

        if (!entryRes.ok) {
          brokenLinks.push({
            eventId: ev.id,
            title: ev.title,
            type: 'entry',
            url: entry,
            error: entryRes.error,
          });
        }
      })
    );
    process.stdout.write(`Checked ${Math.min(i + batchSize, events.length)}/${events.length} events...\r`);
  }

  console.log(`\n\n=== リンクチェック結果 ===`);
  console.log(`チェック大会数: ${events.length}`);
  console.log(`検出された無効/エラーリンク数: ${brokenLinks.length}\n`);

  if (brokenLinks.length > 0) {
    console.log(`--- リンク切れ一覧 ---`);
    brokenLinks.forEach((item, index) => {
      console.log(
        `${index + 1}. [${item.type.toUpperCase()}] ${item.title}\n   ID: ${item.eventId}\n   URL: ${item.url}\n   エラー: ${item.error}\n`
      );
    });
  } else {
    console.log('すべてのリンクが正常に稼働しています！');
  }

  // 結果を一時ファイルにも出力
  fs.writeFileSync(
    path.resolve(__dirname, 'broken_links_report.json'),
    JSON.stringify(brokenLinks, null, 2),
    'utf-8'
  );
}

run();
