import React, { useRef, useEffect, useState } from 'react';
import { DealItem } from '../types';
import { AccessCounter } from './AccessCounter';
import { handleImageError } from '../utils/imageFallback';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Mountain,
  ShoppingBag,
  Sun,
  Moon,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { formatPrice } from '../utils/helpers';

interface DealsTickerProps {
  deals: DealItem[];
  totalEvents?: number;
  openCount?: number;
  lastUpdated?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenCatalog?: () => void;
  isPcView?: boolean;
  onToggleDisplayMode?: () => void;
}

export const DealsTicker: React.FC<DealsTickerProps> = ({
  deals,
  totalEvents = 158,
  openCount = 29,
  lastUpdated = '2026.10.31 10:30',
  theme = 'light',
  onToggleTheme,
  onOpenCatalog,
  isPcView,
  onToggleDisplayMode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animFrameId = useRef<number | null>(null);

  // 途切れず無限にぐるぐる繋がるように3セット配置
  const tripleDeals = [...deals, ...deals, ...deals];

  // 初期スクロール位置を中央セットの開始位置に設定
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || deals.length === 0) return;

    const timer = setTimeout(() => {
      if (el) {
        const singleWidth = el.scrollWidth / 3;
        el.scrollLeft = singleWidth;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [deals.length]);

  // requestAnimationFrame による超高精度・滑らか自動スクロール
  useEffect(() => {
    if (isPaused || deals.length === 0) return;

    let lastTime = performance.now();

    const step = (now: number) => {
      const el = scrollRef.current;
      if (!el) return;

      const elapsed = now - lastTime;
      if (elapsed > 16) {
        lastTime = now;
        const singleWidth = el.scrollWidth / 3;

        if (singleWidth > 0) {
          el.scrollLeft += 0.8;

          // 右端（2セット分通過）に達したら、中央セットへ瞬間ワープ
          if (el.scrollLeft >= singleWidth * 2) {
            el.scrollLeft -= singleWidth;
          }
        }
      }

      animFrameId.current = requestAnimationFrame(step);
    };

    animFrameId.current = requestAnimationFrame(step);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isPaused, deals.length]);

  // 左右の手動スクロールボタン
  const handleManualScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;

    const singleWidth = el.scrollWidth / 3;
    const offset = direction === 'left' ? -340 : 340;

    if (direction === 'right' && el.scrollLeft >= singleWidth * 2 - 100) {
      el.scrollLeft -= singleWidth;
    } else if (direction === 'left' && el.scrollLeft <= singleWidth + 100) {
      el.scrollLeft += singleWidth;
    }

    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className="bg-slate-950 border-b border-amber-500/70 text-slate-100 select-none transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2.5">
          {/* 上段（スマホでは左右1行に収める／PCでは左ブロック） */}
          <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto shrink-0">
            <div className="flex flex-col justify-center shrink-0 pr-1">
              {/* 上段：HP名称をクリックでページ最上部へスムーズスクロール */}
              <a
                href="#"
                onClick={handleScrollToTop}
                className="flex items-center gap-1.5 sm:gap-2 group cursor-pointer"
                title="OUTDOOR RACE HUB ページの先頭へ戻る"
              >
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:bg-teal-500 transition-colors">
                  <Mountain className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
                </div>
                <div className="leading-none">
                  <div className="text-xs sm:text-lg font-black tracking-tight text-white flex items-center gap-1 drop-shadow-xs whitespace-nowrap">
                    <span>OUTDOOR</span>
                    <span className="text-teal-400">RACE HUB</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold tracking-wide mt-0.5 inline-block">
                    2026-2027 全国＆中四国
                  </span>
                </div>
              </a>

              {/* PC表示時：ロゴの真下に最新情報更新日時バッジ */}
              <div className="hidden md:flex items-center gap-1.5 mt-1.5">
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-[10px] sm:text-[11px] font-bold text-emerald-300 leading-none whitespace-nowrap shadow-xs"
                  title="全国＆中四国の大会日程・エントリー受付状況・必携装備・ギア特価を常時巡回更新中"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">最新情報:</span>
                  <span className="text-white font-mono font-black">{lastUpdated}</span>
                </div>
              </div>
            </div>

            {/* スマホ表示時の右上コントロール（はみ出しゼロ） */}
            <div className="flex md:hidden items-center gap-1 shrink-0">
              {onToggleDisplayMode && (
                <button
                  onClick={onToggleDisplayMode}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="PC表示とスマホ表示の切り替え"
                >
                  {isPcView ? (
                    <>
                      <Smartphone className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>スマホ版</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>PC版</span>
                    </>
                  )}
                </button>
              )}
              <AccessCounter variant="compact" />
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  aria-label="テーマ切り替え"
                >
                  {theme === 'light' ? (
                    <Moon className="w-3.5 h-3.5 text-slate-200" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* スマホ2段目：最新情報日時 ＋ おすすめ商品専用ページボタン（見切れゼロ） */}
          <div className="flex md:hidden items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-[10px] font-bold text-emerald-300 leading-none whitespace-nowrap min-w-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-white font-mono font-black truncate">{lastUpdated}</span>
            </div>
            {onOpenCatalog && (
              <button
                onClick={onOpenCatalog}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 font-black text-[11px] shadow-sm cursor-pointer whitespace-nowrap border border-amber-300 shrink-0"
              >
                <ShoppingBag className="w-3 h-3 text-slate-950 shrink-0" />
                <span>おすすめ商品専用ページ</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </button>
            )}
          </div>

          {/* 中央：無限スライド 楽天特価ギアカルーセル */}
          <div className="relative w-full md:flex-1 min-w-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5"
            >
              {tripleDeals.map((deal, idx) => {
                const savedYen = deal.original_price - deal.price;
                const isNew = Boolean(
                  deal.registered_at &&
                    Date.now() - new Date(deal.registered_at).getTime() <= 48 * 60 * 60 * 1000
                );
                return (
                  <a
                    key={`${deal.id}-${idx}`}
                    href={deal.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-amber-400 rounded-xl p-1 sm:p-1.5 w-[240px] sm:w-[310px] shrink-0 transition-all shadow-xs"
                    title={`楽天市場で見る: ${deal.title}`}
                  >
                    {/* 商品画像 + 割引リボン + 新規登録マーク */}
                    <div className="relative shrink-0">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-contain bg-white rounded-lg p-0.5 border border-slate-700 shadow-2xs"
                        loading="lazy"
                      />
                      <div className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded shadow border border-white/80 tracking-tight leading-none">
                        {deal.discount_rate}%OFF
                      </div>
                      {isNew && (
                        <div className="absolute -bottom-1 -left-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[9px] px-1 py-0.2 rounded shadow border border-white/90 leading-none">
                          新着NEW
                        </div>
                      )}
                    </div>

                    {/* 商品情報 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mb-0.5 whitespace-nowrap">
                        {isNew && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 leading-none shadow-xs">
                            🆕 新規登録
                          </span>
                        )}
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-600 text-white leading-none">
                          🔥 ¥{savedYen.toLocaleString()}引
                        </span>
                        <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-amber-400 text-slate-950 flex items-center gap-0.5 leading-none">
                          <Flame className="w-2.5 h-2.5 fill-red-600 text-red-600 shrink-0" />
                          P{deal.point_rate}倍
                        </span>
                      </div>

                      <p className="text-xs text-white font-bold truncate group-hover:text-amber-300 transition-colors">
                        {deal.title}
                      </p>

                      <div className="flex items-baseline gap-1 mt-0.5 whitespace-nowrap">
                        <span className="text-sm font-black font-mono text-amber-300 tracking-tight leading-none">
                          {formatPrice(deal.price)}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through font-mono">
                          {formatPrice(deal.original_price)}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                          <span>楽天</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* 右端（PC表示のみ）：2段構成（上段：累計アクセス数 / 下段：＜ ＞ 月マーク） */}
          <div className="hidden md:flex flex-col items-end justify-center gap-1 shrink-0">
            {/* 上段：アクセス数 */}
            <div className="flex items-center gap-1.5">
              {onOpenCatalog && (
                <button
                  onClick={onOpenCatalog}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-[11px] sm:text-xs shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap border border-amber-300"
                  title="おすすめ商品・必携品専用カタログページを開く"
                >
                  <ShoppingBag className="w-3 h-3 text-slate-950 shrink-0" />
                  <span>🎒 おすすめ商品専用ページ</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}
              <AccessCounter variant="compact" />
            </div>

            {/* 下段：＜ ＞ 月マーク */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleManualScroll('left')}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
                aria-label="前へスクロール"
                title="前へ"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleManualScroll('right')}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
                aria-label="次へスクロール"
                title="次へ"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* PC表示 / スマホ表示 切り替えボタン */}
              {onToggleDisplayMode && (
                <button
                  onClick={onToggleDisplayMode}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                  aria-label="PC表示とスマホ表示の切り替え"
                  title={isPcView ? 'スマホ用画面に切り替え' : 'PC用画面に切り替え'}
                >
                  {isPcView ? (
                    <>
                      <Smartphone className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>スマホ版</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>PC版</span>
                    </>
                  )}
                </button>
              )}

              {/* テーマ切り替えボタン */}
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="p-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors shadow-2xs cursor-pointer"
                  aria-label="テーマ切り替え"
                  title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
                >
                  {theme === 'light' ? (
                    <Moon className="w-3 h-3 text-slate-200" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-400" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
