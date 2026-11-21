import React, { useState, useEffect, useRef } from 'react';
import { Activity, Eye } from 'lucide-react';

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

const REEL_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** 1桁ずつくるくる回転するドラムロール式デジタルリール */
const DigitReel: React.FC<{
  digit: string;
  index: number;
  spinning: boolean;
  size: 'compact' | 'footer';
}> = ({ digit, index, spinning, size }) => {
  const num = Number(digit);
  // 回転開始時は0番目、確定時は2周目(10 + num)へ滑らかに回転させる
  const targetIndex = spinning ? 10 + num : 0;
  const rowHeight = size === 'footer' ? 32 : 20;
  const isCompact = size === 'compact';

  return (
    <span
      className={
        isCompact
          ? 'relative inline-flex justify-center overflow-hidden w-[13px] h-[20px] rounded-[4px] bg-slate-950/90 border border-teal-500/40 shadow-inner'
          : 'relative inline-flex justify-center overflow-hidden w-[24px] h-[32px] rounded-md bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]'
      }
    >
      {/* 機械式メーター風の中央ライン */}
      {!isCompact && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/50 z-10"
        />
      )}
      <span
        className="flex flex-col items-center will-change-transform"
        style={{
          transform: `translateY(-${targetIndex * rowHeight}px)`,
          transition: `transform ${950 + index * 140}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay: `${index * 60}ms`,
        }}
      >
        {REEL_DIGITS.map((d, i) => (
          <span
            key={i}
            style={{ height: `${rowHeight}px`, lineHeight: `${rowHeight}px` }}
            className={
              isCompact
                ? 'block text-center font-mono text-[12px] font-black text-teal-300 select-none'
                : 'block text-center font-mono text-[17px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.45)] select-none'
            }
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

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

  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // compact はマウント直後、footer は画面に表示された瞬間にくるくる回転開始
  useEffect(() => {
    if (variant === 'compact') {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant]);

  // 表示用の文字配列（例: "1,234" → ['1', ',', '2', '3', '4']、最小4桁ゼロ埋めなし）
  const formattedChars = count.toLocaleString().split('');

  // ヘッダー用（画面右上）表示
  if (variant === 'compact') {
    return (
      <div
        ref={containerRef}
        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-slate-900/95 border border-slate-700/90 text-xs font-black text-slate-100 leading-none shadow-sm select-none hover:border-teal-400/80 transition-colors shrink-0"
        title="サイト累計アクセス数（PC・スマホ全端末合算）"
      >
        <Eye className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <span className="text-[10px] font-bold text-slate-300 hidden sm:inline tracking-wide">
          ACCESS
        </span>
        <div className="inline-flex items-center gap-[2px]" aria-label={`累計アクセス ${count}`}>
          {formattedChars.map((ch, idx) =>
            ch === ',' ? (
              <span key={`c-${idx}`} className="text-teal-400 font-mono text-[11px] font-black leading-none pb-0.5">
                ,
              </span>
            ) : (
              <DigitReel key={`d-${idx}`} digit={ch} index={idx} spinning={ready} size="compact" />
            )
          )}
        </div>
      </div>
    );
  }

  // フッター用（サイト最下部：レース計時器風メカニカル・オドメーター）
  return (
    <div
      ref={containerRef}
      className="inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border border-slate-700/80 shadow-lg shadow-slate-950/15 dark:shadow-black/40"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <Activity className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-xs font-extrabold tracking-wider text-slate-200 uppercase">
          Total Visits
        </span>
      </div>

      <div
        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-black/50 border border-slate-700/70"
        aria-label={`公式累計アクセス数 ${count}`}
      >
        {formattedChars.map((ch, idx) =>
          ch === ',' ? (
            <span key={`fc-${idx}`} className="text-emerald-400 font-mono text-base font-black self-end pb-1">
              ,
            </span>
          ) : (
            <DigitReel key={`fd-${idx}`} digit={ch} index={idx} spinning={ready} size="footer" />
          )
        )}
      </div>

      <span className="text-[11px] font-bold text-teal-300/90 tracking-wide">
        累計アクセス
      </span>
    </div>
  );
};
