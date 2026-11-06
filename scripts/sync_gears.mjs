/**
 * ギアマスター自動同期＆画像自動取得スクリプト (scripts/sync_gears.mjs)
 * 
 * Googleスプレッドシートから最新の専門ギアデータを取得し、
 * 各商品の購入ページ（item.rakuten.co.jp等）から公式商品画像（og:image）を
 * リアルタイムに自動抽出し、gears.json / deals.json を完全同期します。
 * 
 * 【画像処理・リンク方針】
 * 1. スプレッドシートの deal_url / standard_url を解析し、商品個別ページの og:image を自動取得
 * 2. スプレッドシートに image_url 列が存在する場合は最優先で採用
 * 3. リンク先は常に個別商品購入ページ (item.rakuten.co.jp) に直通
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
 * 楽天市場の商品個別直通URLマッピングテーブル（スプレッドシートにURLがない場合のフォールバック）
 */
const EXACT_ITEM_DIRECT_URLS = {
  'gear-trail-rain-tnf-strike': 'https://item.rakuten.co.jp/canpanera/n17-2287/',
  'gear-trail-rain-montbell': 'https://webshop.montbell.jp/goods/disp.php?product_id=1128590',
  'gear-trail-pack-salomon-advskin12': 'https://item.rakuten.co.jp/vitaliser/salomon-2568/',
  'gear-trail-pack-nathan-pinnacle': 'https://item.rakuten.co.jp/usbonline/ns40180j/',
  'gear-trail-shoes-hoka-speedgoat6': 'https://item.rakuten.co.jp/sports-diary/hka-1147791-swrd/',
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

/**
 * 確定公式画像フォールバックテーブル
 */
const FALLBACK_GEAR_IMAGES = {
  'gear-trail-rain-tnf-strike': 'https://shop.r10s.jp/canpanera/cabinet/item240/item_n17-2287_0.jpg',
  'gear-trail-rain-montbell': 'https://tshop.r10s.jp/airwel/cabinet/shohin13/13162527/imgrc0141194038.jpg',
  'gear-trail-pack-salomon-advskin12': 'https://shop.r10s.jp/vitaliser/cabinet/300606/salomon-2568.jpg',
  'gear-trail-pack-nathan-pinnacle': 'https://shop.r10s.jp/usbonline/cabinet/pic-2/ns40180j-main.jpg',
  'gear-trail-shoes-hoka-speedgoat6': 'https://shop.r10s.jp/sports-diary/cabinet/16/hka-1147791-swrd_1.jpg',
  'gear-trail-shoes-altra-lonepeak8': 'https://shop.r10s.jp/glv/cabinet/newsingle202607/ala-3rak.jpg',
  'gear-trail-poles-leki-fx-one': 'https://shop.r10s.jp/vitaliser/cabinet/300800/caravan-1647.jpg',
  'gear-trail-light-petzl-swift': 'https://shop.r10s.jp/kompas/cabinet/item83/e095bb_01.jpg',
  'gear-trail-sublight-bd-spot': 'https://shop.r10s.jp/canpanera/cabinet/item230/item_b17466_0.jpg',
  'gear-trail-wear-mil-drynamic': 'https://shop.r10s.jp/sportsmario2/cabinet/evidence_20250822/i06mjmiv01248_1.jpg',
  'gear-trail-wear-c3fit-tights': 'https://shop.r10s.jp/2-kobeya/cabinet/goldwin/3f14127.jpg',
  'gear-trail-bivvy-sol-escape': 'https://shop.r10s.jp/canpanera/cabinet/item209/item_s23005_0.jpg',
  'gear-cycle-helmet-ogk-vitt': 'https://shop.r10s.jp/phalconcycle/cabinet/07626918/07626920/imgrc0107384488.jpg',
  'gear-cycle-light-cateye-ampp': 'https://shop.r10s.jp/cycle-shop-eggs/cabinet/07026577/imgrc0091873775.jpg',
  'gear-cycle-tool-topeak-mini': 'https://shop.r10s.jp/aris/cabinet/00244673/0651y.jpg',
  'gear-cycle-bottle-camelbak': 'https://shop.r10s.jp/amical/cabinet/item/z00359-001.jpg',
  'gear-cycle-wear-pearl-wind': 'https://shop.r10s.jp/bebike/cabinet/new_item/pearlizumi/2300.jpg',
  'gear-marathon-shoes-asics-s4': 'https://shop.r10s.jp/alpen/cabinet/img/678/4302610436_1.jpg',
  'gear-marathon-pouch-yurenikui': 'https://shop.r10s.jp/yurenikui/cabinet/compass1620286780.jpg',
  'gear-nutrition-magon-gel': 'https://shop.r10s.jp/lafitte/cabinet/19ss_keleme_01/1baa78ee55d355a8dc_1.jpg',
  'gear-marathon-socks-tabio': 'https://shop.r10s.jp/alpen/cabinet/img/560/3888990001_1.jpg',
  'gear-ar-compass-silva-no3': 'https://shop.r10s.jp/shop-senjin/cabinet/other/imgrc0089499110.jpg',
  'gear-ar-mapcase-sealline': 'https://shop.r10s.jp/aila/cabinet/00100/59587_1.jpg',
  'gear-ar-drybag-seatosummit': 'https://shop.r10s.jp/yoshikip2/cabinet/07198126/imgrc0084318357.jpg'
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

/**
 * 商品購入ページから公式出品画像 (og:image) をリアルタイム自動抽出
 */
async function extractProductImage(itemUrl) {
  if (!itemUrl || !itemUrl.startsWith('http')) return null;

  try {
    const res = await fetch(itemUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. og:image を抽出
    const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1] && ogMatch[1].startsWith('http') && !ogMatch[1].includes('noimage')) {
      return ogMatch[1];
    }

    // 2. 楽天のメイン商品画像 (tshop / shop.r10s.jp) を抽出
    const r10Match = html.match(/https:\/\/(tshop|shop)\.r10s\.jp\/[a-zA-Z0-9_\-\/]+\.(jpg|png|webp)/i);
    if (r10Match && r10Match[0]) {
      return r10Match[0];
    }
  } catch (err) {
    // タイムアウトやアクセス制限時はフォールバックへ
  }
  return null;
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
  console.log(' ギアマスター自動同期＆商品画像自動抽出処理 開始');
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
    const dealPrice = parseNumber(getCol(row, 'deal_price'));
    const csvDealUrl = getCol(row, 'deal_url');
    const csvImageUrl = getCol(row, 'image_url'); // スプレッドシート側で画像URL指定がある場合に対応

    // 対応するセール特価情報を探索（新スキーマID・旧スキーマID双方で確実に照合）
    const mappedDealId = GEAR_TO_DEAL_MAP[id] || id;
    let matchedDeal = dealsMap.get(id) || dealsMap.get(mappedDealId);

    // 【1. 購入直通リンクの決定】
    let finalRawDealUrl = '';
    if (csvDealUrl && (csvDealUrl.includes('item.rakuten.co.jp') || (!csvDealUrl.includes('search.rakuten.co.jp') && !csvDealUrl.includes('rakuten.co.jp')))) {
      finalRawDealUrl = csvDealUrl;
    } else if (matchedDeal && matchedDeal.affiliate_url && matchedDeal.affiliate_url.includes('item.rakuten.co.jp')) {
      finalRawDealUrl = matchedDeal.affiliate_url;
    } else if (EXACT_ITEM_DIRECT_URLS[id]) {
      finalRawDealUrl = EXACT_ITEM_DIRECT_URLS[id];
    } else {
      finalRawDealUrl = standardUrl;
    }

    const dealUrl = buildDirectAffiliateUrl(finalRawDealUrl);

    // 【2. 商品画像の決定：確定公式画像＆アンマッチ根絶エンジン】
    // 優先順位：
    // ① スプレッドシートの image_url
    // ② 各ギア固有の確定公式画像（FALLBACK_GEAR_IMAGES）★アンマッチを100%防ぐ最強の防壁
    // ③ 出品ページ (finalRawDealUrl) からの og:image 自動取得
    // ④ matchedDeal の image_url (※ネイサンザック汚染画像は完全排除)
    let finalImageUrl = csvImageUrl;
    if (!finalImageUrl && FALLBACK_GEAR_IMAGES[id]) {
      finalImageUrl = FALLBACK_GEAR_IMAGES[id];
    }
    if (!finalImageUrl && finalRawDealUrl.includes('item.rakuten.co.jp')) {
      finalImageUrl = await extractProductImage(finalRawDealUrl);
      if (finalImageUrl) {
        console.log(`  📸 [画像自動抽出成功] ${id}: ${finalImageUrl.slice(0, 70)}...`);
      }
    }
    if (!finalImageUrl && matchedDeal && matchedDeal.image_url) {
      // ネイサンザック画像が別アイテムに混入している場合は無効化
      if (!matchedDeal.image_url.includes('ns40180j-main') || id === 'gear-trail-pack-nathan-pinnacle') {
        finalImageUrl = matchedDeal.image_url;
      }
    }

    const discountRate = (originalPrice > 0 && dealPrice > 0 && dealPrice < originalPrice)
      ? Math.round((1 - dealPrice / originalPrice) * 100)
      : (matchedDeal ? matchedDeal.discount_rate : undefined);

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
      price: dealPrice || (matchedDeal ? matchedDeal.price : undefined),
      discountRate,
      dealUrl,
      imageUrl: finalImageUrl
    };

    gearItems.push(gearItem);

    // deals.json 側の対応する商品画像やURLも連動して最新化
    if (matchedDeal && finalImageUrl) {
      matchedDeal.image_url = finalImageUrl;
      if (finalRawDealUrl.includes('item.rakuten.co.jp')) {
        matchedDeal.affiliate_url = dealUrl;
      }
    }
  }

  console.log(`🎉 合計 ${gearItems.length} 件のギアマスターデータを構築しました`);
  fs.writeFileSync(GEARS_JSON_PATH, JSON.stringify(gearItems, null, 2) + '\n', 'utf-8');
  console.log(`💾 ${GEARS_JSON_PATH} に保存完了！`);

  // deals.json も更新
  if (dealsMap.size > 0) {
    const updatedDeals = Array.from(dealsMap.values());
    fs.writeFileSync(DEALS_JSON_PATH, JSON.stringify(updatedDeals, null, 2) + '\n', 'utf-8');
    console.log(`💾 ${DEALS_JSON_PATH} も最新画像・リンクで同期完了！`);
  }

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
