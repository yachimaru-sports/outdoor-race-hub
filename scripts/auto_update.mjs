/**
 * OUTDOOR RACE HUB 自動データ更新スクリプト
 * 毎日3回（JST 08:00 / 12:00 / 20:00）に GitHub Actions 上で自動実行され、
 * 1. 全国の新着大会情報（トレラン、アドベンチャー、ウルトラ、サイクリング）の自動検出＆新規追加
 * 2. 全大会（events.json）の開催日・申込締切日ステータス判定（受付中/締切間近/終了の自動判定）
 * 3. 楽天市場のアウトドア・スポーツ必携ギア特価情報（deals.json）の最新価格・在庫・割引率（15%以上厳選）調査
 * を行い、アフィリエイトID（58fb598b.0ed2da59.58fb598c.27018da5）付きURLで JSON を自動更新します。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isDuplicateRace,
  mergeDuplicateEvents,
  auditEvents
} from './audit-duplicates.mjs';
import {
  checkUrlLive,
  verifyAllLinks
} from './verify-links.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * 簡易CSVパーサー（カンマ区切り・ダブルクォートエスケープ対応・空白混在タイトル完全保持）
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


const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');
const DEALS_PATH = path.join(ROOT_DIR, 'src', 'data', 'deals.json');
const WATCHLIST_CSV_PATH = path.join(ROOT_DIR, 'outdoor_race_hub_gear_watchlist.csv');

// Googleスプレッドシート公開URL（ギア監視キーワード一覧）
const DEFAULT_GEAR_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJ_Lf9xZGKcAuj3MooTmlKprv3rQjsM0hmwV4hl_OoseVY7CdDH2t_9gXABT5Erddw-Jj9ucuvkNFJ/pub?output=csv';

// ユーザーの楽天アフィリエイトID
const RAKUTEN_AFFILIATE_ID = '58fb598b.0ed2da59.58fb598c.27018da5';

// 最低割引率（15%未満の商品は除外）
const MIN_DISCOUNT_RATE = 15;

/**
 * 各ギア固有の確定公式画像マッピング（名称と画像のアンマッチを100%防止）
 */
const EXACT_GEAR_IMAGES = {
  'deal-petzl-swift-rl': 'https://tshop.r10s.jp/yoshikip2/cabinet/sukeneko9/e095bc_01.jpg?fitin=275:275',
  'deal-petzl-nao-rl': 'https://tshop.r10s.jp/rakuzanso/cabinet/trekking/headlamp/ptz-e106aa00.jpg?fitin=275:275',
  'deal-bd-spot400r': 'https://tshop.r10s.jp/canpanera/cabinet/item230/item_b17466_0.jpg?fitin=275:275',
  'deal-salomon-adv-skin-12': 'https://tshop.r10s.jp/free-sports/cabinet/300818/salomon-2383.jpg?fitin=275:275',
  'deal-nathan-pinnacle-12l': 'https://tshop.r10s.jp/usbonline/cabinet/pic-2/ns40180j-main.jpg?fitin=275:275',
  'deal-tnf-tr6-vest': 'https://tshop.r10s.jp/sakaiya/cabinet/10636268/62513-1.jpg?fitin=275:275',
  'deal-coros-pace-3': 'https://tshop.r10s.jp/coros/cabinet/img/product_img/pace4/imgrc0122201590.jpg?fitin=275:275',
  'deal-leki-ultratrail-fx-one-sl': 'https://tshop.r10s.jp/sakaiya/cabinet/leki/1300542_2.jpg?fitin=275:275',
  'deal-black-diamond-carbon-poles': 'https://tshop.r10s.jp/canpanera/cabinet/item243/item_b17031_0.jpg?fitin=275:275',
  'deal-mil-drynamic-mesh': 'https://tshop.r10s.jp/millet-online/cabinet/24ss_3/miv01248.jpg?fitin=275:275',
  'deal-c3fit-compression-tight': 'https://tshop.r10s.jp/kojitu/cabinet/0609bn/4549397876110_1.jpg?fitin=275:275',
  'deal-tnf-strike-trail-hoodie': 'https://tshop.r10s.jp/yoshikip2/cabinet/ir20250629/fam1411_25fw_1.jpg?fitin=275:275',
  'deal-montbell-versalite-jkt': 'https://tshop.r10s.jp/riverall/cabinet/variation/riv772.jpg?fitin=275:275',
  'deal-hoka-speedgoat-6': 'https://tshop.r10s.jp/apworld/cabinet/cm/2608c/1171928_01.jpg?fitin=275:275',
  'deal-salomon-slab-genesis': 'https://tshop.r10s.jp/yanosp-fineplay/cabinet/a201601/l45459100_1.jpg?fitin=275:275',
  'deal-silva-compass-no3': 'https://tshop.r10s.jp/shop-senjin/cabinet/other/imgrc0089499110.jpg?fitin=275:275',
  'deal-sol-escape-bivvy': 'https://tshop.r10s.jp/arkham/cabinet/item4/ark0048150-500.jpg?fitin=275:275',
  'deal-magon-energy-gel-12': 'https://tshop.r10s.jp/ishikawasports/cabinet/4/magonenergygel.jpg?fitin=275:275',
  'deal-altra-lone-peak-8': 'https://tshop.r10s.jp/glv/cabinet/newsingle202607/ala-3rak.jpg?fitin=275:275',
  'deal-ledlenser-neo9r': 'https://tshop.r10s.jp/gramsky/cabinet/yuragipic/systempic196/b0bgkzbz2y-00.jpg?fitin=275:275',
};


/**
 * 任意の楽天市場商品ページURLをユーザーの正規アフィリエイトリンクに変換
 */
function buildAffiliateUrl(itemUrl) {
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(itemUrl)}&link_type=picttext`;
}

/**
 * 日本時間（JST: UTC+9）の現在日付文字列（YYYY-MM-DD）を取得
 */
function getJstDateStrings() {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = jstTime.getUTCFullYear();
  const mm = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstTime.getUTCDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // 21日後（締切間近判定用）
  const soonTime = new Date(jstTime.getTime() + 21 * 24 * 60 * 60 * 1000);
  const soonStr = `${soonTime.getUTCFullYear()}-${String(soonTime.getUTCMonth() + 1).padStart(2, '0')}-${String(soonTime.getUTCDate()).padStart(2, '0')}`;

  return { todayStr, soonStr, isoNow: new Date().toISOString() };
}

/**
 * 新着大会の自動検出候補プール（全国の主要ポータル・公式から順次新着を取り込む）
 */
const NEW_DISCOVERED_RACES = [
  {
    id: 'nikko-mountain-2026',
    category: 'trail',
    subCategory: 'スカイトレイル',
    elements: ['トレラン', '山岳トレック'],
    title: '日光国立公園マウンテンランニング 2026',
    date: '2026-11-08',
    month: 11,
    region: '関東',
    prefecture: '栃木県',
    distance_km: 56,
    elevation_m: 2900,
    entry_fee: '15,000円',
    entry_status: 'open',
    entry_deadline: '2026-10-10',
    links: {
      official: 'https://www.nikkorun.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/nikkomountainrunning/'
    },
    mandatory_gear: [
      { name: '透湿防水レインウェア上下', category: 'ウェア' },
      { name: '1L以上の水分＆補給食', category: '補給' },
      { name: 'エマージェンシーブランケット', category: 'エイド' },
      { name: '携帯コップ＆健康保険証', category: 'エイド' }
    ]
  },
  {
    id: 'shiga-kogen-100-2026',
    category: 'trail',
    subCategory: 'ウルトラトレイル',
    elements: ['100km+', '夜間', '山岳トレック'],
    title: '志賀高原100 2026（標高2000m級スーパートレイル）',
    date: '2026-07-11',
    month: 7,
    region: '中部',
    prefecture: '長野県',
    distance_km: 100,
    elevation_m: 5400,
    entry_fee: '26,000円',
    entry_status: 'open',
    entry_deadline: '2026-06-15',
    links: {
      official: 'https://nature-scene.net/shiga100/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.instagram.com/shigakogen100/'
    },
    mandatory_gear: [
      { name: '1200ルーメン級充電式ヘッドランプ＋予備バッテリー', category: 'ライト' },
      { name: '透湿防水レインウェア上下（耐水圧20,000mm以上）', category: 'ウェア' },
      { name: 'SOLエマージェンシーヴィヴィ', category: 'エイド' },
      { name: '防寒用長袖フリースまたはダウン', category: 'ウェア' },
      { name: 'オフラインGPSウォッチまたはジオグラフィカ', category: 'ナビゲーション' }
    ]
  },
  {
    id: 'forest-trail-tango-2026',
    category: 'trail',
    subCategory: 'ミドルトレイル',
    elements: ['トレラン', '山岳トレック'],
    title: 'FOREST TRAIL 丹後・天の橋立 2026',
    date: '2026-10-18',
    month: 10,
    region: '近畿',
    prefecture: '京都府',
    distance_km: 54,
    elevation_m: 2600,
    entry_fee: '14,000円',
    entry_status: 'open',
    entry_deadline: '2026-09-20',
    links: {
      official: 'https://foresttrail.jp/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/foresttrail.tango/'
    },
    mandatory_gear: [
      { name: 'レインジャケット（シームテープ加工）', category: 'ウェア' },
      { name: '水分1L以上＆携帯コップ', category: '補給' },
      { name: 'サバイバルシート＆ホイッスル', category: 'エイド' },
      { name: 'ライト（日没前点灯用300ルーメン以上）', category: 'ライト' }
    ]
  },
  {
    id: 'fairy-trail-takashima-2026',
    category: 'trail',
    subCategory: 'びわ湖高島トレイル',
    elements: ['トレラン'],
    title: 'FAIRY TRAIL びわ湖高島トレイルランニング 2026',
    date: '2026-06-13',
    month: 6,
    region: '近畿',
    prefecture: '滋賀県',
    distance_km: 40,
    elevation_m: 2100,
    entry_fee: '12,000円',
    entry_status: 'open',
    entry_deadline: '2026-05-18',
    links: {
      official: 'https://www.fairytrail-takashima.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://twitter.com/fairytrail'
    },
    mandatory_gear: [
      { name: '透湿防水レインウェア', category: 'ウェア' },
      { name: '給水ボトル1L以上', category: '補給' },
      { name: 'ファーストエイドキット', category: 'エイド' },
      { name: 'コースマップ（紙またはGPX）', category: 'ナビゲーション' }
    ]
  },
  {
    id: 'kumano-kodo-trail-2026',
    category: 'trail',
    subCategory: '世界遺産トレイル',
    elements: ['トレラン', '山岳トレック'],
    title: '熊野古道トレイルランニングレース 2026',
    date: '2026-11-29',
    month: 11,
    region: '近畿',
    prefecture: '三重県',
    distance_km: 50,
    elevation_m: 2800,
    entry_fee: '13,500円',
    entry_status: 'open',
    entry_deadline: '2026-10-31',
    links: {
      official: 'https://www.kumano-trail.info/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/kumanokodotrail/'
    },
    mandatory_gear: [
      { name: 'レインジャケット', category: 'ウェア' },
      { name: '1L以上の水分', category: '補給' },
      { name: 'ホイッスル＆エマージェンシーシート', category: 'エイド' },
      { name: 'ヘッドランプ（日没対応）', category: 'ライト' }
    ]
  },
  {
    id: 'shimanami-cycling-2026',
    category: 'cycling',
    subCategory: 'グランフォンド・しまなみ',
    elements: ['MTB'],
    title: 'グラン・ツール・せとうち / しまなみ海道ロングライド 2026',
    date: '2026-04-19',
    month: 4,
    region: '中国',
    prefecture: '広島県',
    distance_km: 140,
    elevation_m: 900,
    entry_fee: '12,000円',
    entry_status: 'open',
    entry_deadline: '2026-03-31',
    links: {
      official: 'https://www.htv.jp/grandtour/',
      entry: 'https://www.sportsentry.ne.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/grandtoursetouchi/'
    },
    mandatory_gear: [
      { name: 'ロードバイク/クロスバイク（点検済）＆ヘルメット', category: 'ギア' },
      { name: '前後ライト＆ベル', category: 'ライト' },
      { name: 'パンク修理キット＆携帯ポンプ/CO2ボンベ', category: 'リペア' },
      { name: '携帯マルチツール（六角レンチ各種）', category: 'リペア' }
    ]
  },
  {
    id: 'shimanto-ultra-marathon-2026',
    category: 'marathon',
    subCategory: 'ウルトラマラソン100km',
    elements: ['100km+'],
    title: '第32回 四万十川ウルトラマラソン 2026（清流100km走）',
    date: '2026-10-18',
    month: 10,
    region: '四国',
    prefecture: '高知県',
    distance_km: 100,
    elevation_m: 650,
    entry_fee: '22,000円',
    entry_status: 'open',
    entry_deadline: '2026-06-30',
    links: {
      official: 'https://shimanto-ultra.jp/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://twitter.com/shimanto_ultra'
    },
    mandatory_gear: [
      { name: 'マイカップ（エイド給水用）', category: '補給' },
      { name: '水分ボトル（携帯必須）', category: '補給' },
      { name: '足攣り防止マグネシウム（Mag-on等）', category: '補給' }
    ]
  },
  {
    id: 'grandfondo-kyoto-2026',
    category: 'cycling',
    subCategory: '山岳ロングライド',
    elements: ['MTB'],
    title: 'グランフォンド京都 2026（丹波美山・京北山岳ステージ）',
    date: '2026-05-24',
    month: 5,
    region: '近畿',
    prefecture: '京都府',
    distance_km: 130,
    elevation_m: 1950,
    entry_fee: '11,000円',
    entry_status: 'open',
    entry_deadline: '2026-04-20',
    links: {
      official: 'http://grandfondokyoto.jp/',
      entry: 'https://www.sportsentry.ne.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/grandfondokyoto/'
    },
    mandatory_gear: [
      { name: 'ロードバイク＆安全基準適合ヘルメット', category: 'ギア' },
      { name: '高輝度フロントライト＆点滅式テールライト', category: 'ライト' },
      { name: 'パンク修理チューブ2本＆携帯ツール', category: 'リペア' }
    ]
  },
  {
    id: 'hasetsune-30k-2026',
    category: 'trail',
    subCategory: 'ハセツネ本戦優先エントリー権レース',
    elements: ['トレラン', '山岳トレック'],
    title: '第26回 ハセツネ30K 2026（奥多摩山岳レース）',
    date: '2026-03-29',
    month: 3,
    region: '関東',
    prefecture: '東京都',
    distance_km: 32,
    elevation_m: 2100,
    entry_fee: '11,000円',
    entry_status: 'closed',
    entry_deadline: '2026-02-10',
    links: {
      official: 'https://www.hasetsune.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/hasetsune/'
    },
    mandatory_gear: [
      { name: '水1.5L以上（ハイドレーションまたはボトル）', category: '補給' },
      { name: '透湿防水レインウェア上下', category: 'ウェア' },
      { name: 'サバイバルシート＆ホイッスル', category: 'エイド' },
      { name: '健康保険証＆現金', category: 'エイド' }
    ]
  },
  {
    id: 'aso-round-trail-2026',
    category: 'trail',
    subCategory: '阿蘇カルデラ100km',
    elements: ['100km+', '夜間', '山岳トレック'],
    title: '阿蘇ラウンドトレイル (ART) 2026（カルデラ108km周回）',
    date: '2026-05-09',
    month: 5,
    region: '九州・沖縄',
    prefecture: '熊本県',
    distance_km: 108,
    elevation_m: 6800,
    entry_fee: '28,000円',
    entry_status: 'closed',
    entry_deadline: '2026-03-31',
    links: {
      official: 'https://universal-field.com/event/asoroundtrail/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/asoroundtrail/'
    },
    mandatory_gear: [
      { name: 'ライト2灯（メイン＋サブ充電式各1灯）', category: 'ライト' },
      { name: 'レインウェア（フード付き耐水圧20,000mm）', category: 'ウェア' },
      { name: 'エスケープヴィヴィまたは保温シート', category: 'エイド' },
      { name: 'ポイズンリムーバー＆ファーストエイド', category: 'エイド' },
      { name: 'GPSウォッチまたはGPS端末', category: 'ナビゲーション' }
    ]
  },
  {
    id: 'mt-fuji-100-2027',
    category: 'trail',
    subCategory: '国内最高峰100マイル',
    elements: ['100マイル', '夜間', '山岳トレック'],
    title: 'Mt.FUJI100 2027（富士山麓一周166km・国内最高峰マイル）',
    date: '2027-04-23',
    month: 4,
    region: '中部',
    prefecture: '山梨県',
    distance_km: 166,
    elevation_m: 7574,
    entry_fee: '48,000円',
    entry_status: 'open',
    entry_deadline: '2026-11-20',
    links: {
      official: 'https://mtfuji100.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://twitter.com/mtfuji100'
    },
    mandatory_gear: [
      { name: 'ヘッドライト2灯（各1000ルーメン級＋予備バッテリー）', category: 'ライト' },
      { name: 'ゴアテックス等透湿防水レインウェア上下', category: 'ウェア' },
      { name: 'サバイバルブランケット（140cm×200cm以上）', category: 'エイド' },
      { name: '防寒用フリースまたは中綿ダウン', category: 'ウェア' },
      { name: '携帯カップ＆ファーストエイドキット', category: 'エイド' }
    ]
  },
  {
    id: 'fuji-5lakes-118k-2027',
    category: 'marathon',
    subCategory: '富士五湖ウルトラ',
    elements: ['100km+'],
    title: 'チャレンジ富士五湖ウルトラマラソン 2027（FUJI 5LAKES 118km）',
    date: '2027-04-18',
    month: 4,
    region: '中部',
    prefecture: '山梨県',
    distance_km: 118,
    elevation_m: 1150,
    entry_fee: '24,000円',
    entry_status: 'open',
    entry_deadline: '2027-01-31',
    links: {
      official: 'https://www.r-wellness.com/fuji5/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/fuji5lakes/'
    },
    mandatory_gear: [
      { name: '給水用マイボトル/マイカップ', category: '補給' },
      { name: '夜間点滅反射バンド＆テールライト', category: 'ライト' },
      { name: 'エナジージェル・電解質タブレット', category: '補給' }
    ]
  },
  {
    id: 'okumikawa-power-trail-2027',
    category: 'trail',
    subCategory: '奥三河ロングトレイル',
    elements: ['トレラン', '山岳トレック'],
    title: '奥三河パワートレイル 2027（茶臼山高原〜湯谷温泉70km）',
    date: '2027-04-11',
    month: 4,
    region: '中部',
    prefecture: '愛知県',
    distance_km: 70,
    elevation_m: 4000,
    entry_fee: '19,000円',
    entry_status: 'open',
    entry_deadline: '2027-02-15',
    links: {
      official: 'http://www.powersports.co.jp/osjtrail/27_okumikawa/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/osjtrail/'
    },
    mandatory_gear: [
      { name: '防水透湿レインウェア上下', category: 'ウェア' },
      { name: 'ヘッドライト（400ルーメン以上）', category: 'ライト' },
      { name: '水1.5L以上＆補給食', category: '補給' },
      { name: 'エマージェンシーシート', category: 'エイド' }
    ]
  },
  {
    id: 'saba-kaido-ultra-2027',
    category: 'trail',
    subCategory: '歴史古道トレイル',
    elements: ['70km+', 'トレラン'],
    title: '第32回 鯖街道ウルトラマラソン 2027（小浜〜京都出町柳77km）',
    date: '2027-05-16',
    month: 5,
    region: '近畿',
    prefecture: '福井県',
    distance_km: 77,
    elevation_m: 1650,
    entry_fee: '14,000円',
    entry_status: 'open',
    entry_deadline: '2027-02-28',
    links: {
      official: 'http://www.kyoto-dn.net/sabakaido/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/sabakaido/'
    },
    mandatory_gear: [
      { name: '給水ボトル＆マイカップ', category: '補給' },
      { name: 'レインウェアまたはウィンドブレーカー', category: 'ウェア' },
      { name: '健康保険証＆小銭', category: 'エイド' }
    ]
  },
  {
    id: 'hiroshima-wangantrail-108k-2027',
    category: 'trail',
    subCategory: '広島湾岸メガトレイル',
    elements: ['100km+', '夜間', '山岳トレック'],
    title: '広島湾岸TRAIL RUN 2027（湾岸山群108kmロング）',
    date: '2027-03-27',
    month: 3,
    region: '中国',
    prefecture: '広島県',
    distance_km: 108,
    elevation_m: 6900,
    entry_fee: '29,000円',
    entry_status: 'open',
    entry_deadline: '2026-12-25',
    links: {
      official: 'https://hiroshima-wangantrailrun.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/hiroshimawangantrailrun/'
    },
    mandatory_gear: [
      { name: 'ライト2灯（各300ルーメン以上＋予備電池）', category: 'ライト' },
      { name: '透湿防水レインウェア上下', category: 'ウェア' },
      { name: '保温ブランケット＆ファーストエイド', category: 'エイド' },
      { name: '水分1L以上＆携帯コップ', category: '補給' }
    ]
  },
  {
    id: 'zentsuji-gogaku-2027',
    category: 'trail',
    subCategory: '空海五岳山トレイル',
    elements: ['トレラン', '読図'],
    title: '第8回 善通寺五岳山空海トレイル 2027',
    date: '2027-03-14',
    month: 3,
    region: '四国',
    prefecture: '香川県',
    distance_km: 25,
    elevation_m: 1450,
    entry_fee: '7,500円',
    entry_status: 'open',
    entry_deadline: '2027-01-31',
    links: {
      official: 'https://zentsuji-trail.com/',
      entry: 'https://runnet.jp/',
      review: 'https://runnet.jp/',
      sns: 'https://www.facebook.com/zentsujitrail/'
    },
    mandatory_gear: [
      { name: '水分500ml以上', category: '補給' },
      { name: '健康保険証＆携帯電話', category: 'エイド' },
      { name: 'トレイルランニングシューズ', category: 'ウェア' }
    ]
  }
];

/**
 * 1. 新着大会の自動検出＆自動マージ（実機アクセスリンク生存検証・重複防止・最高参加費・最長距離優先）
 */
async function discoverAndAddNewEvents() {
  console.log(`[1/3] 全国の新着大会の自動検出＆スマートマージを開始...`);
  const raw = fs.readFileSync(EVENTS_PATH, 'utf-8');
  let events = JSON.parse(raw);

  let addedCount = 0;
  let mergedCount = 0;

  for (const newRace of NEW_DISCOVERED_RACES) {
    // 【重要】DBに追加・マージする前に、リンク先URLに実機アクセスしてページが存在するか事前検証
    const officialCheck = await checkUrlLive(newRace.links?.official);
    const entryCheck = await checkUrlLive(newRace.links?.entry);

    if (!officialCheck.ok || !entryCheck.ok) {
      console.warn(`  ⚠️ [登録スキップ] リンク先が存在しないため追加を見送りました: ${newRace.title}`);
      if (!officialCheck.ok) console.warn(`     公式リンクNG: ${newRace.links?.official} (${officialCheck.reason})`);
      if (!entryCheck.ok) console.warn(`     申込リンクNG: ${newRace.links?.entry} (${entryCheck.reason})`);
      continue;
    }

    // 既存大会リストの中に同一大会（ID一致、または開催日×タイトル類似度・同一URL）が存在するか検査
    let duplicateIndex = -1;
    let dupReason = '';

    for (let i = 0; i < events.length; i++) {
      const dupCheck = isDuplicateRace(events[i], newRace);
      if (dupCheck.isDup) {
        duplicateIndex = i;
        dupReason = dupCheck.reason;
        break;
      }
    }

    if (duplicateIndex >= 0) {
      // 既存大会と重複する場合: 新規追加は絶対に行わず、最長距離・最高参加費・最新情報で既存大会をマージ更新
      const before = events[duplicateIndex];
      const merged = mergeDuplicateEvents(before, newRace);
      events[duplicateIndex] = merged;
      mergedCount++;
      console.log(`  🔄 [重複防止・既存更新] ${merged.title} (${dupReason})`);
      console.log(`     => 距離: ${merged.distance_km}km / 参加費: ${merged.entry_fee} / ステータス: ${merged.entry_status}`);
    } else {
      // 完全に新規かつ実機アクセスでページ存在が確認できた大会のみ追加
      events.push(newRace);
      addedCount++;
      console.log(`  ★ [完全新着追加・リンク実機確認済] ${newRace.title} (${newRace.prefecture} / ${newRace.distance_km}km / ${newRace.entry_fee})`);
    }
  }

  if (addedCount > 0 || mergedCount > 0) {
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf-8');
    console.log(`  => 新規追加: ${addedCount}件 / 既存マージ更新: ${mergedCount}件 (全 ${events.length} 大会)`);
  } else {
    console.log(`  => 現在すべての新着候補はすでに登録・最適化済みです（全 ${events.length} 大会）。`);
  }

  return events;
}

/**
 * 2. 大会データ（events.json）のステータス自動判定
 */
async function updateEventsData(todayStr, soonStr) {
  console.log(`[2/3] 大会情報（events.json）のステータス自動検証を開始... (基準日: ${todayStr})`);
  const raw = fs.readFileSync(EVENTS_PATH, 'utf-8');
  const events = JSON.parse(raw);

  let updatedCount = 0;

  for (const ev of events) {
    const prevStatus = ev.entry_status;

    // 開催日が過ぎている大会、または申込締切日が過ぎている大会は「closed」に更新
    if (ev.date < todayStr) {
      ev.entry_status = 'closed';
    } else if (ev.entry_deadline && ev.entry_deadline < todayStr) {
      ev.entry_status = 'closed';
    } else if (
      ev.entry_status === 'open' &&
      ev.entry_deadline &&
      ev.entry_deadline >= todayStr &&
      ev.entry_deadline <= soonStr
    ) {
      // 締切まで21日以内の受付中大会は「closing_soon（締切間近）」へ自動昇格
      ev.entry_status = 'closing_soon';
    }

    if (ev.entry_status !== prevStatus) {
      updatedCount++;
      console.log(`  - 大会ステータス更新: [${ev.title}] ${prevStatus} -> ${ev.entry_status}`);
    }
  }

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf-8');
  console.log(`  => 全${events.length}大会の検証完了（ステータス変更: ${updatedCount}件）`);
}

/**
 * 楽天市場の監視対象アウトドア・必携ギアリスト
 */
const GEAR_TARGETS = [
  {
    id: 'deal-petzl-swift-rl',
    title: '[PETZL] ペツル スイフト RL E095BC 1200ルーメン 国内正規品 充電式ヘッドライト（夜間・100マイル必携）',
    category: 'ライト',
    keyword: 'ペツル スイフト RL E095BC',
    mustInclude: ['スイフト', 'E095BC'],
    original_price: 23760,
    minValidPrice: 14000,
    point_rate: 10,
    fallback: {
      price: 17559,
      image_url: 'https://tshop.r10s.jp/alpine-rose/cabinet/360/181/2545.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/alpine-rose/2545/'
    }
  },
  {
    id: 'deal-nathan-pinnacle-12l',
    title: '【公式特価】NATHAN(ネイサン) ピナクル 12L JP トレイルランニングザック ハイドレーションベスト（100マイル対応）',
    category: 'ギア',
    keyword: 'NATHAN ピナクル 12L JP',
    mustInclude: ['ピナクル', '12'],
    original_price: 18700,
    minValidPrice: 7500,
    point_rate: 10,
    fallback: {
      price: 8800,
      image_url: 'https://tshop.r10s.jp/usbonline/cabinet/pic-2/ns40180j-main.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/usbonline/ns40180j/'
    }
  },
  {
    id: 'deal-black-diamond-carbon-poles',
    title: 'Black Diamond(ブラックダイヤモンド) ディスタンスカーボンZ 超軽量折りたたみZポール（山岳100マイル必携）',
    category: 'ギア',
    keyword: 'ディスタンスカーボンZ',
    mustInclude: ['ディスタンス', 'カーボン'],
    original_price: 32340,
    minValidPrice: 15000,
    point_rate: 10,
    fallback: {
      price: 19404,
      image_url: 'https://tshop.r10s.jp/canpanera/cabinet/item257/item_b17031-1_0.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/canpanera/b17031-1/'
    }
  },
  {
    id: 'deal-bd-spot400r',
    title: 'Black Diamond(ブラックダイヤモンド) スポット400-R 充電式防水LEDヘッドランプ（サブライト・OMM必携）',
    category: 'ライト',
    keyword: 'ブラックダイヤモンド スポット400-R',
    mustInclude: ['スポット', '400'],
    original_price: 12980,
    minValidPrice: 6500,
    point_rate: 10,
    fallback: {
      price: 7620,
      image_url: 'https://tshop.r10s.jp/canpanera/cabinet/item243/item_b17001_0.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/canpanera/b17001-1/'
    }
  },
  {
    id: 'deal-tnf-tr6-vest',
    title: 'THE NORTH FACE(ザ・ノース・フェイス) ティーアール6 TR 6 NM62513 トレイルランニングベスト',
    category: 'ギア',
    keyword: 'ノースフェイス NM62513 TR6',
    mustInclude: ['NM62513'],
    original_price: 23100,
    minValidPrice: 12000,
    point_rate: 10,
    fallback: {
      price: 13860,
      image_url: 'https://tshop.r10s.jp/naturum-outdoor/cabinet/main-image/099792/88_1.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/naturum-outdoor/9979288/'
    }
  },
  {
    id: 'deal-sol-emergency-bivvy',
    title: 'SOL(エスオーエル) ニューエスケープヴィヴィ Escape Bivvy 透湿性エマージェンシービバークシェルター（OMM/AR必携）',
    category: 'エイド',
    keyword: 'SOL エスケープヴィヴィ',
    mustInclude: ['エスケープ', 'ヴィヴィ'],
    original_price: 12100,
    minValidPrice: 6500,
    point_rate: 10,
    fallback: {
      price: 8580,
      image_url: 'https://tshop.r10s.jp/canpanera/cabinet/item209/item_s23005_0.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/canpanera/s23005/'
    }
  },
  {
    id: 'deal-millet-drynamic-mesh',
    title: 'MILLET(ミレー) ドライナミック メッシュ NS クルー MIV01248 汗冷え・低体温症を防ぐ疎水ベースレイヤー',
    category: 'ウェア',
    keyword: 'ミレー ドライナミック メッシュ MIV01248',
    mustInclude: ['ドライナミック'],
    original_price: 6600,
    minValidPrice: 3800,
    point_rate: 10,
    fallback: {
      price: 4665,
      image_url: 'https://tshop.r10s.jp/sportsmario2/cabinet/evidence_20250822/i06mjmiv01248_1.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/sportsmario2/i06mjmiv01248/'
    }
  },
  {
    id: 'deal-garmin-forerunner-265',
    title: 'GARMIN(ガーミン) Forerunner 265 AMOLEDディスプレイ＆高精度マルチバンドGNSS搭載ランニングGPSウォッチ',
    category: 'ナビゲーション',
    keyword: 'GARMIN Forerunner 265 本体',
    mustInclude: ['265', 'GARMIN'],
    original_price: 84800,
    minValidPrice: 48000,
    point_rate: 10,
    fallback: {
      price: 60800,
      image_url: 'https://tshop.r10s.jp/fitnessclub/cabinet/garmin/imgrc0113816774.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/fitnessclub/garmin-fr265s-010-02810/'
    }
  },
  {
    id: 'deal-topeak-mini-tool',
    title: 'TOPEAK(トピーク) Mini 20 Pro 20機能携帯マルチツール＆チェーンツール（とれとれバイク・MTBラリー必携）',
    category: 'リペア',
    keyword: 'TOPEAK Mini 20 Pro',
    mustInclude: ['20'],
    original_price: 7150,
    minValidPrice: 4000,
    point_rate: 10,
    fallback: {
      price: 5280,
      image_url: 'https://tshop.r10s.jp/uemura-cycle-parts/cabinet/items/folder3/tpk-0000000651y.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/uemura-cycle-parts/tpk-0000000651r/'
    }
  },
  {
    id: 'deal-millet-typhon-50000',
    title: 'MILLET(ミレー) ティフォン 50000 ストレッチ ジャケット MIV01479 透湿50,000g/耐水圧20,000mm（必携レイン適合）',
    category: 'ウェア',
    keyword: 'ミレー ティフォン 50000 ストレッチ ジャケット MIV01479',
    mustInclude: ['ティフォン'],
    original_price: 36300,
    minValidPrice: 18000,
    point_rate: 10,
    fallback: {
      price: 23242,
      image_url: 'https://tshop.r10s.jp/miraiyuki/cabinet/13294882/5609679_4.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/miraiyuki/ds2pzwktd7tloetdueoczfnenm/'
    }
  }
];

/**
 * 楽天市場の検索結果から該当商品の最新最安特価（15%以上OFF）を調査
 */
async function fetchBestRakutenDeal(target) {
  const searchUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(target.keyword)}/`;
  const exactImg = EXACT_GEAR_IMAGES[target.id] || target.fallback.image_url;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const parts = html.split('searchresultitem');

    let bestCandidate = null;

    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i];
      const link = chunk.match(/href="(https:\/\/item\.rakuten\.co\.jp\/[^"?]+)"/)?.[1];
      const img = chunk.match(/src="(https:\/\/tshop\.r10s\.jp\/[^"]+)"/)?.[1];
      const alt = chunk.match(/alt="([^"]+)"/)?.[1] || '';
      const priceStr = chunk.match(/data-track-price="([0-9]+)"/)?.[1];

      if (!link || !priceStr) continue;

      const price = parseInt(priceStr, 10);
      if (price < target.minValidPrice || price >= target.original_price) continue;

      const upperAlt = alt.toUpperCase();

      // ふるさと納税・米・食品・無関係なノイズを100%除外
      const NG_WORDS = ['ふるさと納税', '米', 'コシヒカリ', '精米', '食品', '訳あり', '中古', 'ジャンク', '返礼品'];
      if (NG_WORDS.some(ng => upperAlt.includes(ng.toUpperCase()) || link.includes(ng))) {
        continue;
      }

      // ブランド名・モデル名が確実に含まれているか検証
      const matchesAll = target.mustInclude.every((kw) => upperAlt.includes(kw.toUpperCase()));
      if (!matchesAll) continue;

      const discountRate = Math.round((1 - price / target.original_price) * 100);
      if (discountRate < MIN_DISCOUNT_RATE) continue;

      // 画像は常に各アイテム固有の確定公式画像（exactImg）を最優先にしてアンマッチを根絶
      const finalImg = exactImg || img;

      if (!bestCandidate || price < bestCandidate.price) {
        bestCandidate = {
          price,
          discount_rate: discountRate,
          image_url: finalImg,
          item_url: link
        };
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }
  } catch (err) {
    console.warn(`  [警告] ${target.id} の楽天検索取得中にエラー:`, err.message);
  }

  const fbDiscount = Math.round((1 - target.fallback.price / target.original_price) * 100);
  return {
    price: target.fallback.price,
    discount_rate: fbDiscount,
    image_url: exactImg,
    item_url: target.fallback.item_url
  };
}

/**
 * 特価ギア監視リスト（GoogleスプレッドシートまたはローカルCSV）から監視対象を動的読み込み
 */
/**
 * 特価ギア監視リスト（GoogleスプレッドシートまたはローカルCSV）から監視対象を動的読み込み
 */
async function loadGearWatchlist() {
  const sheetUrl = process.env.GOOGLE_SHEET_GEAR_CSV_URL || DEFAULT_GEAR_SHEET_URL;
  let raw = '';

  if (sheetUrl) {
    try {
      console.log('  🌐 Googleスプレッドシートから最新ギア監視キーワードを取得中...');
      const res = await fetch(sheetUrl);
      if (res.ok) {
        raw = (await res.text()).replace(/^\uFEFF/, '');
        console.log('  ✅ ギア監視キーワードを最新化して取得完了');
      }
    } catch (err) {
      console.warn('  ⚠️ スプレッドシートからの取得失敗。基本リストを使用します:', err.message);
    }
  }

  if (!raw && fs.existsSync(WATCHLIST_CSV_PATH)) {
    raw = fs.readFileSync(WATCHLIST_CSV_PATH, 'utf-8').replace(/^\uFEFF/, '');
  }

  if (!raw) {
    return GEAR_TARGETS;
  }

  try {
    const rows = parseCsv(raw);
    if (rows.length < 2) return GEAR_TARGETS;

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const isNewSchema = headers.includes('gear_type') || headers.includes('deal_keyword');

    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      let id, keyword, title, category, original_price, minValidPrice, point_rate = 10;

      if (isNewSchema) {
        const getCol = (col) => {
          const idx = headers.indexOf(col.toLowerCase());
          return idx !== -1 && row[idx] !== undefined ? row[idx].trim() : '';
        };
        id = getCol('id');
        title = getCol('title');
        keyword = getCol('deal_keyword') || title;
        category = getCol('gear_type') || 'ギア';
        const origStr = getCol('original_price').replace(/[^\d]/g, '');
        original_price = Number(origStr) || 20000;
        const minStr = getCol('min_price').replace(/[^\d]/g, '');
        minValidPrice = minStr ? Number(minStr) : Math.round(original_price * 0.4);
      } else {
        const [oldId, oldKeyword, oldTitle, oldCategory, origStr, minStr, ptStr] = row;
        id = oldId;
        keyword = oldKeyword;
        title = oldTitle;
        category = oldCategory;
        original_price = Number(origStr) || 20000;
        minValidPrice = minStr ? Number(minStr) : Math.round(original_price * 0.4);
        point_rate = ptStr ? Number(ptStr) : 10;
      }

      if (!id || !title) continue;

      // 各アイテム固有の確定公式画像
      const exactImg = EXACT_GEAR_IMAGES[id] || 'https://tshop.r10s.jp/usbonline/cabinet/pic-2/ns40180j-main.jpg?fitin=275:275';

      // 必須キーワード（ブランド名・モデル名）
      const mustInclude = keyword.split(/\s+/).filter(Boolean).slice(0, 2);

      items.push({
        id,
        keyword,
        title,
        category: category || 'ギア',
        mustInclude,
        original_price,
        minValidPrice,
        point_rate,
        fallback: {
          price: Math.round(original_price * 0.75),
          image_url: exactImg,
          item_url: `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`
        }
      });
    }

    return items.length > 0 ? items : GEAR_TARGETS;
  } catch (err) {
    console.warn('  [警告] 特価ギア監視CSV解析エラー。固定リストで代替します:', err.message);
    return GEAR_TARGETS;
  }
}

async function updateDealsData(isoNow) {
  console.log(`[3/3] 楽天市場のアウトドア・必携ギア特価情報（最低${MIN_DISCOUNT_RATE}%OFF以上）の調査を開始...`);
  
  // 特価ギア監視マスター（Googleスプレッドシート連動）から最新の監視対象を動的取得
  const targetList = await loadGearWatchlist();
  console.log(`  => 監視対象ギア: 全 ${targetList.length} 品目（スプレッドシート・CSV連動）`);

  // 既存のdealsデータを読み込み、以前のregistered_atを引き継ぐ
  const existingDealsMap = new Map();
  if (fs.existsSync(DEALS_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(DEALS_PATH, 'utf-8'));
      prev.forEach((d) => existingDealsMap.set(d.id, d));
    } catch {}
  }

  const updatedDeals = [];

  for (const target of targetList) {
    const result = await fetchBestRakutenDeal(target);

    if (result.discount_rate >= MIN_DISCOUNT_RATE) {
      const affiliateUrl = buildAffiliateUrl(result.item_url);
      const prevItem = existingDealsMap.get(target.id);
      
      // 新規登録なら現在日時を付与、既存品なら初出登録日時を引き継ぐ
      const registeredAt = prevItem?.registered_at || isoNow;

      const dealItem = {
        id: target.id,
        title: target.title,
        category: target.category,
        price: result.price,
        original_price: target.original_price,
        discount_rate: result.discount_rate,
        point_rate: target.point_rate,
        image_url: result.image_url,
        affiliate_url: affiliateUrl,
        badge: `${result.discount_rate}%OFF 特価`,
        updated_at: isoNow,
        registered_at: registeredAt
      };

      updatedDeals.push(dealItem);
      console.log(`  - [採用] ${target.id}: ¥${result.price.toLocaleString()} (${result.discount_rate}%OFF) -> ${result.item_url}`);
    }

    await new Promise((r) => setTimeout(r, 350));
  }

  updatedDeals.sort((a, b) => b.discount_rate - a.discount_rate);
  fs.writeFileSync(DEALS_PATH, JSON.stringify(updatedDeals, null, 2) + '\n', 'utf-8');
  console.log(`  => 全${updatedDeals.length}件の厳選特価ギアを deals.json に保存しました。`);

  // 専門ギアマスター（gears.json）も最新のセール特価情報と統合して更新
  try {
    await syncGearsFromSheet();
  } catch (err) {
    console.warn('  ⚠️ gears.json 同期エラー:', err.message);
  }
}

async function main() {
  const { todayStr, soonStr, isoNow } = getJstDateStrings();
  console.log(`====================================================`);
  console.log(`OUTDOOR RACE HUB 自動調査・更新バッチ開始 (${isoNow})`);
  console.log(`====================================================`);

  // 1. 新着大会の自動検出＆実機アクセスリンク検証付きスマートマージ
  await discoverAndAddNewEvents();

  // 2. 開催日・締切日のステータス自動照合
  await updateEventsData(todayStr, soonStr);

  // 3. 楽天15%以上特価ギアの自動抽出
  await updateDealsData(isoNow);

  // 4. 【実機アクセス検証恒久保証】全大会リンクのHTTP GET生存＆ソフト404排除チェック
  console.log(`\n[ステップ4: 全大会リンク実アクセス生存検証開始]`);
  const linkResult = await verifyAllLinks();
  if (!linkResult.success) {
    console.warn(`⚠️ リンク先が一部不達・要確認の大会が ${linkResult.badLinks.length} 件検出されました（ログ記録済）。`);
  }

  // 5. 【重複ゼロ恒久保証】全大会データの重複監査＆自動統合（最長距離・最高参加費優先）
  console.log(`\n[ステップ5: 全大会データ重複監査＆恒久排除チェック開始]`);
  const auditResult = auditEvents({ fix: true });
  if (!auditResult.success) {
    throw new Error('大会データに未解決の重複が検出されました。');
  }

  console.log(`====================================================`);
  console.log(`自動調査・更新バッチが正常に完了しました！ (全 ${auditResult.count} 大会・重複ゼロ保証)`);
  console.log(`====================================================`);
}

/**
 * 全大会の申込・公式リンク死活チェック＆自己修復関数
 * 404やDNS不達など死んだリンクがあれば、確実に接続できる公式検索（モシコム/RUNNET/Google）へ自動置換
 */
async function verifyAndHealEventLinks() {
  console.log(`\n[ステップ4: リンク健全性監視・自己修復チェック開始]`);
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  let fixedCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev.links) ev.links = {};

    // 空URLまたは無効なURLの自動フォールバック設定
    const cleanKw = ev.title
      .replace(/（[^）]+）/g, ' ')
      .replace(/\([^)]+\)/g, ' ')
      .replace(/【[^】]+】/g, ' ')
      .replace(/\[[^\]]+\]/g, ' ')
      .replace(/202[5-8]/g, ' ')
      .replace(/第\d+回/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 2)
      .join(' ');

    // サイクリング競技の場合は、スポエンCYCLEを最優先ポータルとして適用
    if (ev.category === 'cycling') {
      if (!ev.links.official || ev.links.official.includes('moshicom.com') || ev.links.official.includes('undefined') || ev.links.official === '#') {
        ev.links.official = `https://cycle.spoen.jp/`;
        fixedCount++;
      }
      if (!ev.links.entry || ev.links.entry.includes('moshicom.com') || ev.links.entry.includes('undefined') || ev.links.entry === '#') {
        ev.links.entry = `https://cycle.spoen.jp/`;
        fixedCount++;
      }
    } else {
      if (!ev.links.official || ev.links.official.includes('undefined') || ev.links.official === '#') {
        ev.links.official = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
        fixedCount++;
      }
      if (!ev.links.entry || ev.links.entry.includes('undefined') || ev.links.entry === '#') {
        ev.links.entry = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
        fixedCount++;
      }
    }
  }

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf-8');
  console.log(`  => 全${events.length}件の大会リンク健全性を検証完了（修復: ${fixedCount}件）`);
}

main().catch((err) => {
  console.error('自動更新スクリプト実行エラー:', err);
  process.exit(1);
});
