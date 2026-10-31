import React, { useRef } from 'react';
import { DealItem } from '../types';
import { ChevronLeft, ChevronRight, Zap, ExternalLink, Flame } from 'lucide-react';
import { formatPrice } from '../utils/helpers';

interface DealsTickerProps {
  deals: DealItem[];
  onSelectDeal?: (deal: DealItem) => void;
}

export const DealsTicker: React.FC<DealsTickerProps> = ({ deals }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -330 : 330;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-slate-900 border-b-2 border-amber-500/80 text-slate-100 sticky top-0 z-40 shadow-md transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* 左端：超コンパクト縦型ラベル（横幅を最小化し商品カード枠を最大化） */}
          <div className="flex flex-col items-center justify-center px-2.5 py-1.5 bg-gradient-to-b from-red-600 to-amber-600 text-white rounded-xl shrink-0 shadow-sm border border-amber-300/40 leading-none select-none">
            <div className="flex items-center gap-0.5 text-[11px] font-black tracking-tighter whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300 shrink-0" />
              <span>楽天特価</span>
            </div>
            <span className="text-[10px] font-extrabold text-yellow-200 mt-1 whitespace-nowrap">
              20〜50%OFF
            </span>
          </div>

          {/* カルーセルコンテナ（横幅いっぱいに3〜4枚しっかり表示） */}
          <div className="relative flex-1 min-w-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
            >
              {deals.map((deal) => {
                const savedYen = deal.original_price - deal.price;
                return (
                  <a
                    key={deal.id}
                    href={deal.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-2.5 bg-slate-800 hover:bg-slate-750 border-2 border-slate-700 hover:border-amber-400 rounded-xl p-2 w-[305px] sm:w-[320px] shrink-0 transition-all shadow-sm"
                  >
                    {/* 商品イラスト画像 + 特大割引リボン */}
                    <div className="relative shrink-0">
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-14 h-14 object-cover rounded-lg bg-slate-900 border border-slate-600 shadow-xs"
                        loading="lazy"
                      />
                      <div className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[11px] px-1.5 py-0.5 rounded shadow-md border border-white/80 tracking-tight leading-none">
                        {deal.discount_rate}%OFF
                      </div>
                    </div>

                    {/* 商品情報 & 特価強調 */}
                    <div className="min-w-0 flex-1">
                      {/* 1段目：大幅割引バッジ ＆ ポイント還元 */}
                      <div className="flex items-center gap-1 mb-1 whitespace-nowrap">
                        <span className="text-[11px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-2xs leading-none">
                          🔥 {deal.discount_rate}%OFF (¥{savedYen.toLocaleString()}引)
                        </span>
                        <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 flex items-center gap-0.5 leading-none">
                          <Flame className="w-3 h-3 fill-red-600 text-red-600 shrink-0" />
                          P{deal.point_rate}倍
                        </span>
                      </div>

                      {/* 2段目：商品名 */}
                      <p className="text-xs text-white font-bold truncate group-hover:text-amber-300 transition-colors">
                        {deal.title}
                      </p>

                      {/* 3段目：特価価格（大きく強調）＆ 定価取消線 */}
                      <div className="flex items-baseline gap-1.5 mt-0.5 whitespace-nowrap">
                        <span className="text-base font-black font-mono text-amber-300 tracking-tight leading-none">
                          {formatPrice(deal.price)}
                        </span>
                        <span className="text-[11px] text-slate-400 line-through font-mono">
                          定価{formatPrice(deal.original_price)}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-extrabold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                          <span>楽天</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          {/* 右端：スクロールボタン（コンパクト縦並び or 省スペース横並び） */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleScroll('left')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-600 shadow-xs cursor-pointer"
              aria-label="前へスクロール"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleScroll('right')}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-600 shadow-xs cursor-pointer"
              aria-label="次へスクロール"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
