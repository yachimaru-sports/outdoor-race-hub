import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const items = [
  {
    id: 'deal-petzl-swift-rl',
    keyword: 'ペツル スイフト RL E095BC',
    title: '[PETZL] ペツル スイフト RL 1200ルーメン 充電式ヘッドライト（夜間・100マイル必携）',
    category: 'ライト',
    original_price: 23760,
    min_price: 14000,
    point_rate: 10
  },
  {
    id: 'deal-nathan-pinnacle-12l',
    keyword: 'NATHAN ピナクル 12L JP',
    title: '【公式特価】NATHAN(ネイサン) ピナクル 12L JP トレイルランニングザック（100マイル対応）',
    category: 'ギア',
    original_price: 18700,
    min_price: 7500,
    point_rate: 10
  },
  {
    id: 'deal-black-diamond-carbon-poles',
    keyword: 'ディスタンスカーボンZ',
    title: 'Black Diamond(ブラックダイヤモンド) ディスタンスカーボンZ 折りたたみZポール（山岳100マイル必携）',
    category: 'ギア',
    original_price: 32340,
    min_price: 15000,
    point_rate: 10
  },
  {
    id: 'deal-bd-spot400r',
    keyword: 'Black Diamond スポット400-R',
    title: 'Black Diamond(ブラックダイヤモンド) スポット400-R 防水LEDヘッドランプ（サブライト必携）',
    category: 'ライト',
    original_price: 12980,
    min_price: 6500,
    point_rate: 10
  },
  {
    id: 'deal-tnf-tr6-vest',
    keyword: 'ノースフェイス TR 6 NM62513',
    title: 'THE NORTH FACE(ザ・ノース・フェイス) TR 6 レース仕様ベスト型トレランザック',
    category: 'ギア',
    original_price: 23100,
    min_price: 12000,
    point_rate: 10
  },
  {
    id: 'deal-salomon-adv-skin-12',
    keyword: 'サロモン ADV SKIN 12',
    title: 'SALOMON(サロモン) ADV SKIN 12 レースベスト（フラスク付属・定番ベストセラー）',
    category: 'ギア',
    original_price: 22000,
    min_price: 13000,
    point_rate: 10
  },
  {
    id: 'deal-petzl-actik-core',
    keyword: 'ペツル アクティック コア 600',
    title: 'PETZL(ペツル) アクティック コア 600ルーメン 充電式ヘッドランプ（予備ライト必携）',
    category: 'ライト',
    original_price: 11000,
    min_price: 6000,
    point_rate: 10
  },
  {
    id: 'deal-mil-drynamic-mesh',
    keyword: 'ミレー ドライナミック メッシュ ノースリーブ',
    title: 'MILLET(ミレー) ドライナミックメッシュ アンダーウェア（汗冷え防止・必携ベースレイヤー）',
    category: 'ウェア',
    original_price: 6490,
    min_price: 4500,
    point_rate: 10
  },
  {
    id: 'deal-c3fit-compression-tight',
    keyword: 'ゴールドウイン インパクトエアー ロングタイツ',
    title: 'Goldwin(ゴールドウイン) インパクトエアー ロングタイツ（膝腰サポート・長距離用）',
    category: 'ウェア',
    original_price: 14850,
    min_price: 9000,
    point_rate: 10
  },
  {
    id: 'deal-salomon-active-skin-8',
    keyword: 'サロモン ACTIVE SKIN 8',
    title: 'SALOMON(サロモン) ACTIVE SKIN 8 ハイドレーションベスト（中距離トレラン向け）',
    category: 'ギア',
    original_price: 16500,
    min_price: 9500,
    point_rate: 10
  }
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const headers = ['id', 'keyword', 'title', 'category', 'original_price', 'min_price', 'point_rate'];
const rows = [headers.join(',')];

for (const item of items) {
  rows.push([
    escapeCsv(item.id),
    escapeCsv(item.keyword),
    escapeCsv(item.title),
    escapeCsv(item.category),
    escapeCsv(item.original_price),
    escapeCsv(item.min_price),
    escapeCsv(item.point_rate)
  ].join(','));
}

// UTF-8 BOM付き (\uFEFF) かつ CRLF 改行で保存
const csvOutput = '\uFEFF' + rows.join('\r\n');

// 1. パッケージ内への書き込み
const packagePath = path.join(ROOT_DIR, 'gemini_skill_package', 'outdoor_race_hub_gear_watchlist.csv');
fs.writeFileSync(packagePath, csvOutput, 'utf-8');
console.log('✅ gemini_skill_package/outdoor_race_hub_gear_watchlist.csv をBOM付きで更新しました。');

// 2. ルートへの書き込み（Excelでロックされている場合はスキップまたは別名）
const rootPath = path.join(ROOT_DIR, 'outdoor_race_hub_gear_watchlist.csv');
try {
  fs.writeFileSync(rootPath, csvOutput, 'utf-8');
  console.log('✅ outdoor_race_hub_gear_watchlist.csv をBOM付きで更新しました。');
} catch (err) {
  console.warn('⚠️ outdoor_race_hub_gear_watchlist.csv は現在Excel等で開かれているため上書きを保留しました。');
  console.warn('   Excelを閉じてから再実行するか、BOM付き版をご利用ください。');
  const backupPath = path.join(ROOT_DIR, 'outdoor_race_hub_gear_watchlist_utf8_bom.csv');
  fs.writeFileSync(backupPath, csvOutput, 'utf-8');
  console.log(`✅ 代わりに ${backupPath} として保存しました。`);
}
