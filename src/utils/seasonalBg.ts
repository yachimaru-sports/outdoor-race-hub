/**
 * src/utils/seasonalBg.ts
 * 季節感・スポーツ・自然を感じる背景画像を、日付シードで日々変化させながら選択するヘルパー
 */

export interface SeasonalBgItem {
  file: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  label: string;
}

const ALL_BACKGROUNDS: SeasonalBgItem[] = [
  { file: 'spring-trail.webp', season: 'spring', label: '新緑の山岳トレイル（春）' },
  { file: 'summer-cycling.webp', season: 'summer', label: '瀬戸内海沿いのロード（夏）' },
  { file: 'summer-alpine.webp', season: 'summer', label: '雲海を望む稜線（夏）' },
  { file: 'autumn-trail.webp', season: 'autumn', label: '紅葉の山岳トレイル（秋）' },
  { file: 'autumn-cycling.webp', season: 'autumn', label: '朝霧の湖畔サイクルロード（秋）' },
  { file: 'winter-trail.webp', season: 'winter', label: '冬の朝焼けと雪山稜線（冬）' },
];

function getJstParts(): { dateStr: string; month: number; dayOfYear: number } {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const dateStr = now.toISOString().slice(0, 10);
  const month = now.getUTCMonth() + 1;
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start) / 86400000);
  return { dateStr, month, dayOfYear };
}

function getSeasonByMonth(month: number): SeasonalBgItem['season'] {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/**
 * 現在の季節画像を軸にしつつ、日々異なる画像が選ばれる背景URLを返す
 */
export function getDailySeasonalBackground(): { url: string; label: string } {
  const { month, dayOfYear } = getJstParts();
  const season = getSeasonByMonth(month);
  const seasonalPool = ALL_BACKGROUNDS.filter((b) => b.season === season);

  // 該当季節の画像を基本としつつ、偶数日/奇数日や複数枚のローテーションで毎日風景が変化するように選出
  let chosen: SeasonalBgItem;
  if (seasonalPool.length >= 2) {
    chosen = seasonalPool[dayOfYear % seasonalPool.length];
  } else {
    // 1枚のみの季節は、メインの季節画像と通年使える絶景（雲海・湖畔）を日替わりでローテーション
    const altPool = [seasonalPool[0], ALL_BACKGROUNDS[2], ALL_BACKGROUNDS[4]].filter(Boolean);
    chosen = altPool[dayOfYear % altPool.length];
  }

  const base = import.meta.env.BASE_URL || '/';
  return {
    url: `${base}hero-bg/${chosen.file}`,
    label: chosen.label,
  };
}
