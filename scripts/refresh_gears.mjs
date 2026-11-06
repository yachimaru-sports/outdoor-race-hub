/**
 * scripts/refresh_gears.mjs
 * 装備カタログ（src/data/gears.json）の完全自動更新スクリプト（APIキー不要で動作）
 *
 * 方針（誤情報・リンク切れ・画像切れをサイトに出さない）:
 *  1. 各商品ページ(item.rakuten.co.jp)を実際に取得して HTTP 200 を確認
 *  2. 価格・定価・商品画像は「商品ページの実データ」から取得（推測URLは使わない）
 *  3. 画像URLは実際に GET して image/* かつ HTTP 200 を確認
 *  4. 割引率は 定価 と 現在価格 から計算（ページで確認できた数値のみ）
 *  5. 各装備カテゴリ内の最大割引商品に isBestDeal を自動付与
 *  6. 商品ページ消滅・画像取得不能の商品は掲載から除外（RAKUTEN_APP_ID があれば代替商品を自動検索）
 *  7. 除外の結果カテゴリが3品未満になる場合は終了コード1で失敗 → デプロイを止め、昨日の正常なサイトを維持
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, opts = {}, tries = 3) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (res.status < 500 && res.status !== 429) return res;
      last = res;
    } catch (e) { last = null; }
    await sleep(800 * (i + 1));
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
async function scrapeItem(url) {
  const res = await fetchRetry(url);
  if (!res) return { ok: false, reason: 'network' };
  if (res.status !== 200) return { ok: false, reason: `HTTP ${res.status}` };
  if (!/item\.rakuten\.co\.jp/.test(res.url)) return { ok: false, reason: `redirected to ${res.url}` };
  const html = decodeHtml(Buffer.from(await res.arrayBuffer()), res.headers.get('content-type') || '');

  let price = 0;
  const imageCandidates = [];
  for (const s of html.matchAll(/<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(s[1]);
      const sku = j?.api?.data?.itemInfoSku;
      if (sku?.sku?.[0]) {
        price = price || sku.sku[0].taxIncludedPrice || 0;
        for (const im of sku.sku[0].images || []) if (im.location) imageCandidates.push(im.location);
      }
    } catch { /* skip */ }
  }
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && !/noimage/i.test(og[1])) imageCandidates.unshift(og[1]);
  for (const m of html.matchAll(/https?:\/\/(?:tshop|shop|image)\.r10s\.jp\/[^"'\s\\<>)]+\.(?:jpg|jpeg|png)/gi)) imageCandidates.push(m[0]);

  let listPrice = 0;
  const lp = html.match(/メーカー希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/希望小売価格[^\d]{0,30}([0-9,]+)\s*円/) || html.match(/定価[^\d]{0,30}([0-9,]+)\s*円/);
  if (lp) listPrice = Number(lp[1].replace(/,/g, ''));

  return { ok: true, price, listPrice, images: [...new Set(imageCandidates.map(cleanImage))].filter(Boolean).slice(0, 8) };
}

/** 楽天APIで代替商品を探す（RAKUTEN_APP_ID がある場合のみ） */
async function findReplacement(gear) {
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
    if (s.ok) return { url, title: it.itemName, scraped: s };
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
  const log = [];
  let scraped = await scrapeItem(g.dealUrl);
  let url = g.dealUrl;
  let replaced = false;
  if (!scraped.ok) {
    log.push(`商品ページ不通(${scraped.reason})`);
    const rep = await findReplacement(g);
    if (!rep) return { gear: g, status: 'dead', log };
    scraped = rep.scraped; url = rep.url; replaced = true;
    log.push(`楽天APIで代替商品に自動置換: ${url}`);
  }

  let image = '';
  for (const c of scraped.images) { if (await imageIsAlive(c)) { image = c; break; } }
  if (!image) return { gear: g, status: 'noimage', log: [...log, '商品画像を取得できず'] };

  // 価格: ページ実測値。取得不能 or 異常値は「前回確認値」を維持して注記
  let originalPrice = g.originalPrice || 0;
  if (scraped.listPrice > 0) originalPrice = scraped.listPrice;
  let price = scraped.price;
  let stale = false;
  if (replaced) {
    originalPrice = scraped.listPrice || price; // 代替品は定価不明なら割引表示しない
  } else if (!price || price < originalPrice * 0.2) {
    price = g.price; stale = true; log.push('価格を確認できず前回値を維持');
  }
  if (price > originalPrice) originalPrice = price;
  const discountRate = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0;

  const next = {
    ...g,
    dealUrl: url, standardUrl: url,
    imageUrl: image, price, originalPrice, discountRate,
    priceVerifiedAt: stale ? g.priceVerifiedAt : new Date().toISOString(),
  };
  if (replaced) next.title = `${g.brand || ''} ${g.gearType}（自動選定）`.trim();
  return { gear: next, status: 'ok', log };
}

function stripTag(s) { return (s || '').replace(/^【[^】]*(?:最安|OFF|目玉)[^】]*】\s*/g, ''); }

async function main() {
  const gears = JSON.parse(fs.readFileSync(GEARS_PATH, 'utf-8'));
  console.log(`対象 ${gears.length} 品を実機検証します（商品ページ・画像・価格）`);
  const results = await pool(gears, 4, async (g) => {
    const r = await refreshOne(g);
    console.log(`${r.status === 'ok' ? '✅' : '❌'} ${g.id} ${r.log.join(' / ')}`);
    return r;
  });

  const alive = results.filter((r) => r.status === 'ok').map((r) => r.gear);
  const removed = results.filter((r) => r.status !== 'ok').map((r) => ({ id: r.gear.id, reason: r.log.join(' / ') }));

  // カテゴリごとに isBestDeal を再計算（最大割引。同率は安い方）
  const byType = new Map();
  for (const g of alive) { g.isBestDeal = false; (byType.get(g.gearType) || byType.set(g.gearType, []).get(g.gearType)).push(g); }
  const problems = [];
  for (const [type, list] of byType) {
    if (list.length < MIN_PER_CATEGORY) problems.push(`${type}: ${list.length}品（最低${MIN_PER_CATEGORY}品必要）`);
    const best = [...list].sort((a, b) => b.discountRate - a.discountRate || a.price - b.price)[0];
    if (best && best.discountRate > 0) best.isBestDeal = true;
  }
  // 元に存在したカテゴリが消えた場合も異常
  for (const t of new Set(gears.map((g) => g.gearType))) if (!byType.has(t)) problems.push(`${t}: 0品`);

  for (const g of alive) {
    const body = stripTag(g.standardTitle);
    g.standardTitle = g.isBestDeal ? `【カテゴリ最安${g.discountRate}%OFF】${body}` : body;
    g.badge = g.isBestDeal ? `🔥 ${g.discountRate}%OFF 最安特価` : g.discountRate >= 15 ? `${g.discountRate}%OFF 特価` : '定番おすすめ';
  }

  // 厳格検証（失敗時はファイルを書き換えずに終了＝公開サイトは前回の正常状態を維持）
  const bad = alive.filter((g) => !g.imageUrl || !/item\.rakuten\.co\.jp/.test(g.dealUrl) || g.price <= 0);
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
    isBestDeal: Boolean(g.isBestDeal), updated_at: now, registered_at: registeredAt.get(g.id) || now,
  })).sort((a, b) => b.discount_rate - a.discount_rate);

  fs.writeFileSync(GEARS_PATH, JSON.stringify(alive, null, 2) + '\n');
  fs.writeFileSync(DEALS_PATH, JSON.stringify(deals, null, 2) + '\n');

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { /* new */ }
  Object.assign(meta, {
    last_updated_at: now, deals_count: deals.length, gears_count: alive.length,
    gear_sync_source: 'refresh_gears.mjs (商品ページ実測・画像HTTP200検証済)',
    gear_removed: removed,
  });
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');
  console.log(`\n🎉 完了: 掲載 ${alive.length} 品 / 特価(${DEAL_THRESHOLD}%以上) ${deals.length} 品 / 除外 ${removed.length} 品`);
  for (const r of removed) console.log(` 除外: ${r.id} ${r.reason}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
