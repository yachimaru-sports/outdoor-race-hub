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
  getGoogleMapsUrl,
} from '../utils/helpers';
import { CalendarAddButton } from './CalendarAddButton';
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
  ShoppingBag,
  ChevronRight,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface EventDetailModalProps {
  event: RaceEvent | null;
  deals: DealItem[];
  gears?: GearItem[];
  isFavorite?: boolean;
  onClose: () => void;
  onOpenCatalog?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, deals, gears = [], isFavorite = false, onClose, onOpenCatalog }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [mobileTab, setMobileTab] = useState<'overview' | 'gear' | 'deals'>('overview');

  useEffect(() => {
    setMobileTab('overview');
  }, [event?.id]);

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
      window.dispatchEvent(new Event('gear-check-updated'));
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
    window.dispatchEvent(new Event('gear-check-updated'));
  };

  const clearAll = () => {
    setCheckedItems({});
    localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event('gear-check-updated'));
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
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(event.id)}`
    : '';
  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isPastRace = (event.end_date || event.date) < todayStr;
  const status = ENTRY_STATUS_CONFIG[event.entry_status];
  const isAwaitingRace = isFavorite && !isPastRace && event.entry_status === 'closed';
  const statusLabel = isPastRace ? '開催終了' : (isAwaitingRace ? '開催待ち' : status.label);
  const statusBadgeClass = isAwaitingRace
    ? 'bg-sky-50 text-sky-800 border-sky-400 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-600 font-black'
    : status.badge;
  const statusDotClass = isAwaitingRace ? 'bg-sky-500 animate-pulse' : status.dot;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 animate-fadeIn">
      <div
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-slate-900 dark:text-slate-100 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-sm font-extrabold border shrink-0 ${cat.badgeBg}`}>
              {cat.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-sm font-bold border shrink-0 ${
                statusBadgeClass
              } ${status.pulse ? 'animate-pulse' : ''}`}
              title={isAwaitingRace ? 'エントリー済・大会開催日を待っている状態です' : undefined}
            >
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusDotClass}`} />
              {statusLabel}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer shrink-0"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダル本体コンテンツ */}
        <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-6">
          {/* 大会名 & 概要 */}
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight leading-snug">
              {event.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 mt-2 sm:mt-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1 font-black text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-800">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700 dark:text-teal-400" />
                {formatEventDateSlash(event.date, event.end_date)}
              </span>
              <a
                href={getGoogleMapsUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  event.venue?.name
                    ? `Googleマップで集合場所「${event.venue.name}」を開きます`
                    : `Googleマップで「${event.prefecture}」の大会会場を開きます`
                }
                className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 transition-colors group/map"
              >
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700 dark:text-teal-400 group-hover/map:text-red-500 transition-colors shrink-0" />
                <span className="underline decoration-teal-400/50 underline-offset-2">
                  {event.prefecture} ({event.region})
                </span>
                <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 group-hover/map:text-teal-600 shrink-0" />
              </a>
            </div>
          </div>

          {/* スペックカード（スマホは3列＋申込期間1行でコンパクト化、PCは4列） */}
          <div className="bg-slate-50 dark:bg-slate-850/80 p-2.5 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3.5 items-center">
              <div className="text-center sm:text-left">
                <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-bold block">総距離</span>
                <div className="text-base sm:text-2xl font-black text-slate-950 dark:text-white font-mono mt-0.5">
                  {Math.round(event.distance_km)} <span className="text-[10px] sm:text-xs font-bold text-slate-600">km</span>
                </div>
              </div>

              <div className="text-center sm:text-left border-x sm:border-x-0 border-slate-200 dark:border-slate-700 px-1 sm:px-0">
                <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-bold block">累積標高</span>
                <div className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5 flex items-center justify-center sm:justify-start gap-0.5 sm:gap-1">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{event.elevation_m > 0 ? `+${event.elevation_m.toLocaleString()}m` : '平坦'}</span>
                </div>
              </div>

              <div className="text-center sm:text-left">
                <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-bold block">参加費</span>
                <div className="text-sm sm:text-2xl font-black text-slate-950 dark:text-white font-mono mt-0.5 truncate">
                  {event.entry_fee || '—'}
                </div>
              </div>

              <div className="hidden sm:block text-left">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">申込受付期間</span>
                <div className="text-base font-black text-amber-800 dark:text-amber-400 mt-1 font-mono">
                  {formatPeriodSlash(event.entry_start_date, event.entry_deadline) || '公式サイト確認'}
                </div>
              </div>
            </div>

            {/* スマホ用：申込受付期間を1行に集約 */}
            <div className="sm:hidden mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-bold">申込受付期間</span>
              <span className="font-black text-amber-800 dark:text-amber-400 font-mono">
                {formatPeriodSlash(event.entry_start_date, event.entry_deadline) || '公式サイト確認'}
              </span>
            </div>
          </div>

          {/* スマホ専用：情報集約タブバー */}
          <div className="sm:hidden grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMobileTab('overview')}
              className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                mobileTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              リンク・共有
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('gear')}
              className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobileTab === 'gear'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>必携品</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                {completedCount}/{totalCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('deals')}
              className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                mobileTab === 'deals'
                  ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>特価ギア</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300">
                {recommendedDeals.length}
              </span>
            </button>
          </div>

          {/* 公式リンク・アクションボタンバー（スマホでは「リンク・共有」タブ内） */}
          <div className={`${mobileTab === 'overview' ? 'block' : 'hidden sm:block'} space-y-2.5 sm:space-y-3`}>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
              {event.links.entry && (
                <a
                  href={event.links.entry}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="col-span-2 sm:flex-1 sm:min-w-[160px] py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
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
                  className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors shadow-2xs"
                >
                  <Globe className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>大会公式サイト</span>
                </a>
              )}

              {event.links.review && (
                <a
                  href={event.links.review}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors shadow-2xs"
                >
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>レポ・口コミ</span>
                </a>
              )}

              {event.links.sns && (
                <a
                  href={event.links.sns}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 transition-colors shadow-2xs"
                >
                  <Share2 className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>公式SNS</span>
                </a>
              )}

              <div className="flex items-center justify-center sm:justify-start">
                <CalendarAddButton event={event} variant="button" menuPlacement="bottom-left" />
              </div>

              <div className="col-span-2 sm:col-span-1 grid grid-cols-3 sm:flex items-center gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${event.title}（${event.date}・${event.prefecture}）`)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 sm:py-3 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                  title="Xで共有"
                >
                  <span>Xで共有</span>
                </a>

                <a
                  href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 sm:py-3 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                  title="LINEで送る"
                >
                  <span>LINE</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="py-2.5 sm:py-3 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'コピー済' : 'URLコピー'}</span>
                </button>
              </div>
            </div>

            {/* リンク確認日・前年情報注意書き */}
            {(event.links.verified_at || event.links.official_stale) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300">
                {event.links.verified_at && (
                  <span className="inline-flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    リンク内容照合日: {event.links.verified_at}
                  </span>
                )}
                {event.links.official_stale && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    公式サイトは前年情報のままの可能性があります（最新案内は申込ページもあわせてご確認ください）
                  </span>
                )}
              </div>
            )}
          </div>

          {/* セクション 1: 必携品チェックリスト (localStorage保存) */}
          <div className={`${mobileTab === 'gear' ? 'block' : 'hidden sm:block'} bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 sm:pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700 dark:text-teal-400" />
                  <h3 className="font-extrabold text-slate-950 dark:text-white text-sm sm:text-base">
                    大会必携装備チェックリスト
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                  ※ チェック状態はブラウザに自動保存されます
                </p>
              </div>

              {/* 進捗 & 一括操作ボタン */}
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <span className="text-xs sm:text-sm font-extrabold text-teal-900 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-teal-300 dark:border-teal-800">
                  {completedCount} / {totalCount} 完了 ({progressPercent}%)
                </span>
                <div className="flex items-center gap-3">
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
            </div>

            {/* プログレスバー */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 sm:h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-700 to-emerald-600 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* チェックリスト一覧 */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800 sm:divide-y-0 sm:space-y-2 border sm:border-0 border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-none overflow-hidden sm:overflow-visible bg-white dark:bg-slate-900 sm:bg-transparent pt-0 sm:pt-0.5">
              {event.mandatory_gear.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-600 p-3 sm:py-2">
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
                      className={`flex flex-col gap-1 px-2.5 py-2 sm:p-3 sm:rounded-xl sm:border transition-all cursor-pointer select-none sm:shadow-2xs ${
                        isChecked
                          ? 'bg-emerald-50/50 dark:bg-slate-800/40 sm:border-emerald-200 dark:sm:border-slate-700/40 text-slate-500'
                          : 'bg-white dark:bg-slate-800/80 sm:border-slate-250 dark:sm:border-slate-700/80 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            className="shrink-0 text-teal-700 dark:text-teal-400 focus:outline-none"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 fill-teal-700 text-white dark:text-slate-900" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-slate-500" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`text-xs sm:text-sm font-bold block leading-snug truncate sm:whitespace-normal ${
                                isChecked
                                  ? 'line-through text-slate-500 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                              title={gear.name}
                            >
                              {gear.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <span className="hidden sm:inline-block text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-250 dark:border-slate-700">
                            {gear.category}
                          </span>
                          {matchedGear && (
                            <MandatoryGearLinks gear={matchedGear} size="sm" />
                          )}
                        </div>
                      </div>

                      {matchedGear && matchedGear.standardTitle && (
                        <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 font-medium pl-8 border-l-2 border-teal-500/50 ml-1 truncate">
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
          <div className={`${mobileTab === 'deals' ? 'block' : 'hidden sm:block'} bg-slate-900 text-white border-2 border-amber-500/60 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4 shadow-md`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-500 text-white font-black shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-white text-sm sm:text-lg leading-snug">
                    必携品に直結！楽天市場 特価セールギア
                  </h3>
                  <p className="text-[11px] sm:text-xs text-amber-300 font-semibold truncate">
                    対象「{Array.from(eventGearCategories).join('・')}」の厳選割引モデル
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenCatalog && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenCatalog();
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors shadow cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>ギアカタログで全品比較</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-red-600 text-white hidden sm:inline">
                  15%〜50%OFF厳選
                </span>
              </div>
            </div>

            {/* ギアグリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 pt-0.5">
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
                    className="group flex gap-2.5 sm:gap-3.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 sm:border-2 hover:border-amber-400 rounded-xl p-2.5 sm:p-3.5 transition-all shadow-sm relative"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg bg-slate-900 border border-slate-600"
                        loading="lazy"
                      />
                      <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md border border-white/80 shadow-sm">
                        {deal.discount_rate}%OFF
                      </span>
                      {isNew && (
                        <span className="absolute -bottom-1.5 -left-1.5 bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md border border-white/90 shadow-sm leading-none">
                          新着
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          <span className="text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded bg-red-600/90 text-white">
                            ¥{savedYen.toLocaleString()}引
                          </span>
                          <span className="text-[10px] sm:text-xs font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-red-600 text-red-600" />
                            P{deal.point_rate}倍
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 group-hover:text-amber-300 transition-colors leading-snug">
                          {deal.title}
                        </p>
                      </div>

                      <div className="flex items-baseline justify-between mt-1.5 pt-1 border-t border-slate-700">
                        <div>
                          <span className="text-sm sm:text-lg font-black text-amber-300 font-mono">
                            {formatPrice(deal.price)}
                          </span>
                          <span className="text-[11px] sm:text-xs text-slate-400 line-through ml-1.5 font-mono">
                            {formatPrice(deal.original_price)}
                          </span>
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-emerald-400 flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          楽天
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
