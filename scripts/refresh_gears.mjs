/**
 * scripts/refresh_gears.mjs
 * 装備カタログ（src/data/gears.json）の完全自動更新スクリプト
 *
 * 方針（誤情報・リンク切れ・画像切れ・売り切れをサイトに出さない・完全自己修復）:
 *  1. 各商品ページ(item.rakuten.co.jp / Shopify)を実際に取得して HTTP 200・在庫あり を確認
 *  2. 在庫ありSKUの中から最安実売価格と公式定価（メーカー希望小売価格等）を実測
 *     ※タイトルの「XX%OFF」から架空定価を逆算しない
 *  3. 画像URLは実際に GET して image/* かつ HTTP 200 を確認
 *  4. 【自己修復】売り切れ・ページ消滅(404)・画像取得不能の場合:
 *     - 第1層: 楽天API（RAKUTEN_APP_ID がある場合）
 *     - 第2層: 楽天市場モール検索直接スクレイピング（生きた在庫あり商品を抽出）
 *     - 第3層: Gemini AI（Google Search Grounding）
 *  5. 割引率は 公式定価 と 在庫あり最安実売価格 から計算し、説明文も同期
 *  6. 各装備カテゴリ内の最大割引商品に isBestDeal を自動付与
 *  7. 修復後もカテゴリが3品未満になる場合は終了コード1で失敗 → デプロイを止め、前日の正常なサイトを維持
 */
import fs from 'node:fs';
import { appendChangelog, nowJstParts } from './lib/changelog.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
const MIN_PER_CATEGORY = 3;
const DEAL_THRESHOLD = 20;
const MIN_GEAR_PRICE = 3001; // ツール・ギア類は3,000円以下の安価品を不採用（靴下・補給食等の小物は除外）
const SMALL_EXEMPT_CATEGORIES = new Set([
  'ランニングソックス',
  '補給食・エナジージェル',
  'アンダーウェア',
  'エマージェンシー・救急',
  '防水スタッフバッグ',
]);
function meetsQualityPrice(category, price) {
  if (SMALL_EXEMPT_CATEGORIES.has(category)) return price > 0;
  return price >= MIN_GEAR_PRICE;
}
const GEARS_PATH = 'src/data/gears.json';
const DEALS_PATH = 'src/data/deals.json';
const META_PATH = 'src/data/meta.json';
const RAKUTEN_APP_ID = (process.env.RAKUTEN_APP_ID || '').trim();
const RAKUTEN_ACCESS_KEY = (process.env.RAKUTEN_ACCESS_KEY || '').trim();
const RAKUTEN_ORIGIN = (process.env.RAKUTEN_ORIGIN || 'https://yachimaru-sports.github.io').trim();
const AFFILIATE_ID = (process.env.RAKUTEN_AFFILIATE_ID || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

let ciRakutenBlockedCount = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, opts = {}, tries = isCI ? 1 : 2) {
  let last = null;
  const timeoutMs = isCI ? 5000 : 9000;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      // 403/404/410 等はリトライしても変わらないため即返す
      if (res.status < 500 && res.status !== 429) return res;
      last = res;
    } catch { last = null; }
    if (i + 1 < tries) await sleep(600 * (i + 1));
  }
  return last;
}

function cleanImage(u) {
  let s = (u || '').trim();
  if (s.startsWith('//')) s = 'https:' + s;
  return s.replace(/\?_ex=[^&]+/, '').replace(/[?&]$/, '').replace(/^http:/, 'https:');
}

async function imageIsAlive(url) {
  if (!url || !/^https:\/\//.test(url)) return false;
  const res = await fetchRetry(url, { headers: { Accept: 'image/*' } }, 2);
  if (!res || res.status !== 200) return false;
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 2000; // 極小のダミー画像は不採用
}

function decodeHtml(buffer, contentType = '') {
  let enc = 'utf-8';
  const head = buffer.subarray(0, 2000).toString('latin1');
  const m = head.match(/charset=["']?([a-zA-Z0-9_-]+)/i) || contentType.match(/charset=([a-zA-Z0-9_-]+)/i);
  if (m) {
    const cs = m[1].toLowerCase();
    if (cs.includes('euc')) enc = 'euc-jp';
    else if (cs.includes('shift') || cs.includes('sjis') || cs.includes('cp932')) enc = 'shift_jis';
  }
  try { return new TextDecoder(enc).decode(buffer); } catch { return buffer.toString('utf-8'); }
}

function cleanTitleText(raw) {
  return (raw || '')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 説明文中の割引表記を現在の実測値に同期（0%の場合は割引表記を削除） */
export function syncDescriptionWithPrice(gear, price, originalPrice, discountRate) {
  let desc = stripTag(gear.standardTitle || '');
  const savedAmount = originalPrice > price ? originalPrice - price : 0;

  if (discountRate > 0 && savedAmount > 0) {
    desc = desc.replace(/定価より\d+[%％]OFF（[¥￥]?[0-9,]+引き）/g, `定価より${discountRate}%OFF（¥${savedAmount.toLocaleString()}引き）`);
    desc = desc.replace(/定価より\d+[%％]OFFの/g, `定価より${discountRate}%OFFの`);
  } else {
    desc = desc.replace(/【最新セール発掘】/g, '');
    desc = desc.replace(/【公式Webshopセール】/g, '');
    desc = desc.replace(/定価より\d+[%％]OFF（[¥￥]?[0-9,]+引き）[。、\s]*/g, '');
    desc = desc.replace(/定価より\d+[%％]OFFの/g, '');
    desc = desc.replace(/楽天市場の本日更新目玉特価品[。、\s]*/g, '');
    desc = desc.trim();
    if (!desc) {
      desc = `${gear.gearType || 'アウトドアギア'}の定番おすすめモデル。`;
    }
  }
  return desc;
}

let shopifyLock = Promise.resolve();

/** Shopify Storefront (.js優先 / .jsonフォールバック) から在庫・実売価格・定価・画像を厳格抽出 */
export async function scrapeShopifyProduct(url) {
  const run = async () => {
    await sleep(2000);
    const clean = url.split('?')[0].replace(/\/+$/, '');
    const jsUrl = clean.endsWith('.js') ? clean : `${clean}.js`;

    let res = null;
    for (let i = 0; i < 2; i++) {
      res = await fetchRetry(jsUrl, { headers: { Accept: 'application/json' } }, 1);
      if (res && res.status === 200) {
        const ct = res.headers.get('content-type') || '';
        const txt = await res.text();
        if (!/local_rate_limited/i.test(txt) && (ct.includes('json') || txt.trim().startsWith('{'))) {
          try {
            const data = JSON.parse(txt);
            const variants = Array.isArray(data?.variants) ? data.variants : [];
            const inStockVars = variants.filter((v) => v && v.available === true && Number(v.price) > 0);
            const images = (data.images || []).map((im) => cleanImage(typeof im === 'string' ? im : im?.src)).filter(Boolean);
            const title = String(data.title || '').trim();

            if (data.available === false || inStockVars.length === 0) {
              return {
                ok: true,
                inStock: false,
                soldOutReason: 'shopify sold-out',
                title,
                price: 0,
                listPrice: 0,
                images,
                inStockSkuCount: 0,
                totalSkuCount: variants.length,
              };
            }

            // 在庫ありバリアントの中で最安値の実売価格を採用（Shopify .js の price は銭単位=100倍）
            const sortedVars = [...inStockVars].sort((a, b) => Number(a.price) - Number(b.price));
            const cheapest = sortedVars[0];
            const price = Math.round((Number(cheapest.price) / 100) * 1.1);
            const rawCompare = Number(cheapest.compare_at_price) || 0;
            const listPrice = rawCompare > Number(cheapest.price) ? Math.round((rawCompare / 100) * 1.1) : price;
            const maxPrice = Math.round((Number(sortedVars[sortedVars.length - 1].price) / 100) * 1.1);

            return {
              ok: price > 0,
              inStock: true,
              title,
              price,
              maxInStockPrice: maxPrice,
              listPrice,
              images,
              inStockSkuCount: inStockVars.length,
              totalSkuCount: variants.length,
            };
          } catch {
            // JSONパース失敗時は次のリトライへ
          }
        } else {
          res = { status: 429 };
        }
      }
      if (i === 0) await sleep(3500);
    }

    return {
      ok: false,
      blocked: res ? (res.status === 403 || res.status === 429 || res.status >= 500) : true,
      reason: res ? `HTTP ${res.status}` : 'network',
    };
  };

  // 並列呼び出しでもShopify側で429にならないよう直列実行
  const next = shopifyLock.then(run, run);
  shopifyLock = next.catch(() => {});
  return next;
}

/** 楽天商品ページから 在庫状態・在庫あり最安価格・公式定価・画像候補 を厳格抽出 */
export async function scrapeItem(url) {
  const res = await fetchRetry(url);
  if (!res) return { ok: false, blocked: true, reason: 'network' };
  if (res.status === 403 || res.status === 429 || res.status >= 500) {
    return { ok: false, blocked: true, reason: `HTTP ${res.status}` };
  }
  if (res.status !== 200) return { ok: false, blocked: false, reason: `HTTP ${res.status}` };
  if (!/item\.rakuten\.co\.jp/.test(res.url)) return { ok: false, blocked: false, reason: `redirected to ${res.url}` };
  const html = decodeHtml(Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || '');

  let title = '';
  let info = null;
  const imageCandidates = [];
  for (const s of html.matchAll(/<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(s[1]);
      const sku = j?.api?.data?.itemInfoSku;
      if (sku) {
        info = sku;
        if (sku.title) title = sku.title;
        break;
      }
    } catch { /* skip */ }
  }

  if (!title) {
    const tm = html.match(/<title>([^<]+)<\/title>/i);
    if (tm) title = tm[1].split('【楽天市場】')[0].split('：')[0].trim();
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && !/noimage/i.test(og[1])) imageCandidates.unshift(og[1]);
  if (info?.sku) {
    for (const sk of info.sku) {
      for (const im of sk.images || []) if (im.location) imageCandidates.push(im.location);
    }
  }
  for (const m of html.matchAll(/https?:\/\/(?:tshop|shop|image)\.r10s\.jp\/[^"'\s\\<>)]+\.(?:jpg|jpeg|png)/gi)) imageCandidates.push(m[0]);
  const images = [...new Set(imageCandidates.map(cleanImage))].filter(Boolean).slice(0, 8);
  const cleanedTitle = cleanTitleText(title);

  // itemInfoSku に基づく厳格な在庫・SKU判定
  if (info) {
    const purchaseCond = info.purchaseInfo?.purchaseBySellType?.purchaseCondition;
    const topStockCond = info.purchaseInfo?.newPurchaseSku?.stockCondition;
    if (info.hideItem === true || info.draftItem === true || purchaseCond === 'sold-out' || purchaseCond === 'unavailable' || topStockCond === 'sold-out') {
      return {
        ok: true,
        inStock: false,
        soldOutReason: `item_status=${purchaseCond || topStockCond || 'hidden/draft'}`,
        title: cleanedTitle,
        price: 0,
        listPrice: 0,
        images,
        inStockSkuCount: 0,
        totalSkuCount: Array.isArray(info.sku) ? info.sku.length : 0,
      };
    }

    const invMap = new Map();
    for (const v of (info.purchaseInfo?.variantMappedInventories || [])) {
      if (v && v.sku != null) invMap.set(String(v.sku), v.quantity);
    }
    const skuMetaMap = new Map();
    for (const v of (info.purchaseInfo?.sku || [])) {
      if (v && v.variantId != null) {
        skuMetaMap.set(String(v.variantId), {
          stockCondition: v.newPurchaseSku?.stockCondition,
          quantity: v.newPurchaseSku?.quantity,
          refPrice: Number(v.doublePrice?.taxIncludedVerifiedReferencePrice) || 0,
        });
      }
    }

    const allSkus = Array.isArray(info.sku) ? info.sku.filter((s) => !s.hidden) : [];
    const unlimited = info.unlimitedInventoryFlag === true;
    const inStockSkus = allSkus.filter((s) => {
      const vid = String(s.variantId ?? '');
      const meta = skuMetaMap.get(vid);
      const sc = meta?.stockCondition;
      if (sc === 'sold-out' || sc === 'unavailable') return false;
      if (unlimited) return true;
      const qty = invMap.has(vid) ? invMap.get(vid) : meta?.quantity;
      if (typeof qty === 'number') return qty > 0;
      return purchaseCond !== 'sold-out';
    });

    if (inStockSkus.length === 0) {
      return {
        ok: true,
        inStock: false,
        soldOutReason: 'all_skus_sold_out',
        title: cleanedTitle,
        price: 0,
        listPrice: 0,
        images,
        inStockSkuCount: 0,
        totalSkuCount: allSkus.length,
      };
    }

    const pricedSkus = inStockSkus.filter((s) => Number(s.taxIncludedPrice) > 0).sort((a, b) => Number(a.taxIncludedPrice) - Number(b.taxIncludedPrice));
    if (pricedSkus.length === 0) {
      return {
        ok: true,
        inStock: false,
        soldOutReason: 'no_priced_in_stock_sku',
        title: cleanedTitle,
        price: 0,
        listPrice: 0,
        images,
        inStockSkuCount: 0,
        totalSkuCount: allSkus.length,
      };
    }

    const cheapest = pricedSkus[0];
    const price = Number(cheapest.taxIncludedPrice);
    const maxInStockPrice = Number(pricedSkus[pricedSkus.length - 1].taxIncludedPrice);
    const cheapestMeta = skuMetaMap.get(String(cheapest.variantId ?? ''));

    // 定価取得: 1) 最安SKU公式参考価格 2) purchaseInfo verified参考価格 3) 商品共通参考価格 4) HTML明示的メーカー希望小売価格
    // ※タイトル文字列の「XX%OFF」からの架空定価逆算は絶対に行わない
    let listPrice = 0;
    const refCandidates = [
      Number(cheapest.taxIncludedReferencePrice) || 0,
      Number(cheapestMeta?.refPrice) || 0,
      Number(info.taxIncludedReferencePrice) || 0,
    ];
    for (const rc of refCandidates) {
      if (rc > price) { listPrice = rc; break; }
    }
    if (!listPrice) {
      const lp = html.match(/メーカー希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/定価[^\d]{0,30}([0-9,]+)\s*円/);
      if (lp) {
        const parsedLp = Number(lp[1].replace(/,/g, ''));
        if (parsedLp > price) listPrice = parsedLp;
      }
    }

    return {
      ok: true,
      inStock: true,
      title: cleanedTitle,
      price,
      maxInStockPrice,
      listPrice: listPrice > price ? listPrice : price,
      images,
      inStockSkuCount: inStockSkus.length,
      totalSkuCount: allSkus.length,
    };
  }

  // itemInfoSku が取得できない特殊ページのフォールバック（販売終了・売り切れ文言検知）
  if (/ただいま販売期間外|この商品は売り切れ|申し訳ございませんが.*売り切れ|販売を終了/i.test(html)) {
    return {
      ok: true,
      inStock: false,
      soldOutReason: 'html_sold_out_text',
      title: cleanedTitle,
      price: 0,
      listPrice: 0,
      images,
      inStockSkuCount: 0,
      totalSkuCount: 0,
    };
  }

  return { ok: false, blocked: false, reason: 'itemInfoSku_missing' };
}

/** 1. 楽天モール検索スクレイピング（APIキー完全不要で生きた item.rakuten.co.jp を抽出） */
export async function searchRakutenDirect(keyword) {
  const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  try {
    const res = await fetchRetry(url, {}, 2);
    if (!res || !res.ok) return [];
    const html = await res.text();
    const matches = [...html.matchAll(/href=["'](https:\/\/item\.rakuten\.co\.jp\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+(?:\/|\?)[^"']*)["']/g)];
    return [...new Set(matches.map((m) => m[1].split('?')[0]))];
  } catch {
    return [];
  }
}

let geminiQuotaExhausted = false;

/** 2. Gemini AI による Google Search Grounding での楽天市場商品URL探索 */
export async function searchWithGemini(keyword) {
  if (!GEMINI_API_KEY || geminiQuotaExhausted) return null;
  const prompt = `楽天市場（rakuten.co.jp）で現在販売中（在庫あり）の「${keyword}」の個別商品ページURL（https://item.rakuten.co.jp/...）を1つGoogle検索で特定し、URLのみを出力してください。見つからなければ空文字。`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 429) {
      const body = await res.text().catch(() => '');
      if (/per day|free_tier_requests|limit:\s*20/i.test(body)) geminiQuotaExhausted = true;
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const m = text.match(/https:\/\/item\.rakuten\.co\.jp\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+(?:\/)?/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

/** 2-A. Gemini AI (Google Search Grounding) によるセール商品候補一括探索（楽天API不要・CI WAF遮断時も利用可能） */
async function discoverDealsWithGemini(target) {
  if (!GEMINI_API_KEY || geminiQuotaExhausted) return [];
  const prompt = [
    `Google検索を使い、楽天市場（item.rakuten.co.jp）で現在販売中かつ在庫あり・セール割引中の「${target.brand} ${target.category}」（キーワード: ${target.keyword}）の商品を最大3件探してください。`,
    '必ず実在する商品ページのURL（https://item.rakuten.co.jp/...）、商品名、現在の税込販売価格（円）、定価またはメーカー希望小売価格（円）、可能なら商品画像URL（r10s.jp 等）をJSON配列のみで出力してください。',
    '例: [{"title":"商品名","url":"https://item.rakuten.co.jp/shop/item/","price":12800,"originalPrice":19800,"imageUrl":"https://thumbnail.image.rakuten.co.jp/..."}]',
    '見つからない場合は [] のみ出力してください。推測や架空のURL・価格は絶対に出力しないでください。',
  ].join('\n');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (res.status === 429) {
      const body = await res.text().catch(() => '');
      if (/per day|free_tier_requests|limit:\s*20/i.test(body)) {
        geminiQuotaExhausted = true;
        console.warn(' ⚠️ Gemini API 1日上限に達したため、以降は他ソースのみで継続します。');
      }
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[1] || m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.url === 'string' && /^https:\/\/item\.rakuten\.co\.jp\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+/.test(x.url))
      .map((x) => ({
        url: x.url.split('?')[0].replace(/\/+$/, ''),
        title: String(x.title || '').trim(),
        price: Number(x.price) || 0,
        originalPrice: Number(x.originalPrice) || 0,
        imageUrl: cleanImage(String(x.imageUrl || '')),
      }));
  } catch {
    return [];
  }
}

/** 2-B. Gemini AI (Google Search Grounding) による最新価格取得（楽天APIなし・WAF遮断時のフォールバック） */
let geminiPriceQuota = 15;
async function fetchPriceWithGemini(gear) {
  if (!GEMINI_API_KEY || geminiQuotaExhausted || geminiPriceQuota <= 0) return null;
  geminiPriceQuota--;
  const prompt = `次の楽天市場商品の現在の在庫状況・税込販売価格（円）・定価/メーカー希望小売価格（円）をGoogle検索で調べて、JSONのみ（例: {"inStock": true, "price": 12800, "originalPrice": 16000}）で出力してください。売り切れ・販売終了の場合は {"inStock": false, "price": 0}。不明な場合は {"price": 0}。\n商品名: ${gear.title}\nURL: ${gear.dealUrl}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (res.status === 429) {
      const body = await res.text().catch(() => '');
      if (/per day|free_tier_requests|limit:\s*20/i.test(body)) geminiQuotaExhausted = true;
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.inStock === false) return { inStock: false, price: 0, originalPrice: 0 };
    const price = Number(parsed.price) || 0;
    const originalPrice = Number(parsed.originalPrice) || 0;
    if (price < 500 || price > 300000) return null;
    if (gear.price && (price < gear.price * 0.3 || price > gear.price * 3)) return null;
    return { inStock: true, price, originalPrice: originalPrice > price ? originalPrice : 0 };
  } catch {
    return null;
  }
}

/** 楽天キャプション等から公式定価（メーカー希望小売価格）を抽出 */
function extractListPriceFromCaption(caption, price) {
  if (!caption || !(price > 0)) return 0;
  const lp = caption.match(/メーカー希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || caption.match(/希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || caption.match(/定価[^\d]{0,30}([0-9,]+)\s*円/);
  if (lp) {
    const val = Number(lp[1].replace(/,/g, ''));
    if (val > price) return val;
  }
  return 0;
}

/** 3. 楽天公式API検索（2026年新仕様 openapi.rakuten.co.jp + accessKey 対応） */
export async function searchRakutenApiItems(keyword, minPrice = 1000, extraParams = {}) {
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) return [];
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    availability: '1',
    sort: '+itemPrice',
    hits: '10',
    minPrice: String(minPrice),
    format: 'json',
    formatVersion: '2',
    ...extraParams,
  });
  if (keyword) params.set('keyword', keyword);
  if (AFFILIATE_ID) params.set('affiliateId', AFFILIATE_ID);
  const res = await fetchRetry(`https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701?${params}`, {
    headers: { accessKey: RAKUTEN_ACCESS_KEY, Referer: `${RAKUTEN_ORIGIN}/`, Origin: RAKUTEN_ORIGIN },
  });
  if (!res || res.status !== 200) return [];
  const data = await res.json().catch(() => null);
  return data?.Items || [];
}

/** 楽天APIによるピンポイント在庫・価格照合（CI WAF遮断時用） */
export async function verifyItemWithRakutenApi(url, fallbackKeyword = '') {
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) return null;
  const cleanUrl = (url || '').split('?')[0].replace(/\/+$/, '');
  const m = cleanUrl.match(/^https:\/\/item\.rakuten\.co\.jp\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const [, shopCode, itemCode] = m;
  const norm = (u) => (u || '').split('?')[0].replace(/\/+$/, '');

  // 1) shopCode + availability=1 で検索（itemCode → fallbackKeyword）
  for (const kw of [itemCode, fallbackKeyword].filter(Boolean)) {
    const items = await searchRakutenApiItems(kw, 100, { shopCode, availability: '1', hits: '20' });
    const hit = items.find((it) => norm(it.itemUrl) === cleanUrl);
    if (hit && hit.itemPrice > 0) {
      return {
        found: true,
        inStock: true,
        price: Number(hit.itemPrice),
        listPrice: extractListPriceFromCaption(hit.itemCaption, Number(hit.itemPrice)),
        title: cleanTitleText(hit.itemName || ''),
        images: (hit.mediumImageUrls || hit.smallImageUrls || []).map((x) => cleanImage(typeof x === 'string' ? x : x?.imageUrl)).filter(Boolean),
      };
    }
  }

  // 2) availability=1 で見つからない場合、availability=0（全商品）で存在するか確認 → あれば売り切れ確定
  for (const kw of [itemCode, fallbackKeyword].filter(Boolean)) {
    const allItems = await searchRakutenApiItems(kw, 100, { shopCode, availability: '0', hits: '20' });
    const hitAll = allItems.find((it) => norm(it.itemUrl) === cleanUrl);
    if (hitAll) {
      return { found: true, inStock: false, price: 0, listPrice: 0, title: cleanTitleText(hitAll.itemName || ''), images: [] };
    }
  }
  return null;
}

export async function searchRakutenApi(gear) {
  const items = await searchRakutenApiItems(
    gear.dealKeyword || gear.title,
    Math.round((gear.originalPrice || 10000) * 0.3)
  );
  for (const it of items) {
    if (!it.itemUrl || !it.itemUrl.includes('item.rakuten.co.jp')) continue;
    if (!isReplacementRelevant(gear, it.itemName || '')) continue;
    const url = it.itemUrl.split('?')[0];
    const s = await scrapeItem(url);
    if (s.ok && s.inStock && s.price > 0) return { url, title: it.itemName, scraped: s, source: '楽天API' };
    // CI等で商品ページがWAF遮断(403等)された場合でも、楽天API(availability=1)の在庫・価格＋画像CDN実通が取れれば採用
    if (s.blocked && it.itemPrice > 0) {
      const rawImgs = (it.mediumImageUrls || it.smallImageUrls || []).map((x) => cleanImage(typeof x === 'string' ? x : x?.imageUrl)).filter(Boolean);
      const listPrice = extractListPriceFromCaption(it.itemCaption, Number(it.itemPrice));
      for (const im of rawImgs) {
        if (await imageIsAlive(im)) {
          return {
            url,
            title: cleanTitleText(it.itemName),
            scraped: { ok: true, inStock: true, title: cleanTitleText(it.itemName), price: Number(it.itemPrice), listPrice: listPrice || Number(it.itemPrice), images: [im] },
            source: '楽天API(WAF迂回)',
          };
        }
      }
    }
  }
  return null;
}

/** 代替商品が元の商品カテゴリ・ブランド/キーワードと一致しているか検証（別商品への誤置換を防止） */
const BRAND_PATTERNS = {
  altra: /altra|アルトラ/i,
  hoka: /hoka|ホカ/i,
  salomon: /salomon|サロモン/i,
  petzl: /petzl|ペツル/i,
  leki: /leki|レキ/i,
  millet: /millet|ミレー/i,
  asics: /asics|アシックス/i,
  nike: /nike|ナイキ/i,
  adidas: /adidas|アディダス/i,
  'the north face': /north\s*face|ノースフェイス/i,
  'black diamond': /black\s*diamond|ブラックダイヤモンド/i,
  'cw-x': /cw-x|cwx|ワコール/i,
  c3fit: /c3fit|シースリーフィット|goldwin/i,
  montbell: /montbell|モンベル/i,
  finetrack: /finetrack|ファイントラック/i,
  'pearl izumi': /pearl\s*izumi|パールイズミ/i,
  'ogk kabuto': /ogk|kabuto|カブト|オージーケー/i,
  cateye: /cateye|cat\s*eye|キャットアイ/i,
  nathan: /nathan|ネイサン/i,
  ledlenser: /ledlenser|レッドレンザー/i,
  patagonia: /patagonia|パタゴニア/i,
  'mag-on': /mag-on|マグオン/i,
  silva: /silva|シルバ/i,
  suunto: /suunto|スント/i,
  'inner fact': /inner\s*fact|インナーファクト/i,
  sol: /sol|エスオーエル/i,
  exped: /exped|エクスペド/i,
  'sea to summit': /sea\s*to\s*summit|シートゥサミット/i,
};

function normalizeBrandKey(brand) {
  return (brand || '')
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function isReplacementRelevant(gear, candTitle) {
  if (!candTitle) return false;
  if (!isCategoryMatch(gear.gearType, candTitle)) return false;
  const t = candTitle.normalize('NFKC').toLowerCase();
  const brand = normalizeBrandKey(gear.brand);
  if (brand && brand.length >= 2) {
    const pattern = BRAND_PATTERNS[brand];
    if (pattern) return pattern.test(candTitle.normalize('NFKC'));
    return t.includes(brand);
  }
  const kws = (gear.matchKeywords || []).map((k) => String(k).normalize('NFKC').toLowerCase()).filter((k) => k.length >= 2);
  if (kws.some((k) => t.includes(k))) return true;
  return kws.length === 0;
}

/** 3重自己修復（Self-Healing）エンジン: 楽天API → 楽天モール直接検索 → Gemini AI */
export async function findReplacement(gear, excludeUrls = new Set()) {
  const normU = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  const isExcluded = (u) => excludeUrls.has(normU(u));
  const cleanBrand = normalizeBrandKey(gear.brand);
  const query = `${cleanBrand || ''} ${gear.dealKeyword || gear.title || ''}`.replace(/\s+/g, ' ').trim();

  // 第1層: 楽天新API（キーがある場合）
  if (RAKUTEN_APP_ID && RAKUTEN_ACCESS_KEY) {
    const apiRes = await searchRakutenApi(gear);
    if (apiRes && !isExcluded(apiRes.url)) return apiRes;
  }

  // 第2層: 楽天モール検索スクレイピング（在庫あり個別商品URLを抽出）
  const directUrls = await searchRakutenDirect(query);
  for (const u of directUrls.slice(0, 10)) {
    if (isExcluded(u)) continue;
    const s = await scrapeItem(u);
    if (s.ok && s.inStock && s.price > 0 && meetsQualityPrice(gear.gearType, s.price) && isReplacementRelevant(gear, s.title)) {
      let hasImg = false;
      for (const im of s.images) { if (await imageIsAlive(im)) { hasImg = true; break; } }
      if (hasImg) return { url: u, title: s.title || gear.title, scraped: s, source: '楽天モール直接検索' };
    }
  }

  // 第3層: Gemini AI (Google Search Grounding)
  if (GEMINI_API_KEY) {
    const geminiUrl = await searchWithGemini(query);
    if (geminiUrl && !isExcluded(geminiUrl)) {
      const s = await scrapeItem(geminiUrl);
      if (s.ok && s.inStock && s.price > 0 && meetsQualityPrice(gear.gearType, s.price) && isReplacementRelevant(gear, s.title)) {
        let hasImg = false;
        for (const im of s.images) { if (await imageIsAlive(im)) { hasImg = true; break; } }
        if (hasImg) return { url: geminiUrl, title: s.title || gear.title, scraped: s, source: 'Gemini AI' };
      }
    }
  }

  return null;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function refreshOne(g, usedUrls = new Set()) {
  const normU = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  const nowIso = new Date().toISOString();
  const isFixedPartner = Boolean(g.officialUrl || g.shopName || g.id.startsWith('gear-innerfact-') || g.id.startsWith('gear-runplus-'));

  // 1. 公式ストアセール品（Shopify Storefront API対応：Ledlenser公式等）
  if (g.officialSaleSource === 'shopify' || g.dealUrl?.includes('ledlenser.co.jp/products/')) {
    const s = await scrapeShopifyProduct(g.dealUrl);
    if (s.ok) {
      if (!s.inStock) {
        return { gear: g, status: 'sold_out', log: [`公式ストア売り切れ(${s.soldOutReason || 'sold-out'})のため除外`] };
      }
      let image = '';
      for (const im of s.images) { if (await imageIsAlive(im)) { image = im; break; } }
      if (!image && g.imageUrl && await imageIsAlive(g.imageUrl)) image = g.imageUrl;
      if (image && s.price > 0) {
        const originalPrice = s.listPrice > s.price ? s.listPrice : s.price;
        const discountRate = originalPrice > s.price ? Math.round((1 - s.price / originalPrice) * 100) : 0;
        const dropped = Boolean(g.price && s.price < g.price);
        const priceChanged = Boolean(g.price !== s.price || g.discountRate !== discountRate);
        const prevPrice = g.price && g.price !== s.price ? g.price : g.prevPrice;
        const syncedDesc = syncDescriptionWithPrice(g, s.price, originalPrice, discountRate);
        return {
          gear: {
            ...g,
            imageUrl: image,
            price: s.price,
            originalPrice,
            discountRate,
            standardTitle: syncedDesc,
            ...(prevPrice ? { prevPrice } : {}),
            lowest30d: Math.min(g.lowest30d || s.price, s.price),
            priceVerifiedAt: nowIso,
            _verifiedToday: true,
          },
          status: 'ok',
          dropped,
          priceChanged,
          verifiedToday: true,
          oldPrice: g.price,
          log: [`公式ストア実測(在庫あり${s.inStockSkuCount}/${s.totalSkuCount}種 ¥${s.price.toLocaleString()} / ${discountRate}%OFF)`],
        };
      }
    }
    const imgAlive = await imageIsAlive(g.imageUrl);
    if (imgAlive || s.blocked) {
      return {
        gear: { ...g, priceVerifiedAt: g.priceVerifiedAt || nowIso, _verifiedToday: false },
        status: 'ok',
        verifiedToday: false,
        log: [`公式ストア応答制限(${s.reason || 'rate-limit'})のため既存値を安全維持`],
      };
    }
    return { gear: g, status: 'dead', log: [`公式ストア取得失敗(${s.reason || 'unknown'})かつ画像不通`] };
  }

  // 2. 楽天以外の外部提携サイト（RUNPLUS等）：HTTP 200と画像生存を確認（特価枠には入れない）
  if (!g.dealUrl?.includes('item.rakuten.co.jp')) {
    const res = await fetchRetry(g.dealUrl);
    const pageOk = Boolean(res && res.status === 200);
    const imgOk = await imageIsAlive(g.imageUrl);
    if (!pageOk && !imgOk) {
      return { gear: g, status: 'dead', log: [`外部ページ不通(${res ? 'HTTP ' + res.status : 'timeout'})かつ画像不通`] };
    }
    return {
      gear: {
        ...g,
        discountRate: 0,
        originalPrice: g.price || g.originalPrice || 0,
        priceVerifiedAt: pageOk ? nowIso : (g.priceVerifiedAt || nowIso),
        _verifiedToday: pageOk,
      },
      status: 'ok',
      verifiedToday: pageOk,
      log: [pageOk ? `提携ショップHTTP 200確認済み(画像${imgOk ? 'OK' : 'NG'})` : '提携ショップ一時不通のため画像確認で維持'],
    };
  }

  // 3. 楽天市場商品（INNER FACT等の提携楽天URLもスキップせず必ずリンク・在庫・売値を実測する）
  const log = [];
  let scraped;
  if (isCI && ciRakutenBlockedCount >= 3) {
    scraped = { ok: false, blocked: true, reason: 'CI環境WAF連続遮断のためAPI照合へ移行' };
  } else {
    scraped = await scrapeItem(g.dealUrl);
    if (scraped.blocked) ciRakutenBlockedCount++;
    else if (scraped.ok) ciRakutenBlockedCount = 0;
  }

  let url = g.dealUrl;
  let replaced = false;

  // 3-A. 商品ページで「売り切れ」が確定した場合 → 必ず在庫あり代替品へ置換、なければ除外
  if (scraped.ok && !scraped.inStock) {
    log.push(`売り切れ検知(${scraped.soldOutReason || 'sold-out'})`);
    const rep = await findReplacement(g, usedUrls);
    if (!rep) {
      return { gear: g, status: 'sold_out', log: [...log, '代替在庫あり商品が見つからず除外'] };
    }
    scraped = rep.scraped;
    url = rep.url;
    usedUrls.add(normU(url));
    replaced = true;
    log.push(`【自己修復】売り切れのため${rep.source}で在庫あり代替品へ置換: ${url}`);
  }

  // 3-B. ページ取得失敗（404消滅 または CI環境WAF遮断）
  if (!scraped.ok) {
    if (scraped.blocked) {
      // CI等でWAF遮断時はまず楽天APIピンポイント照合で在庫と最新価格を実測
      const apiCheck = await verifyItemWithRakutenApi(g.dealUrl, g.dealKeyword || g.title.slice(0, 40));
      if (apiCheck && apiCheck.found) {
        if (!apiCheck.inStock) {
          log.push('楽天API照合で売り切れ確定');
          const rep = await findReplacement(g, usedUrls);
          if (!rep) return { gear: g, status: 'sold_out', log: [...log, '代替在庫あり商品が見つからず除外'] };
          scraped = rep.scraped;
          url = rep.url;
          usedUrls.add(normU(url));
          replaced = true;
          log.push(`【自己修復】${rep.source}で在庫あり代替品へ置換: ${url}`);
        } else if (apiCheck.price > 0) {
          const imgAlive = await imageIsAlive(g.imageUrl);
          if (imgAlive) {
            const price = apiCheck.price;
            const originalPrice = apiCheck.listPrice > price
              ? apiCheck.listPrice
              : (g.originalPrice && g.originalPrice > price ? g.originalPrice : price);
            const discountRate = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
            const dropped = Boolean(g.price && price < g.price);
            const priceChanged = Boolean(g.price !== price || g.discountRate !== discountRate);
            const prevPrice = g.price && g.price !== price ? g.price : g.prevPrice;
            const syncedDesc = syncDescriptionWithPrice(g, price, originalPrice, discountRate);
            return {
              gear: {
                ...g,
                price,
                originalPrice,
                discountRate,
                standardTitle: syncedDesc,
                ...(prevPrice ? { prevPrice } : {}),
                lowest30d: Math.min(g.lowest30d || price, price),
                priceVerifiedAt: nowIso,
                _verifiedToday: true,
              },
              status: 'ok',
              dropped,
              priceChanged,
              verifiedToday: true,
              oldPrice: g.price,
              log: [`楽天API在庫・価格実測(¥${price.toLocaleString()} / ${discountRate}%OFF)`],
            };
          }
        }
      }

      // 楽天APIでも未解決かつWAF遮断時のみ Gemini フォールバック
      if (!scraped.ok && GEMINI_API_KEY && geminiPriceQuota > 0) {
        const gRes = await fetchPriceWithGemini(g);
        if (gRes && gRes.inStock === false) {
          log.push('Gemini検索で売り切れ検知');
          const rep = await findReplacement(g, usedUrls);
          if (!rep) return { gear: g, status: 'sold_out', log: [...log, '代替在庫あり商品が見つからず除外'] };
          scraped = rep.scraped;
          url = rep.url;
          usedUrls.add(normU(url));
          replaced = true;
          log.push(`【自己修復】${rep.source}で代替品を特定: ${url}`);
        } else if (gRes && gRes.price > 0) {
          const imgAlive = await imageIsAlive(g.imageUrl);
          if (imgAlive) {
            const price = gRes.price;
            const originalPrice = gRes.originalPrice > price
              ? gRes.originalPrice
              : (g.originalPrice && g.originalPrice > price ? g.originalPrice : price);
            const discountRate = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
            const dropped = Boolean(g.price && price < g.price);
            const priceChanged = Boolean(g.price !== price || g.discountRate !== discountRate);
            const prevPrice = g.price && g.price !== price ? g.price : g.prevPrice;
            const syncedDesc = syncDescriptionWithPrice(g, price, originalPrice, discountRate);
            return {
              gear: {
                ...g,
                price,
                originalPrice,
                discountRate,
                standardTitle: syncedDesc,
                ...(prevPrice ? { prevPrice } : {}),
                lowest30d: Math.min(g.lowest30d || price, price),
                priceVerifiedAt: nowIso,
                _verifiedToday: true,
              },
              status: 'ok',
              dropped,
              priceChanged,
              verifiedToday: true,
              oldPrice: g.price,
              log: [`Gemini検索で価格実測(¥${price.toLocaleString()} / ${discountRate}%OFF)`],
            };
          }
        }
      }

      // ここまで未解決のWAF遮断：画像生存を確認しても priceVerifiedAt は今日に書き換えない（verifiedToday: false）
      if (!scraped.ok) {
        const imgAlive = await imageIsAlive(g.imageUrl);
        if (imgAlive) {
          return {
            gear: { ...g, priceVerifiedAt: g.priceVerifiedAt || nowIso, _verifiedToday: false },
            status: 'ok',
            verifiedToday: false,
            log: [`WAF遮断(${scraped.reason})のため未検証維持(画像OK・更新日時据置)`],
          };
        }
        log.push(`WAF遮断(${scraped.reason})かつ画像不通`);
      }
    } else {
      log.push(`商品ページ消滅(${scraped.reason})`);
    }

    if (!scraped.ok) {
      const rep = await findReplacement(g, usedUrls);
      if (!rep) {
        if (scraped.blocked) {
          return {
            gear: { ...g, priceVerifiedAt: g.priceVerifiedAt || nowIso, _verifiedToday: false },
            status: 'ok',
            verifiedToday: false,
            log: [...log, '一時障害の可能性があるため既存データを保護(未検証)'],
          };
        }
        return { gear: g, status: 'dead', log };
      }
      scraped = rep.scraped;
      url = rep.url;
      usedUrls.add(normU(url));
      replaced = true;
      log.push(`【自己修復】${rep.source}で代替商品を特定: ${url}`);
    }
  }

  // 4. 画像の死活確認＆自己修復
  let image = '';
  for (const c of scraped.images) { if (await imageIsAlive(c)) { image = c; break; } }
  if (!image && g.imageUrl && await imageIsAlive(g.imageUrl)) {
    image = g.imageUrl;
    log.push('商品ページ画像候補から取得不可のため既存有効画像を維持');
  }
  if (!image) {
    log.push('元ページで画像取得不能');
    const rep = await findReplacement(g, usedUrls);
    if (rep) {
      for (const c of rep.scraped.images) { if (await imageIsAlive(c)) { image = c; break; } }
      if (image) {
        scraped = rep.scraped;
        url = rep.url;
        usedUrls.add(normU(url));
        replaced = true;
        log.push(`【自己修復】${rep.source}で生きた画像付き商品に置換: ${url}`);
      }
    }
  }
  if (!image) return { gear: g, status: 'noimage', log: [...log, '商品画像をどうしても取得できず除外'] };

  // 5. 価格・定価・割引率の厳格実測同期（在庫あり最安SKUの実売価格のみ採用）
  const price = scraped.price;
  if (!price || price <= 0) {
    return { gear: g, status: 'dead', log: [...log, '有効な販売価格を取得できず除外'] };
  }
  let originalPrice = scraped.listPrice > price ? scraped.listPrice : price;
  if (price > originalPrice) originalPrice = price;
  const discountRate = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;
  const prevPrice = g.price && g.price !== price ? g.price : g.prevPrice;
  const lowest30d = Math.min(g.lowest30d || price, price);
  const dropped = Boolean(!replaced && g.price && price < g.price);
  const priceChanged = Boolean(!replaced && (g.price !== price || g.discountRate !== discountRate));

  // 品質ガード: 提携固定枠および小物カテゴリを除き、3,000円以下の安価品は除外
  if (!isFixedPartner && !meetsQualityPrice(g.gearType, price)) {
    return { gear: g, status: 'low_quality', log: [`品質価格基準(¥${MIN_GEAR_PRICE.toLocaleString()}以上)未満のため除外: ¥${price.toLocaleString()}`] };
  }

  const nextTitle = replaced && scraped.title ? scraped.title : g.title;
  const syncedDesc = syncDescriptionWithPrice(g, price, originalPrice, discountRate);

  const next = {
    ...g,
    title: nextTitle,
    dealUrl: url,
    standardUrl: isFixedPartner ? g.standardUrl : url,
    imageUrl: image,
    price,
    originalPrice,
    discountRate,
    standardTitle: syncedDesc,
    ...(prevPrice ? { prevPrice } : {}),
    lowest30d,
    priceVerifiedAt: nowIso,
    _verifiedToday: true,
  };
  if (priceChanged) {
    log.push(`価格実測更新: ¥${(g.price || 0).toLocaleString()}(${g.discountRate || 0}%OFF) → ¥${price.toLocaleString()}(${discountRate}%OFF)`);
  }
  return { gear: next, status: 'ok', dropped, priceChanged, verifiedToday: true, oldPrice: g.price, log };
}

function stripTag(s) { return (s || '').replace(/^【[^】]*(?:最安|OFF|目玉)[^】]*】\s*/g, ''); }

// 毎朝の新規特価品ディスカバリー用ターゲットリスト（シューズ・ウェア・ザック・ライト・サイクル・補給食・読図）
const DISCOVERY_TARGETS = [
  { keyword: 'サロモン トレランシューズ セール', category: 'トレランシューズ', sports: ['trail', 'marathon'], brand: 'SALOMON' },
  { keyword: 'HOKA スピードゴート セール', category: 'トレランシューズ', sports: ['trail'], brand: 'HOKA' },
  { keyword: 'アシックス ランニングシューズ セール', category: 'ランニングシューズ', sports: ['marathon'], brand: 'ASICS' },
  { keyword: 'ホカ ランニングシューズ 特価', category: 'ランニングシューズ', sports: ['marathon'], brand: 'HOKA' },
  { keyword: 'サロモン トレランザック 特価', category: 'トレランザック', sports: ['trail', 'marathon'], brand: 'SALOMON' },
  { keyword: 'ネイサン ランニングベスト セール', category: 'トレランザック', sports: ['trail'], brand: 'NATHAN' },
  { keyword: 'ペツル アクティックコア 充電式 ヘッドライト セール', category: 'ヘッドライト', sports: ['trail', 'adventure'], brand: 'PETZL' },
  { keyword: 'レッドレンザー 充電式 ヘッドライト 高照度 特価', category: 'ヘッドライト', sports: ['trail', 'adventure'], brand: 'LEDLENSER' },
  { keyword: 'C3fit タイツ セール', category: 'サポートタイツ', sports: ['trail', 'marathon', 'cycling'], brand: 'C3fit' },
  { keyword: 'CW-X ジェネレーター セール', category: 'サポートタイツ', sports: ['trail', 'marathon'], brand: 'CW-X' },
  { keyword: 'ノースフェイス ランニングウェア セール', category: 'ランニングウェア', sports: ['trail', 'marathon'], brand: 'THE NORTH FACE' },
  { keyword: 'パタゴニア ランニング ウェア セール', category: 'ランニングウェア', sports: ['trail', 'marathon'], brand: 'Patagonia' },
  { keyword: 'LEKI トレラン ポール 特価', category: 'トレッキングポール', sports: ['trail'], brand: 'LEKI' },
  { keyword: 'ブラックダイヤモンド ディスタンス セール', category: 'トレッキングポール', sports: ['trail'], brand: 'Black Diamond' },
  { keyword: 'ミレー レインウェア 特価', category: 'レインウェア', sports: ['trail', 'adventure'], brand: 'MILLET' },
  { keyword: 'ノースフェイス レインジャケット セール', category: 'レインウェア', sports: ['trail', 'adventure'], brand: 'THE NORTH FACE' },
  { keyword: 'パールイズミ サイクルウェア セール', category: 'サイクル用品', sports: ['cycling'], brand: 'PEARL iZUMi' },
  { keyword: 'キャットアイ VOLT400 AMPP500 充電式 ライト セール', category: 'サイクル用品', sports: ['cycling'], brand: 'CATEYE' },
  { keyword: 'OGK カブト FM-X ヘルメット MTB セール', category: 'サイクル用品', sports: ['cycling'], brand: 'OGK KABUTO' },
  { keyword: 'ブラックダイヤモンド ヘルメット 登山 セール', category: 'サイクル用品', sports: ['adventure', 'trail'], brand: 'Black Diamond' },
  { keyword: 'マグオン ジェル セール', category: '補給食・エナジージェル', sports: ['trail', 'marathon', 'cycling'], brand: 'Mag-on' },
  { keyword: 'ミレー ドライナミック メッシュ セール', category: 'アンダーウェア', sports: ['trail', 'marathon', 'cycling'], brand: 'MILLET' },
  { keyword: 'シルバ コンパス 読図', category: '読図・コンパス・マップ', sports: ['adventure', 'trail'], brand: 'SILVA' },
];

const CATEGORY_RULES = {
  'トレランシューズ': { must: /シューズ|靴|トレイル|ランニング|スピードゴート|speedgoat|mutant|altra|salomon/i, ban: /靴下|ソックス|インソール|ポール|ザック|ベスト|ライト|ジュニア|キッズ|子供|子ども|junior|kids/i },
  'トレランザック': { must: /ザック|ベスト|バックパック|リュック|skin|スキン|ピナクル/i, ban: /ポール|ストック|シューズ|ライト|タイツ/i },
  'トレッキングポール': { must: /ポール|ストック|zポール|carbon|distance.*(?:z|carbon)/i, ban: /ザック|リュック|バックパック|バッグ|15|ベスト|シューズ/i },
  'ヘッドライト': { must: /ヘッドライト|ライト|ランタン|アクティック|スイフト|スポット|led/i, ban: /電池のみ|ケースのみ|ベルトのみ|バンドのみ|乾電池専用|単3/i },
  'サポートタイツ': { must: /タイツ|レギンス|スパッツ|ジェネレーター|エキスパート|c3fit|cw-x/i, ban: /シャツ|ジャケット|靴下|ソックス|パンツのみ|ショーツ|ジュニア|キッズ/i },
  'レインウェア': { must: /レイン|ジャケット|シェル|防水|ゴアテックス|ティフォン|タンペート/i, ban: /パンツ|ズボン|シューズ|ザック|グローブ|ジュニア|キッズ/i },
  'ランニングシューズ': { must: /シューズ|靴|ランニング|マラソン|ゲル|ノヴァ|クリフトン|ボンダイ/i, ban: /靴下|ソックス|インソール|ポール|ザック|ジュニア|キッズ|子供|子ども|junior|kids/i },
  'ランニングウェア': { must: /シャツ|tシャツ|フーディ|ジャケット|ベスト|ショーツ|パンツ|ウェア/i, ban: /シューズ|靴|ザック|ライト|ソックス|ジュニア|キッズ|子供|子ども|junior|kids/i },
  'アンダーウェア': { must: /メッシュ|ドライ|インナー|ベースレイヤー|アンダー|クルー|パンツ|シャツ/i, ban: /シューズ|靴|ザック|ライト|ヘルメット|ポール/i },
  'サイクル用品': { must: /サイクル|ジャージ|ジャケット|ウィンドブレーカー|ビブ|タイツ|スパッツ|ヘルメット|ライト|ボトル|ツール/i, ban: /タイヤチューブのみ|パッチのみ|バイク用品|バイク\s*ウェア|バイク\s*用|バイクパンツ|オートバイ|原付|二輪|プロテクター|ライディング|ツーリングパンツ|デニム|ジーンズ|街乗り|通勤|通学|一般用|バイザーのみ|パッドセット|インナーパッド|air-helmet/i },
  '補給食・エナジージェル': { must: /ジェル|補給|マグオン|アミノ|メダリスト|エナジー/i, ban: /ボトル|ポーチ|ザック/i },
  '防水スタッフバッグ': { must: /ドライバッグ|ドライサック|スタッフバッグ|防水バッグ/i, ban: /サコッシュ|ビーチ|海水浴|プール|スマホ|ショルダー|肩掛け/i },
  '読図・コンパス・マップ': { must: /コンパス|方位磁針|方位磁石|マップケース|防水ケース|silva|suunto/i, ban: /時計|ウォッチ|腕時計|シューズ|ザック|ウェア|ジャケット/i },
};

function isCategoryMatch(category, title, brand = '') {
  const rule = CATEGORY_RULES[category];
  if (!rule) return true;
  if (rule.ban && rule.ban.test(title)) return false;
  if (rule.must && !rule.must.test(title)) return false;
  const brandKey = normalizeBrandKey(brand);
  if (brandKey && BRAND_PATTERNS[brandKey] && !BRAND_PATTERNS[brandKey].test(title.normalize('NFKC'))) return false;
  return true;
}

function normGearKey(title) {
  return (title || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龥]/g, '').slice(0, 16);
}

/** メーカー公式Webshop（Ledlenser等 Shopifyセール特集）の自動探索＆登録 */
async function discoverOfficialStoreSales(gears, existingUrls, existingKeys) {
  let added = 0;
  const normUrl = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  try {
    await sleep(2000);
    const topRes = await fetchRetry('https://ledlenser.co.jp/', {}, 1);
    if (!topRes || !topRes.ok) return 0;
    const topHtml = await topRes.text();
    const specialPaths = [...new Set([...topHtml.matchAll(/href=["'](\/blogs\/special\/[a-zA-Z0-9_-]+)["']/g)].map((m) => m[1]))];
    const prodHandles = new Set([...topHtml.matchAll(/href=["'](\/products\/(?:hf|h8r|mh|seo|neo)[a-zA-Z0-9_-]+)["']/gi)].map((m) => m[1]));

    for (const sp of specialPaths.slice(0, 1)) {
      await sleep(2000);
      const spRes = await fetchRetry(`https://ledlenser.co.jp${sp}`, {}, 1);
      if (!spRes || !spRes.ok) continue;
      const spHtml = await spRes.text();
      for (const m of spHtml.matchAll(/(\/products\/[a-zA-Z0-9_-]+)/g)) {
        prodHandles.add(m[1]);
      }
    }

    // HF Signature等のヘッドランプ系を優先チェック
    const sortedHandles = [...prodHandles].sort((a, b) => {
      const score = (x) => (/hf\d+r-signature/i.test(x) ? 0 : /h8r|hf/i.test(x) ? 1 : 2);
      return score(a) - score(b);
    });

    let checked = 0;
    for (const path of sortedHandles) {
      if (checked >= 4) break;
      const fullUrl = normUrl(`https://ledlenser.co.jp${path}`);
      if (existingUrls.has(fullUrl)) continue;
      checked++;
      const s = await scrapeShopifyProduct(fullUrl);
      if (!s.ok || !s.inStock || s.price < MIN_GEAR_PRICE) continue;
      const discountRate = s.listPrice > s.price ? Math.round((1 - s.price / s.listPrice) * 100) : 0;
      if (discountRate < DEAL_THRESHOLD) continue;
      // ヘッドランプ系のみ採用（タクティカルライト・懐中電灯・ランタン等は除外）
      if (!/hf|h8r|mh|neo|ヘッド|ヘッドランプ/i.test(s.title) || /タクティカル|ハンドライト|懐中電灯/i.test(s.title)) continue;

      let validImg = '';
      for (const im of s.images) {
        if (await imageIsAlive(im)) { validImg = im; break; }
      }
      if (!validImg) continue;

      const nKey = normGearKey(s.title);
      if (nKey.length >= 6 && existingKeys.has(nKey)) continue;

      const slug = path.replace('/products/', '').replace(/[^a-zA-Z0-9_-]/g, '');
      const savedAmount = s.listPrice - s.price;
      const newGear = {
        id: `gear-ledlenser-${slug}`,
        sports: ['trail', 'adventure'],
        gearType: 'ヘッドライト',
        matchKeywords: ['LEDLENSER', 'レッドレンザー', 'ヘッドライト', 'セール', 'Black Friday'],
        title: `LEDLENSER ${s.title}`,
        brand: 'LEDLENSER',
        standardTitle: `【公式Webshopセール】定価より${discountRate}%OFF（¥${savedAmount.toLocaleString()}引き）。レッドレンザー公式限定特価モデル。`,
        standardUrl: fullUrl,
        officialUrl: fullUrl,
        shopName: 'LEDLENSER 公式Webshop',
        officialSaleSource: 'shopify',
        dealKeyword: 'レッドレンザー ヘッドライト セール',
        price: s.price,
        originalPrice: s.listPrice,
        discountRate,
        pointRate: 0,
        dealUrl: fullUrl,
        imageUrl: validImg,
        badge: `🔥 ${discountRate}%OFF 公式セール`,
        isBestDeal: false,
        priceVerifiedAt: new Date().toISOString(),
        isNewDiscovery: true,
        _verifiedToday: true,
      };
      console.log(` ➕ 公式セール発掘: [ヘッドライト] ${newGear.title.slice(0, 35)} (${discountRate}%OFF ¥${s.price.toLocaleString()})`);
      gears.push(newGear);
      existingUrls.add(fullUrl);
      existingKeys.add(nKey);
      added++;
      if (added >= 4) break;
    }
  } catch { /* ignore */ }
  return added;
}

/** 毎朝の新規特価品自動探索 ＆ ローテーション入れ替えエンジン */
async function discoverAndRotateDeals(currentGears) {
  console.log('\n🔍 [毎朝自動実行] 全ジャンルの新着・在庫あり特価品を探索＆入れ替えします...');
  const gears = [...currentGears];
  const normUrl = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  const existingUrls = new Set(gears.map((g) => normUrl(g.dealUrl)));
  const existingKeys = new Set(gears.map((g) => normGearKey(g.title)));
  let addedCount = 0;
  let replacedCount = 0;
  let consecutiveBlocked = 0;
  let geminiCalls = 0;
  const perCategoryOps = new Map(); // カテゴリあたり1日最大2品まで新規採用・ローテーション入替

  // 0. メーカー公式Webshop（Ledlenser Black Friday 等）のセール自動探索
  addedCount += await discoverOfficialStoreSales(gears, existingUrls, existingKeys);

  // 日替わりで探索ターゲットの順番をローテーション（毎日違う順番で全ターゲット巡回）
  const daySeed = Math.floor(Date.now() / 86400000) % DISCOVERY_TARGETS.length;
  const rotatedTargets = [...DISCOVERY_TARGETS.slice(daySeed), ...DISCOVERY_TARGETS.slice(0, daySeed)];

  for (const target of rotatedTargets) {
    const catOps = perCategoryOps.get(target.category) || 0;
    if (catOps >= 2) continue;

    const canUseGemini = Boolean(GEMINI_API_KEY && !geminiQuotaExhausted && geminiCalls < 8);
    if (consecutiveBlocked >= 6 && !canUseGemini) {
      console.log(' ⏭️ 楽天スクレイピングが連続制限中かつGemini枠上限のため、新規ディスカバリーを早期完了します。');
      break;
    }
    try {
      let candUrls = [];
      const apiItemMap = new Map();
      const geminiItemMap = new Map();

      if (!(isCI && ciRakutenBlockedCount >= 3)) {
        const directUrls = await searchRakutenDirect(target.keyword);
        candUrls.push(...directUrls.map((u) => normUrl(u)));
      }
      if (RAKUTEN_APP_ID && RAKUTEN_ACCESS_KEY) {
        const minApiPrice = SMALL_EXEMPT_CATEGORIES.has(target.category) ? 1000 : MIN_GEAR_PRICE;
        const apiItems = await searchRakutenApiItems(target.keyword, minApiPrice);
        for (const it of apiItems) {
          if (it.itemUrl && it.itemUrl.includes('item.rakuten.co.jp')) {
            const u = normUrl(it.itemUrl);
            candUrls.push(u);
            apiItemMap.set(u, it);
          }
        }
      }
      if (canUseGemini) {
        geminiCalls++;
        const gItems = await discoverDealsWithGemini(target);
        for (const gi of gItems) {
          candUrls.push(gi.url);
          geminiItemMap.set(gi.url, gi);
        }
      }

      candUrls = [...new Set(candUrls)];
      if (candUrls.length === 0) {
        if (!(isCI && ciRakutenBlockedCount >= 3)) consecutiveBlocked++;
        continue;
      }
      consecutiveBlocked = 0;

      for (const u of candUrls.slice(0, 3)) {
        const cleanU = normUrl(u);
        if (existingUrls.has(cleanU)) continue;

        let s = (isCI && ciRakutenBlockedCount >= 3)
          ? { ok: false, blocked: true, reason: 'CI WAF保護のためスキップ' }
          : await scrapeItem(cleanU);
        if (s.blocked && isCI) ciRakutenBlockedCount++;

        // 売り切れ商品は新規採用しない
        if (s.ok && !s.inStock) continue;

        if (!s.ok) {
          if (s.blocked) {
            const apiIt = apiItemMap.get(cleanU);
            const gIt = geminiItemMap.get(cleanU);
            if (apiIt && apiIt.itemPrice > 0) {
              const rawImgs = (apiIt.mediumImageUrls || apiIt.smallImageUrls || []).map((x) => cleanImage(typeof x === 'string' ? x : x?.imageUrl)).filter(Boolean);
              const apiTitle = cleanTitleText(apiIt.itemName || '');
              // タイトルからのXX%OFF逆算は禁止。キャプション明示定価またはGeminiのみ
              let listPrice = extractListPriceFromCaption(apiIt.itemCaption, Number(apiIt.itemPrice));
              if (!listPrice && GEMINI_API_KEY && !geminiQuotaExhausted && geminiPriceQuota > 0) {
                const gRes = await fetchPriceWithGemini({ title: apiTitle, dealUrl: cleanU, price: Number(apiIt.itemPrice) });
                if (gRes && gRes.inStock !== false && gRes.originalPrice > Number(apiIt.itemPrice)) listPrice = gRes.originalPrice;
              }
              s = { ok: true, inStock: true, title: apiTitle, price: Number(apiIt.itemPrice), listPrice, images: rawImgs };
            } else if (gIt && gIt.price > 0 && gIt.title && gIt.imageUrl) {
              s = {
                ok: true,
                inStock: true,
                title: cleanTitleText(gIt.title),
                price: gIt.price,
                listPrice: gIt.originalPrice > gIt.price ? gIt.originalPrice : 0,
                images: [gIt.imageUrl],
              };
            } else {
              consecutiveBlocked++;
              continue;
            }
          } else {
            continue;
          }
        }

        if (!s.inStock || !s.price || !meetsQualityPrice(target.category, s.price)) continue;
        if (!isCategoryMatch(target.category, s.title, target.brand)) continue;
        const nKey = normGearKey(s.title);
        if (nKey.length >= 6 && existingKeys.has(nKey)) continue;

        const listPrice = s.listPrice || 0;
        const discountRate = listPrice > s.price ? Math.round((1 - s.price / listPrice) * 100) : 0;

        // 実測公式定価からの割引率20%以上の在庫あり目玉特価品のみを採用
        if (discountRate < DEAL_THRESHOLD) continue;

        let validImg = '';
        for (const im of s.images) {
          if (await imageIsAlive(im)) {
            validImg = im;
            break;
          }
        }
        if (!validImg) continue;

        const newId = `gear-deal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const savedAmount = listPrice - s.price;
        const newGear = {
          id: newId,
          sports: target.sports,
          gearType: target.category,
          matchKeywords: [target.brand, target.category, 'セール', '特価', '目玉'],
          title: s.title,
          brand: target.brand,
          standardTitle: `【最新セール発掘】定価より${discountRate}%OFF（¥${savedAmount.toLocaleString()}引き）。楽天市場の本日更新目玉特価品。`,
          standardUrl: cleanU,
          dealKeyword: target.keyword,
          price: s.price,
          originalPrice: listPrice,
          discountRate: discountRate,
          pointRate: 10,
          dealUrl: cleanU,
          imageUrl: validImg,
          badge: `🔥 ${discountRate}%OFF 最安特価`,
          isBestDeal: false,
          priceVerifiedAt: new Date().toISOString(),
          isNewDiscovery: true,
          _verifiedToday: true,
        };

        // カテゴリ内の入れ替え対象を探す（提携公式枠 INNER FACT / RUNPLUS や必須ライト枠、カテゴリ最安目玉品は保護）
        const categoryGears = gears.filter(
          (g) => g.gearType === target.category && !g.officialUrl && !g.shopName && !g.id.startsWith('gear-innerfact-') && !g.id.startsWith('gear-runplus-') && !g.id.startsWith('gear-cycle-light-')
        );

        // 割引率が最も低い、または登録が古いアイテムを優先的にローテーション入替
        const replaceable = categoryGears
          .filter((g) => !g.isBestDeal)
          .sort((a, b) => a.discountRate - b.discountRate || (a.priceVerifiedAt || '').localeCompare(b.priceVerifiedAt || ''));
        const swapTarget = replaceable[0] || categoryGears.sort((a, b) => a.discountRate - b.discountRate || a.price - b.price)[0];

        if (categoryGears.length >= 6 && swapTarget) {
          const removeIdx = gears.findIndex((g) => g.id === swapTarget.id);
          if (removeIdx >= 0) {
            console.log(` 🔄 入替: [${target.category}] ${swapTarget.title.slice(0, 25)} (${swapTarget.discountRate}%OFF) → ${newGear.title.slice(0, 25)} (${discountRate}%OFF)`);
            gears.splice(removeIdx, 1, newGear);
            existingUrls.add(cleanU);
            existingKeys.add(nKey);
            replacedCount++;
            perCategoryOps.set(target.category, catOps + 1);
            break;
          }
        } else if (swapTarget && swapTarget.discountRate <= discountRate && categoryGears.length >= 4) {
          const removeIdx = gears.findIndex((g) => g.id === swapTarget.id);
          if (removeIdx >= 0) {
            console.log(` 🔄 入替: [${target.category}] ${swapTarget.title.slice(0, 25)} (${swapTarget.discountRate}%OFF) → ${newGear.title.slice(0, 25)} (${discountRate}%OFF)`);
            gears.splice(removeIdx, 1, newGear);
            existingUrls.add(cleanU);
            existingKeys.add(nKey);
            replacedCount++;
            perCategoryOps.set(target.category, catOps + 1);
            break;
          }
        } else if (categoryGears.length < 6) {
          console.log(` ➕ 新規追加: [${target.category}] ${newGear.title.slice(0, 30)} (${discountRate}%OFF)`);
          gears.push(newGear);
          existingUrls.add(cleanU);
          existingKeys.add(nKey);
          addedCount++;
          perCategoryOps.set(target.category, catOps + 1);
          break;
        }
      }
    } catch {
      // 1ターゲットのエラーで全体を止めない
    }
  }

  console.log(`✨ 新規特価品ディスカバリー完了: ${addedCount} 品追加, ${replacedCount} 品ローテーション入替`);
  return { gears, addedCount, replacedCount, discoveredTitles: gears.filter((g) => g.isNewDiscovery).map((g) => ({ id: g.id, title: g.title, discountRate: g.discountRate })) };
}

async function main() {
  const gears = JSON.parse(fs.readFileSync(GEARS_PATH, 'utf-8'));
  const normU = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  const usedUrls = new Set(gears.map((g) => normU(g.dealUrl)).filter(Boolean));
  console.log(`対象 ${gears.length} 品を実機検証＆自己修復します（リンク・在庫・実売価格・公式定価・画像）`);
  const results = await pool(gears, 4, async (g) => {
    const r = await refreshOne(g, usedUrls);
    if (r.status === 'ok' && r.gear?.dealUrl) usedUrls.add(normU(r.gear.dealUrl));
    console.log(`${r.status === 'ok' ? '✅' : '❌'} ${g.id} ${r.log.join(' / ')}`);
    return r;
  });

  // 置換等によるURL重複を排除（先着・高割引を優先）
  const seenDealUrls = new Set();
  const aliveBasic = [];
  for (const r of results) {
    if (r.status !== 'ok') continue;
    const nu = normU(r.gear.dealUrl);
    if (nu && seenDealUrls.has(nu)) {
      console.log(` 🧹 URL重複除外: ${r.gear.id} (${nu})`);
      continue;
    }
    if (nu) seenDealUrls.add(nu);
    aliveBasic.push(r.gear);
  }
  const priceDrops = results.filter((r) => r.status === 'ok' && r.dropped);
  const priceUpdatedCount = results.filter((r) => r.status === 'ok' && r.priceChanged).length;
  const verifiedTodayCount = results.filter((r) => r.status === 'ok' && r.verifiedToday).length;
  const unverifiedWafCount = results.filter((r) => r.status === 'ok' && !r.verifiedToday).length;
  const soldOutRemovedCount = results.filter((r) => r.status === 'sold_out').length;
  const removed = results.filter((r) => r.status !== 'ok').map((r) => ({ id: r.gear.id, status: r.status, reason: r.log.join(' / ') }));

  // ★【毎朝自動実行】新着・在庫あり特価商品の自動探索＆ローテーション入れ替え★
  const disc = await discoverAndRotateDeals(aliveBasic);
  const alive = disc.gears;

  // カテゴリごとに isBestDeal を再計算（最大割引。同率は安い方）
  const byType = new Map();
  for (const g of alive) { g.isBestDeal = false; (byType.get(g.gearType) || byType.set(g.gearType, []).get(g.gearType)).push(g); }
  const origTypes = new Set(gears.map((g) => g.gearType));
  const problems = [];
  for (const [type, list] of byType) {
    if (origTypes.has(type) && list.length < MIN_PER_CATEGORY) problems.push(`${type}: ${list.length}品（最低${MIN_PER_CATEGORY}品必要）`);
    const best = [...list].sort((a, b) => b.discountRate - a.discountRate || a.price - b.price)[0];
    if (best && best.discountRate > 0) best.isBestDeal = true;
  }
  for (const t of origTypes) if (!byType.has(t)) problems.push(`${t}: 0品`);

  for (const g of alive) {
    const syncedBody = syncDescriptionWithPrice(g, g.price, g.originalPrice, g.discountRate);
    g.standardTitle = g.isBestDeal ? `【カテゴリ最安${g.discountRate}%OFF】${syncedBody}` : syncedBody;
    g.badge = g.isBestDeal ? `🔥 ${g.discountRate}%OFF 最安特価` : g.discountRate >= 15 ? `${g.discountRate}%OFF 特価` : '定番おすすめ';
  }

  // 厳格検証（提携プロショップ品は独自URLを許容）
  const bad = alive.filter((g) => !g.imageUrl || (!g.officialUrl && !g.shopName && !/item\.rakuten\.co\.jp/.test(g.dealUrl)) || g.price <= 0);
  if (bad.length) problems.push(`不正データ ${bad.length} 件`);
  if (problems.length) {
    console.error('❌ 検証失敗のため更新を中止します（サイトは前回の正常状態を維持）:\n - ' + problems.join('\n - '));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const staleLimitMs = 72 * 60 * 60 * 1000;
  let oldDeals = [];
  try { oldDeals = JSON.parse(fs.readFileSync(DEALS_PATH, 'utf-8')); } catch { /* none */ }
  const registeredAt = new Map(oldDeals.map((d) => [d.gear_id || d.id, d.registered_at]));

  const deals = alive
    .filter((g) => {
      if (!(g.discountRate >= DEAL_THRESHOLD && g.price > 0 && g.originalPrice > g.price)) return false;
      // 72時間以上未検証（WAF遮断等で実測確認できていない）古い特価品は特価枠から除外
      if (g._verifiedToday === false && g.priceVerifiedAt) {
        const ageMs = Date.now() - new Date(g.priceVerifiedAt).getTime();
        if (!Number.isNaN(ageMs) && ageMs > staleLimitMs) return false;
      }
      return true;
    })
    .map((g) => ({
      id: `deal-${g.id}`,
      gear_id: g.id,
      title: g.title,
      category: g.gearType,
      price: g.price,
      original_price: g.originalPrice,
      discount_rate: g.discountRate,
      point_rate: g.pointRate || 10,
      image_url: g.imageUrl,
      affiliate_url: g.dealUrl,
      badge: g.badge,
      description: g.standardTitle,
      official_url: g.officialUrl,
      shop_name: g.shopName,
      isBestDeal: Boolean(g.isBestDeal),
      updated_at: g._verifiedToday ? now : (g.priceVerifiedAt || now),
      registered_at: g.isNewDiscovery ? now : (registeredAt.get(g.id) || now),
    }))
    .sort((a, b) => b.discount_rate - a.discount_rate || a.price - b.price);

  alive.forEach((g) => {
    delete g.isNewDiscovery;
    delete g._verifiedToday;
  });
  fs.writeFileSync(GEARS_PATH, JSON.stringify(alive, null, 2) + '\n');
  fs.writeFileSync(DEALS_PATH, JSON.stringify(deals, null, 2) + '\n');

  const { date, time } = nowJstParts();
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { /* new */ }
  const prevSummary = (meta.run_summary && meta.run_summary.updated_date === date) ? meta.run_summary : {};
  const gearChanges = [
    ...disc.discoveredTitles.slice(0, 6).map((d) => `追加/入替: ${d.title.slice(0, 32)} (${d.discountRate}%OFF)`),
    ...priceDrops.slice(0, 4).map((p) => `値下げ: ${p.gear.title.slice(0, 28)} (¥${(p.oldPrice || 0).toLocaleString()}→¥${p.gear.price.toLocaleString()})`),
  ];
  Object.assign(meta, {
    last_updated_at: now,
    deals_count: deals.length,
    gears_count: alive.length,
    gear_sync_source: 'refresh_gears.mjs (自己修復・在庫/実売価格実測・公式定価厳格照合・画像HTTP200検証済)',
    gear_removed: removed,
    run_summary: {
      ...prevSummary,
      updated_date: date,
      updated_time: time,
      deals_added: disc.addedCount + disc.replacedCount,
      price_drops: priceDrops.length,
      gears_checked: gears.length,
      gears_verified_today: verifiedTodayCount,
      gears_sold_out_removed: soldOutRemovedCount,
      gears_price_updated: priceUpdatedCount,
      gears_unverified_waf: unverifiedWafCount,
      gear_changes: gearChanges,
    },
  });
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');

  const cLogs = [];
  for (const d of disc.discoveredTitles.slice(0, 3)) {
    cLogs.push({
      id: `deal-add-${d.id}-${date}`, date, time, type: 'deal_added',
      title: `新着特価ギア発掘: ${d.title.slice(0, 40)}`,
      detail: `実測 ${d.discountRate}%OFF の特価品を追加・入替しました`, gearId: d.id,
    });
  }
  for (const p of priceDrops.slice(0, 3)) {
    cLogs.push({
      id: `price-drop-${p.gear.id}-${date}`, date, time, type: 'price_drop',
      title: `値下げ検知: ${p.gear.title.slice(0, 40)}`,
      detail: `¥${(p.oldPrice || 0).toLocaleString()} → ¥${p.gear.price.toLocaleString()}`, gearId: p.gear.id,
    });
  }
  appendChangelog(cLogs);
  console.log(`\n🎉 完了: 掲載 ${alive.length} 品 / 特価(${DEAL_THRESHOLD}%以上) ${deals.length} 品 / 本日実測 ${verifiedTodayCount} 品 / 価格更新 ${priceUpdatedCount} 品 / 除外 ${removed.length} 品`);
  for (const r of removed) console.log(` 除外: ${r.id} [${r.status}] ${r.reason}`);
}

// CLI直接実行時
if (process.argv[1]?.endsWith('refresh_gears.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
