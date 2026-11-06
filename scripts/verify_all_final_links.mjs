import fs from 'node:fs';

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
  console.log(`--- 全 ${gears.length} 件のURL生存確認 ---`);
  let failed = 0;
  for (let i = 0; i < gears.length; i++) {
    const g = gears[i];
    const url = g.dealUrl || g.standardUrl;
    const res = await testUrl(url);
    if (!res.ok) {
      console.log(`❌ 失敗 [${i + 1}/${gears.length}]: ${g.title} -> ${url} (${res.status || res.error})`);
      failed++;
    } else {
      console.log(`✅ OK (${res.status}) [${i + 1}/${gears.length}]: [${g.gearType}] ${g.title.slice(0, 30)}`);
    }
  }
  console.log(`\n検証結果: 失敗 ${failed} 件 / 合計 ${gears.length} 件`);
}

verifyAll();
