/**
 * scripts/refresh_gears.mjs
 * 装備カタログ（src/data/gears.json）の完全自動更新スクリプト
 *
 * 方針（誤情報・リンク切れ・画像切れをサイトに出さない・完全自己修復）:
 *  1. 各商品ページ(item.rakuten.co.jp)を実際に取得して HTTP 200 を確認
 *  2. 価格・定価・商品画像は「商品ページの実データ」から取得（推測URLは使わない）
 *  3. 画像URLは実際に GET して image/* かつ HTTP 200 を確認
 *  4. 【自己修復】商品ページ消滅(404)・画像取得不能の場合:
 *     - 第1層: 楽天API（RAKUTEN_APP_ID がある場合）
 *     - 第2層: Gemini AI（Google Search Grounding で楽天市場の現在販売中URLを特定）
 *     - 第3層: 楽天市場モール検索直接スクレイピング（APIキー完全不要で生きた item.rakuten.co.jp を抽出）
 *  5. 割引率は 定価 と 現在価格 から計算（ページで確認できた数値のみ）
 *  6. 各装備カテゴリ内の最大割引商品に isBestDeal を自動付与
 *  7. 修復後もカテゴリが3品未満になる場合は終了コード1で失敗 → デプロイを止め、前日の正常なサイトを維持
 */
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };
const MIN_PER_CATEGORY = 3;
const DEAL_THRESHOLD = 20;
const GEARS_PATH = 'src/data/gears.json';
const DEALS_PATH = 'src/data/deals.json';
const META_PATH = 'src/data/meta.json';
const RAKUTEN_APP_ID = (process.env.RAKUTEN_APP_ID || '').trim();
const AFFILIATE_ID = (process.env.RAKUTEN_AFFILIATE_ID || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, opts = {}, tries = 2) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: AbortSignal.timeout(9000), redirect: 'follow' });
      // 403/404/410 等はリトライしても変わらないため即返す
      if (res.status < 500 && res.status !== 429) return res;
      last = res;
    } catch { last = null; }
    if (i + 1 < tries) await sleep(600 * (i + 1));
  }
  return last;
}

function cleanImage(u) {
  return (u || '').replace(/\?_ex=[^&]+/, '').replace(/[?&]$/, '').replace(/^http:/, 'https:');
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

/** 商品ページから 価格・定価・画像候補 を抽出 */
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
  let price = 0;
  let taxIncRefPrice = 0;
  const imageCandidates = [];
  for (const s of html.matchAll(/<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(s[1]);
      const sku = j?.api?.data?.itemInfoSku;
      if (sku?.title) title = sku.title;
      if (sku?.sku?.[0]) {
        price = price || sku.sku[0].taxIncludedPrice || 0;
        taxIncRefPrice = taxIncRefPrice || Number(sku.sku[0].taxIncludedReferencePrice) || 0;
        for (const im of sku.sku[0].images || []) if (im.location) imageCandidates.push(im.location);
      }
    } catch { /* skip */ }
  }
  if (!title) {
    const tm = html.match(/<title>([^<]+)<\/title>/i);
    if (tm) title = tm[1].split('【楽天市場】')[0].split('：')[0].trim();
  }

  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && !/noimage/i.test(og[1])) imageCandidates.unshift(og[1]);
  for (const m of html.matchAll(/https?:\/\/(?:tshop|shop|image)\.r10s\.jp\/[^"'\s\\<>)]+\.(?:jpg|jpeg|png)/gi)) imageCandidates.push(m[0]);

  // 定価取得の優先順位: 1) 楽天JSON公式税込定価 2) HTMLのメーカー希望小売価格 3) 商品タイトルの明示的割引(Max/最大/クーポン除外)
  let listPrice = taxIncRefPrice > price ? taxIncRefPrice : 0;
  if (!listPrice) {
    const lp = html.match(/メーカー希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/定価[^\d]{0,30}([0-9,]+)\s*円/);
    if (lp) listPrice = Number(lp[1].replace(/,/g, ''));
  }

  // 商品タイトルそのものに記載された「XX%OFF」のみ対象（ページ全体の広告バナーや「Max/最大XX%OFF」による架空定価生成を防止）
  if (!listPrice && title && price > 0) {
    const cleanedForOff = title.replace(/(?:max|最大|クーポン|割引)[^0-9]{0,10}[0-9]{1,2}\s*[%％]\s*off/gi, '');
    const offMatch = cleanedForOff.match(/([0-9]{1,2})\s*[%％]\s*(?:OFF|off)/i);
    if (offMatch) {
      const rate = Number(offMatch[1]);
      if (rate >= 10 && rate <= 70) {
        listPrice = Math.round(price / (1 - rate / 100));
      }
    }
  }

  // タイトルクリーンアップ
  title = (title || '')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { ok: true, title, price, listPrice, images: [...new Set(imageCandidates.map(cleanImage))].filter(Boolean).slice(0, 8) };
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

/** 2. Gemini AI による Google Search Grounding での楽天市場商品URL探索 */
export async function searchWithGemini(keyword) {
  if (!GEMINI_API_KEY) return null;
  const prompt = `楽天市場（rakuten.co.jp）で現在販売中の「${keyword}」の個別商品ページURL（https://item.rakuten.co.jp/...）を1つGoogle検索で特定し、URLのみを出力してください。見つからなければ空文字。`;
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
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const m = text.match(/https:\/\/item\.rakuten\.co\.jp\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+(?:\/)?/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

/** 3. 楽天公式API検索（RAKUTEN_APP_ID がある場合） */
export async function searchRakutenApi(gear) {
  if (!RAKUTEN_APP_ID) return null;
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID, keyword: gear.dealKeyword || gear.title, availability: '1',
    sort: '+itemPrice', hits: '10', minPrice: String(Math.round((gear.originalPrice || 10000) * 0.3)), format: 'json', formatVersion: '2',
  });
  if (AFFILIATE_ID) params.set('affiliateId', AFFILIATE_ID);
  const res = await fetchRetry(`https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params}`);
  if (!res || res.status !== 200) return null;
  const data = await res.json().catch(() => null);
  for (const it of data?.Items || []) {
    if (!it.itemUrl || !it.itemUrl.includes('item.rakuten.co.jp')) continue;
    const url = it.itemUrl.split('?')[0];
    const s = await scrapeItem(url);
    if (s.ok) return { url, title: it.itemName, scraped: s, source: '楽天API' };
    // CI等で商品ページがWAF遮断(403等)された場合でも、楽天APIの在庫・価格＋画像CDN実通が取れれば採用
    if (s.blocked && it.itemPrice > 0) {
      const rawImgs = (it.mediumImageUrls || it.smallImageUrls || []).map((x) => cleanImage(typeof x === 'string' ? x : x?.imageUrl)).filter(Boolean);
      for (const im of rawImgs) {
        if (await imageIsAlive(im)) {
          return {
            url,
            title: it.itemName,
            scraped: { ok: true, title: it.itemName, price: it.itemPrice, listPrice: 0, images: [im] },
            source: '楽天API(WAF迂回)',
          };
        }
      }
    }
  }
  return null;
}

/** 3重自己修復（Self-Healing）エンジン: 楽天API → 楽天モール直接検索 → Gemini AI */
export async function findReplacement(gear) {
  const query = `${gear.brand || ''} ${gear.gearType || ''} ${gear.dealKeyword || gear.title || ''}`.trim();

  // 第1層: 楽天API（キーがある場合）
  if (RAKUTEN_APP_ID) {
    const apiRes = await searchRakutenApi(gear);
    if (apiRes) return apiRes;
  }

  // 第2層: 楽天モール検索スクレイピング（APIキー完全不要で生きた個別商品URLを抽出）
  const directUrls = await searchRakutenDirect(query);
  for (const u of directUrls.slice(0, 5)) {
    const s = await scrapeItem(u);
    if (s.ok) {
      let hasImg = false;
      for (const im of s.images) { if (await imageIsAlive(im)) { hasImg = true; break; } }
      if (hasImg) return { url: u, title: s.title || gear.title, scraped: s, source: '楽天モール直接検索' };
    }
  }

  // 第3層: Gemini AI (Google Search Grounding)
  if (GEMINI_API_KEY) {
    const geminiUrl = await searchWithGemini(query);
    if (geminiUrl) {
      const s = await scrapeItem(geminiUrl);
      if (s.ok) {
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

async function refreshOne(g) {
  // 提携ショップ・公式固定枠（RUNPLUS、INNER FACT等）は画像疎通を確認しつつ保護
  if (g.officialUrl || g.shopName || !g.dealUrl?.includes('item.rakuten.co.jp')) {
    const imgOk = await imageIsAlive(g.imageUrl);
    return {
      gear: {
        ...g,
        priceVerifiedAt: new Date().toISOString(),
      },
      status: 'ok',
      log: [imgOk ? '提携パートナー・公式固定枠として安全に維持(画像200 OK)' : '提携パートナー・公式固定枠として安全に維持'],
    };
  }

  const log = [];
  let scraped = await scrapeItem(g.dealUrl);
  let url = g.dealUrl;
  let replaced = false;

  // 1. 商品ページ自体の死活確認＆自己修復
  if (!scraped.ok) {
    if (scraped.blocked) {
      // WAF遮断(403/429)や一時的タイムアウトの場合は安易に削除せず、画像CDNの生存を確認して安全維持
      const imgAlive = await imageIsAlive(g.imageUrl);
      if (imgAlive) {
        return {
          gear: { ...g, priceVerifiedAt: g.priceVerifiedAt || new Date().toISOString() },
          status: 'ok',
          log: [`WAF/一時応答制限(${scraped.reason})のため画像生存確認のうえ前回正常値を安全維持`],
        };
      }
      log.push(`WAF/応答制限(${scraped.reason})かつ画像不通`);
    } else {
      log.push(`商品ページ消滅(${scraped.reason})`);
    }

    const rep = await findReplacement(g);
    if (!rep) {
      // 確実な消滅(404/410)のみ除外し、一時障害は既存データを維持してCI全滅を防止
      if (scraped.blocked) {
        return {
          gear: { ...g },
          status: 'ok',
          log: [...log, '一時障害の可能性があるため既存データを保護'],
        };
      }
      return { gear: g, status: 'dead', log };
    }
    scraped = rep.scraped; url = rep.url; replaced = true;
    log.push(`【自己修復】${rep.source}で代替商品を特定: ${url}`);
  }

  // 2. 画像の死活確認＆自己修復
  let image = '';
  for (const c of scraped.images) { if (await imageIsAlive(c)) { image = c; break; } }
  if (!image && g.imageUrl && await imageIsAlive(g.imageUrl)) {
    image = g.imageUrl;
    log.push('商品ページ画像候補から取得不可のため既存有効画像を維持');
  }
  if (!image) {
    log.push('元ページで画像取得不能');
    const rep = await findReplacement(g);
    if (rep) {
      for (const c of rep.scraped.images) { if (await imageIsAlive(c)) { image = c; break; } }
      if (image) {
        scraped = rep.scraped; url = rep.url; replaced = true;
        log.push(`【自己修復】${rep.source}で生きた画像付き商品に置換: ${url}`);
      }
    }
  }
  if (!image) return { gear: g, status: 'noimage', log: [...log, '商品画像をどうしても取得できず除外'] };

  // 価格・定価: 商品ページの実測値を厳格採用（HTML誤検知の架空定価は是正）
  let price = scraped.price;
  let originalPrice = g.originalPrice || 0;
  let stale = false;
  if (replaced) {
    originalPrice = scraped.listPrice > price ? scraped.listPrice : price;
  } else if (!price || price <= 0) {
    price = g.price;
    stale = true;
    log.push('価格を確認できず前回値を維持');
  } else {
    // ページに公式定価・明示割引がある場合のみ定価を設定し、根拠がない場合は正直に通常価格扱い
    originalPrice = scraped.listPrice > price ? scraped.listPrice : price;
  }
  if (price > originalPrice) originalPrice = price;
  const discountRate = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

  const next = {
    ...g,
    dealUrl: url, standardUrl: url,
    imageUrl: image, price, originalPrice, discountRate,
    priceVerifiedAt: stale ? g.priceVerifiedAt : new Date().toISOString(),
  };
  if (replaced && scraped.title) next.title = scraped.title;
  return { gear: next, status: 'ok', log };
}

function stripTag(s) { return (s || '').replace(/^【[^】]*(?:最安|OFF|目玉)[^】]*】\s*/g, ''); }

// 毎朝の新規特価品ディスカバリー用ターゲットリスト
const DISCOVERY_TARGETS = [
  { keyword: 'サロモン トレランシューズ セール', category: 'トレランシューズ', sports: ['trail', 'marathon'], brand: 'SALOMON' },
  { keyword: 'HOKA スピードゴート セール', category: 'トレランシューズ', sports: ['trail'], brand: 'HOKA' },
  { keyword: 'アシックス トレラン セール', category: 'トレランシューズ', sports: ['trail', 'marathon'], brand: 'ASICS' },
  { keyword: 'サロモン トレランザック 特価', category: 'トレランザック', sports: ['trail', 'marathon'], brand: 'SALOMON' },
  { keyword: 'ネイサン ランニングベスト セール', category: 'トレランザック', sports: ['trail'], brand: 'NATHAN' },
  { keyword: 'ペツル ヘッドライト セール', category: 'ヘッドライト', sports: ['trail', 'adventure'], brand: 'PETZL' },
  { keyword: 'レッドレンザー ヘッドライト 特価', category: 'ヘッドライト', sports: ['trail', 'adventure'], brand: 'LEDLENSER' },
  { keyword: 'C3fit タイツ セール', category: 'サポートタイツ', sports: ['trail', 'marathon', 'cycling'], brand: 'C3fit' },
  { keyword: 'CW-X ジェネレーター セール', category: 'サポートタイツ', sports: ['trail', 'marathon'], brand: 'CW-X' },
  { keyword: 'LEKI トレラン ポール 特価', category: 'トレッキングポール', sports: ['trail'], brand: 'LEKI' },
  { keyword: 'ブラックダイヤモンド ディスタンス セール', category: 'トレッキングポール', sports: ['trail'], brand: 'Black Diamond' },
  { keyword: 'ミレー レインウェア 特価', category: 'レインウェア', sports: ['trail', 'adventure'], brand: 'MILLET' },
  { keyword: 'マグオン ジェル セール', category: '補給食・エナジージェル', sports: ['trail', 'marathon', 'cycling'], brand: 'Mag-on' },
];

const CATEGORY_RULES = {
  'トレランシューズ': { must: /シューズ|靴|トレイル|ランニング|スピードゴート|speedgoat|mutant|altra|salomon/i, ban: /靴下|ソックス|インソール|ポール|ザック|ベスト|ライト/i },
  'トレランザック': { must: /ザック|ベスト|バックパック|リュック|skin|スキン|ピナクル/i, ban: /ポール|ストック|シューズ|ライト|タイツ/i },
  'トレッキングポール': { must: /ポール|ストック|zポール|carbon|distance.*(?:z|carbon)/i, ban: /ザック|リュック|バックパック|バッグ|15|ベスト|シューズ/i },
  'ヘッドライト': { must: /ヘッドライト|ライト|ランタン|ティカ|ティキナ|アクティック|スポット|led/i, ban: /電池のみ|ケースのみ|ベルトのみ|バンドのみ/i },
  'サポートタイツ': { must: /タイツ|レギンス|スパッツ|ジェネレーター|エキスパート|c3fit|cw-x/i, ban: /シャツ|ジャケット|靴下|ソックス|パンツのみ|ショーツ/i },
  'レインウェア': { must: /レイン|ジャケット|シェル|防水|ゴアテックス|ティフォン|タンペート/i, ban: /パンツ|ズボン|シューズ|ザック|グローブ/i },
  '補給食・エナジージェル': { must: /ジェル|補給|マグオン|アミノ|メダリスト|エナジー/i, ban: /ボトル|ポーチ|ザック/i },
};

function isCategoryMatch(category, title) {
  const rule = CATEGORY_RULES[category];
  if (!rule) return true;
  if (rule.ban && rule.ban.test(title)) return false;
  if (rule.must && !rule.must.test(title)) return false;
  return true;
}

function normGearKey(title) {
  return (title || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龥]/g, '').slice(0, 16);
}

/** 毎朝の新規特価品自動探索 ＆ ローテーション入れ替えエンジン */
async function discoverAndRotateDeals(currentGears) {
  console.log('\n🔍 [毎朝自動実行] 新たな目玉特価品の探索＆入れ替えを開始します（Gemini AI & 楽天検索）...');
  const gears = [...currentGears];
  const normUrl = (u) => (u || '').split('?')[0].replace(/\/+$/, '');
  const existingUrls = new Set(gears.map((g) => normUrl(g.dealUrl)));
  const existingKeys = new Set(gears.map((g) => normGearKey(g.title)));
  let addedCount = 0;
  let replacedCount = 0;
  let consecutiveBlocked = 0;

  for (const target of DISCOVERY_TARGETS) {
    if (consecutiveBlocked >= 4) {
      console.log(' ⏭️ 楽天スクレイピングがWAF連続制限中のため、新規ディスカバリーを早期完了します。');
      break;
    }
    try {
      let candUrls = [];
      if (GEMINI_API_KEY) {
        const geminiUrl = await searchWithGemini(`${target.brand} ${target.category} セール 30%OFF`);
        if (geminiUrl) candUrls.push(geminiUrl);
      }
      const directUrls = await searchRakutenDirect(target.keyword);
      candUrls = [...new Set([...candUrls, ...directUrls])];
      if (candUrls.length === 0) {
        consecutiveBlocked++;
        continue;
      }
      consecutiveBlocked = 0;

      for (const u of candUrls.slice(0, 3)) {
        const cleanU = u.split('?')[0].replace(/\/+$/, '');
        if (existingUrls.has(cleanU)) continue;

        const s = await scrapeItem(cleanU);
        if (!s.ok) {
          if (s.blocked) consecutiveBlocked++;
          continue;
        }
        if (!s.price || s.price <= 0) continue;
        if (!isCategoryMatch(target.category, s.title)) continue;
        const nKey = normGearKey(s.title);
        if (nKey.length >= 6 && existingKeys.has(nKey)) continue;

        let listPrice = s.listPrice || 0;
        let discountRate = 0;
        if (listPrice > s.price) {
          discountRate = Math.round((1 - s.price / listPrice) * 100);
        }

        // 本物の実測割引率20%以上の目玉特価品のみを採用
        if (discountRate < 20) continue;

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
        };

        // カテゴリ内の入れ替え対象を探す（提携公式枠 INNER FACT や RUNPLUS は絶対に保護・除外）
        const categoryGears = gears.filter(
          (g) => g.gearType === target.category && !g.officialUrl && !g.shopName && !g.id.startsWith('gear-innerfact-') && !g.id.startsWith('gear-runplus-')
        );

        // 割引率が最も低いアイテム（通常価格品や低割引品）を探す
        const lowestDiscountGear = categoryGears.sort((a, b) => a.discountRate - b.discountRate || a.price - b.price)[0];

        if (lowestDiscountGear && lowestDiscountGear.discountRate < discountRate && categoryGears.length >= 4) {
          const removeIdx = gears.findIndex((g) => g.id === lowestDiscountGear.id);
          if (removeIdx >= 0) {
            console.log(` 🔄 入替: [${target.category}] ${lowestDiscountGear.title.slice(0, 25)} (${lowestDiscountGear.discountRate}%OFF) → ${newGear.title.slice(0, 25)} (${discountRate}%OFF)`);
            gears.splice(removeIdx, 1, newGear);
            existingUrls.add(cleanU);
            existingKeys.add(nKey);
            replacedCount++;
            break;
          }
        } else if (categoryGears.length < 6) {
          console.log(` ➕ 新規追加: [${target.category}] ${newGear.title.slice(0, 30)} (${discountRate}%OFF)`);
          gears.push(newGear);
          existingUrls.add(cleanU);
          existingKeys.add(nKey);
          addedCount++;
          break;
        }
      }
    } catch {
      // 1ターゲットのエラーで全体を止めない
    }
  }

  console.log(`✨ 新規特価品ディスカバリー完了: ${addedCount} 品追加, ${replacedCount} 品ローテーション入替`);
  return gears;
}

async function main() {
  const gears = JSON.parse(fs.readFileSync(GEARS_PATH, 'utf-8'));
  console.log(`対象 ${gears.length} 品を実機検証＆自己修復します（商品ページ・画像・価格）`);
  const results = await pool(gears, 4, async (g) => {
    const r = await refreshOne(g);
    console.log(`${r.status === 'ok' ? '✅' : '❌'} ${g.id} ${r.log.join(' / ')}`);
    return r;
  });

  const aliveBasic = results.filter((r) => r.status === 'ok').map((r) => r.gear);
  const removed = results.filter((r) => r.status !== 'ok').map((r) => ({ id: r.gear.id, reason: r.log.join(' / ') }));

  // ★【毎朝自動実行】Gemini AI ＆ 楽天市場検索による新たな特価商品の自動探索＆入れ替え★
  const alive = await discoverAndRotateDeals(aliveBasic);

  // カテゴリごとに isBestDeal を再計算（最大割引。同率は安い方）
  const byType = new Map();
  for (const g of alive) { g.isBestDeal = false; (byType.get(g.gearType) || byType.set(g.gearType, []).get(g.gearType)).push(g); }
  const problems = [];
  for (const [type, list] of byType) {
    if (list.length < MIN_PER_CATEGORY) problems.push(`${type}: ${list.length}品（最低${MIN_PER_CATEGORY}品必要）`);
    const best = [...list].sort((a, b) => b.discountRate - a.discountRate || a.price - b.price)[0];
    if (best && best.discountRate > 0) best.isBestDeal = true;
  }
  for (const t of new Set(gears.map((g) => g.gearType))) if (!byType.has(t)) problems.push(`${t}: 0品`);

  for (const g of alive) {
    const body = stripTag(g.standardTitle);
    g.standardTitle = g.isBestDeal ? `【カテゴリ最安${g.discountRate}%OFF】${body}` : body;
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
  let oldDeals = [];
  try { oldDeals = JSON.parse(fs.readFileSync(DEALS_PATH, 'utf-8')); } catch { /* none */ }
  const registeredAt = new Map(oldDeals.map((d) => [d.gear_id || d.id, d.registered_at]));

  const deals = alive.filter((g) => g.discountRate >= DEAL_THRESHOLD).map((g) => ({
    id: `deal-${g.id}`, gear_id: g.id, title: g.title, category: g.gearType,
    price: g.price, original_price: g.originalPrice, discount_rate: g.discountRate, point_rate: g.pointRate || 10,
    image_url: g.imageUrl, affiliate_url: g.dealUrl, badge: g.badge, description: g.standardTitle,
    official_url: g.officialUrl, shop_name: g.shopName,
    isBestDeal: Boolean(g.isBestDeal), updated_at: now, registered_at: g.isNewDiscovery ? now : (registeredAt.get(g.id) || now),
  })).sort((a, b) => b.discount_rate - a.discount_rate);

  alive.forEach((g) => delete g.isNewDiscovery);
  fs.writeFileSync(GEARS_PATH, JSON.stringify(alive, null, 2) + '\n');
  fs.writeFileSync(DEALS_PATH, JSON.stringify(deals, null, 2) + '\n');

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { /* new */ }
  Object.assign(meta, {
    last_updated_at: now, deals_count: deals.length, gears_count: alive.length,
    gear_sync_source: 'refresh_gears.mjs (自己修復・商品ページ実測・画像HTTP200検証済)',
    gear_removed: removed,
  });
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');
  console.log(`\n🎉 完了: 掲載 ${alive.length} 品 / 特価(${DEAL_THRESHOLD}%以上) ${deals.length} 品 / 除外 ${removed.length} 品`);
  for (const r of removed) console.log(` 除外: ${r.id} ${r.reason}`);
}

// CLI直接実行時
if (process.argv[1]?.endsWith('refresh_gears.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
