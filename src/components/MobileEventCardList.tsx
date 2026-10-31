import React, { useState } from 'react';
import { RaceEvent, DealItem } from '../types';
import {
  CATEGORY_LABELS,
  ELEMENT_BADGES,
  ENTRY_STATUS_CONFIG,
  formatEventDateSlash,
  formatPeriodSlash,
  getGoogleMapsUrl,
} from '../utils/helpers';
import {
  Calendar,
  Clock,
  MapPin,
  Bookmark,
  Backpack,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Coins,
  TrendingUp,
  Flame,
  CheckCircle2,
  Tag,
} from 'lucide-react';

interface MobileEventCardListProps {
  events: RaceEvent[];
  deals: DealItem[];
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
}

export const MobileEventCardList: React.FC<MobileEventCardListProps> = ({
  events,
  deals,
  favoriteIds,
  onToggleFavorite,
}) => {
  // 各カードの必携品アコーディオン開閉状態（IDのマップ）
  const [expandedGearIds, setExpandedGearIds] = useState<Record<string, boolean>>({});

  const toggleGearAccordion = (id: string) => {
    setExpandedGearIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 必携装備チェック状態の取得
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

  // 関連セール品の抽出
  const getRelatedDeal = (categoryName: string) => {
    return deals.find((d) => d.category.toLowerCase().includes(categoryName.toLowerCase()));
  };

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs">
        <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">
          条件に一致する大会が見つかりませんでした
        </p>
        <p className="text-xs mt-2 text-slate-600 dark:text-slate-400 font-medium">
          検索条件や競技ジャンルを変更してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const cat = CATEGORY_LABELS[event.category];
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isPastRace = event.date < todayStr;
        const status = ENTRY_STATUS_CONFIG[event.entry_status];
        const isFav = favoriteIds.includes(event.id);
        const isAwaitingRace = isFav && !isPastRace && event.entry_status === 'closed';
        const statusLabel = isPastRace ? '開催終了' : isAwaitingRace ? '開催待ち' : status.label;
        const statusBadgeClass = isAwaitingRace
          ? 'bg-sky-50 text-sky-800 border-sky-400 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-600 font-black'
          : status.badge;
        const statusDotClass = isAwaitingRace ? 'bg-sky-500 animate-pulse' : status.dot;

        const canEntry = !!event.links.entry && event.entry_status !== 'closed' && !isPastRace;
        const totalGearCount = event.mandatory_gear.length;
        const checkedGearCount = getGearProgress(event);
        const isGearExpanded = !!expandedGearIds[event.id];

        return (
          <div
            key={event.id}
            className={`bg-white dark:bg-slate-900 border-2 rounded-2xl shadow-sm overflow-hidden transition-all ${
              isFav
                ? 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-300/40 bg-rose-50/15'
                : 'border-slate-250 dark:border-slate-800'
            }`}
          >
            {/* 上部アクセントカラーバー */}
            <div className={`h-1.5 w-full ${cat.accentBg}`} />

            <div className="p-4 space-y-3">
              {/* 1. 最上部：種別バッジ ＆ 日付 ＆ 受付ステータス ＆ マイ参戦保存ボタン */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-black border shrink-0 ${cat.badgeBg}`}
                  >
                    {cat.shortLabel}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border shrink-0 ${statusBadgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass}`} />
                    <span>{statusLabel}</span>
                  </span>
                </div>

                {/* マイ参戦予定ボタン（親指で押しやすい最小44x44pxターゲット） */}
                <button
                  type="button"
                  onClick={() => onToggleFavorite(event.id)}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-all cursor-pointer select-none shrink-0 ${
                    isFav
                      ? 'bg-rose-100 text-rose-600 border-rose-400 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 border-slate-300 dark:border-slate-700'
                  }`}
                  aria-label={isFav ? '参戦予定から解除' : '参戦予定に追加'}
                >
                  <Bookmark className={`w-5 h-5 ${isFav ? 'fill-current text-rose-600' : ''}`} />
                </button>
              </div>

              {/* 2. 大会名（太字・大きめで視認性抜群） */}
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white leading-snug tracking-tight">
                  {event.title}
                </h3>
                {event.subCategory && (
                  <p className="text-xs font-bold text-teal-700 dark:text-teal-400 mt-0.5">
                    {event.subCategory}
                  </p>
                )}
              </div>

              {/* 3. 日程情報（開催日 ＆ 申込期間） */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-850/80 rounded-xl border border-slate-200 dark:border-slate-750 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                    開催日:
                  </span>
                  <span className="font-mono font-black text-slate-950 dark:text-white">
                    {formatEventDateSlash(event.date, event.end_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 dark:border-slate-750">
                  <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    申込:
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatPeriodSlash(event.entry_start_date, event.entry_deadline) || '受付終了'}
                  </span>
                </div>
              </div>

              {/* 4. スペック（距離・標高・参加費・エリア） */}
              <div className="grid grid-cols-3 gap-1.5 py-2 px-2.5 bg-slate-100/90 dark:bg-slate-850/60 rounded-xl border border-slate-250 dark:border-slate-800 text-center">
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">距離</div>
                  <div className="text-sm font-black text-slate-950 dark:text-white font-mono">
                    {Math.round(event.distance_km)} <span className="text-[10px] font-normal">km</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">獲得標高</div>
                  <div className="text-sm font-black text-amber-800 dark:text-amber-400 font-mono">
                    {event.elevation_m > 0 ? `+${event.elevation_m}m` : '平坦'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">参加費</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono truncate">
                    {event.entry_fee || '—'}
                  </div>
                </div>
              </div>

              {/* エリア＆マップリンク ＋ 特徴タグ */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                <a
                  href={getGoogleMapsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span>{event.prefecture} ({event.region})</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>

                <div className="flex flex-wrap items-center gap-1">
                  {event.elements?.slice(0, 3).map((el) => {
                    const badge = ELEMENT_BADGES[el];
                    if (!badge) return null;
                    return (
                      <span
                        key={el}
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${badge.style}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 5. 主な必携品アコーディオン（開閉可能） */}
              {totalGearCount > 0 && (
                <div className="border border-slate-200 dark:border-slate-750 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-850/40">
                  <button
                    type="button"
                    onClick={() => toggleGearAccordion(event.id)}
                    className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Backpack className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <span>主な必携品 ({totalGearCount}点)</span>
                      {checkedGearCount > 0 && (
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded-full">
                          {checkedGearCount}/{totalGearCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <span>{isGearExpanded ? '閉じる' : '装備確認'}</span>
                      {isGearExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {/* アコーディオン展開コンテンツ */}
                  {isGearExpanded && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-900 space-y-2">
                      <div className="space-y-1.5">
                        {event.mandatory_gear.map((gear, idx) => {
                          const deal = getRelatedDeal(gear.category);
                          return (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 shrink-0 mt-0.5">
                                  {gear.category}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 leading-snug">
                                  {gear.name}
                                </span>
                              </div>

                              {deal && (
                                <a
                                  href={deal.affiliate_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-black bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800"
                                  title={`楽天セール品: ${deal.title}`}
                                >
                                  <span>{deal.discount_rate}%OFF</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 6. 最下部アクションボタン（親指で押しやすい全幅44px+特大ボタン） */}
              <div className="pt-2 flex items-center gap-2">
                {canEntry && event.links.entry ? (
                  <a
                    href={event.links.entry}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-black text-sm rounded-xl shadow-md transition-all text-center select-none cursor-pointer"
                  >
                    <span>エントリー申込</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="flex-1 min-h-[48px] inline-flex items-center justify-center px-4 py-2.5 bg-slate-150 dark:bg-slate-800 text-slate-500 font-bold text-sm rounded-xl border border-slate-300 dark:border-slate-700 text-center select-none">
                    <span>{statusLabel}</span>
                  </div>
                )}

                {/* 公式サイトボタン */}
                {event.links.official && (
                  <a
                    href={event.links.official}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-3.5 inline-flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shrink-0 select-none cursor-pointer"
                    title="大会公式サイトを開く"
                  >
                    <span>公式HP</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
