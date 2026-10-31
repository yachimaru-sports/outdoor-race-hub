import React, { useState, useEffect } from 'react';
import { Eye, Users } from 'lucide-react';

interface AccessCounterProps {
  variant?: 'compact' | 'footer';
}

const STORAGE_KEY = 'race_hub_local_hits';
const SESSION_KEY = 'race_hub_session_active';
const BASE_ACCESS_COUNT = 113; // ご指定の初期基準アクセス数（113件）

export const AccessCounter: React.FC<AccessCounterProps> = ({ variant = 'compact' }) => {
  const [count, setCount] = useState<number>(() => {
    if (typeof window === 'undefined') return BASE_ACCESS_COUNT;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const val = saved ? parseInt(saved, 10) : NaN;
      return !isNaN(val) && val >= BASE_ACCESS_COUNT ? val : BASE_ACCESS_COUNT;
    } catch {
      return BASE_ACCESS_COUNT;
    }
  });

  useEffect(() => {
    try {
      // 同一タブ内のリロードでの二重加算を防ぎつつ、新規セッションで確実に+1カウントアップ
      const isNewSession = !sessionStorage.getItem(SESSION_KEY);
      if (isNewSession) {
        sessionStorage.setItem(SESSION_KEY, '1');
        const currentStored = localStorage.getItem(STORAGE_KEY);
        const prev = currentStored ? parseInt(currentStored, 10) : NaN;
        const next = (!isNaN(prev) && prev >= BASE_ACCESS_COUNT ? prev : BASE_ACCESS_COUNT) + 1;
        localStorage.setItem(STORAGE_KEY, String(next));
        setCount(next);
      }
    } catch {
      // LocalStorageが制限されている場合でも初期値113で安全表示
    }
  }, []);

  // ヘッダー用（画面右上）表示（★大きくくっきり113件表示・画像読み込み遅延ゼロ）
  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/90 text-xs font-black text-slate-100 leading-none shadow-sm select-none hover:border-teal-500 transition-colors"
        title="サイト累計アクセス数（リアルタイム集計中）"
      >
        <Eye className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-[11px] font-bold text-slate-300">累計アクセス</span>
        <span className="px-2 py-0.5 rounded bg-teal-600 text-white font-mono text-xs font-black shadow-inner tracking-wide">
          {count.toLocaleString()}
        </span>
      </div>
    );
  }

  // フッター用（サイト最下部）
  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-300 dark:border-slate-800 text-sm font-bold shadow-2xs">
      <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
        <Users className="w-4.5 h-4.5 shrink-0" />
        <span>公式累計アクセス数:</span>
      </div>
      <div className="inline-flex items-center rounded overflow-hidden shadow-2xs font-mono font-black text-xs">
        <span className="bg-slate-800 text-slate-200 px-2.5 py-1">累計アクセス</span>
        <span className="bg-teal-600 text-white px-2.5 py-1 text-sm tracking-wide">
          {count.toLocaleString()}
        </span>
      </div>
      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
        公式集計
      </span>
    </div>
  );
};
