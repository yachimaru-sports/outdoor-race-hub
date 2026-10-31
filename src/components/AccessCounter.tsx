import React from 'react';
import { Eye, Users } from 'lucide-react';

interface AccessCounterProps {
  variant?: 'compact' | 'footer';
}

export const AccessCounter: React.FC<AccessCounterProps> = ({ variant = 'compact' }) => {
  // 本番サイトのURLキー（実アクセスのみをカウントする誠実な公式カウンター）
  const counterUrl =
    'https://hits.sh/yachimaru-sports.github.io/outdoor-race-hub.svg?label=%E7%B4%AF%E8%A8%88%E3%82%A2%E3%82%AF%E3%82%BB%E3%82%B9&color=0d9488&labelColor=0f172a';

  // ヘッダー用（画面右上）コンパクト表示
  if (variant === 'compact') {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900 border border-slate-750 text-[10px] font-bold text-slate-300 leading-none shadow-2xs select-none"
        title="サイト累計アクセス数（実数のみをリアルタイム集計）"
      >
        <Eye className="w-3 h-3 text-teal-400 shrink-0" />
        <img
          src={counterUrl}
          alt="累計アクセス数"
          className="h-4 w-auto inline-block rounded"
          loading="eager"
        />
      </div>
    );
  }

  // フッター用（サイト最下部）
  return (
    <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-300 dark:border-slate-800 text-xs font-bold shadow-2xs">
      <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
        <Users className="w-4 h-4 shrink-0" />
        <span>公式累計アクセス数:</span>
      </div>
      <img
        src={counterUrl}
        alt="累計アクセス数"
        className="h-5 w-auto inline-block rounded shadow-2xs"
        loading="lazy"
      />
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-700">
        実数計測
      </span>
    </div>
  );
};
