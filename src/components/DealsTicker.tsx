import React, { useRef, useEffect, useState } from 'react';
import { DealItem } from '../types';
import { AccessCounter } from './AccessCounter';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  ExternalLink,
  Flame,
  Mountain,
  Sun,
  Moon,
  Calendar,
} from 'lucide-react';
import { formatPrice } from '../utils/helpers';

interface DealsTickerProps {
  deals: DealItem[];
  totalEvents?: number;
  openCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const DealsTicker: React.FC<DealsTickerProps> = ({
  deals,
  totalEvents = 158,
  openCount = 29,
  theme = 'light',
  onToggleTheme,
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

  return (
    <header
      className="bg-slate-950 border-b-2 border-amber-500/80 text-slate-100 sticky top-0 z-50 shadow-md select-none transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2.5">
          {/* 左端：サイトブランドロゴ（上段に大きく配置） ＆ その下に大会数・楽天特価バッジ */}
          <div className="flex flex-col justify-center shrink-0 pr-1">
            {/* 上段：HP名称を大きく堂々と目立たせる */}
            <a
              href="#"
              className="flex items-center gap-2 group cursor-pointer"
              title="OUTDOOR RACE HUB トップへ"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:bg-teal-500 transition-colors">
                <Mountain className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div className="leading-none">
                <div className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1 drop-shadow-xs">
                  <span>OUTDOOR</span>
                  <span className="text-teal-400">RACE HUB</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5 inline-block">
                  2026-2027 全国＆中四国
                </span>
              </div>
            </a>

            {/* 下段：ロゴの真下に大会数バッジ ＆ 楽天特価ラベル ＆ 累計アクセスカウンター */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {/* 掲載大会数（受付中） */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 leading-none whitespace-nowrap">
                <Calendar className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                <span>全{totalEvents}大会</span>
                <span className="text-emerald-400 font-black">(受付中{openCount})</span>
              </div>

              {/* 楽天特価ラベル */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-red-600 to-amber-600 text-white rounded shrink-0 shadow-xs border border-amber-300/40 text-[10px] font-black leading-none whitespace-nowrap">
                <Zap className="w-2.5 h-2.5 fill-yellow-300 text-yellow-300 shrink-0" />
                <span>楽天特価</span>
                <span className="text-[9px] text-yellow-200 font-extrabold ml-0.5">20〜53%OFF</span>
              </div>

              </div>
          </div>

          {/* 中央：無限スライド 楽天特価ギアカルーセル */}
          <div className="relative flex-1 min-w-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5"
            >
              {tripleDeals.map((deal, idx) => {
                const savedYen = deal.original_price - deal.price;
                return (
                  <a
                    key={`${deal.id}-${idx}`}
                    href={deal.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-amber-400 rounded-xl p-1.5 w-[290px] sm:w-[310px] shrink-0 transition-all shadow-xs"
                    title={`楽天市場で見る: ${deal.title}`}
                  >
                    {/* 商品画像 + 割引リボン */}
                    <div className="relative shrink-0">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-12 h-12 object-cover rounded-lg bg-slate-950 border border-slate-700 shadow-2xs"
                        loading="lazy"
                      />
                      <div className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded shadow border border-white/80 tracking-tight leading-none">
                        {deal.discount_rate}%OFF
                      </div>
                    </div>

                    {/* 商品情報 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mb-0.5 whitespace-nowrap">
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

          {/* 右端：スライドアクション ＆ テーマ切り替え */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* リアルタイム累計アクセスカウンター（画面最右上） */}
            <AccessCounter variant="compact" />
            <button
              onClick={() => handleManualScroll('left')}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
              aria-label="前へスクロール"
              title="前へ"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleManualScroll('right')}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
              aria-label="次へスクロール"
              title="次へ"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* テーマ切り替えボタン */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors shadow-2xs cursor-pointer ml-0.5"
                aria-label="テーマ切り替え"
                title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
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
      </div>
    </header>
  );
};
