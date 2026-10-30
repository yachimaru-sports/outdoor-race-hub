import React from 'react';
import { RaceEvent } from '../types';
import { CATEGORY_LABELS, ELEMENT_BADGES, ENTRY_STATUS_CONFIG, formatDate } from '../utils/helpers';
import {
  Calendar,
  MapPin,
  TrendingUp,
  Star,
  Globe,
  FileEdit,
  MessageSquare,
  Share2,
  Backpack,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';

interface EventCardViewProps {
  events: RaceEvent[];
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onSelectEvent: (event: RaceEvent) => void;
}

export const EventCardView: React.FC<EventCardViewProps> = ({
  events,
  favoriteIds,
  onToggleFavorite,
  onSelectEvent,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
      {events.map((event) => {
        const cat = CATEGORY_LABELS[event.category];
        const status = ENTRY_STATUS_CONFIG[event.entry_status];
        const isFav = favoriteIds.includes(event.id);
        const checkedGearCount = getGearProgress(event);
        const totalGearCount = event.mandatory_gear.length;
        const canEntry = !!event.links.entry && event.entry_status !== 'closed';

        return (
          <div
            key={event.id}
            onClick={() => onSelectEvent(event)}
            className={`group rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md relative overflow-hidden border ${
              isFav
                ? 'bg-rose-50/30 dark:bg-slate-900 border-rose-400 dark:border-rose-700'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 hover:border-teal-600 dark:hover:border-slate-700'
            }`}
          >
            {/* 上部カラーアクセントバー */}
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
                    {status.label}
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

              {/* 大会タイトル */}
              <h3 className="font-extrabold text-slate-950 dark:text-white text-base sm:text-lg group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors line-clamp-2 min-h-[52px] leading-snug">
                {event.title}
              </h3>

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

              {/* 開催日 & エリア */}
              <div className="mt-3 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span className="font-extrabold text-slate-950 dark:text-slate-100">
                    {formatDate(event.date)}
                  </span>
                  {event.entry_deadline && (
                    <span className="text-xs text-slate-600 dark:text-slate-400 ml-auto font-bold">
                      締切: {event.entry_deadline}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {event.prefecture}{' '}
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">
                      ({event.region}地方)
                    </span>
                  </span>
                  {event.review && (
                    <div className="ml-auto flex items-center gap-1 text-xs text-amber-950 dark:text-amber-300 font-extrabold bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-500/20">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="font-mono">{event.review.rating.toFixed(1)}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                        ({event.review.count})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* スペック（距離・獲得標高） */}
              <div className="grid grid-cols-2 gap-2.5 my-3 py-3 px-4 bg-slate-100/80 dark:bg-slate-850/60 rounded-xl border border-slate-250 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                    距離
                  </div>
                  <div className="text-lg font-black text-slate-950 dark:text-white font-mono mt-0.5">
                    {event.distance_km}{' '}
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">km</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-bold">
                    累積標高 (D+)
                  </div>
                  <div className="text-lg font-black text-amber-800 dark:text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    {event.elevation_m > 0 ? `+${event.elevation_m.toLocaleString()}m` : 'フラット'}
                  </div>
                </div>
              </div>

              {/* 必携品プレビュー & 準備進捗 */}
              {totalGearCount > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Backpack className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <span>必携装備 ({totalGearCount}点):</span>
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
                        className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 truncate max-w-[140px]"
                      >
                        {gear.name}
                      </span>
                    ))}
                    {totalGearCount > 3 && (
                      <span className="text-xs text-slate-600 dark:text-slate-400 px-1.5 py-1 font-bold">
                        +{totalGearCount - 3}点
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* フッターリンクボタン群（4スロット固定整列） */}
            <div
              className="pt-3.5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-[1fr_40px_40px_40px] items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* スロット1: エントリー申込 or 詳細 */}
              {canEntry ? (
                <a
                  href={event.links.entry!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <FileEdit className="w-4 h-4" />
                  <span>エントリー申込</span>
                </a>
              ) : (
                <button
                  onClick={() => onSelectEvent(event)}
                  className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-extrabold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  必携品・詳細を見る
                </button>
              )}

              {/* スロット2: 公式 */}
              {event.links.official ? (
                <a
                  href={event.links.official}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                  title="大会公式サイト"
                >
                  <Globe className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                </a>
              ) : (
                <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <Globe className="w-4 h-4 opacity-40" />
                </span>
              )}

              {/* スロット3: 口コミ */}
              {event.links.review ? (
                <a
                  href={event.links.review}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                  title="大会レポ・口コミ"
                >
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                </a>
              ) : (
                <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 opacity-40" />
                </span>
              )}

              {/* スロット4: SNS */}
              {event.links.sns ? (
                <a
                  href={event.links.sns}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                  title="公式SNS"
                >
                  <Share2 className="w-4 h-4 text-sky-600" />
                </a>
              ) : (
                <span className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <Share2 className="w-4 h-4 opacity-40" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
