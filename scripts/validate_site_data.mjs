/**
 * scripts/validate_site_data.mjs
 * 公開前の最終ゲート。1つでも問題があれば終了コード1 → デプロイを止め、前日の正常なサイトを維持する。
 *  - 装備: 全カテゴリ3品以上 / ID重複なし / 商品ページ HTTP200(item.rakuten.co.jp直リンク) / 画像 HTTP200(image/*)
 *          / 割引率が 定価・価格 から再計算した値と一致 / 特価一覧(deals)が装備と整合 / 各カテゴリに最大1つの isBestDeal
 *  - 大会: 重複なし（audit-duplicates）・リンク死活は auto_heal_event_links が処理済み
 */
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const gears = JSON.parse(fs.readFileSync('src/data/gears.json', 'utf-8'));
const deals = JSON.parse(fs.readFileSync('src/data/deals.json', 'utf-8'));
const errors = [];

async function get(url, accept) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'ja' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (r.status < 500) return r;
    } catch { /* retry */ }
    await new Promise((s) => setTimeout(s, 1000));
  }
  return null;
}

// 構造チェック
const ids = new Set();
const byType = new Map();
for (const g of gears) {
  if (ids.has(g.id)) errors.push(`ID重複: ${g.id}`);
  ids.add(g.id);
  (byType.get(g.gearType) || byType.set(g.gearType, []).get(g.gearType)).push(g);
  if (!/^https:\/\/item\.rakuten\.co\.jp\//.test(g.dealUrl || '')) errors.push(`直リンクではない: ${g.id} ${g.dealUrl}`);
  if (!(g.price > 0) || !(g.originalPrice >= g.price)) errors.push(`価格異常: ${g.id} ${g.price}/${g.originalPrice}`);
  const expect = g.originalPrice > g.price ? Math.round((1 - g.price / g.originalPrice) * 100) : 0;
  if (expect !== g.discountRate) errors.push(`割引率不整合: ${g.id} 表示${g.discountRate}% 計算${expect}%`);
}
for (const [t, list] of byType) {
  if (list.length < 3) errors.push(`カテゴリ品数不足: ${t} ${list.length}品`);
  if (list.filter((g) => g.isBestDeal).length > 1) errors.push(`isBestDeal が複数: ${t}`);
}
const gearIds = new Set(gears.map((g) => g.id));
for (const d of deals) {
  if (!gearIds.has(d.gear_id)) errors.push(`特価一覧に存在しない装備: ${d.id}`);
  const g = gears.find((x) => x.id === d.gear_id);
  if (g && (g.price !== d.price || g.imageUrl !== d.image_url || g.dealUrl !== d.affiliate_url)) errors.push(`特価一覧と装備が不一致: ${d.id}`);
}

// 実アクセスチェック（商品ページ・画像）
let idx = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (idx < gears.length) {
    const g = gears[idx++];
    const page = await get(g.dealUrl, 'text/html');
    if (!page || page.status !== 200 || !/item\.rakuten\.co\.jp/.test(page.url)) errors.push(`商品ページ不通: ${g.id} ${g.dealUrl} (${page ? page.status : 'network'})`);
    const img = await get(g.imageUrl, 'image/*');
    if (!img || img.status !== 200 || !(img.headers.get('content-type') || '').startsWith('image/')) errors.push(`画像不通: ${g.id} ${g.imageUrl} (${img ? img.status : 'network'})`);
  }
}));

if (errors.length) {
  console.error(`❌ 公開前検証 失敗 (${errors.length}件)\n - ` + errors.join('\n - '));
  process.exit(1);
}
console.log(`✅ 公開前検証 合格: 装備 ${gears.length} 品 / ${byType.size} カテゴリ / 特価 ${deals.length} 品（商品ページ・画像すべて HTTP200、割引率は定価から再計算して一致）`);
