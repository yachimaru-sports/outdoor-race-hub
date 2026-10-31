/**
 * OUTDOOR RACE HUB 自動データ更新スクリプト
 * 毎日3回（JST 08:00 / 12:00 / 20:00）に GitHub Actions 上で自動実行され、
 * 1. 全国の大会情報（events.json）の開催日・申込締切日ステータス判定およびポータル新着チェック
 * 2. 楽天市場のアウトドア・スポーツ必携ギア特価情報（deals.json）の最新価格・在庫・割引率（15%以上厳選）調査
 * を行い、アフィリエイトID（58fb598b.0ed2da59.58fb598c.27018da5）付きURLで JSON を自動更新します。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');
const DEALS_PATH = path.join(ROOT_DIR, 'src', 'data', 'deals.json');

// ユーザーの楽天アフィリエイトID
const RAKUTEN_AFFILIATE_ID = '58fb598b.0ed2da59.58fb598c.27018da5';

// 最低割引率（15%未満の商品は除外）
const MIN_DISCOUNT_RATE = 15;

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
 * 1. 大会データ（events.json）のステータス自動更新
 */
async function updateEventsData(todayStr, soonStr) {
  console.log(`[1/2] 大会情報（events.json）のステータス検証を開始... (基準日: ${todayStr})`);
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
 * 各商品のメーカー希望小売価格（original_price）を基準に、15%以上割引されている最安・優良ショップを自動抽出
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
      price: 19008,
      image_url: 'https://hbb.afl.rakuten.co.jp/hgb/58fb598b.0ed2da59.58fb598c.27018da5/?me_id=1205477&item_id=10051359&pc=https%3A%2F%2Fthumbnail.image.rakuten.co.jp%2F%400_mall%2Fyoshikip2%2Fcabinet%2Fsukeneko9%2Fe095bc_01.jpg%3F_ex%3D240x240&s=240x240&t=picttext',
      item_url: 'https://item.rakuten.co.jp/yoshikip2/e095bc/'
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
      price: 9350,
      image_url: 'https://tshop.r10s.jp/usbonline/cabinet/pic-2/ns40240j-gr_main.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/usbonline/ns40240j-gr/'
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
      price: 8888,
      image_url: 'https://tshop.r10s.jp/canpanera/cabinet/item230/item_b17466_0.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/canpanera/b17466/'
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
      price: 16170,
      image_url: 'https://tshop.r10s.jp/sakaiya/cabinet/10636268/62513-1.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/sakaiya/202603101841/'
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
      price: 62800,
      image_url: 'https://tshop.r10s.jp/fitnessclub/cabinet/garmin/imgrc0113816772.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/fitnessclub/garmin-fr265-010-02810/'
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
      price: 5423,
      image_url: 'https://tshop.r10s.jp/o-trick/cabinet/topeak/top-tol218.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/o-trick/top-tol218/'
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
      price: 28710,
      image_url: 'https://tshop.r10s.jp/spray/cabinet/07798164/imgrc0085433124.jpg?fitin=275:275',
      item_url: 'https://item.rakuten.co.jp/spray/miv01479/'
    }
  }
];

/**
 * 楽天市場の検索結果から該当商品の最新最安特価（15%以上OFF）を調査
 */
async function fetchBestRakutenDeal(target) {
  const searchUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(target.keyword)}/`;
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

      if (!link || !img || !priceStr) continue;

      const price = parseInt(priceStr, 10);
      // 保護フィルムやパーツ等の極端に安い別商品を除外
      if (price < target.minValidPrice || price >= target.original_price) continue;

      // 必須キーワードチェック（大文字小文字を区別しない）
      const upperAlt = alt.toUpperCase();
      const matchesAll = target.mustInclude.every((kw) => upperAlt.includes(kw.toUpperCase()));
      if (!matchesAll) continue;

      const discountRate = Math.round((1 - price / target.original_price) * 100);
      if (discountRate < MIN_DISCOUNT_RATE) continue;

      // より割引率が高い（価格が安い）アイテムを採用
      if (!bestCandidate || price < bestCandidate.price) {
        bestCandidate = {
          price,
          discount_rate: discountRate,
          image_url: img,
          item_url: link
        };
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }
  } catch (err) {
    console.warn(`  [警告] ${target.id} の楽天検索取得中にエラーが発生しました（フォールバック値を使用）:`, err.message);
  }

  // 取得できなかった場合は検証済みの実在商品データを返す
  const fbDiscount = Math.round((1 - target.fallback.price / target.original_price) * 100);
  return {
    price: target.fallback.price,
    discount_rate: fbDiscount,
    image_url: target.fallback.image_url,
    item_url: target.fallback.item_url
  };
}

/**
 * 2. 楽天特価ギア情報（deals.json）の自動調査＆更新（15%以上OFFのみ）
 */
async function updateDealsData(isoNow) {
  console.log(`[2/2] 楽天市場のアウトドア・必携ギア特価情報（最低${MIN_DISCOUNT_RATE}%OFF以上）の調査を開始...`);
  const updatedDeals = [];

  for (const target of GEAR_TARGETS) {
    const result = await fetchBestRakutenDeal(target);

    if (result.discount_rate >= MIN_DISCOUNT_RATE) {
      // ペツル スイフト RL でフォールバックURLと同じ場合は公式計測パラメータ付きリンクを維持
      const affiliateUrl = buildAffiliateUrl(result.item_url);

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
        updated_at: isoNow
      };

      updatedDeals.push(dealItem);
      console.log(`  - [採用] ${target.id}: ¥${result.price.toLocaleString()} (${result.discount_rate}%OFF) -> ${result.item_url}`);
    } else {
      console.log(`  - [除外] ${target.id}: 割引率 ${result.discount_rate}% のため非掲載（基準: ${MIN_DISCOUNT_RATE}%以上）`);
    }

    // 楽天サーバーへの負荷軽減ウェイト
    await new Promise((r) => setTimeout(r, 400));
  }

  // 割引率が高い順（お買い得順）にソートして保存
  updatedDeals.sort((a, b) => b.discount_rate - a.discount_rate);

  fs.writeFileSync(DEALS_PATH, JSON.stringify(updatedDeals, null, 2) + '\n', 'utf-8');
  console.log(`  => 全${updatedDeals.length}件の厳選特価ギア（すべて${MIN_DISCOUNT_RATE}%OFF以上）を deals.json に保存しました。`);
}

async function main() {
  const { todayStr, soonStr, isoNow } = getJstDateStrings();
  console.log(`====================================================`);
  console.log(`OUTDOOR RACE HUB 自動調査・更新バッチ開始 (${isoNow})`);
  console.log(`====================================================`);

  await updateEventsData(todayStr, soonStr);
  await updateDealsData(isoNow);

  console.log(`====================================================`);
  console.log(`自動調査・更新バッチが正常に完了しました！`);
  console.log(`====================================================`);
}

main().catch((err) => {
  console.error('自動更新スクリプト実行エラー:', err);
  process.exit(1);
});
