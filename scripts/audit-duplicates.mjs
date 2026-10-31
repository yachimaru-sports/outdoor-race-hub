/**
 * scripts/audit-duplicates.mjs
 * 
 * 全大会データ（src/data/events.json）の重複監査および自動統合スクリプト
 * 
 * 監査ルール:
 * 1. 同一IDの重複チェック
 * 2. 同一開催日（または開始日）かつタイトル類似度（正規化比較・部分一致・キーワード一致）
 * 3. 同一公式ドメイン・URLの同一日開催チェック
 * 
 * マージルール（--fix 適用時、または日々の自動更新時）:
 * 1. 複数種目・価格違いがある場合、常に【最長距離】を採用
 * 2. 参加費は最も高い【最高参加費】を採用
 * 3. 開催日はより正確な2Days等の詳細表記を採用
 * 4. 必携品リストは重複排除して全アイテムを結合
 * 
 * 終了コード:
 * - 重複ゼロ: 0 (正常終了)
 * - 重複検出（--fixなし）: 1 (異常終了 / ビルド・CIを安全にブロック)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');

/**
 * 金額文字列から数値を抽出（例: "24,000円" -> 24000）
 */
export function parseFee(feeStr) {
  if (!feeStr) return 0;
  const digits = String(feeStr).replace(/[^\d]/g, '');
  return parseInt(digits, 10) || 0;
}

/**
 * 距離から数値を抽出（例: 118, "118km" -> 118）
 */
export function parseDistance(dist) {
  if (!dist) return 0;
  if (typeof dist === 'number') return dist;
  const digits = String(dist).replace(/[^\d.]/g, '');
  return parseFloat(digits) || 0;
}

/**
 * タイトルの正規化（全角半角・年度・回数・括弧・記号を除去）
 */
export function normalizeRaceTitle(title) {
  if (!title) return '';
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/第\s*\d+\s*回?/g, '')
    .replace(/202[4-9]/g, '')
    .replace(/\b\d+km\b/gi, '')
    .replace(/\b\d+k\b/gi, '')
    .replace(/\b100mile\b/gi, '')
    .replace(/[\s\-_・＆&~〜/／:：!！?？]+/g, '')
    .trim();
}

/**
 * 2つの日付が重なるか判定（例: "2027-03-27" と "2027-03-27~28"）
 */
export function isSameOrOverlappingDate(date1, date2) {
  if (!date1 || !date2) return false;
  if (date1 === date2) return true;
  const start1 = date1.split(/[~～]/)[0].trim();
  const start2 = date2.split(/[~～]/)[0].trim();
  return start1 === start2;
}

/**
 * 2つの大会が同一大会（重複）であるかを高精度に判定
 */
export function isDuplicateRace(a, b) {
  // 1. 完全同一ID
  if (a.id && b.id && a.id === b.id) {
    return { isDup: true, reason: 'ID完全一致' };
  }

  // 2. 開催日（または開始日）が異なる場合は別大会とみなす（年次違いなどは日付が異なる）
  if (!isSameOrOverlappingDate(a.date, b.date)) {
    return { isDup: false };
  }

  // 以下、開催日または開始日が同一の場合の照合
  const normA = normalizeRaceTitle(a.title);
  const normB = normalizeRaceTitle(b.title);

  // 2-1. 正規化タイトルが完全一致
  if (normA.length > 2 && normA === normB) {
    return { isDup: true, reason: `正規化タイトル完全一致 (${normA})` };
  }

  // 2-2. 正規化タイトルの一方が他方を包含し、共通部分が十分長い（6文字以上）
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return { isDup: true, reason: `タイトル包含一致 (${normA} / ${normB})` };
    }
  }

  // 2-3. 公式サイトURL（独自ドメイン）が完全一致
  const isGenericPortal = (url) => {
    if (!url) return true;
    return (
      url.includes('moshicom.com') ||
      url.includes('runnet.jp') ||
      url.includes('sportsentry.ne.jp') ||
      url.includes('cycle.spoen.jp')
    );
  };
  if (
    a.links?.official &&
    b.links?.official &&
    !isGenericPortal(a.links.official) &&
    a.links.official === b.links.official
  ) {
    return { isDup: true, reason: `公式サイトURL一致 (${a.links.official})` };
  }

  // 2-4. 同一都道府県かつ重要キーワード一致
  if (a.prefecture && b.prefecture && a.prefecture === b.prefecture) {
    const minLen = Math.min(normA.length, normB.length);
    if (minLen >= 4) {
      let commonChars = 0;
      for (const char of normA) {
        if (normB.includes(char)) commonChars++;
      }
      const similarity = commonChars / Math.max(normA.length, normB.length);
      if (similarity > 0.75) {
        return { isDup: true, reason: `同一都道府県・タイトル高類似度 (${Math.round(similarity * 100)}%)` };
      }
    }
  }

  return { isDup: false };
}

/**
 * 2つの重複大会を、ユーザー要件（最長距離・最高参加費・最新詳細）に従って安全にマージ
 */
export function mergeDuplicateEvents(target, incoming) {
  const merged = { ...target };

  // 1. 距離: 最長距離を採用
  const distTarget = parseDistance(target.distance_km);
  const distIncoming = parseDistance(incoming.distance_km);
  if (distIncoming > distTarget) {
    merged.distance_km = incoming.distance_km;
  }

  // 2. 標高: より高い累積標高を採用
  const elevTarget = target.elevation_m || 0;
  const elevIncoming = incoming.elevation_m || 0;
  merged.elevation_m = Math.max(elevTarget, elevIncoming);

  // 3. 参加費: 最も高い金額を採用
  const feeTarget = parseFee(target.entry_fee);
  const feeIncoming = parseFee(incoming.entry_fee);
  if (feeIncoming > feeTarget) {
    merged.entry_fee = incoming.entry_fee;
  }

  // 4. タイトル: より詳細な（長い、またはサブ情報を含む）タイトルを採用
  if (incoming.title && incoming.title.length > (merged.title || '').length) {
    merged.title = incoming.title;
  }

  // 5. 日付: 2Daysなどの範囲表記があれば優先
  if (incoming.date && incoming.date.includes('~') && !merged.date.includes('~')) {
    merged.date = incoming.date;
  }

  // 6. 受付ステータス: open または closing_soon を優先
  if (incoming.entry_status === 'open' && merged.entry_status === 'closed') {
    merged.entry_status = 'open';
  } else if (incoming.entry_status === 'closing_soon' && merged.entry_status === 'closed') {
    merged.entry_status = 'closing_soon';
  }

  // 7. リンク情報の補完
  merged.links = {
    official: target.links?.official || incoming.links?.official || '',
    entry: target.links?.entry || incoming.links?.entry || '',
    review: target.links?.review || incoming.links?.review || '',
    sns: target.links?.sns || incoming.links?.sns || ''
  };

  // 8. 必携品の重複排除マージ
  const gearMap = new Map();
  (target.mandatory_gear || []).forEach((g) => gearMap.set(g.name, g));
  (incoming.mandatory_gear || []).forEach((g) => {
    if (!gearMap.has(g.name)) gearMap.set(g.name, g);
  });
  merged.mandatory_gear = Array.from(gearMap.values());

  return merged;
}

/**
 * 全件重複監査メインロジック
 */
export function auditEvents(options = { fix: false }) {
  console.log(`====================================================`);
  console.log(`[大会データ重複監査スクリプト] 監査開始... (対象: ${EVENTS_PATH})`);
  console.log(`====================================================`);

  if (!fs.existsSync(EVENTS_PATH)) {
    console.error(`エラー: イベントファイルが存在しません: ${EVENTS_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(EVENTS_PATH, 'utf-8');
  const events = JSON.parse(raw);
  const totalOriginal = events.length;
  console.log(`- 登録大会総数: ${totalOriginal} 件`);

  const duplicates = [];
  const mergedEvents = [];
  const handledIndices = new Set();

  for (let i = 0; i < events.length; i++) {
    if (handledIndices.has(i)) continue;

    let current = { ...events[i] };
    handledIndices.add(i);

    for (let j = i + 1; j < events.length; j++) {
      if (handledIndices.has(j)) continue;

      const compare = events[j];
      const dupResult = isDuplicateRace(current, compare);

      if (dupResult.isDup) {
        duplicates.push({
          idxA: i,
          idxB: j,
          reason: dupResult.reason,
          eventA: current,
          eventB: compare
        });

        console.warn(`\n⚠️  [重複検知] 理由: ${dupResult.reason}`);
        console.warn(`   [A] ID: ${current.id} | 日付: ${current.date} | 距離: ${current.distance_km}km | 参加費: ${current.entry_fee} | 名称: ${current.title}`);
        console.warn(`   [B] ID: ${compare.id} | 日付: ${compare.date} | 距離: ${compare.distance_km}km | 参加費: ${compare.entry_fee} | 名称: ${compare.title}`);

        // 自動マージ処理（最長距離・最高参加費を優先）
        current = mergeDuplicateEvents(current, compare);
        console.warn(`   => [マージ結果] 距離: ${current.distance_km}km | 参加費: ${current.entry_fee} | 名称: ${current.title}`);

        handledIndices.add(j);
      }
    }

    mergedEvents.push(current);
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`監査結果サマリー:`);
  console.log(`- スキャン総数: ${totalOriginal} 件`);
  console.log(`- 重複検知組数: ${duplicates.length} 組`);

  if (duplicates.length === 0) {
    console.log(`\x1b[32m%s\x1b[0m`, `✅ 重複ゼロ: すべての大会データ（全 ${totalOriginal} 件）が健全に管理されています！`);
    return { success: true, count: totalOriginal, duplicates: [] };
  }

  if (options.fix) {
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(mergedEvents, null, 2) + '\n', 'utf-8');
    console.log(`\x1b[33m%s\x1b[0m`, `🛠️  [自動修復完了] 重複した大会を「最長距離・最高参加費優先」ルールで1つに統合しました。`);
    console.log(`   新総件数: ${mergedEvents.length} 件 (解消: ${totalOriginal - mergedEvents.length} 件)`);
    return { success: true, count: mergedEvents.length, duplicates };
  } else {
    console.error(`\x1b[31m%s\x1b[0m`, `❌ 重複エラー: ${duplicates.length} 組の重複が存在します。日々の品質維持のため処理を中断します。`);
    console.error(`   修正するには 'node scripts/audit-duplicates.mjs --fix' を実行してください。`);
    return { success: false, count: totalOriginal, duplicates };
  }
}

// 直接実行された場合のハンドラ
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isFix = process.argv.includes('--fix');
  const result = auditEvents({ fix: isFix });
  if (!result.success) {
    process.exit(1);
  }
}
