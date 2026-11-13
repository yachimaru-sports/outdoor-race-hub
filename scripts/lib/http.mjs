/**
 * scripts/lib/http.mjs
 * ページ取得の共通ユーティリティ（大会リンク・商品リンク検証で共用）
 *
 * fetchPage(url) の戻り値:
 *   kind: 'ok'      … 200系で本文取得成功
 *         'dead'    … 404/410・DNS不達・ソフト404・ドメインパーキング等（確実に使えない）
 *         'blocked' … 403/429/5xx/タイムアウト（ボット遮断や一時障害の可能性。即削除はしない）
 *   status, finalUrl, title, text（表示テキスト・正規化前）, reason
 */

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const SOFT_404 = [
  'Page not found', 'お探しのページは見つかりませんでした', '指定されたページは見つかりませんでした',
  'ページが見つかりません', 'ご指定のページは見つかりません', '404 Not Found', 'The requested URL was not found',
  'このページは存在しません', '404エラー', 'お探しのページは存在しません', 'ページは削除されました',
  '該当する大会が見つかりません', '大会情報が見つかりません', 'この大会は存在しません', '公開が終了しました',
];
const PARKING = [
  'キャッチコピーなどが入ります', 'この文章はダミーです', 'Lorem ipsum dolor sit amet',
  'このドメインはお名前.comで取得されました', 'ドメインパーキング', 'Domain Parking',
  'ムームードメインで取得したドメインです', 'このウェブサイトは販売用です', 'This domain may be for sale',
  'このドメインは売り出し中です', 'Buy this domain',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function decodeBody(buffer, contentType = '') {
  let enc = 'utf-8';
  const head = buffer.subarray(0, 3000).toString('latin1');
  const m = head.match(/charset=["']?([a-zA-Z0-9_-]+)/i) || contentType.match(/charset=([a-zA-Z0-9_-]+)/i);
  if (m) {
    const cs = m[1].toLowerCase();
    if (cs.includes('euc')) enc = 'euc-jp';
    else if (cs.includes('shift') || cs.includes('sjis') || cs.includes('cp932') || cs.includes('windows-31j')) enc = 'shift_jis';
  }
  try { return new TextDecoder(enc).decode(buffer); } catch { return buffer.toString('utf-8'); }
}

export function htmlToText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** ページを取得して死活・内容を判定 */
export async function fetchPage(url, { tries = 2, timeoutMs = 15000 } = {}) {
  if (!url || !/^https?:\/\//.test(url)) return { kind: 'dead', status: 0, reason: '不正なURL形式', finalUrl: url };
  let last = { kind: 'blocked', status: 0, reason: '不明', finalUrl: url };
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'ja,en;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const finalUrl = res.url || url;
      if (res.status === 404 || res.status === 410) return { kind: 'dead', status: res.status, reason: `HTTP ${res.status}`, finalUrl };
      if (res.status >= 400) {
        last = { kind: 'blocked', status: res.status, reason: `HTTP ${res.status}`, finalUrl };
        if (i + 1 < tries) { await sleep(1500); continue; }
        return last;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const html = decodeBody(buf, res.headers.get('content-type') || '');
      const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = tm ? htmlToText(tm[1]) : '';
      const ogt = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const text = htmlToText(html);
      const full = `${title} ${ogt ? ogt[1] : ''} ${desc ? desc[1] : ''} ${text}`;
      if (/404/.test(title) && /(not found|見つかりません|存在しません)/i.test(title)) {
        return { kind: 'dead', status: res.status, reason: `ソフト404（${title}）`, finalUrl, title };
      }
      if (/RUNNET ランネット・大会ガイド&エントリー/.test(title) && text.length < 600) {
        return { kind: 'dead', status: res.status, reason: 'RUNNET大会情報なし/公開終了ページ', finalUrl, title };
      }
      for (const kw of PARKING) if (full.includes(kw)) return { kind: 'dead', status: res.status, reason: `未使用ドメイン/テンプレ（${kw}）`, finalUrl, title };
      // 本文が短いページだけソフト404判定（長い本文の中の「ページが見つかりません」リンク文言による誤判定を防ぐ）
      if (text.length < 4000) {
        for (const kw of SOFT_404) if (full.includes(kw)) return { kind: 'dead', status: res.status, reason: `ソフト404（${kw}）`, finalUrl, title };
      }
      return { kind: 'ok', status: res.status, finalUrl, title, text: full, html };
    } catch (e) {
      const msg = e?.cause?.code || e?.name || e?.message || String(e);
      if (/ENOTFOUND|EAI_AGAIN|ERR_INVALID_URL|CERT_HAS_EXPIRED|ERR_TLS_CERT_ALTNAME_INVALID|DEPTH_ZERO_SELF_SIGNED/i.test(msg) && i + 1 >= tries) {
        return { kind: 'dead', status: 0, reason: `接続不可（${msg}）`, finalUrl: url };
      }
      last = { kind: 'blocked', status: 0, reason: msg === 'TimeoutError' || msg === 'AbortError' ? 'タイムアウト' : msg, finalUrl: url };
      if (i + 1 < tries) await sleep(1500);
    }
  }
  return last;
}

/** 並列実行プール */
export async function pool(items, size, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

export { sleep };
