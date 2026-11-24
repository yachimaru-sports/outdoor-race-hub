/**
 * src/utils/seasonalBg.ts
 * 近日開催大会の開催地風景（meta.json の daily_hero）または季節感・スポーツ・自然を感じる背景画像を返すヘルパー
 */
import metaData from '../data/meta.json';

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
 * 近日開催大会の開催地風景（daily_hero）があれば最優先し、なければ季節別の風景を日替わりで返す
 */
export function getDailySeasonalBackground(): {
  url: string;
  label: string;
  eventId?: string;
  eventTitle?: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
} {
  const base = import.meta.env.BASE_URL || '/';
  const meta = metaData as {
    daily_hero?: {
      date?: string;
      updated_at?: string;
      image?: string;
      place_label?: string;
      event_id?: string;
      event_title?: string;
      author?: string;
      license?: string;
      source_url?: string;
    };
  };

  if (meta.daily_hero?.image) {
    const cleanPath = meta.daily_hero.image.replace(/^\/+/, '');
    const ver = meta.daily_hero.updated_at || meta.daily_hero.date || '';
    const versionSuffix = ver ? `?v=${encodeURIComponent(ver)}` : '';
    return {
      url: `${base}${cleanPath}${versionSuffix}`,
      label: meta.daily_hero.place_label || '本日のピックアップ開催地',
      eventId: meta.daily_hero.event_id,
      eventTitle: meta.daily_hero.event_title,
      credit: meta.daily_hero.author,
      license: meta.daily_hero.license,
      sourceUrl: meta.daily_hero.source_url,
    };
  }

  const { month, dayOfYear } = getJstParts();
  const season = getSeasonByMonth(month);
  const seasonalPool = ALL_BACKGROUNDS.filter((b) => b.season === season);

  let chosen: SeasonalBgItem;
  if (seasonalPool.length >= 2) {
    chosen = seasonalPool[dayOfYear % seasonalPool.length];
  } else {
    const altPool = [seasonalPool[0], ALL_BACKGROUNDS[2], ALL_BACKGROUNDS[4]].filter(Boolean);
    chosen = altPool[dayOfYear % altPool.length];
  }

  return {
    url: `${base}hero-bg/${chosen.file}`,
    label: chosen.label,
  };
}
