/**
 * Googleスプレッドシート連携スクリプト (sync_from_sheets.mjs)
 * 
 * GoogleスプレッドシートからエクスポートされたCSVデータ（または公開CSV URL）を読み込み、
 * OUTDOOR RACE HUB の大会データベース (src/data/events.json) を安全に同期・自動生成します。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const EVENTS_JSON_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');
const LOCAL_CSV_PATH = path.join(ROOT_DIR, 'outdoor_race_hub_events_master.csv');

/**
 * 簡易CSVパーサー（カンマ区切り・ダブルクォートエスケープ対応）
 */
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

/**
 * CSV行から RaceEvent オブジェクトを構築
 */
function rowToEvent(headers, row) {
  const getVal = (name) => {
    const idx = headers.indexOf(name);
    return idx !== -1 && row[idx] !== undefined ? row[idx].trim() : '';
  };

  const id = getVal('id');
  const title = getVal('title');
  if (!id || !title) return null;

  const rawGear = getVal('mandatory_gear');
  const mandatory_gear = rawGear
    ? rawGear.split('/').map(g => g.trim()).filter(Boolean).map(name => {
        let category = 'ギア';
        if (/ウェア|レイン|ジャケット|パンツ|タイツ|グローブ|手袋|防寒/i.test(name)) category = 'ウェア';
        else if (/ライト|ランプ|電池|バッテリー/i.test(name)) category = 'ライト';
        else if (/シート|ブランケット|ホイッスル|救急|エイド|絆創膏|保険証/i.test(name)) category = 'エイド';
        else if (/水|補給|フラスク|ボトル|ジェル/i.test(name)) category = '補給';
        else if (/GPS|時計|地図|コンパス|マップ/i.test(name)) category = 'ナビゲーション';
        return { name, category };
      })
    : [];

  const rawElements = getVal('elements');
  const elements = rawElements
    ? rawElements.split('/').map(e => e.trim()).filter(Boolean)
    : [];

  return {
    id,
    category: getVal('category') || 'trail',
    subCategory: getVal('subCategory'),
    elements,
    title,
    date: getVal('date'),
    month: Number(getVal('month')) || 1,
    region: getVal('region') || '全国',
    prefecture: getVal('prefecture') || '',
    distance_km: Number(getVal('distance_km')) || 0,
    elevation_m: Number(getVal('elevation_m')) || 0,
    entry_status: getVal('entry_status') || 'open',
    entry_start_date: getVal('entry_start_date') || undefined,
    entry_deadline: getVal('entry_deadline') || undefined,
    entry_fee: getVal('entry_fee') || undefined,
    links: {
      official: getVal('official_url') || null,
      entry: getVal('entry_url') || null,
      review: null,
      sns: null,
      verified: true,
      verified_at: new Date().toISOString().split('T')[0]
    },
    mandatory_gear,
    venue: {
      name: getVal('venue_name') || '',
      mapQuery: getVal('venue_map') || (getVal('prefecture') + ' ' + getVal('venue_name'))
    },
    source: {
      portalName: getVal('source_portal') || '大会公式'
    }
  };
}

async function main() {
  console.log('========================================================');
  console.log(' Googleスプレッドシート → OUTDOOR RACE HUB 同期バッチ開始');
  console.log('========================================================');

  let csvContent = '';
  const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL;

  if (sheetUrl) {
    console.log(`🌐 Googleスプレッドシート公開URLから最新データを取得中...`);
    const res = await fetch(sheetUrl);
    if (!res.ok) {
      throw new Error(`スプレッドシートの取得に失敗しました: HTTP ${res.status}`);
    }
    csvContent = await res.text();
  } else if (fs.existsSync(LOCAL_CSV_PATH)) {
    console.log(`📄 ローカルのマスターCSV (${LOCAL_CSV_PATH}) から読み込みます...`);
    csvContent = fs.readFileSync(LOCAL_CSV_PATH, 'utf-8');
  } else {
    throw new Error('同期元となるスプレッドシートURL (GOOGLE_SHEET_CSV_URL) または master.csv が存在しません。');
  }

  // BOM除去
  if (csvContent.charCodeAt(0) === 0xFEFF) {
    csvContent = csvContent.slice(1);
  }

  const rows = parseCsv(csvContent);
  if (rows.length < 2) {
    throw new Error('CSVデータが空、またはヘッダー行しか存在しません。');
  }

  const headers = rows[0].map(h => h.trim());
  const newEvents = [];

  for (let i = 1; i < rows.length; i++) {
    const ev = rowToEvent(headers, rows[i]);
    if (ev) {
      newEvents.push(ev);
    }
  }

  console.log(`✅ 解析完了: 合計 ${newEvents.length} 件の大会データを構築しました。`);

  // events.json へ保存
  fs.writeFileSync(EVENTS_JSON_PATH, JSON.stringify(newEvents, null, 2) + '\n', 'utf-8');
  console.log(`🎉 正常に ${EVENTS_JSON_PATH} へ書き込みを完了しました！`);
}

main().catch(err => {
  console.error('同期エラー:', err);
  process.exit(1);
});
