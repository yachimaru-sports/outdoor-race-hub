/**
 * scripts/auto_heal_event_links.mjs
 * 大会リンク（公式・申込）の自動修復
 *  1. 全リンクを実アクセス検証（verify-links.mjs の checkUrlLive を使用）
 *  2. 「確実に死んでいる」リンク（404/410・ソフト404・未初期化テンプレ・DNS不達）を2回確認
 *  3. GEMINI_API_KEY があれば Gemini(Google検索連動) で正しいURLを再探索 → 検証OKなら差し替え
 *  4. 見つからなければリンクを null にして画面から非表示（死んだリンクは絶対に出さない）
 *  ※ タイムアウト・403・429・5xx は一時障害の可能性があるため削除せず保持
 */
import fs from 'node:fs';
import { checkUrlLive } from './verify-links.mjs';

const EVENTS_PATH = 'src/data/events.json';
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isDefinitelyDead(r) {
  if (r.ok) return false;
  if (r.status === 404 || r.status === 410) return true;
  const reason = r.reason || '';
  if (/ソフト404|未初期化|ダミー/.test(reason)) return true;
  if (/ENOTFOUND|getaddrinfo|fetch failed/i.test(reason) && r.status === 0 && /ENOTFOUND|getaddrinfo/i.test(reason)) return true;
  return false;
}

async function confirmDead(url) {
  const first = await checkUrlLive(url);
  if (!isDefinitelyDead(first)) return { dead: false, result: first };
  await sleep(3000);
  const second = await checkUrlLive(url);
  return { dead: isDefinitelyDead(second), result: second };
}

async function askGemini(ev, type) {
  if (!GEMINI_API_KEY) return '';
  const label = type === 'entry' ? '申込・エントリーページ' : '公式サイト';
  const prompt = `次の大会の【${label}】の現在有効なURLをGoogle検索で特定し、URLのみを1行で出力してください。説明は不要。見つからなければ空文字。\n大会名: ${ev.title}\n開催日: ${ev.date}\n開催地: ${ev.prefecture || ''} ${ev.region || ''}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1 } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.warn(`  Gemini HTTP ${res.status}`); return ''; }
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const m = text.match(/https?:\/\/[^\s"'<>)\]]+/);
    return m ? m[0] : '';
  } catch (e) { console.warn(`  Gemini例外: ${e.message}`); return ''; }
}

async function main() {
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  const targets = [];
  for (const ev of events) for (const t of ['official', 'entry']) if (ev.links?.[t]) targets.push({ ev, type: t, url: ev.links[t] });

  const cache = new Map();
  const queue = [...new Set(targets.map((t) => t.url))];
  const deadUrls = new Set();
  let idx = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (idx < queue.length) {
      const url = queue[idx++];
      const { dead, result } = await confirmDead(url);
      cache.set(url, result);
      if (dead) { deadUrls.add(url); console.log(`💀 死リンク確定: ${url} (${result.reason})`); }
    }
  }));

  const healed = [];
  const removed = [];
  for (const t of targets) {
    if (!deadUrls.has(t.url)) continue;
    let replacement = '';
    const cand = await askGemini(t.ev, t.type);
    if (cand && cand !== t.url) {
      const r = await checkUrlLive(cand);
      if (r.ok) replacement = cand;
    }
    if (replacement) {
      t.ev.links[t.type] = replacement;
      healed.push({ id: t.ev.id, type: t.type, from: t.url, to: replacement });
      console.log(`🤖 AIが修復: ${t.ev.title} [${t.type}] → ${replacement}`);
    } else {
      t.ev.links[t.type] = null;
      removed.push({ id: t.ev.id, type: t.type, url: t.url });
      console.log(`🧹 非表示化: ${t.ev.title} [${t.type}] ${t.url}`);
    }
  }

  if (healed.length || removed.length) fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n');
  console.log(`\n大会リンク検証 ${queue.length} 件 / 死リンク ${deadUrls.size} 件 / AI修復 ${healed.length} / 非表示 ${removed.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
