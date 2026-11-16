import React from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 画面右下に常駐し、クリックすると一番上へスムーズに戻るフローティングボタン
 */
export const ScrollToTopButton: React.FC = () => {
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      aria-label="一番上へ戻る"
      title="一番上へ戻る"
      className="fixed bottom-5 right-4 sm:bottom-7 sm:right-6 z-40 inline-flex items-center gap-1.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full bg-teal-700/95 hover:bg-teal-600 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-slate-900/30 border border-teal-400/50 backdrop-blur-xs transition-all cursor-pointer select-none"
    >
      <ArrowUp className="w-4 h-4 stroke-[2.6]" />
      <span>TOPへ</span>
    </button>
  );
};
