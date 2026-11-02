import { handleImageError } from '../utils/imageFallback';
import React, { useState, useEffect } from 'react';
import { RaceEvent, DealItem, GearItem } from '../types';
import { matchMandatoryGear } from '../utils/gearMatcher';
import { MandatoryGearLinks } from './MandatoryGearLinks';
import {
  CATEGORY_LABELS,
  ENTRY_STATUS_CONFIG,
  formatDate,
  formatEventDateRange,
  formatEventDateSlash,
  formatDeadlineSlash,
  formatPeriodSlash,
  formatPrice,
} from '../utils/helpers';
import {
  X,
  Calendar,
  MapPin,
  TrendingUp,
  Globe,
  FileEdit,
  MessageSquare,
  Share2,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface EventDetailModalProps {
  event: RaceEvent | null;
  deals: DealItem[];
  gears?: GearItem[];
  isFavorite?: boolean;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, deals, gears = [], isFavorite = false, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const storageKey = `gear_check_${event.id}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCheck = (name: string) => {
    setCheckedItems((prev) => {
      const updated = { ...prev, [name]: !prev[name] };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const checkAll = () => {
    const updated: Record<string, boolean> = {};
    event.mandatory_gear.forEach((gear) => {
      updated[gear.name] = true;
    });
    setCheckedItems(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const clearAll = () => {
    setCheckedItems({});
    localStorage.removeItem(storageKey);
  };

  const totalCount = event.mandatory_gear.length;
  const completedCount = event.mandatory_gear.filter((g) => checkedItems[g.name]).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const eventGearCategories = new Set(event.mandatory_gear.map((g) => g.category));
  // 必携品テキストとギアマスターを厳格照合し、直結するセール商品を優先抽出
  const strictlyMatchedGears = event.mandatory_gear
    .map((g) => matchMandatoryGear(g.name, event.category, gears))
    .filter((g): g is GearItem => Boolean(g));

  const matchedDealIds = new Set(strictlyMatchedGears.map((g) => g.id));
  const priorityDeals = deals.filter((d) => {
    // ギアIDの一致またはタイトルに含まれるブランド・キーワード照合
    return strictlyMatchedGears.some((sg) => 
      d.id.includes(sg.id.replace('gear-', 'deal-')) ||
      (sg.brand && d.title.includes(sg.brand)) ||
      (sg.gearType && d.title.includes(sg.gearType))
    );
  });

  const remainingDeals = deals.filter((d) => !priorityDeals.some((pd) => pd.id === d.id));
  const recommendedDeals = [...priorityDeals, ...remainingDeals].slice(0, 4);

  const cat = CATEGORY_LABELS[event.category];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isPastRace = event.date < todayStr;
  const status = ENTRY_STATUS_CONFIG[event.entry_status];
  const isAwaitingRace = isFavorite && !isPastRace && event.entry_status === 'closed';
  const statusLabel = isPastRace ? '開催終了' : (isAwaitingRace ? '開催待ち' : status.label);
  const statusBadgeClass = isAwaitingRace
    ? 'bg-sky-50 text-sky-800 border-sky-400 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-600 font-black'
    : status.badge;
  const statusDotClass = isAwaitingRace ? 'bg-sky-500 animate-pulse' : status.dot;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold border ${cat.badgeBg}`}>
              {cat.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold border ${
                statusBadgeClass
              } ${status.pulse ? 'animate-pulse' : ''}`}
              title={isAwaitingRace ? 'エントリー済・大会開催日を待っている状態です' : undefined}
            >
              <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
              {statusLabel}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダル本体コンテンツ */}
        <div className="p-6 space-y-6">
          {/* 大会名 & 概要 */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight leading-snug">
              {event.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3.5 mt-3 text-sm text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-black text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-lg border border-teal-300 dark:border-teal-800">
                <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                開催日: {formatEventDateSlash(event.date, event.end_date)}
              </span>
              <span className="flex items-center gap-1.5 font-bold">
                <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                {event.prefecture} ({event.region}地方)
              </span>
            </div>
          </div>

          {/* スペックカード（距離・標高・参加費・締切） */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-slate-50 dark:bg-slate-850/80 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">コース総距離</span>
              <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
                {Math.round(event.distance_km)} <span className="text-xs font-bold text-slate-600">km</span>
              </div>
            </div>

            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">累積標高 (D+)</span>
              <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {event.elevation_m > 0 ? `+${event.elevation_m.toLocaleString()}m` : 'フラット'}
              </div>
            </div>

            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">エントリー費</span>
              <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
                {event.entry_fee || '—'}
              </div>
            </div>

            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">申込受付期間</span>
              <div className="text-sm sm:text-base font-black text-amber-800 dark:text-amber-400 mt-1 font-mono">
                {formatPeriodSlash(event.entry_start_date, event.entry_deadline) || '公式サイト確認'}
              </div>
            </div>
          </div>

          {/* 公式リンク・アクションボタンバー */}
          <div className="flex flex-wrap items-center gap-2.5">
            {event.links.entry && (
              <a
                href={event.links.entry}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[160px] py-3 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <FileEdit className="w-4 h-4" />
                <span>エントリー申込ページへ</span>
              </a>
            )}

            {event.links.official && (
              <a
                href={event.links.official}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-sm font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Globe className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>大会公式サイト</span>
              </a>
            )}

            {event.links.review && (
              <a
                href={event.links.review}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-sm font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span>大会レポ・口コミ</span>
              </a>
            )}

            {event.links.sns && (
              <a
                href={event.links.sns}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-sm font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Share2 className="w-4 h-4 text-sky-600" />
                <span>公式SNS</span>
              </a>
            )}
          </div>

          {/* セクション 1: 必携品チェックリスト (localStorage保存) */}
          <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                  <h3 className="font-extrabold text-slate-950 dark:text-white text-base">
                    大会必携装備チェックリスト
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                  ※ チェック状態はブラウザに自動保存され、一覧画面の進捗バッジに反映されます
                </p>
              </div>

              {/* 進捗 & 一括操作ボタン */}
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm font-extrabold text-teal-900 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-3 py-1 rounded-full border border-teal-300 dark:border-teal-800">
                  {completedCount} / {totalCount} 完了 ({progressPercent}%)
                </span>
                <button
                  onClick={checkAll}
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 underline underline-offset-2 cursor-pointer"
                >
                  全チェック
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600 underline underline-offset-2 cursor-pointer"
                >
                  クリア
                </button>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-700 to-emerald-600 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* チェックリスト一覧 */}
            <div className="space-y-2 pt-1">
              {event.mandatory_gear.length === 0 ? (
                <p className="text-sm text-slate-600 py-2">
                  公式の必携品指定はありません（基本装備をご準備ください）。
                </p>
              ) : (
                event.mandatory_gear.map((gear) => {
                  const isChecked = !!checkedItems[gear.name];
                  const matchedGear = matchMandatoryGear(gear.name, event.category, gears);
                  return (
                    <div
                      key={gear.name}
                      onClick={() => toggleCheck(gear.name)}
                      className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all cursor-pointer select-none shadow-2xs ${
                        isChecked
                          ? 'bg-emerald-50/50 dark:bg-slate-800/40 border-emerald-200 dark:border-slate-700/40 text-slate-500'
                          : 'bg-white dark:bg-slate-800/80 border-slate-250 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            className="shrink-0 text-teal-700 dark:text-teal-400 focus:outline-none"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 fill-teal-700 text-white dark:text-slate-900" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`text-sm font-bold block ${
                                isChecked
                                  ? 'line-through text-slate-500 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {gear.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-250 dark:border-slate-700">
                            {gear.category}
                          </span>
                          {matchedGear && (
                            <MandatoryGearLinks gear={matchedGear} size="md" />
                          )}
                        </div>
                      </div>

                      {matchedGear && matchedGear.standardTitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-8 border-l-2 border-teal-500/50 ml-1">
                          💡 定番: {matchedGear.brand ? matchedGear.brand + ' ' : ''}{matchedGear.standardTitle}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* セクション 2: 特価ギア連動提案 (deals.json) */}
          <div className="bg-slate-900 text-white border-2 border-amber-500/60 rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-500 text-white font-black">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                    この大会の必携品に直結！楽天市場 特価セールギア
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">
                    対象カテゴリー「{Array.from(eventGearCategories).join('・')}」の大幅割引・高還元モデル
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-red-600 text-white hidden sm:inline">
                15%〜50%OFF厳選
              </span>
            </div>

            {/* ギアグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {recommendedDeals.map((deal) => {
                const savedYen = deal.original_price - deal.price;
                const isNew = Boolean(
                  deal.registered_at &&
                    Date.now() - new Date(deal.registered_at).getTime() <= 48 * 60 * 60 * 1000
                );
                return (
                  <a
                    key={deal.id}
                    href={deal.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-3.5 bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-amber-400 rounded-xl p-3.5 transition-all shadow-sm relative"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-20 h-20 object-cover rounded-lg bg-slate-900 border border-slate-600"
                        loading="lazy"
                      />
                      <span className="absolute -top-2 -left-2 bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-md border border-white/80 shadow-sm">
                        {deal.discount_rate}%OFF
                      </span>
                      {isNew && (
                        <span className="absolute -bottom-2 -left-2 bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md border border-white/90 shadow-sm leading-none">
                          新着
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {isNew && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500 text-slate-950 leading-none shadow-xs">
                              🆕 新規登録
                            </span>
                          )}
                          <span className="text-xs font-black px-2 py-0.5 rounded bg-red-600 text-white">
                            🔥 {deal.discount_rate}%OFF (¥{savedYen.toLocaleString()}引)
                          </span>
                          <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 flex items-center gap-0.5">
                            <Flame className="w-3 h-3 fill-red-600 text-red-600" />
                            P{deal.point_rate}倍
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 group-hover:text-amber-300 transition-colors leading-snug">
                          {deal.title}
                        </p>
                      </div>

                      <div className="flex items-baseline justify-between mt-2 pt-1.5 border-t border-slate-700">
                        <div>
                          <span className="text-base sm:text-lg font-black text-amber-300 font-mono">
                            {formatPrice(deal.price)}
                          </span>
                          <span className="text-xs text-slate-400 line-through ml-1.5 font-mono">
                            {formatPrice(deal.original_price)}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          楽天で見る
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
