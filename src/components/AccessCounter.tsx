import React, { useState, useEffect } from 'react';
import { Eye, Users } from 'lucide-react';

interface AccessCounterProps {
  variant?: 'compact' | 'footer';
}

const STORAGE_KEY = 'race_hub_local_hits';
const SESSION_KEY = 'race_hub_session_active';
const BASE_ACCESS_COUNT = 113; // 既存の累計基準アクセス数（113件）
const COUNTER_NS = 'yachimaru-outdoor-race-hub';
const COUNTER_KEY = 'visits';

// 同一ページ内にヘッダー・フッターの2箇所へマウントされても API 呼び出しは1回にまとめる
let sharedFetchPromise: Promise<number | null> | null = null;

function fetchSharedCount(): Promise<number | null> {
  if (sharedFetchPromise) return sharedFetchPromise;
  sharedFetchPromise = (async () => {
    try {
      const isLocal =
        typeof window !== 'undefined' &&
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
      const isNewSession = !sessionStorage.getItem(SESSION_KEY);
      if (isNewSession) {
        sessionStorage.setItem(SESSION_KEY, '1');
      }
      const action = isNewSession && !isLocal ? 'hit' : 'get';
      const res = await fetch(
        `https://abacus.jasoncameron.dev/${action}/${COUNTER_NS}/${COUNTER_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { value?: number };
      if (typeof data.value !== 'number' || Number.isNaN(data.value)) return null;
      return BASE_ACCESS_COUNT + data.value;
    } catch {
      return null;
    }
  })();
  return sharedFetchPromise;
}

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
    let mounted = true;
    fetchSharedCount().then((total) => {
      if (!mounted || total === null) return;
      setCount(total);
      try {
        localStorage.setItem(STORAGE_KEY, String(total));
      } catch {
        // LocalStorage制限時は無視
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ヘッダー用（画面右上）表示
  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/90 text-xs font-black text-slate-100 leading-none shadow-sm select-none hover:border-teal-500 transition-colors shrink-0"
        title="サイト累計アクセス数（PC・スマホ全端末合算）"
      >
        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400 shrink-0" />
        <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 hidden sm:inline">累計アクセス</span>
        <span className="px-1.5 sm:px-2 py-0.5 rounded bg-teal-600 text-white font-mono text-[11px] sm:text-xs font-black shadow-inner tracking-wide">
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
