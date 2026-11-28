import React, { useEffect, useRef, useState } from 'react';
import { Mountain } from 'lucide-react';

interface DailyIntroSplashProps {
  bgUrl: string;
  placeLabel: string;
  eventTitle?: string;
  replayKey?: number;
  onActiveChange?: (active: boolean) => void;
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
 * 1日1回限定・完全GPU合成（60fps+・1本連続曲線）で日替わり開催地風景がシネマティックに着地するオープニング演出
 */
export const DailyIntroSplash: React.FC<DailyIntroSplashProps> = ({
  bgUrl,
  placeLabel,
  eventTitle,
  replayKey = 0,
  onActiveChange,
}) => {
  const [phase, setPhase] = useState<IntroPhase>(() => (shouldPlayOnMount() ? 'preloading' : 'hidden'));
  const [runId, setRunId] = useState<number>(0);

  const prevReplayKeyRef = useRef<number>(replayKey);
  const finishTimerRef = useRef<number | null>(null);
  const skipTimerRef = useRef<number | null>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

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

  // 演出のアクティブ状態を親へ通知（裏側の自動カルーセル等を一時停止させるため）
  useEffect(() => {
    onActiveChangeRef.current?.(phase !== 'hidden');
  }, [phase]);

  // アンマウント時は確実に非アクティブ通知を戻す
  useEffect(() => {
    return () => {
      onActiveChangeRef.current?.(false);
    };
  }, []);

  // 上部ボタン等の手動再再生トリガー検知
  useEffect(() => {
    if (replayKey > prevReplayKeyRef.current) {
      prevReplayKeyRef.current = replayKey;
      clearAllTimers();
      setRunId((prev) => prev + 1);
      setPhase('preloading');
    }
  }, [replayKey]);

  // プリロード＆デコード完了待ち：画像をDOMに事前マウントし、デコード完了＋2フレーム同期で0フレーム落ち再生
  useEffect(() => {
    if (phase !== 'preloading') return;

    let cancelled = false;
    let triggered = false;
    let raf1: number | null = null;
    let raf2: number | null = null;

    const triggerPlay = () => {
      if (cancelled || triggered) return;
      triggered = true;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (cancelled) return;
          try {
            localStorage.setItem(STORAGE_KEY, getJstTodayIso());
          } catch {}
          setPhase('playing');
        });
      });
    };

    const img = new Image();
    img.decoding = 'async';
    img.src = bgUrl;

    const handleLoaded = () => {
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(triggerPlay);
      } else {
        triggerPlay();
      }
    };

    if (img.complete) {
      handleLoaded();
    } else {
      img.onload = handleLoaded;
      img.onerror = triggerPlay;
    }

    const fallbackTimer = window.setTimeout(triggerPlay, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [phase, bgUrl, runId]);

  // アニメーション総尺（2.75s）が完全に透過し切った後にアンマウントする
  useEffect(() => {
    if (phase !== 'playing') return;

    finishTimerRef.current = window.setTimeout(() => {
      setPhase('hidden');
      finishTimerRef.current = null;
    }, 2850);

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
    }, 220);
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
      aria-label="アウトドアレースハブ（OUTDOOR RACE HUB）本日のオープニング"
      onClick={handleSkip}
      style={{ contain: 'strict' }}
      className={`fixed inset-0 z-[9999] select-none overflow-hidden cursor-pointer transition-opacity duration-200 ${
        isSkipping ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 外側シネマティック暗幕（終了時に背景とスキップヒントごと本画面へ滑らかに溶け込む） */}
      <div
        className={`absolute inset-0 bg-[#060b14] ${
          isPlaying ? 'intro-gpu-layer animate-intro-curtain' : ''
        }`}
      >
        {/* 層1：今日の開催地景色（事前マウント済み＋opacityとtransformを2層分離し1本連続曲線で縮小着地） */}
        <div
          className={`absolute inset-0 overflow-hidden pointer-events-none ${
            isPlaying ? 'intro-gpu-layer animate-intro-scenery-fade' : 'opacity-0'
          }`}
        >
          <div
            className={`w-full h-full ${
              isPlaying ? 'intro-gpu-layer animate-intro-scenery-motion' : ''
            }`}
          >
            <img
              src={bgUrl}
              alt=""
              decoding="async"
              {...({ fetchpriority: 'high' } as React.ImgHTMLAttributes<HTMLImageElement>)}
              className="w-full h-full object-cover object-center"
            />
            {/* シネマティック・ソフトビネット＆上下グラデーション（ロゴと文字を高品位に引き立てる） */}
            <div className="absolute inset-0 bg-slate-950/25" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/75" />
          </div>
        </div>

        {/* 層2：OUTDOOR RACE HUB ロゴ（登場1本曲線 × 退場1本曲線の2層分離） */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none ${
            isPlaying ? 'intro-gpu-layer animate-intro-logo-exit' : 'opacity-0'
          }`}
        >
          <div
            className={`flex flex-col items-center text-center ${
              isPlaying ? 'intro-gpu-layer animate-intro-logo-enter' : ''
            }`}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white flex items-center justify-center shadow-xl ring-1 ring-white/25 mb-3 sm:mb-4">
              <Mountain className="w-6 h-6 sm:w-8 sm:h-8 stroke-[2.3]" />
            </div>
            <h1
              style={{ textShadow: '0 4px 24px rgba(0, 0, 0, 0.45)' }}
              className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.08em] leading-none"
            >
              <span className="text-white">OUTDOOR </span>
              <span className="text-teal-300">RACE HUB</span>
            </h1>
            <div
              className={`w-32 sm:w-48 h-[1.5px] mt-3 sm:mt-4 bg-gradient-to-r from-transparent via-teal-300/90 to-transparent ${
                isPlaying ? 'intro-gpu-layer animate-intro-accent-reveal' : 'opacity-0'
              }`}
            />
            <p
              style={{ textShadow: '0 2px 12px rgba(0, 0, 0, 0.5)' }}
              className="text-[11px] sm:text-sm font-bold tracking-[0.16em] text-white/90 mt-2.5 sm:mt-3"
            >
              アウトドアレースハブ 〜アウトドア大会一括検索〜
            </p>
          </div>
        </div>

        {/* 層3：画面下部中央 今日のフィールド名キャプション */}
        <div
          className={`absolute inset-x-0 bottom-12 sm:bottom-16 px-4 pointer-events-none ${
            isPlaying ? 'intro-gpu-layer animate-intro-caption-exit' : 'opacity-0'
          }`}
        >
          <div
            style={{ textShadow: '0 2px 16px rgba(0, 0, 0, 0.7)' }}
            className={`flex flex-col items-center text-center ${
              isPlaying ? 'intro-gpu-layer animate-intro-caption-enter' : ''
            }`}
          >
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-teal-200">
              TODAY&apos;S FIELD
            </span>
            <p className="mt-1 text-lg sm:text-2xl font-black tracking-wide text-white">
              {placeLabel}
            </p>
            {eventTitle && (
              <p className="mt-0.5 text-[11px] sm:text-xs text-white/90 font-medium truncate max-w-[88vw]">
                {eventTitle}
              </p>
            )}
          </div>
        </div>

        {/* 右下：タップで即スキップヒント（シネマティック幕と一緒に滑らかにフェードアウト） */}
        <div className="fixed bottom-5 right-5 pointer-events-none">
          <span className="inline-block px-2.5 py-1 rounded-full bg-slate-900/60 border border-white/15 text-white/90 text-[10px] font-bold">
            タップでスキップ
          </span>
        </div>
      </div>
    </div>
  );
};
