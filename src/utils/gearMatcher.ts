import { GearItem } from '../types/index';

/**
 * 必携品テキストとギアマスターを照合する厳格マッチング関数
 * 
 * 1. 競技種目の絞り込み:
 *    表示対象大会の category (trail, cycling, marathon, adventure, rogaining) が
 *    ギアの sports に含まれているアイテム、または "all" のみを候補とする。
 * 
 * 2. キーワード・中分類照合:
 *    必携品の品名テキストに対して、gearMasterの matchKeywords に含まれる単語のいずれかが
 *    含まれているかを厳格チェック（大分類による安易なマッチングは排除）。
 * 
 * 3. 非該当アイテムの扱い:
 *    「デジタルカメラ」「スマートフォン」「筆記用具」「ファーストエイドキット」など、
 *    専門ギアに合致しないアイテムは null を返し、UI側で特価バッジやリンクを表示しない。
 */
export function matchMandatoryGear(
  gearText: string,
  raceCategory: string,
  gearMaster: GearItem[]
): GearItem | null {
  if (!gearText || !gearMaster || gearMaster.length === 0) {
    return null;
  }

  const normalizedText = gearText.toLowerCase();

  // 明らかにギアマスター対象外の一般携行品・電子機器・日用品は即座に除外（誤爆防止の多重防御）
  const ignorePatterns = [
    'スマートフォン', 'スマホ', '携帯電話', 'デジタルカメラ', 'デジカメ', 'カメラ',
    '筆記用具', 'ペン', 'ボールペン', '健康保険証', '保険証', '身分証', '現金', '小銭',
    'ファーストエイド', '救急セット', '絆創膏', 'テーピング', 'マスク'
  ];
  if (ignorePatterns.some(pat => normalizedText.includes(pat.toLowerCase()))) {
    // ただし「カメラ付きスマートフォン」などのように純粋に除外対象のみで構成されているか確認
    // もし「スマートフォンおよび予備バッテリー」などでも一般品
    const isPureGeneralItem = !normalizedText.includes('レイン') &&
                              !normalizedText.includes('ライト') &&
                              !normalizedText.includes('ザック') &&
                              !normalizedText.includes('シューズ') &&
                              !normalizedText.includes('コンパス');
    if (isPureGeneralItem) {
      return null;
    }
  }

  // 1. 競技種目の絞り込み
  const candidateGears = gearMaster.filter((g) => {
    if (!g.sports || g.sports.length === 0) return true;
    if (g.sports.includes(raceCategory) || g.sports.includes('all')) return true;
    // アドベンチャーレースは複合マルチスポーツ（MTB/パドル/トレラン/ナビゲーション）
    if (raceCategory === 'adventure' && (g.sports.includes('cycling') || g.sports.includes('trail') || g.sports.includes('rogaining'))) {
      return true;
    }
    // ロゲイニングはナビゲーション＆山岳走
    if (raceCategory === 'rogaining' && (g.sports.includes('adventure') || g.sports.includes('trail'))) {
      return true;
    }
    return false;
  });

  // 2. matchKeywordsの含有判定（部分一致・完全一致）
  for (const gear of candidateGears) {
    if (!gear.matchKeywords || gear.matchKeywords.length === 0) continue;
    const isMatched = gear.matchKeywords.some((kw) => {
      const trimmed = kw.trim().toLowerCase();
      return trimmed.length > 0 && normalizedText.includes(trimmed);
    });
    if (isMatched) {
      return gear;
    }
  }

  // 該当する専門ギアがない場合はnull（バッジ非表示）
  return null;
}
