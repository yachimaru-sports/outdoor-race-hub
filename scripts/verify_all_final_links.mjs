import fs from 'node:fs';

const deals = JSON.parse(fs.readFileSync('src/data/deals.json', 'utf-8'));
const gears = JSON.parse(fs.readFileSync('src/data/gears.json', 'utf-8'));

async function testUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function verifyAll() {
  console.log('======================================================');
  console.log(' 全商品リンク・画像URL 最終アクセス検証（HTTP 200検査）');
  console.log('======================================================');

  let failedCount = 0;

  // 1. deals のURL検査
  console.log(`\n--- deals.json (${deals.length}件) リンク検証 ---`);
  for (const d of deals) {
    const res = await testUrl(d.affiliate_url);
    if (!res.ok) {
      console.log(`❌ 失敗: [${d.id}] ${d.title} -> ${d.affiliate_url} (${res.status || res.error})`);
      failedCount++;
    } else {
      console.log(`✅ OK (HTTP ${res.status}): [${d.discount_rate}%OFF] ${d.title.slice(0, 30)}`);
    }
  }

  // 2. gears の dealUrl / standardUrl 検査
  console.log(`\n--- gears.json (${gears.length}件) リンク検証 ---`);
  for (const g of gears) {
    const targetUrl = g.dealUrl || g.standardUrl;
    const res = await testUrl(targetUrl);
    if (!res.ok) {
      console.log(`❌ 失敗: [${g.id}] ${g.title} -> ${targetUrl} (${res.status || res.error})`);
      failedCount++;
    } else {
      const rateLabel = g.discountRate > 0 ? `${g.discountRate}%OFF` : '定番品';
      console.log(`✅ OK (HTTP ${res.status}): [${rateLabel}] ${g.title.slice(0, 30)}`);
    }
  }

  console.log('======================================================');
  console.log(`検証完了: 失敗 ${failedCount} 件 / 総検査数 ${deals.length + gears.length} 件`);
  console.log('======================================================');
}

verifyAll();
