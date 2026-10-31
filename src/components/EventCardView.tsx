import React from 'react';
import { RaceEvent } from '../types';
import {
  CATEGORY_LABELS,
  ELEMENT_BADGES,
  ENTRY_STATUS_CONFIG,
  formatDate,
  formatEventDateRange,
  formatEventDateSlash,
  formatDeadlineSlash,
  getGoogleMapsUrl,
} from '../utils/helpers';
import { LinkButton } from './LinkButton';
import {
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Globe,
  FileEdit,
  MessageSquare,
  Share2,
  ChevronRight,
  Bookmark,
  CheckCircle2,
  Backpack,
  Coins,
  ExternalLink,
} from 'lucide-react';

interface EventCardViewProps {
  events: RaceEvent[];
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onSelectEvent?: (event: RaceEvent) => void;
}

export const EventCardView: React.FC<EventCardViewProps> = ({
  events,
  favoriteIds,
  onToggleFavorite,
}) => {
  const getGearProgress = (event: RaceEvent) => {
    try {
      const saved = localStorage.getItem(`gear_check_${event.id}`);
      if (!saved) return 0;
      const parsed = JSON.parse(saved);
      return event.mandatory_gear.filter((g) => parsed[g.name]).length;
    } catch {
      return 0;
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
          条件に一致する大会が見つかりませんでした
        </p>
        <p className="text-sm mt-2 text-slate-600 dark:text-slate-400 font-medium">
          上の「条件をクリア」ボタンを押すか、別のスポーツ種目・特徴タグをお試しください。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {events.map((event) => {
        const cat = CATEGORY_LABELS[event.category];
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isPastRace = event.date < todayStr;
        const status = ENTRY_STATUS_CONFIG[event.entry_status];
        const statusLabel = isPastRace ? '開催終了' : status.label;
        const isFav = favoriteIds.includes(event.id);
        const checkedGearCount = getGearProgress(event);
        const totalGearCount = event.mandatory_gear.length;
        const canEntry = !!event.links.entry && event.entry_status !== 'closed' && !isPastRace;
        const isClosingSoon = event.entry_status === 'closing_soon';
        const isOpen = event.entry_status === 'open';

        return (
          <div
            key={event.id}
            className={`group relative bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${
              isFav
                ? 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-300/40 bg-rose-50/20'
                : 'border-slate-250 dark:border-slate-800 hover:border-teal-600 dark:hover:border-teal-500'
            }`}
          >
            {/* 上部アクセントカラーバー */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${cat.accentBg}`} />

            {/* 上部：カテゴリ ＆ ステータス ＆ ブックマーク */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border shrink-0 ${cat.badgeBg}`}
                  >
                    {cat.shortLabel}
                  </span>
                  {event.subCategory && (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                      {event.subCategory}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${
                      status.badge
                    } ${status.pulse ? 'animate-pulse' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                    {statusLabel}
                  </span>

                  {/* 参戦予定ブックマーク */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(event.id);
                    }}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isFav
                        ? 'bg-rose-100 text-rose-600 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 border-slate-300 dark:border-slate-700'
                    }`}
                    title={isFav ? '参戦予定リストから解除' : '参戦予定リストに追加'}
                  >
                    <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 大会タイトル（2行表示 ＋ ホバー時全文字吹き出しポップアップ） */}
              <div className="relative group/cardtitle">
                <h3
                  className="font-black text-slate-950 dark:text-white text-base sm:text-lg group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors line-clamp-2 min-h-[52px] leading-snug cursor-pointer"
                  title={event.title}
                >
                  {event.title}
                </h3>
                {/* マウスホバーで全文表示 */}
                <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/cardtitle:block z-50 bg-slate-950/95 text-white text-xs font-extrabold px-3 py-2 rounded-xl shadow-2xl border border-teal-500/40 max-w-sm pointer-events-none whitespace-normal leading-relaxed backdrop-blur-xs">
                  <div className="text-[10px] text-teal-300 font-bold mb-0.5">大会名（全文）:</div>
                  {event.title}
                </div>
              </div>

              {/* 開催日 ＆ 締切日ハイライトバナー（重要情報として大幅強調） */}
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-850/80 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">開催日:</span>
                    <span className="text-sm font-black text-slate-950 dark:text-white font-mono">
                      {formatEventDateSlash(event.date, event.end_date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">申込締切:</span>
                  </div>
                  <div>
                    {isClosingSoon ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 animate-pulse font-mono">
                        🔥 締切: {event.entry_deadline ? formatDeadlineSlash(event.entry_deadline) : '間近'}
                      </span>
                    ) : isOpen ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-extrabold bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 font-mono">
                        {event.entry_deadline ? `締切: ${formatDeadlineSlash(event.entry_deadline)}` : '受付中'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 font-bold font-mono">
                        {event.entry_deadline ? `締切: ${formatDeadlineSlash(event.entry_deadline)}` : '受付終了'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 競技エレメントタグ（読図・MTB・パドル等） */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2 min-h-[28px]">
                {event.elements &&
                  event.elements.map((el) => {
                    const badge = ELEMENT_BADGES[el];
                    if (!badge) return null;
                    return (
                      <span
                        key={el}
                        className={`inline-flex items-center gap-1 text-xs font-extrabold px-2 py-0.5 rounded-md border ${badge.style}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    );
                  })}
              </div>

              {/* エリア表示（クリックでGoogleマップの集合場所へ直行） */}
              <div className="mt-2 text-xs sm:text-sm">
                <a
                  href={getGoogleMapsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 transition-colors group/map"
                  title={
                    event.venue?.name
                      ? `Googleマップで集合場所「${event.venue.name}」を開きます`
                      : `Googleマップで「${event.prefecture}」の大会会場を開きます`
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400 group-hover/map:text-red-500 transition-colors shrink-0" />
                  <span className="font-black underline decoration-teal-400/50 underline-offset-2">
                    {event.prefecture}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">
                    ({event.region}地方)
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover/map:text-teal-600 shrink-0" />
                </a>
              </div>

              {/* スペック（距離・獲得標高・参加費） */}
              <div className="grid grid-cols-3 gap-2 my-3 py-3 px-3 bg-slate-100/80 dark:bg-slate-850/60 rounded-xl border border-slate-250 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                    距離
                  </div>
                  <div className="text-base font-black text-slate-950 dark:text-white font-mono mt-0.5">
                    {Math.round(event.distance_km)}
                    <span className="text-[11px] font-bold text-slate-600">km</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                    獲得標高
                  </div>
                  <div className="text-sm font-black text-amber-800 dark:text-amber-400 font-mono mt-0.5">
                    {event.elevation_m > 0 ? `+${event.elevation_m}m` : '平坦'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                    参加費
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5 truncate">
                    {event.entry_fee || '—'}
                  </div>
                </div>
              </div>

              {/* 必携品プレビュー & 準備進捗 */}
              {totalGearCount > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Backpack className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <span>必携装備 ({totalGearCount}アイテム):</span>
                    </span>
                    {checkedGearCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-900 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        {checkedGearCount}/{totalGearCount} 準備済
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {event.mandatory_gear.slice(0, 3).map((gear, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 truncate max-w-[130px]"
                      >
                        {gear.name}
                      </span>
                    ))}
                    {totalGearCount > 3 && (
                      <span className="text-xs text-slate-600 dark:text-slate-400 px-1 py-0.5 font-bold">
                        +{totalGearCount - 3}アイテム
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* フッターリンクボタン群（申込 ＆ 公式 ホバー直リンクポップアップ対応） */}
            <div
              className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <LinkButton
                  type="entry"
                  url={event.links.entry}
                  canEntry={canEntry}
                  isBroken={false}
                  eventTitle={event.title}
                />
                <LinkButton
                  type="official"
                  url={event.links.official}
                  isBroken={false}
                  eventTitle={event.title}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
