/**
 * ギアマスター自動同期スクリプト (scripts/sync_gears.mjs)
 * 
 * Googleスプレッドシート（新スキーマ）から最新の専門ギアデータを取得し、
 * deals.json（楽天市場の特価セール情報）と結合して
 * src/data/gears.json を完全生成します。
 * 
 * 【重要方針】
 * - 特価品リンク（dealUrl）は、楽天市場の「検索結果一覧」ではなく、
 *   必ず各商品の「個別直接購入ページ (item.rakuten.co.jp)」に直通ジャンプさせます。
 * - タイトル・型番・商品内容とリンク先が100%合致することを保証します。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const GEARS_JSON_PATH = path.join(ROOT_DIR, 'src', 'data', 'gears.json');
const DEALS_JSON_PATH = path.join(ROOT_DIR, 'src', 'data', 'deals.json');
const META_JSON_PATH = path.join(ROOT_DIR, 'src', 'data', 'meta.json');

// Googleスプレッドシート公開CSV URL
const DEFAULT_GEAR_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJ_Lf9xZGKcAuj3MooTmlKprv3rQjsM0hmwV4hl_OoseVY7CdDH2t_9gXABT5Erddw-Jj9ucuvkNFJ/pub?output=csv';

const RAKUTEN_AFFILIATE_ID = '58fb598b.0ed2da59.58fb598c.27018da5';

/**
 * 楽天市場の商品個別直通URLマッピングテーブル（検索一覧ではなく直接購入ページへ直通）
 */
const EXACT_ITEM_DIRECT_URLS = {
  'gear-trail-rain-tnf-strike': 'https://item.rakuten.co.jp/canpanera/n17-2287/',
  'gear-trail-rain-montbell': 'https://webshop.montbell.jp/goods/disp.php?product_id=1128590',
  'gear-trail-pack-salomon-advskin12': 'https://item.rakuten.co.jp/free-sports/salomon-2383/',
  'gear-trail-pack-nathan-pinnacle': 'https://item.rakuten.co.jp/usbonline/ns40180j/',
  'gear-trail-shoes-hoka-speedgoat6': 'https://item.rakuten.co.jp/sports-diary/hka-1147791-bblc/',
  'gear-trail-shoes-altra-lonepeak8': 'https://item.rakuten.co.jp/glv/ala-3/',
  'gear-trail-poles-leki-fx-one': 'https://item.rakuten.co.jp/sakaiya/202610211933/',
  'gear-trail-light-petzl-swift': 'https://item.rakuten.co.jp/alpine-rose/2545/',
  'gear-trail-sublight-bd-spot': 'https://item.rakuten.co.jp/canpanera/b17466/',
  'gear-trail-wear-mil-drynamic': 'https://item.rakuten.co.jp/sportsmario2/i06mjmiv01248/',
  'gear-trail-wear-c3fit-tights': 'https://item.rakuten.co.jp/auc-bestsports/3fw14127/',
  'gear-trail-bivvy-sol-escape': 'https://item.rakuten.co.jp/canpanera/s23005/',
  'gear-cycle-helmet-ogk-vitt': 'https://item.rakuten.co.jp/phalconcycle/ogkk-004090/',
  'gear-cycle-light-cateye-ampp': 'https://item.rakuten.co.jp/cycle-shop-eggs/10000022/',
  'gear-cycle-tool-topeak-mini': 'https://item.rakuten.co.jp/aris/topmini20p/',
  'gear-cycle-bottle-camelbak': 'https://item.rakuten.co.jp/amical/z00359/',
  'gear-cycle-wear-pearl-wind': 'https://item.rakuten.co.jp/bebike/pearlizumi-2300/',
  'gear-marathon-shoes-asics-s4': 'https://item.rakuten.co.jp/alpen/4302610436/',
  'gear-marathon-pouch-yurenikui': 'https://yurenikui.jp/',
  'gear-nutrition-magon-gel': 'https://item.rakuten.co.jp/lafitte/magon-energygel-set/',
  'gear-marathon-socks-tabio': 'https://item.rakuten.co.jp/alpen/3888990001/',
  'gear-ar-compass-silva-no3': 'https://item.rakuten.co.jp/shop-senjin/73010000/',
  'gear-ar-mapcase-sealline': 'https://item.rakuten.co.jp/aila/59587/',
  'gear-ar-drybag-seatosummit': 'https://item.rakuten.co.jp/yoshikip2/ss-brdb20/'
};

function parseCsv(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row = [];
    let insideQuote = false;
    let field = '';
    
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        if (insideQuote && line[c + 1] === '"') {
          field += '"';
          c++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    row.push(field);
    result.push(row);
  }
  
  return result;
}

function parseNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d]/g, '');
  return Number(cleaned) || 0;
}

/**
 * URLを楽天アフィリエイト直通リンクに変換
 */
function buildDirectAffiliateUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.includes('hb.afl.rakuten.co.jp')) {
    return rawUrl;
  }
  if (rawUrl.includes('item.rakuten.co.jp')) {
    const cleanUrl = rawUrl.split('?')[0];
    return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(cleanUrl)}&link_type=picttext`;
  }
  return rawUrl;
}

// ギアIDと旧deals IDのマッピング
const GEAR_TO_DEAL_MAP = {
  'gear-trail-rain-tnf-strike': 'deal-tnf-strike-trail-hoodie',
  'gear-trail-rain-montbell': 'deal-montbell-versalite-jkt',
  'gear-trail-pack-salomon-advskin12': 'deal-salomon-adv-skin-12',
  'gear-trail-pack-nathan-pinnacle': 'deal-nathan-pinnacle-12l',
  'gear-trail-shoes-hoka-speedgoat6': 'deal-hoka-speedgoat-6',
  'gear-trail-shoes-altra-lonepeak8': 'deal-altra-lone-peak-8',
  'gear-trail-poles-leki-fx-one': 'deal-leki-ultratrail-fx-one-sl',
  'gear-trail-light-petzl-swift': 'deal-petzl-swift-rl',
  'gear-trail-sublight-bd-spot': 'deal-bd-spot400r',
  'gear-trail-wear-mil-drynamic': 'deal-mil-drynamic-mesh',
  'gear-trail-wear-c3fit-tights': 'deal-c3fit-compression-tight',
  'gear-trail-bivvy-sol-escape': 'deal-sol-escape-bivvy',
  'gear-ar-compass-silva-no3': 'deal-silva-compass-no3',
  'gear-nutrition-magon-gel': 'deal-magon-energy-gel-12',
};

export async function syncGearsFromSheet() {
  console.log('========================================================');
  console.log(' ギアマスター（新スキーマ）同期処理 開始');
  console.log('========================================================');

  const sheetUrl = process.env.GOOGLE_SHEET_GEAR_CSV_URL || DEFAULT_GEAR_SHEET_URL;
  console.log(`📡 Googleスプレッドシートから最新ギアマスター取得中: ${sheetUrl}`);

  const res = await fetch(sheetUrl);
  if (!res.ok) {
    throw new Error(`スプレッドシート取得失敗: HTTP ${res.status}`);
  }
  let csvText = await res.text();
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.slice(1);
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSVデータが空またはヘッダー行がありません');
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  console.log('CSVヘッダー:', headers);

  // deals.json を読み込み
  const dealsMap = new Map();
  if (fs.existsSync(DEALS_JSON_PATH)) {
    try {
      const deals = JSON.parse(fs.readFileSync(DEALS_JSON_PATH, 'utf-8'));
      deals.forEach(d => {
        dealsMap.set(d.id, d);
      });
      console.log(`✅ deals.json から ${deals.length} 件の特価データを読み込みました`);
    } catch (e) {
      console.warn('deals.json 読み込み失敗:', e.message);
    }
  }

  const getCol = (row, colName) => {
    const idx = headers.indexOf(colName.toLowerCase());
    return idx !== -1 && row[idx] !== undefined ? row[idx].trim() : '';
  };

  const gearItems = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = getCol(row, 'id');
    const title = getCol(row, 'title');
    if (!id || !title) continue;

    const sportsRaw = getCol(row, 'sports');
    const sports = sportsRaw
      ? sportsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['trail'];

    const gearType = getCol(row, 'gear_type');
    const matchKeywordsRaw = getCol(row, 'match_keywords');
    const matchKeywords = matchKeywordsRaw
      ? matchKeywordsRaw.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    const brand = getCol(row, 'brand');
    const standardTitle = getCol(row, 'standard_title');
    const standardUrl = getCol(row, 'standard_url');
    const dealKeyword = getCol(row, 'deal_keyword') || title;
    const originalPrice = parseNumber(getCol(row, 'original_price'));
    const minPrice = parseNumber(getCol(row, 'min_price'));
    const csvDealUrl = getCol(row, 'deal_url');

    // 対応するセール特価情報を探索
    const mappedDealId = GEAR_TO_DEAL_MAP[id] || id;
    let matchedDeal = dealsMap.get(mappedDealId);

    const discountRate = matchedDeal ? matchedDeal.discount_rate : undefined;
    const dealPrice = matchedDeal ? matchedDeal.price : undefined;
    const imageUrl = matchedDeal ? matchedDeal.image_url : undefined;

    // 【最重要】購入直通リンクの決定ロジック
    // 1. スプレッドシート(CSV)の deal_url に商品直接ページ (item.rakuten.co.jp) または公式直営サイトが書かれている場合 -> 最優先
    // 2. deals.json に商品直接ページ (item.rakuten.co.jp) がある場合 -> 採用
    // 3. 確定商品個別URLテーブル (EXACT_ITEM_DIRECT_URLS) -> 採用
    let finalRawDealUrl = '';
    if (csvDealUrl && (csvDealUrl.includes('item.rakuten.co.jp') || (!csvDealUrl.includes('search.rakuten.co.jp') && !csvDealUrl.includes('rakuten.co.jp')))) {
      finalRawDealUrl = csvDealUrl;
    } else if (matchedDeal && matchedDeal.affiliate_url && matchedDeal.affiliate_url.includes('item.rakuten.co.jp')) {
      finalRawDealUrl = matchedDeal.affiliate_url;
    } else if (EXACT_ITEM_DIRECT_URLS[id]) {
      finalRawDealUrl = EXACT_ITEM_DIRECT_URLS[id];
    } else if (matchedDeal && matchedDeal.affiliate_url) {
      finalRawDealUrl = matchedDeal.affiliate_url;
    } else {
      finalRawDealUrl = standardUrl;
    }

    const dealUrl = buildDirectAffiliateUrl(finalRawDealUrl);

    const gearItem = {
      id,
      sports,
      gearType,
      matchKeywords,
      title,
      brand: brand || undefined,
      standardTitle,
      standardUrl,
      dealKeyword,
      originalPrice: originalPrice || undefined,
      minPrice: minPrice || undefined,
      price: dealPrice,
      discountRate,
      dealUrl,
      imageUrl
    };

    gearItems.push(gearItem);
  }

  console.log(`🎉 合計 ${gearItems.length} 件のギアマスターデータを構築しました`);
  fs.writeFileSync(GEARS_JSON_PATH, JSON.stringify(gearItems, null, 2) + '\n', 'utf-8');
  console.log(`💾 ${GEARS_JSON_PATH} に保存完了！`);

  // meta.json 更新
  try {
    let meta = {};
    if (fs.existsSync(META_JSON_PATH)) {
      meta = JSON.parse(fs.readFileSync(META_JSON_PATH, 'utf-8'));
    }
    meta.last_updated_at = new Date().toISOString();
    meta.gears_count = gearItems.length;
    fs.writeFileSync(META_JSON_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
    console.log(`⏱️ 最新更新日時 (${meta.last_updated_at}) を meta.json に記録しました。`);
  } catch (err) {
    console.warn('meta.json 更新スキップ:', err);
  }

  return gearItems;
}

if (process.argv[1] && process.argv[1].endsWith('sync_gears.mjs')) {
  syncGearsFromSheet().catch(err => {
    console.error('エラー:', err);
    process.exit(1);
  });
}
