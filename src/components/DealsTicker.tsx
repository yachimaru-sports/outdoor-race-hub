import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { DealItem } from '../types';
import { AccessCounter } from './AccessCounter';
import { handleImageError } from '../utils/imageFallback';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Mountain,
  ShoppingBag,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  HelpCircle,
  Map as MapIcon,
  RefreshCw,
} from 'lucide-react';
import { formatPrice } from '../utils/helpers';

interface DealsTickerProps {
  deals: DealItem[];
  totalEvents?: number;
  openCount?: number;
  lastUpdated?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenCatalog?: () => void;
  onOpenMap?: () => void;
  onOpenGuide?: () => void;
  isPcView?: boolean;
  onToggleDisplayMode?: () => void;
  pausedExternally?: boolean;
}

/** カルーセル用の超軽量128pxサムネイルURLへ変換（転送量・VRAM負荷を約1/64へ削減） */
function toLightweightThumbUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('https://shop.r10s.jp/')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url.replace('https://shop.r10s.jp/', 'https://tshop.r10s.jp/')}${sep}_ex=128x128`;
  }
  if (url.includes('cdn.shopify.com')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}width=128`;
  }
  return url;
}

export const DealsTicker: React.FC<DealsTickerProps> = ({
  deals,
  lastUpdated = '2026.10.31 10:30',
  theme = 'light',
  onToggleTheme,
  onOpenCatalog,
  onOpenMap,
  onOpenGuide,
  isPcView,
  onToggleDisplayMode,
  pausedExternally = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const [isTouchPaused, setIsTouchPaused] = useState(false);

  const pausedExternallyRef = useRef(pausedExternally);
  const boostTimerRef = useRef<number | null>(null);
  const touchResumeTimerRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    mode: 'undecided' | 'horizontal' | 'vertical';
  } | null>(null);

  useEffect(() => {
    pausedExternallyRef.current = pausedExternally;
  }, [pausedExternally]);

  useEffect(() => {
    return () => {
      if (boostTimerRef.current !== null) window.clearTimeout(boostTimerRef.current);
      if (touchResumeTimerRef.current !== null) window.clearTimeout(touchResumeTimerRef.current);
    };
  }, []);

  // GPUテクスチャ上限内に確実に収めるため、新着優先＋割引率順で最大20件に絞って表示
  const displayDeals = useMemo(() => {
    const nowMs = Date.now();
    return deals
      .map((deal) => {
        const isNew = Boolean(
          deal.registered_at &&
            nowMs - new Date(deal.registered_at).getTime() <= 48 * 60 * 60 * 1000
        );
        return {
          deal,
          savedYen: deal.original_price - deal.price,
          isNew,
          thumbUrl: toLightweightThumbUrl(deal.image_url),
        };
      })
      .sort((a, b) => {
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
        return (b.deal.discount_rate || 0) - (a.deal.discount_rate || 0);
      })
      .slice(0, 20);
  }, [deals]);

  // 1周あたりのアニメーション秒数（20件で約130秒）
  const durationSec = Math.max(40, Math.round(displayDeals.length * 6.5));

  // 軽量サムネイル取得失敗時は元画像へフォールバックし、さらに失敗時のみSVG代替画像を表示
  const handleThumbError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fallbackSrc = img.dataset.fallbackSrc;
    if (fallbackSrc && img.src !== fallbackSrc) {
      img.removeAttribute('data-fallback-src');
      img.src = fallbackSrc;
      return;
    }
    handleImageError(e);
  }, []);

  // PC用 ＜ / ＞ ボタン：Compositor上で playbackRate を使って滑らかに送り・戻し
  const handleManualScroll = useCallback(
    (direction: 'left' | 'right') => {
      const anim = trackRef.current?.getAnimations?.()[0];
      if (!anim) return;

      const durMs = durationSec * 1000;
      if (direction === 'left') {
        const cur = Number(anim.currentTime || 0);
        if (cur < durMs * 2) {
          anim.currentTime = cur + durMs * 10;
        }
      }

      anim.playbackRate = direction === 'right' ? 10 : -10;
      if (boostTimerRef.current !== null) {
        window.clearTimeout(boostTimerRef.current);
      }
      boostTimerRef.current = window.setTimeout(() => {
        anim.playbackRate = 1;
        boostTimerRef.current = null;
      }, 300);
    },
    [durationSec]
  );

  // スマホのタッチスワイプ操作（縦スクロールは邪魔せず、指を離せば確実に自動スライドへ復帰）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchResumeTimerRef.current !== null) {
      window.clearTimeout(touchResumeTimerRef.current);
      touchResumeTimerRef.current = null;
    }
    setIsTouchPaused(true);
    didDragRef.current = false;
    const touch = e.touches[0];
    if (touch) {
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        mode: 'undecided',
      };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const ts = touchRef.current;
      const touch = e.touches[0];
      if (!ts || !touch || ts.mode === 'vertical') return;

      const totalDx = Math.abs(touch.clientX - ts.startX);
      const totalDy = Math.abs(touch.clientY - ts.startY);

      if (ts.mode === 'undecided') {
        if (totalDx < 6 && totalDy < 6) return;
        if (totalDy > totalDx) {
          ts.mode = 'vertical';
          return;
        }
        ts.mode = 'horizontal';
        didDragRef.current = true;
      }

      const moveDx = ts.lastX - touch.clientX;
      ts.lastX = touch.clientX;

      const anim = trackRef.current?.getAnimations?.()[0];
      const setWidth = firstSetRef.current?.offsetWidth || 0;
      if (anim && setWidth > 0) {
        const durMs = durationSec * 1000;
        const deltaMs = (moveDx / setWidth) * durMs;
        let nextTime = Number(anim.currentTime || 0) + deltaMs;
        if (nextTime < durMs) {
          nextTime += durMs * 10;
        }
        anim.currentTime = nextTime;
      }
    },
    [durationSec]
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
    if (touchResumeTimerRef.current !== null) {
      window.clearTimeout(touchResumeTimerRef.current);
    }
    touchResumeTimerRef.current = window.setTimeout(() => {
      setIsTouchPaused(false);
      const anim = trackRef.current?.getAnimations?.()[0];
      if (anim && anim.playState === 'paused' && !pausedExternallyRef.current) {
        try {
          anim.play();
        } catch {
          // ignore
        }
      }
      touchResumeTimerRef.current = null;
    }, 400);
  }, []);

  const handleForceRefresh = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }, []);

  const handleScrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** 1周期分のカードセットを描画（2セット連結でシームレス無限ループ） */
  const renderCardSet = (isDuplicate: boolean) =>
    displayDeals.map(({ deal, savedYen, isNew, thumbUrl }, idx) => (
      <a
        key={`${isDuplicate ? 'dup' : 'main'}-${deal.id}-${idx}`}
        href={deal.affiliate_url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={isDuplicate ? -1 : undefined}
        onClick={(e) => {
          if (didDragRef.current) {
            e.preventDefault();
            didDragRef.current = false;
          }
        }}
        className="group relative flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-amber-400 rounded-xl p-1 sm:p-1.5 w-[240px] sm:w-[310px] shrink-0 transition-colors shadow-xs"
        title={`楽天市場で見る: ${deal.title}`}
      >
        {/* 商品画像（128px軽量サムネ + 2段階フォールバック） */}
        <div className="relative shrink-0">
          <img
            src={thumbUrl}
            data-fallback-src={deal.image_url}
            alt={isDuplicate ? '' : deal.title}
            width={48}
            height={48}
            loading="eager"
            decoding="async"
            onError={handleThumbError}
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain bg-white rounded-lg p-0.5 border border-slate-700 shadow-2xs"
          />
          <div className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-black text-[10px] px-1.5 py-0.2 rounded shadow border border-white/80 tracking-tight leading-none">
            {deal.discount_rate}%OFF
          </div>
          {isNew && (
            <div className="absolute -bottom-1 -left-1 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[9px] px-1 py-0.2 rounded shadow border border-white/90 leading-none">
              新着NEW
            </div>
          )}
        </div>

        {/* 商品情報 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5 whitespace-nowrap">
            {isNew && (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500 text-slate-950 leading-none shadow-xs">
                🆕 新規登録
              </span>
            )}
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
    ));

  return (
    <div className="bg-slate-950 border-b border-amber-500/70 text-slate-100 select-none transition-colors">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 md:gap-2.5">
          {/* 上段（スマホでは左右1行に収める／PCでは左ブロック） */}
          <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto shrink-0">
            <div className="flex flex-col justify-center shrink-0 pr-1">
              {/* 上段：HP名称をクリックでページ最上部へスムーズスクロール */}
              <a
                href="#"
                onClick={handleScrollToTop}
                className="flex items-center gap-1.5 sm:gap-2 group cursor-pointer"
                title="アウトドアレースハブ（OUTDOOR RACE HUB）〜アウトドア大会一括検索〜 ページの先頭へ戻る"
              >
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:bg-teal-500 transition-colors">
                  <Mountain className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
                </div>
                <div className="leading-none">
                  <div className="text-xs sm:text-lg font-black tracking-tight text-white flex items-center gap-1 drop-shadow-xs whitespace-nowrap">
                    <span>OUTDOOR</span>
                    <span className="text-teal-400">RACE HUB</span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-slate-300 font-bold tracking-tight mt-0.5 inline-block whitespace-nowrap">
                    アウトドアレースハブ<span className="hidden sm:inline"> 〜アウトドア大会一括検索〜</span>
                  </span>
                </div>
              </a>

              {/* PC表示時：ロゴの真下に最新情報更新日時バッジ（ワンタップ強制更新対応） */}
              <div className="hidden md:flex items-center gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={handleForceRefresh}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-[10px] sm:text-[11px] font-bold text-emerald-300 leading-none whitespace-nowrap shadow-xs cursor-pointer transition-colors"
                  title="タップして最新情報へ強制更新"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">最新情報:</span>
                  <span className="text-white font-mono font-black">{lastUpdated}</span>
                  <RefreshCw className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
                </button>
              </div>
            </div>

            {/* スマホ表示時の右上コントロール（はみ出しゼロ） */}
            <div className="flex md:hidden items-center gap-1 shrink-0">
              {onToggleDisplayMode && (
                <button
                  onClick={onToggleDisplayMode}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  aria-label="PC表示とスマホ表示の切り替え"
                >
                  {isPcView ? (
                    <>
                      <Smartphone className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>スマホ版</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>PC版</span>
                    </>
                  )}
                </button>
              )}
              <AccessCounter variant="compact" />
              {onOpenGuide && (
                <button
                  onClick={onOpenGuide}
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg border border-sky-400/80 bg-sky-500/25 hover:bg-sky-500/40 text-sky-100 text-[10px] font-black transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                  aria-label="使い方マニュアルを開く"
                  title="使い方マニュアルを開く"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>マニュアル</span>
                </button>
              )}
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  aria-label="テーマ切り替え"
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

          {/* スマホ2段目：最新情報日時（ワンタップ更新） ＋ 全国マップ ＋ おすすめ商品専用ページボタン（見切れゼロ） */}
          <div className="flex md:hidden items-center justify-between gap-1.5 w-full">
            <button
              type="button"
              onClick={handleForceRefresh}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-[10px] font-bold text-emerald-300 leading-none whitespace-nowrap min-w-0 cursor-pointer transition-colors"
              title="タップして最新情報へ強制更新"
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              <span className="text-white font-mono font-black truncate">{lastUpdated}</span>
              <RefreshCw className="w-2.5 h-2.5 text-emerald-300 shrink-0" />
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {onOpenMap && (
                <button
                  onClick={onOpenMap}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-[10px] shadow-sm cursor-pointer whitespace-nowrap border border-teal-300 shrink-0"
                >
                  <MapIcon className="w-3 h-3 text-slate-950 shrink-0" />
                  <span>全国マップ</span>
                </button>
              )}
              {onOpenCatalog && (
                <button
                  onClick={onOpenCatalog}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 font-black text-[10px] shadow-sm cursor-pointer whitespace-nowrap border border-amber-300 shrink-0"
                >
                  <ShoppingBag className="w-3 h-3 text-slate-950 shrink-0" />
                  <span>ギア特集</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* 中央：ネイティブCSS @keyframes 無限スライド 楽天特価ギアカルーセル */}
          <div
            className="deals-marquee-viewport relative w-full md:flex-1 min-w-0 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* 左右端の滑らかなグラデーションフェードマスク */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-5 sm:w-8 z-10 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-5 sm:w-8 z-10 bg-gradient-to-l from-slate-950 via-slate-950/70 to-transparent"
            />

            <div
              ref={trackRef}
              className={`deals-marquee-track py-0.5${pausedExternally || isTouchPaused ? ' is-paused' : ''}`}
              style={{ '--deals-marquee-duration': `${durationSec}s` } as React.CSSProperties}
            >
              <div ref={firstSetRef} className="flex items-center gap-2.5 shrink-0 pr-2.5">
                {renderCardSet(false)}
              </div>
              <div aria-hidden="true" className="flex items-center gap-2.5 shrink-0 pr-2.5">
                {renderCardSet(true)}
              </div>
            </div>
          </div>

          {/* 右端（PC表示のみ）：2段構成（上段：累計アクセス数 / 下段：＜ ＞ 月マーク） */}
          <div className="hidden md:flex flex-col items-end justify-center gap-1 shrink-0">
            {/* 上段：全国マップ ＋ ギア特集 ＋ アクセス数 */}
            <div className="flex items-center gap-1.5">
              {onOpenMap && (
                <button
                  onClick={onOpenMap}
                  className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-[11px] sm:text-xs shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap border border-teal-300"
                  title="日本地図から大会を探す（全国→地方→県内ピン）"
                >
                  <MapIcon className="w-3 h-3 text-slate-950 shrink-0" />
                  <span>🗺️ 全国マップ</span>
                </button>
              )}
              {onOpenCatalog && (
                <button
                  onClick={onOpenCatalog}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-[11px] sm:text-xs shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap border border-amber-300"
                  title="おすすめ商品・必携品専用カタログページを開く"
                >
                  <ShoppingBag className="w-3 h-3 text-slate-950 shrink-0" />
                  <span>🎒 おすすめ商品専用ページ</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}
              <AccessCounter variant="compact" />
            </div>

            {/* 下段：＜ ＞ 月マーク */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleManualScroll('left')}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
                aria-label="前へスクロール"
                title="前へ"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleManualScroll('right')}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-white transition-colors border border-slate-700 shadow-2xs cursor-pointer"
                aria-label="次へスクロール"
                title="次へ"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* PC表示 / スマホ表示 切り替えボタン */}
              {onToggleDisplayMode && (
                <button
                  onClick={onToggleDisplayMode}
                  className="inline-flex items-center gap-1 px-1.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[10px] font-bold transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                  aria-label="PC表示とスマホ表示の切り替え"
                  title={isPcView ? 'スマホ用画面に切り替え' : 'PC用画面に切り替え'}
                >
                  {isPcView ? (
                    <>
                      <Smartphone className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>スマホ版</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>PC版</span>
                    </>
                  )}
                </button>
              )}

              {/* 使い方マニュアルボタン（明るく視認性を高めた常設配置） */}
              {onOpenGuide && (
                <button
                  onClick={onOpenGuide}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sky-400/75 bg-sky-500/20 hover:bg-sky-500/35 text-sky-100 text-[11px] font-black transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                  aria-label="使い方マニュアルを開く"
                  title="地図検索・条件絞り込み・カレンダー登録などの使い方マニュアル"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>使い方マニュアル</span>
                </button>
              )}

              {/* テーマ切り替えボタン */}
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="p-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors shadow-2xs cursor-pointer"
                  aria-label="テーマ切り替え"
                  title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
                >
                  {theme === 'light' ? (
                    <Moon className="w-3 h-3 text-slate-200" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-400" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
