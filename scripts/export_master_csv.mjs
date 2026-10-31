import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const eventsPath = path.join(ROOT_DIR, 'src', 'data', 'events.json');
const outputPath = path.join(ROOT_DIR, 'outdoor_race_hub_events_master.csv');

const events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));

const headers = [
  'id',
  'title',
  'category',
  'subCategory',
  'date',
  'month',
  'region',
  'prefecture',
  'distance_km',
  'elevation_m',
  'entry_status',
  'entry_start_date',
  'entry_deadline',
  'entry_fee',
  'official_url',
  'entry_url',
  'venue_name',
  'venue_map',
  'elements',
  'mandatory_gear'
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const rows = [headers.join(',')];

for (const e of events) {
  const gearStr = (e.mandatory_gear || []).map(g => typeof g === 'string' ? g : g.name).join(' / ');
  const elementsStr = (e.elements || []).join(' / ');
  const row = [
    escapeCsv(e.id),
    escapeCsv(e.title),
    escapeCsv(e.category),
    escapeCsv(e.subCategory || ''),
    escapeCsv(e.date),
    escapeCsv(e.month),
    escapeCsv(e.region),
    escapeCsv(e.prefecture),
    escapeCsv(e.distance_km),
    escapeCsv(e.elevation_m || 0),
    escapeCsv(e.entry_status),
    escapeCsv(e.entry_start_date || ''),
    escapeCsv(e.entry_deadline || ''),
    escapeCsv(e.entry_fee || ''),
    escapeCsv(e.links?.official || ''),
    escapeCsv(e.links?.entry || ''),
    escapeCsv(e.venue?.name || ''),
    escapeCsv(e.venue?.mapQuery || ''),
    escapeCsv(elementsStr),
    escapeCsv(gearStr)
  ];
  rows.push(row.join(','));
}

// UTF-8 BOM付きで保存（ExcelやGoogleスプレッドシートで文字化けゼロ）
fs.writeFileSync(outputPath, '\uFEFF' + rows.join('\r\n'), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${events.length} records!`);
