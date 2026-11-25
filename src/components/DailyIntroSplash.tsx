import React, { useEffect, useRef, useState } from 'react';
import { Mountain } from 'lucide-react';

interface DailyIntroSplashProps {
  bgUrl: string;
  placeLabel: string;
  eventTitle?: string;
  replayKey?: number;
}

type IntroPhase = 'hidden' | 'preloading' | 'playing' | 'skipping';

const STORAGE_KEY = 'race_hub_intro_seen_date';

/**
 * 日本時間（JST）の本日の日付文字列（YYYY-MM-DD）を返す
 */
function getJstTodayIso(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 初回マウント時にオープニング演出を再生すべきか判定する
 */
function shouldPlayOnMount(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // テスト・確認用クエリ ?intro=1 がある場合は常に再生
    const params = new URLSearchParams(window.location.search);
    if (params.get('intro') === '1') return true;
    // 視差・アニメーション抑制設定のユーザーには自動再生を控える
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) !== getJstTodayIso();
  } catch {
    return false;
  }
}

/**
 * 1日1回限定・日替わり開催地の風景が手前から背景へ収まる約2秒のオープニング演出
 */
export const DailyIntroSplash: React.FC<DailyIntroSplashProps> = ({
  bgUrl,
  placeLabel,
  eventTitle,
  replayKey = 0,
}) => {
  const [phase, setPhase] = useState<IntroPhase>(() => (shouldPlayOnMount() ? 'preloading' : 'hidden'));
  const [runId, setRunId] = useState<number>(0);

  const prevReplayKeyRef = useRef<number>(replayKey);
  const finishTimerRef = useRef<number | null>(null);
  const skipTimerRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (skipTimerRef.current !== null) {
      window.clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  };

  // フッター等の手動再再生トリガー検知
  useEffect(() => {
    if (replayKey > prevReplayKeyRef.current) {
      prevReplayKeyRef.current = replayKey;
      clearAllTimers();
      setRunId((prev) => prev + 1);
      setPhase('preloading');
    }
  }, [replayKey]);

  // プリロード処理：今日の背景画像を先に読み込み、完了または最大450msで再生開始
  useEffect(() => {
    if (phase !== 'preloading') return;

    let cancelled = false;
    const startPlaying = () => {
      if (cancelled) return;
      try {
        localStorage.setItem(STORAGE_KEY, getJstTodayIso());
      } catch {}
      setPhase('playing');
    };

    const img = new Image();
    img.onload = startPlaying;
    img.onerror = startPlaying;
    img.src = bgUrl;

    if (img.complete) {
      startPlaying();
      return () => {
        cancelled = true;
      };
    }

    const fallbackTimer = window.setTimeout(startPlaying, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [phase, bgUrl, runId]);

  // 再生開始から約2.1秒後に自動終了し、アンマウントする
  useEffect(() => {
    if (phase !== 'playing') return;

    finishTimerRef.current = window.setTimeout(() => {
      setPhase('hidden');
      finishTimerRef.current = null;
    }, 2100);

    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [phase, runId]);

  // タップ・クリック・Escapeキーによる即スキップ
  const handleSkip = () => {
    if (phase === 'hidden' || phase === 'skipping') return;
    clearAllTimers();
    try {
      localStorage.setItem(STORAGE_KEY, getJstTodayIso());
    } catch {}
    setPhase('skipping');
    skipTimerRef.current = window.setTimeout(() => {
      setPhase('hidden');
      skipTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    if (phase === 'hidden') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  if (phase === 'hidden') return null;

  const isPlaying = phase === 'playing';
  const isSkipping = phase === 'skipping';

  return (
    <div
      key={runId}
      role="dialog"
      aria-label="OUTDOOR RACE HUB 本日のオープニング"
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] select-none overflow-hidden cursor-pointer transition-opacity duration-200 ${
        isSkipping ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 層1：柔らかい白（ダーク時は濃紺）ベース幕 */}
      <div
        className={`absolute inset-0 bg-[#f8fafc] dark:bg-[#020617] ${
          isPlaying ? 'animate-intro-backdrop' : ''
        }`}
      />

      {/* 層2：今日の開催地景色（手前から広がり、奥のHP背景へ着地） */}
      {isPlaying && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="w-full h-full animate-intro-scenery will-change-transform">
            <img
              src={bgUrl}
              alt=""
              className="w-full h-full object-cover object-center saturate-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
          </div>

          {/* 画面下部中央：今日のフィールド名キャプション */}
          <div className="absolute inset-x-0 bottom-12 sm:bottom-16 px-4 flex flex-col items-center text-center animate-intro-caption">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.28em] uppercase text-teal-200 drop-shadow">
              TODAY&apos;S FIELD
            </span>
            <p className="mt-1 text-lg sm:text-2xl font-black tracking-wide text-white drop-shadow-md">
              {placeLabel}
            </p>
            {eventTitle && (
              <p className="mt-0.5 text-[11px] sm:text-xs text-white/85 font-medium truncate max-w-[88vw] drop-shadow">
                {eventTitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 層3：OUTDOOR RACE HUB ロゴ（手前から中央奥へスッと消える） */}
      {isPlaying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-intro-logo will-change-transform">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-xl mb-3 sm:mb-4">
              <Mountain className="w-6 h-6 sm:w-8 sm:h-8 stroke-[2.3]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.08em] leading-none drop-shadow-[0_2px_16px_rgba(255,255,255,0.65)] dark:drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]">
              <span className="text-slate-900 dark:text-white">OUTDOOR </span>
              <span className="text-teal-600 dark:text-teal-400">RACE HUB</span>
            </h1>
            <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-slate-600 dark:text-slate-300 mt-2 sm:mt-3">
              JAPAN OUTDOOR RACE PORTAL
            </p>
          </div>
        </div>
      )}

      {/* 右下：タップで即スキップヒント */}
      <div className="fixed bottom-5 right-5 pointer-events-none">
        <span className="inline-block px-2.5 py-1 rounded-full bg-slate-900/45 text-white/85 text-[10px] font-bold backdrop-blur-xs">
          タップでスキップ
        </span>
      </div>
    </div>
  );
};
