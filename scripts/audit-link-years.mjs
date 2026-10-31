import fs from 'fs';

const events = JSON.parse(fs.readFileSync('src/data/events.json', 'utf8'));

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      }
    });
    const html = await res.text();
    return { status: res.status, ok: res.ok, html };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function auditLink(url, targetYear) {
  if (!url || !url.startsWith('http')) return { skipped: true, reason: 'invalid url' };
  
  // RUNNET / モシコム / スポーツエントリーの検索リンクは動的検索
  if (url.includes('/search') || url.includes('/parts/2026/')) {
    return { valid: true, note: 'portal search link' };
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return { valid: false, error: `HTTP ${res.status}: ${res.error || ''}` };
  }

  const html = res.html;
  const hasTargetYear = html.includes(targetYear.toString());
  const hasNextYear = html.includes((targetYear + 1).toString());
  const hasPrevYear = html.includes((targetYear - 1).toString());
  const has2024 = html.includes('2024');
  const has2023 = html.includes('2023');

  // タイトル抽出
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // 古い年度しか存在しないケースを検知
  if (!hasTargetYear && !hasNextYear && (has2024 || has2023)) {
    return {
      valid: false,
      yearMismatch: true,
      foundYears: { 2024: has2024, 2023: has2023, target: false },
      title,
      url
    };
  }

  return {
    valid: true,
    hasTargetYear,
    title
  };
}

async function main() {
  console.log(`Starting Year Audit for ${events.length} events...`);
  const mismatches = [];
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const targetYear = parseInt(e.date.split('-')[0], 10);
    const officialUrl = e.links?.official;
    
    process.stdout.write(`[${i + 1}/${events.length}] Checking: ${e.title.slice(0, 25)}... `);

    const officialResult = await auditLink(officialUrl, targetYear);
    if (!officialResult.valid) {
      if (officialResult.yearMismatch) {
        console.log(`⚠️ MISMATCH (${officialResult.title})`);
        mismatches.push({
          id: e.id,
          title: e.title,
          targetYear,
          url: officialUrl,
          foundYears: officialResult.foundYears,
          pageTitle: officialResult.title
        });
      } else {
        console.log(`❌ ERROR (${officialResult.error})`);
        errors.push({
          id: e.id,
          title: e.title,
          url: officialUrl,
          error: officialResult.error
        });
      }
    } else {
      console.log(`✅ OK`);
    }

    // レートリミット配慮
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n--- AUDIT SUMMARY ---');
  console.log(`Total Mismatches (Old year only): ${mismatches.length}`);
  console.log(`Total Network/HTTP Errors: ${errors.length}`);
  fs.writeFileSync('audit-mismatches.json', JSON.stringify({ mismatches, errors }, null, 2));
}

main().catch(console.error);
