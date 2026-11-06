import fs from 'node:fs';
import { fetchItemPage } from './fetch_item_util.mjs';

const SEARCH_QUERIES = [
  // トレランシューズ
  { query: 'トレイルランニング シューズ 30%OFF', category: 'トレランシューズ', sports: ['trail'] },
  { query: 'サロモン トレラン シューズ セール 30%', category: 'トレランシューズ', sports: ['trail'] },
  { query: 'ホカ トレイル シューズ 30%OFF', category: 'トレランシューズ', sports: ['trail'] },
  { query: 'アルトラ トレラン セール 30%', category: 'トレランシューズ', sports: ['trail'] },
  // トレランザック
  { query: 'サロモン レースベスト 30%OFF', category: 'トレランザック', sports: ['trail', 'marathon'] },
  { query: 'トレラン ザック 30%OFF', category: 'トレランザック', sports: ['trail', 'adventure'] },
  // ポール
  { query: 'トレイル トレッキングポール カーボン 30%OFF', category: 'トレッキングポール', sports: ['trail', 'adventure'] },
  { query: 'ブラックダイヤモンド ポール セール 30%', category: 'トレッキングポール', sports: ['trail', 'adventure'] },
  // レインウェア・パンツ
  { query: 'ノースフェイス レインウェア 30%OFF', category: 'レインウェア', sports: ['trail', 'adventure', 'cycling'] },
  { query: '防水 レインパンツ 登山 30%OFF', category: 'レインパンツ', sports: ['trail', 'adventure'] },
  // ライト
  { query: 'ペツル ヘッドライト 30%OFF', category: 'ヘッドライト', sports: ['trail', 'adventure'] },
  { query: 'ヘッドライト 登山 防水 30%OFF', category: 'ヘッドライト', sports: ['trail', 'adventure'] },
  // タイツ・ソックス
  { query: 'C3fit タイツ セール 30%', category: 'サポートタイツ', sports: ['trail', 'marathon'] },
  { query: 'CW-X タイツ セール 30%', category: 'サポートタイツ', sports: ['trail', 'marathon'] },
  // サイクル
  { query: 'サイクルジャージ 30%OFF パールイズミ', category: 'サイクルウェア', sports: ['cycling'] },
  { query: '自転車 ヘルメット ロードバイク 30%OFF', category: 'ヘルメット', sports: ['cycling'] },
  { query: 'キャットアイ ライト 自転車 30%OFF', category: 'サイクルライト', sports: ['cycling', 'adventure'] },
  // 防災・エマージェンシー・エイド
  { query: 'エマージェンシーヴィヴィ 登山 30%OFF', category: 'エマージェンシー用品', sports: ['trail', 'adventure'] },
  { query: '防水 ドライバッグ 登山 30%OFF', category: '防水スタッフバッグ', sports: ['adventure', 'trail'] },
  // マラソン
  { query: 'ランニングシューズ 厚底 30%OFF アシックス', category: 'ランニングシューズ', sports: ['marathon'] },
  { query: 'ランニングポーチ 揺れない セール 30%', category: 'ウエストポーチ', sports: ['marathon', 'trail'] },
  { query: 'エナジージェル マラソン セット 25%OFF', category: '補給食・ジェル', sports: ['marathon', 'trail', 'cycling', 'adventure'] }
];

async function searchUrls(query) {
  const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const itemUrls = [...html.matchAll(/href=["'](https:\/\/item\.rakuten\.co\.jp\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+)\/?["']/gi)];
    return [...new Set(itemUrls.map(m => m[1]))];
  } catch (e) {
    return [];
  }
}

async function collectRealSaleDeals() {
  console.log('--- 25%以上OFFの実在ギア探索開始 ---');
  const candidates = [];
  const seenUrls = new Set();

  for (const q of SEARCH_QUERIES) {
    console.log(`\n検索中: [${q.category}] ${q.query}`);
    const urls = await searchUrls(q.query);
    console.log(`  取得URL数: ${urls.length}件`);

    let foundForQuery = 0;
    for (const u of urls) {
      if (seenUrls.has(u)) continue;
      seenUrls.add(u);

      const details = await fetchItemPage(u);
      if (!details) continue;

      // 割引率が25%以上かつ画像・価格が有効なもののみ採用
      if (details.discountRate >= 25 && details.price > 0 && details.imageUrl && details.title.length > 5) {
        console.log(`  ✅ 適合! [${details.discountRate}%OFF] ${details.price}円 (定価:${details.originalPrice}円) - ${details.title.slice(0, 40)}`);
        candidates.push({
          ...details,
          category: q.category,
          sports: q.sports,
          query: q.query
        });
        foundForQuery++;
        if (foundForQuery >= 3) break; // 各クエリから最大3件厳選
      }
    }
  }

  console.log(`\n合計発見数: ${candidates.length}件`);
  fs.writeFileSync('scripts/collected_real_sales.json', JSON.stringify(candidates, null, 2), 'utf-8');
  console.log('scripts/collected_real_sales.json に保存しました');
}

collectRealSaleDeals();
