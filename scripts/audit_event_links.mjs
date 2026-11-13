/**
 * scripts/audit_event_links.mjs
 * 大会リンクの「内容まで含めた」監査（レポートのみ・データは変更しない）
 *   node scripts/audit_event_links.mjs [--json 出力先]
 */
import fs from 'node:fs';
import { fetchPage, pool } from './lib/http.mjs';
import { judgeEventPage } from './lib/event_match.mjs';

const events = JSON.parse(fs.readFileSync('src/data/events.json', 'utf-8'));
const jobs = [];
for (const ev of events) for (const t of ['official', 'entry']) if (ev.links?.[t]) jobs.push({ ev, t, url: ev.links[t] });

const cache = new Map();
const results = await pool(jobs, 8, async (j) => {
  if (!cache.has(j.url)) cache.set(j.url, fetchPage(j.url));
  const page = await cache.get(j.url);
  const v = judgeEventPage(j.ev, page, j.t);
  return { id: j.ev.id, title: j.ev.title, date: j.ev.date, type: j.t, url: j.url, ...v };
});

const bad = results.filter((r) => r.verdict !== 'ok');
const sum = {};
for (const r of results) sum[r.verdict] = (sum[r.verdict] || 0) + 1;
console.log('判定集計:', sum);
for (const r of bad) console.log(`[${r.verdict}] ${r.type} ${r.title} (${r.date}) ${r.url} → ${r.reason}`);
const stale = results.filter((r) => r.stale);
console.log(`\n過去年情報のみの公式ページ: ${stale.length} 件`);
const out = process.argv.indexOf('--json');
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(results, null, 2));
