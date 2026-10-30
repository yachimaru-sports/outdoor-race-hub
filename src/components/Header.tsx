import React from 'react';
import { Mountain, Compass, Award, Calendar, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  totalEvents: number;
  openCount: number;
  dealsCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalEvents,
  openCount,
  dealsCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="border-b border-slate-300 dark:border-slate-800 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md sticky top-[76px] z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 左側：ロゴ＆ブランドタイトル */}
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-sm shrink-0">
                <Mountain className="w-5.5 h-5.5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 dark:text-white whitespace-nowrap">
                    OUTDOOR <span className="text-teal-700 dark:text-teal-400">RACE HUB</span>
                  </h1>
                  <span className="text-xs tracking-wider font-black px-2 py-0.5 rounded-md bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 whitespace-nowrap">
                    2026-2027 全国＆中四国網羅
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-bold mt-0.5 truncate">
                  アドベンチャー・100マイル・トレイルラン・ロングライド・ウルトラマラソン情報 ＆ 楽天特価ギア
                </p>
              </div>
            </div>

            {/* モバイル用テーマ切り替えボタン */}
            <div className="lg:hidden shrink-0 ml-2">
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                aria-label="テーマ切り替え"
                title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 text-slate-800" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>
            </div>
          </div>

          {/* 右側：ピル型カウンター（すべて whitespace-nowrap で改行崩れを完全防止） */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {/* 掲載大会数 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 shadow-2xs font-bold whitespace-nowrap shrink-0">
              <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>掲載大会</span>
              <span className="font-mono font-black text-slate-950 dark:text-white">
                {totalEvents}件
              </span>
            </div>

            {/* エントリー受付中 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-400 dark:border-emerald-600/50 text-xs sm:text-[13px] text-emerald-950 dark:text-emerald-200 shadow-2xs font-bold whitespace-nowrap shrink-0">
              <Compass className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>受付中</span>
              <span className="font-mono font-black text-emerald-900 dark:text-emerald-200">
                {openCount}件
              </span>
            </div>

            {/* 特価品目数 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 border border-amber-400 dark:border-amber-600/50 text-xs sm:text-[13px] text-amber-950 dark:text-amber-200 shadow-2xs font-bold whitespace-nowrap shrink-0">
              <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>特価ギア</span>
              <span className="font-mono font-black text-amber-950 dark:text-amber-200">
                {dealsCount}品
              </span>
            </div>

            {/* PC用テーマ切り替えボタン */}
            <div className="hidden lg:flex items-center pl-1 shrink-0">
              <button
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-2xs text-xs sm:text-[13px] font-bold cursor-pointer whitespace-nowrap shrink-0"
                aria-label="テーマ切り替え"
                title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>ダーク</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>ライト</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
