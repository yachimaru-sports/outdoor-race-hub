/**
 * scripts/lib/gemini.mjs
 * Gemini API (gemini-2.5-flash + Google Search Grounding) 共通ヘルパー
 * Free Tier (20 req/day) でも枯渇しないよう 429 検知と高速フォールバックを備える
 */
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const MODEL = 'gemini-2.5-flash';
let quotaExhausted = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function hasGeminiKey() {
  return Boolean(GEMINI_API_KEY) && !quotaExhausted;
}

/** Google検索連動でGeminiに問い合わせ、テキストを返す */
export async function askGeminiSearch(prompt, { temperature = 0.1, timeoutMs = 25000, tries = 2 } = {}) {
  if (!GEMINI_API_KEY || quotaExhausted) return '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429) {
        const body = await res.text().catch(() => '');
        if (/per day|free_tier_requests|limit:\s*20/i.test(body)) {
          quotaExhausted = true;
          console.warn('⚠️ Gemini API 1日上限に達したため、以降はWeb直接検索のみで継続します。');
          return '';
        }
        if (i + 1 < tries) { await sleep(3000 * (i + 1)); continue; }
        return '';
      }
      if (res.status >= 500) {
        if (i + 1 < tries) { await sleep(2000 * (i + 1)); continue; }
        return '';
      }
      if (!res.ok) return '';
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      return parts.map((p) => p.text || '').join('\n').trim();
    } catch {
      if (i + 1 < tries) await sleep(1500);
    }
  }
  return '';
}

/** 応答テキストから JSON（オブジェクトまたは配列）を安全に抽出 */
export function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const m = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** 応答テキストからURLリストを抽出 */
export function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  return [...new Set(matches.map((u) => u.replace(/[.,;。、]+$/, '')))];
}
