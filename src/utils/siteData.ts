/**
 * 自動更新パイプラインが出力するデータ（changelog.json / meta.json）の安全な読み込みと、
 * NEW・情報更新バッジ等の日付判定ユーティリティ。
 *
 * import.meta.glob を使っているため、ファイルが存在しない場合でもビルドが壊れません。
 */
import type { ChangelogEntry, RaceEvent, RunSummary, SiteMeta } from '../types';

// ファイルが無くても空オブジェクトになる（静的 import だとビルドエラーになるため）
const changelogModules = import.meta.glob('../data/changelog.json', { eager: true, import: 'default' });
const metaModules = import.meta.glob('../data/meta.json', { eager: true, import: 'default' });

const pickFirst = (mods: Record<string, unknown>): unknown => {
  const keys = Object.keys(mods);
  return keys.length > 0 ? mods[keys[0]] : undefined;
};

/** 更新履歴（新しい順・不正データは除外） */
export const CHANGELOG: ChangelogEntry[] = (() => {
  const raw = pickFirst(changelogModules);
  if (!Array.isArray(raw)) return [];
  return (raw as ChangelogEntry[])
    .filter((e) => e && typeof e === 'object' && typeof e.title === 'string' && typeof e.date === 'string')
    .map((e, i) => ({ ...e, id: e.id || `changelog-${i}` }))
    .sort((a, b) => {
      const ka = `${a.date} ${a.time || '00:00'}`;
      const kb = `${b.date} ${b.time || '00:00'}`;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
})();

/** サイトのメタ情報 */
export const SITE_META: SiteMeta = (() => {
  const raw = pickFirst(metaModules);
  return raw && typeof raw === 'object' ? (raw as SiteMeta) : {};
})();

export const RUN_SUMMARY: RunSummary | undefined =
  SITE_META.run_summary && typeof SITE_META.run_summary === 'object' ? SITE_META.run_summary : undefined;

/** 日本時間の今日（YYYY-MM-DD） */
export const todayJst = (): string => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date());
};

/** YYYY-MM-DD から今日までの経過日数（不正値は null） */
export const daysSince = (ymd?: string | null): number | null => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const a = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  const t = todayJst();
  const b = Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)));
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / 86400000);
};

/** 新着大会（追加から7日以内） */
export const isNewEvent = (ev: Pick<RaceEvent, 'added_at'>): boolean => {
  const d = daysSince(ev.added_at);
  return d !== null && d >= 0 && d <= 7;
};

/** 情報更新（更新から3日以内。NEW と重複する場合は NEW を優先） */
export const isRecentlyUpdated = (ev: Pick<RaceEvent, 'added_at' | 'updated_at'>): boolean => {
  if (isNewEvent(ev)) return false;
  const d = daysSince(ev.updated_at);
  return d !== null && d >= 0 && d <= 3;
};

/** YYYY-MM-DD や ISO 文字列を「M/D」形式に（日本時間） */
export const formatMonthDay = (value?: string | null): string => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
  const parts = f.formatToParts(d);
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return m && day ? `${m}/${day}` : '';
};

/** YYYY-MM-DD を「YYYY年M月D日」に */
export const formatJpDate = (ymd?: string | null): string => {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return ymd || '';
  return `${ymd.slice(0, 4)}年${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;
};

/** 大会のディープリンク（?event=<id>）URL */
export const buildEventShareUrl = (eventId: string): string => {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://yachimaru-sports.github.io/outdoor-race-hub/';
  return `${base}?event=${encodeURIComponent(eventId)}`;
};

/** 大会の開始日・終了日（YYYY-MM-DD）を取り出す */
export const getEventDateRange = (ev: Pick<RaceEvent, 'date' | 'end_date'>): { start: string; end: string } => {
  const parts = (ev.date || '').split(/[~～]/).map((s) => s.trim());
  const start = parts[0] || '';
  const end = (ev.end_date && ev.end_date.trim()) || parts[1] || start;
  return { start, end: end < start ? start : end };
};

/** Googleカレンダー追加用URL（終日イベント） */
export const buildGoogleCalendarUrl = (ev: RaceEvent, detailUrl: string): string => {
  const { start, end } = getEventDateRange(ev);
  const compact = (s: string) => s.replace(/-/g, '');
  let dates = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    // 終日予定の終了日は「翌日」を指定する仕様
    const e = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : start;
    const next = new Date(Date.UTC(Number(e.slice(0, 4)), Number(e.slice(5, 7)) - 1, Number(e.slice(8, 10)) + 1));
    const nextStr = next.toISOString().slice(0, 10);
    dates = `${compact(start)}/${compact(nextStr)}`;
  }
  const location = [ev.venue?.name, ev.venue?.address || ev.prefecture].filter(Boolean).join(' ');
  const details = [
    `距離: ${ev.distance_km}km`,
    ev.entry_fee ? `参加費: ${ev.entry_fee}` : '',
    ev.entry_deadline ? `申込締切: ${ev.entry_deadline}` : '',
    ev.links?.official ? `公式サイト: ${ev.links.official}` : '',
    `詳細: ${detailUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const params = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, details, location });
  if (dates) params.set('dates', dates);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
