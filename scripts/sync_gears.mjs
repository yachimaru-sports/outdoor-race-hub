/**
 * ギアマスター自動同期スクリプト (scripts/sync_gears.mjs)
 * 
 * Googleスプレッドシート（新スキーマ）から最新の専門ギアデータを取得し、
 * deals.json（楽天市場の特価セール情報）と結合して
 * src/data/gears.json を完全生成します。
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

function buildRakutenSearchAffiliateUrl(keyword) {
  const targetUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(targetUrl)}&link_type=picttext`;
}

// ギアIDと旧deals IDのマッピング（確実な紐付け用）
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

  // 既存の deals.json を読み込み
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

    // 対応するセール特価情報を探索
    const mappedDealId = GEAR_TO_DEAL_MAP[id] || id;
    let matchedDeal = dealsMap.get(mappedDealId);

    // 見つからない場合はキーワード照合
    if (!matchedDeal) {
      for (const deal of dealsMap.values()) {
        if (deal.title.includes(brand) && deal.title.includes(dealKeyword.split(' ')[0])) {
          matchedDeal = deal;
          break;
        }
      }
    }

    const discountRate = matchedDeal ? matchedDeal.discount_rate : undefined;
    const dealPrice = matchedDeal ? matchedDeal.price : undefined;
    const dealUrl = matchedDeal ? matchedDeal.affiliate_url : buildRakutenSearchAffiliateUrl(dealKeyword);
    const imageUrl = matchedDeal ? matchedDeal.image_url : undefined;

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
