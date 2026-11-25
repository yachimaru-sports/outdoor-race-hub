import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RaceEvent, EventCategory } from '../types';
import {
  PREF_SVG_PATHS,
  REGION_VIEWBOXES,
  PREF_VIEWBOXES,
  NATIONAL_VIEWBOX,
  OKINAWA_BBOX,
  RegionViewBox,
  projectLatLngToMapXY,
} from '../data/japanPrefPaths';
import {
  MAP_REGIONS,
  MAP_REGION_BY_ID,
  PREFECTURES_META,
  PREFECTURE_BY_CODE,
  PREFECTURE_BY_NAME,
  MapRegionId,
  getMapRegionIdByPrefecture,
} from '../data/japanMapData';
import { ArrowLeft, Globe, ChevronRight, MapPin, Compass } from 'lucide-react';

interface JapanDotMapProps {
  events: RaceEvent[];
  selectedRegionId: MapRegionId | null;
  initialZoomFromPrefecture?: string | null;
  onConsumeInitialZoom?: () => void;
  onSelectRegion: (regionId: MapRegionId | 'overseas') => void;
  onSelectPrefecture: (prefectureName: string) => void;
  onResetToNational: () => void;
}

// 沖縄インセットを全国SVG（NATIONAL_VIEWBOX）右下海上へ拡大配置するための変換設定
const OKI_SCALE = 0.84;
const OKI_TARGET_CENTER_X = 685;
const OKI_TARGET_CENTER_Y = 665;
const OKI_ORIG_CENTER_X = OKINAWA_BBOX.x + OKINAWA_BBOX.w / 2;
const OKI_ORIG_CENTER_Y = OKINAWA_BBOX.y + OKINAWA_BBOX.h / 2;
const OKI_TX = OKI_TARGET_CENTER_X - OKI_ORIG_CENTER_X * OKI_SCALE;
const OKI_TY = OKI_TARGET_CENTER_Y - OKI_ORIG_CENTER_Y * OKI_SCALE;
const OKI_INSET_VIEWBOX: RegionViewBox = { x: 520, y: 585, w: 325, h: 160 };

// 9地方の吹き出し位置（NATIONAL_VIEWBOX 座標系パーセント・ホバー拡大時も重なりゼロ）
const CALLOUT_LAYOUT: Record<
  MapRegionId,
  { leftPct: number; topPct: number; pointer: 'down-left' | 'down-right' | 'up-left' | 'up-right' }
> = {
  hokkaido: { leftPct: 48.0, topPct: 13.5, pointer: 'down-right' },
  chubu: { leftPct: 37.5, topPct: 32.5, pointer: 'down-right' },
  tohoku: { leftPct: 80.5, topPct: 38.0, pointer: 'down-left' },
  kinki: { leftPct: 28.0, topPct: 47.0, pointer: 'down-right' },
  kanto: { leftPct: 78.5, topPct: 60.0, pointer: 'down-left' },
  chugoku: { leftPct: 11.5, topPct: 60.5, pointer: 'down-right' },
  kyushu: { leftPct: 10.5, topPct: 87.5, pointer: 'up-right' },
  shikoku: { leftPct: 38.5, topPct: 91.5, pointer: 'up-left' },
  okinawa: { leftPct: 85.0, topPct: 91.5, pointer: 'up-left' },
};

// 種目別マーカーカラー（色相を大きく離した高コントラスト4色）
const EVENT_DOT_COLOR: Record<EventCategory, string> = {
  trail: '#16a34a',     // 鮮やかな純緑
  cycling: '#2563eb',   // くっきり純青
  marathon: '#e11d48',  // 鮮やかな赤ピンク
  adventure: '#f59e0b', // 輝くゴールド
};

const LEGEND_ITEMS: { id: EventCategory; label: string; color: string }[] = [
  { id: 'trail', label: 'トレイル（●緑）', color: '#16a34a' },
  { id: 'cycling', label: 'サイクル（◆青）', color: '#2563eb' },
  { id: 'marathon', label: 'マラソン（■赤）', color: '#e11d48' },
  { id: 'adventure', label: 'AR・ロゲ（★黄）', color: '#f59e0b' },
];

/** 4種目を「色＋形」のダブルコーディングでSVG描画（緑● / 青◆ / 赤■ / 黄★） */
function renderCategoryShape(
  category: EventCategory,
  cx: number,
  cy: number,
  size: number,
  strokeWidth: number,
  key?: string
): React.ReactNode {
  const color = EVENT_DOT_COLOR[category] || '#16a34a';
  const commonProps = {
    fill: color,
    fillOpacity: 0.96,
    stroke: '#ffffff',
    strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
    className: 'pointer-events-none',
  };

  if (category === 'cycling') {
    const r = size * 1.18;
    const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
    return <polygon key={key} points={pts} strokeLinejoin="round" {...commonProps} />;
  }

  if (category === 'marathon') {
    const half = size * 0.94;
    return (
      <rect
        key={key}
        x={cx - half}
        y={cy - half}
        width={half * 2}
        height={half * 2}
        rx={half * 0.25}
        strokeLinejoin="round"
        {...commonProps}
      />
    );
  }

  if (category === 'adventure') {
    const outerR = size * 1.34;
    const innerR = size * 0.56;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
    return <polygon key={key} points={pts.join(' ')} strokeLinejoin="round" {...commonProps} />;
  }

  return <circle key={key} cx={cx} cy={cy} r={size} {...commonProps} />;
}

type ZoomingTarget =
  | { kind: 'pref'; prefName: string; box: RegionViewBox }
  | { kind: 'region-direct'; regionId: 'hokkaido' | 'okinawa'; box: RegionViewBox }
  | null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function resolveStartBoxFromPref(prefName?: string | null): RegionViewBox | null {
  if (!prefName) return null;
  if (prefName === '沖縄県') return OKI_INSET_VIEWBOX;
  const meta = PREFECTURE_BY_NAME[prefName];
  if (meta && PREF_VIEWBOXES[meta.code]) {
    return PREF_VIEWBOXES[meta.code];
  }
  return null;
}

function boxesNearlyEqual(a: RegionViewBox, b: RegionViewBox): boolean {
  return (
    Math.abs(a.x - b.x) < 0.2 &&
    Math.abs(a.y - b.y) < 0.2 &&
    Math.abs(a.w - b.w) < 0.2 &&
    Math.abs(a.h - b.h) < 0.2
  );
}

export const JapanDotMap: React.FC<JapanDotMapProps> = ({
  events,
  selectedRegionId,
  initialZoomFromPrefecture,
  onConsumeInitialZoom,
  onSelectRegion,
  onSelectPrefecture,
  onResetToNational,
}) => {
  const [hoveredRegion, setHoveredRegion] = useState<MapRegionId | 'overseas' | null>(null);
  const [hoveredPrefCode, setHoveredPrefCode] = useState<number | null>(null);
  const [zoomingTarget, setZoomingTarget] = useState<ZoomingTarget>(null);
  const [showOkinawaInsetDuringExit] = useState<boolean>(
    () => initialZoomFromPrefecture === '沖縄県'
  );

  // カメラ補間状態（単一SVG viewBoxを滑らかに補間）
  const initialBox = useMemo<RegionViewBox>(() => {
    const fromPref = resolveStartBoxFromPref(initialZoomFromPrefecture);
    if (fromPref) return fromPref;
    return selectedRegionId ? REGION_VIEWBOXES[selectedRegionId] : NATIONAL_VIEWBOX;
    // 初回マウント時のみ計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [animatedBox, setAnimatedBox] = useState<RegionViewBox>(initialBox);
  const currentBoxRef = useRef<RegionViewBox>(initialBox);
  const rafIdRef = useRef<number | null>(null);
  const animTokenRef = useRef<number>(0);

  // 最新コールバック参照
  const onSelectRegionRef = useRef(onSelectRegion);
  onSelectRegionRef.current = onSelectRegion;
  const onSelectPrefectureRef = useRef(onSelectPrefecture);
  onSelectPrefectureRef.current = onSelectPrefecture;
  const onConsumeInitialZoomRef = useRef(onConsumeInitialZoom);
  onConsumeInitialZoomRef.current = onConsumeInitialZoom;

  // 親側で選択地域が変わったら一時ズームターゲットをクリア
  useEffect(() => {
    setZoomingTarget(null);
    setHoveredRegion(null);
    setHoveredPrefCode(null);
  }, [selectedRegionId]);

  // 目標 viewBox の決定
  const targetBox: RegionViewBox = useMemo(() => {
    if (zoomingTarget) return zoomingTarget.box;
    return selectedRegionId ? REGION_VIEWBOXES[selectedRegionId] : NATIONAL_VIEWBOX;
  }, [zoomingTarget, selectedRegionId]);

  // 親側で渡された戻りズーム元県名を初回マウント時に消費
  useEffect(() => {
    if (initialZoomFromPrefecture) {
      onConsumeInitialZoomRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 目標 viewBox が変わるたびに requestAnimationFrame で滑らかにカメラズーム補間
  useEffect(() => {
    const from = currentBoxRef.current;
    const to = targetBox;

    if (boxesNearlyEqual(from, to)) {
      currentBoxRef.current = to;
      setAnimatedBox(to);
      if (zoomingTarget) {
        if (zoomingTarget.kind === 'pref') {
          onSelectPrefectureRef.current(zoomingTarget.prefName);
        } else {
          onSelectRegionRef.current(zoomingTarget.regionId);
        }
      }
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      currentBoxRef.current = to;
      setAnimatedBox(to);
      if (zoomingTarget) {
        if (zoomingTarget.kind === 'pref') {
          onSelectPrefectureRef.current(zoomingTarget.prefName);
        } else {
          onSelectRegionRef.current(zoomingTarget.regionId);
        }
      }
      return;
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const token = ++animTokenRef.current;
    const duration = zoomingTarget ? 380 : 500;
    const startTime = performance.now();

    const step = (now: number) => {
      if (animTokenRef.current !== token) return;
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / duration);
      const t = easeInOutCubic(rawT);

      const next: RegionViewBox = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        w: from.w + (to.w - from.w) * t,
        h: from.h + (to.h - from.h) * t,
      };
      currentBoxRef.current = next;
      setAnimatedBox(next);

      if (rawT < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
        currentBoxRef.current = to;
        setAnimatedBox(to);
        if (zoomingTarget) {
          if (zoomingTarget.kind === 'pref') {
            onSelectPrefectureRef.current(zoomingTarget.prefName);
          } else {
            onSelectRegionRef.current(zoomingTarget.regionId);
          }
        }
      }
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [targetBox, zoomingTarget]);

  // 地方・都道府県クリック時のズームイン開始ハンドラ
  const handleClickRegion = (regionId: MapRegionId | 'overseas') => {
    if (zoomingTarget) return;
    if (regionId === 'hokkaido') {
      setZoomingTarget({
        kind: 'region-direct',
        regionId: 'hokkaido',
        box: REGION_VIEWBOXES.hokkaido,
      });
      return;
    }
    if (regionId === 'okinawa') {
      setZoomingTarget({
        kind: 'region-direct',
        regionId: 'okinawa',
        box: OKI_INSET_VIEWBOX,
      });
      return;
    }
    onSelectRegion(regionId);
  };

  const handleClickPrefecture = (prefName: string) => {
    if (zoomingTarget) return;
    const meta = PREFECTURE_BY_NAME[prefName];
    if (meta && PREF_VIEWBOXES[meta.code]) {
      setZoomingTarget({
        kind: 'pref',
        prefName,
        box: PREF_VIEWBOXES[meta.code],
      });
    } else {
      onSelectPrefecture(prefName);
    }
  };

  // 現在の絞り込み条件に合致する大会を「9地方」「47都道府県」「海外」へ集計
  const { regionStats, prefStats, overseasStats } = useMemo(() => {
    const rStats: Record<
      MapRegionId,
      { total: number; open: number; categories: Record<string, number> }
    > = {
      hokkaido: { total: 0, open: 0, categories: {} },
      tohoku: { total: 0, open: 0, categories: {} },
      kanto: { total: 0, open: 0, categories: {} },
      chubu: { total: 0, open: 0, categories: {} },
      kinki: { total: 0, open: 0, categories: {} },
      chugoku: { total: 0, open: 0, categories: {} },
      shikoku: { total: 0, open: 0, categories: {} },
      kyushu: { total: 0, open: 0, categories: {} },
      okinawa: { total: 0, open: 0, categories: {} },
    };

    const pStats: Record<
      string,
      { total: number; open: number; categories: Record<string, number> }
    > = {};

    const oStats = { total: 0, open: 0 };

    for (const ev of events) {
      const isOpen = ev.entry_status === 'open' || ev.entry_status === 'closing_soon';
      const regionId = getMapRegionIdByPrefecture(ev.prefecture);

      if (regionId === 'overseas') {
        oStats.total++;
        if (isOpen) oStats.open++;
        continue;
      }

      rStats[regionId].total++;
      if (isOpen) rStats[regionId].open++;
      rStats[regionId].categories[ev.category] =
        (rStats[regionId].categories[ev.category] || 0) + 1;

      if (!pStats[ev.prefecture]) {
        pStats[ev.prefecture] = { total: 0, open: 0, categories: {} };
      }
      pStats[ev.prefecture].total++;
      if (isOpen) pStats[ev.prefecture].open++;
      pStats[ev.prefecture].categories[ev.category] =
        (pStats[ev.prefecture].categories[ev.category] || 0) + 1;
    }

    return { regionStats: rStats, prefStats: pStats, overseasStats: oStats };
  }, [events]);

  // 大会開催地マーカー（本土46都道府県用 ＆ 沖縄インセット用）
  const { mainlandDots, okinawaDots } = useMemo(() => {
    const mainAll: {
      id: string;
      regionId: MapRegionId;
      category: EventCategory;
      x: number;
      y: number;
    }[] = [];
    const okiAll: { id: string; category: EventCategory; x: number; y: number }[] = [];

    const sourceEvents = selectedRegionId
      ? events.filter((ev) => getMapRegionIdByPrefecture(ev.prefecture) === selectedRegionId)
      : events;

    const groups = new Map<string, RaceEvent[]>();
    for (const ev of sourceEvents) {
      if (typeof ev.venue?.lat !== 'number' || typeof ev.venue?.lng !== 'number') continue;
      const rId = getMapRegionIdByPrefecture(ev.prefecture);
      if (rId === 'overseas') continue;
      const key = `${rId}:${ev.venue.lat.toFixed(3)},${ev.venue.lng.toFixed(3)}`;
      const arr = groups.get(key) || [];
      arr.push(ev);
      groups.set(key, arr);
    }

    const regionBox = selectedRegionId ? REGION_VIEWBOXES[selectedRegionId] : null;
    const regionUnit = regionBox ? Math.max(regionBox.w / 1200, regionBox.h / 620) : 1;

    for (const list of groups.values()) {
      list.forEach((ev, idx) => {
        const rId = getMapRegionIdByPrefecture(ev.prefecture);
        if (rId === 'overseas') return;
        const base = projectLatLngToMapXY(ev.venue!.lat!, ev.venue!.lng!);
        let x = base.x;
        let y = base.y;
        if (list.length > 1 && selectedRegionId) {
          const angle = (2 * Math.PI * idx) / list.length;
          const radius = regionUnit * (14.0 + Math.floor(idx / 6) * 10.0);
          x += Math.cos(angle) * radius;
          y += Math.sin(angle) * radius;
        }
        if (rId === 'okinawa') {
          okiAll.push({ id: ev.id, category: ev.category, x, y });
        } else {
          mainAll.push({ id: ev.id, regionId: rId, category: ev.category, x, y });
        }
      });
    }

    return { mainlandDots: mainAll, okinawaDots: okiAll };
  }, [events, selectedRegionId]);

  const zoomedRegionConfig = selectedRegionId ? MAP_REGION_BY_ID[selectedRegionId] : null;
  const zoomedPrefs = useMemo(() => {
    if (!selectedRegionId) return [];
    return PREFECTURES_META.filter((p) => p.regionId === selectedRegionId);
  }, [selectedRegionId]);

  const hoveredPrefMeta = hoveredPrefCode ? PREFECTURE_BY_CODE[hoveredPrefCode] : null;
  const hoveredPrefStat = hoveredPrefMeta ? prefStats[hoveredPrefMeta.name] : undefined;

  // 現在描画する本土ポリゴンの描画順（アクティブ地方・ホバー県を手前に）
  const orderedMainlandPrefs = useMemo(() => {
    return [...PREFECTURES_META]
      .filter((p) => p.code !== 47)
      .sort((a, b) => {
        if (a.code === hoveredPrefCode) return 1;
        if (b.code === hoveredPrefCode) return -1;
        const aInSelected = selectedRegionId && a.regionId === selectedRegionId ? 1 : 0;
        const bInSelected = selectedRegionId && b.regionId === selectedRegionId ? 1 : 0;
        if (aInSelected !== bInSelected) return aInSelected - bInSelected;
        const aRegHover = hoveredRegion === a.regionId ? 1 : 0;
        const bRegHover = hoveredRegion === b.regionId ? 1 : 0;
        if (aRegHover !== bRegHover) return aRegHover - bRegHover;
        return a.code - b.code;
      });
  }, [hoveredPrefCode, hoveredRegion, selectedRegionId]);

  const okinawaPref = PREFECTURE_BY_CODE[47];
  const okinawaPath = PREF_SVG_PATHS[47];
  const isOkinawaHover = hoveredRegion === 'okinawa' || hoveredPrefCode === 47;
  const okinawaCfg = MAP_REGION_BY_ID.okinawa;

  // 地方ビュー用ラベルスケール（現在の地方ターゲット基準）
  const regionUnit = useMemo(() => {
    if (!selectedRegionId) return 1;
    const vb = REGION_VIEWBOXES[selectedRegionId];
    return Math.max(vb.w / 1200, vb.h / 620);
  }, [selectedRegionId]);

  const showNationalCallouts = !selectedRegionId && !zoomingTarget;
  const showRegionLabels = Boolean(selectedRegionId && !zoomingTarget);
  const showOkinawaInset =
    !selectedRegionId ||
    zoomingTarget?.kind === 'region-direct' ||
    showOkinawaInsetDuringExit;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 上部バー：全国時（操作案内） / 地方時（戻る＆地方名）— 高さを揃えて切替時のガタつきを抑止 */}
      {selectedRegionId && zoomedRegionConfig ? (
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-[38px] pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setZoomingTarget(null);
                onResetToNational();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-black border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>全国へ戻る</span>
            </button>

            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full shadow-xs shrink-0"
                style={{ backgroundColor: zoomedRegionConfig.color }}
              />
              <h2 className="text-lg sm:text-2xl font-black text-slate-950 dark:text-white">
                {zoomedRegionConfig.fullName}
              </h2>
              <span className="px-3 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-mono font-black text-xs sm:text-sm">
                {regionStats[selectedRegionId].total}大会
              </span>
              {regionStats[selectedRegionId].open > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-black text-xs sm:text-sm">
                  受付中 {regionStats[selectedRegionId].open}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-bold">
            都道府県をタップすると、その県の開催地ピンマップへズームします
          </p>
        </div>
      ) : (
        <div className="flex flex-nowrap items-center justify-between gap-2 min-h-[38px]">
          <div className="flex items-center gap-2 min-w-0">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200 truncate">
              地方ブロックまたは日本地図をタップして拡大表示（全{events.length}大会）
            </span>
          </div>
          <div
            aria-hidden={!hoveredPrefMeta}
            className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-sm font-black shadow-xs shrink-0 transition-opacity duration-100 ${
              hoveredPrefMeta ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
            }`}
          >
            <MapPin className="w-4 h-4 text-teal-400 dark:text-teal-600 shrink-0" />
            <span>{hoveredPrefMeta ? hoveredPrefMeta.name : '都道府県'}</span>
            <span className="font-mono text-amber-300 dark:text-teal-700">
              {hoveredPrefStat?.total || 0}大会
            </span>
          </div>
        </div>
      )}

      {/* 統合インタラクティブ地図キャンバス（全国・地方で同一サイズの連続カメラズーム） */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-sky-50/55 via-slate-50/75 to-slate-100/85 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-1 sm:p-2 overflow-hidden shadow-inner">
        {/* 地方ズーム時：地図ウィンドウ内左上に大きく目立つ「ひとつ前へ戻る」フローティングボタンを常設 */}
        {selectedRegionId && !zoomingTarget && (
          <button
            type="button"
            onClick={() => {
              setZoomingTarget(null);
              onResetToNational();
            }}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 z-30 inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-slate-900 hover:bg-teal-700 text-white dark:bg-white dark:hover:bg-teal-400 dark:text-slate-950 font-black text-sm sm:text-base lg:text-lg border-2 border-white/90 dark:border-slate-800 shadow-xl hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.8] shrink-0" />
            <span>全国マップへ戻る</span>
          </button>
        )}

        {/* 左上：海外・ARWS世界戦カード（全国ビュー時のみ表示・ズーム時はスッと消える） */}
        <button
          type="button"
          onClick={() => handleClickRegion('overseas')}
          onMouseEnter={() => setHoveredRegion('overseas')}
          onMouseLeave={() => setHoveredRegion(null)}
          className={`absolute left-2.5 top-2.5 sm:left-4 sm:top-4 z-20 text-left rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-md overflow-hidden bg-white/95 dark:bg-slate-900/95 ${
            showNationalCallouts
              ? hoveredRegion === 'overseas'
                ? 'opacity-100 border-indigo-500 scale-105 shadow-xl'
                : 'opacity-100 border-indigo-400/80 dark:border-indigo-600 hover:scale-105'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <div className="bg-indigo-600 text-white px-3 py-1 sm:px-3.5 sm:py-1 text-xs sm:text-sm font-black flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>海外・世界戦</span>
          </div>
          <div className="px-3 py-1.5 sm:px-3.5 sm:py-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-slate-950 dark:text-white leading-none">
              {overseasStats.total}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              レース
            </span>
            {overseasStats.open > 0 && (
              <span className="hidden sm:inline-block ml-1 text-[11px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                受付{overseasStats.open}
              </span>
            )}
          </div>
        </button>

        {/* 右上：地方ビュー用 ホバー中都道府県詳細バッジ */}
        <div
          aria-hidden={!selectedRegionId || !hoveredPrefMeta}
          className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-20 px-4 py-2 rounded-xl bg-slate-950/90 dark:bg-white/95 text-white dark:text-slate-950 text-sm sm:text-base font-black shadow-lg pointer-events-none flex items-center gap-2 transition-opacity duration-100 ${
            selectedRegionId && hoveredPrefMeta ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
        >
          <MapPin className="w-4 h-4 text-teal-400 dark:text-teal-600 shrink-0" />
          <span>{hoveredPrefMeta ? hoveredPrefMeta.name : '都道府県'}</span>
          <span className="font-mono text-amber-300 dark:text-teal-700">
            {hoveredPrefStat?.total || 0}大会
          </span>
          {(hoveredPrefStat?.open || 0) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 dark:text-emerald-800">
              受付{hoveredPrefStat?.open}
            </span>
          )}
        </div>

        {/* 単一統合SVGキャンバス（県ズーム時はふわっとクロスフェードしつつ拡大） */}
        <svg
          viewBox={`${animatedBox.x.toFixed(2)} ${animatedBox.y.toFixed(2)} ${animatedBox.w.toFixed(2)} ${animatedBox.h.toFixed(2)}`}
          preserveAspectRatio="xMidYMid meet"
          className={`w-full h-[440px] sm:h-[600px] lg:h-[680px] select-none block transition-opacity duration-300 ${
            zoomingTarget ? 'opacity-25' : 'opacity-100'
          }`}
          role="img"
          aria-label={
            zoomedRegionConfig
              ? `${zoomedRegionConfig.fullName}の都道府県境マップ`
              : '日本の地方別・県境アウトドアレースマップ'
          }
          onMouseLeave={() => {
            setHoveredRegion(null);
            setHoveredPrefCode(null);
          }}
        >
          {/* 沖縄インセット区切り線（全国ビュー＆沖縄ズーム関連時） */}
          {showOkinawaInset && (
            <path
              d="M 475 745 L 525 578 L 860 578"
              fill="none"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700 transition-opacity duration-300"
              style={{ opacity: selectedRegionId ? 0 : 1 }}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          )}

          {/* 本土46都道府県のポリゴン描画 */}
          {orderedMainlandPrefs.map((pref) => {
            const pathData = PREF_SVG_PATHS[pref.code];
            if (!pathData) return null;
            const regionCfg = MAP_REGION_BY_ID[pref.regionId];
            const isSelectedRegion = selectedRegionId === pref.regionId;
            const pStat = prefStats[pref.name];
            const count = pStat?.total || 0;
            const isPrefHover = hoveredPrefCode === pref.code;
            const isRegionHover = hoveredRegion === pref.regionId;

            if (selectedRegionId) {
              // 地方ズーム中：選択地方は濃淡＋白枠、他地方は淡い背景シルエットとして残す
              if (!isSelectedRegion) {
                return (
                  <path
                    key={pref.code}
                    d={pathData.d}
                    fill="#94a3b8"
                    fillOpacity={0.14}
                    stroke="#cbd5e1"
                    strokeOpacity={0.45}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                );
              }

              const fillColor =
                count === 0
                  ? '#cbd5e1'
                  : isPrefHover
                  ? regionCfg.hoverColor
                  : regionCfg.dotColor;

              const fillOpacity =
                count === 0
                  ? isPrefHover
                    ? 0.6
                    : 0.35
                  : isPrefHover
                  ? 1
                  : count >= 8
                  ? 0.92
                  : count >= 4
                  ? 0.72
                  : 0.48;

              return (
                <path
                  key={pref.code}
                  d={pathData.d}
                  fill={fillColor}
                  fillOpacity={fillOpacity}
                  strokeWidth={isPrefHover ? 3.2 : 2.0}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-white dark:stroke-slate-900 cursor-pointer transition-colors duration-150"
                  onMouseEnter={() => setHoveredPrefCode(pref.code)}
                  onClick={() => handleClickPrefecture(pref.name)}
                />
              );
            }

            // 全国ビュー中
            const isDimmed = hoveredRegion !== null && hoveredRegion !== pref.regionId;
            return (
              <path
                key={pref.code}
                d={pathData.d}
                fill={isRegionHover ? regionCfg.hoverColor : regionCfg.dotColor}
                fillOpacity={isDimmed ? 0.34 : isRegionHover ? 1 : 0.88}
                strokeWidth={isPrefHover ? 2.4 : 1.15}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-white dark:stroke-slate-900 cursor-pointer transition-all duration-150"
                onMouseEnter={() => {
                  setHoveredRegion(pref.regionId);
                  setHoveredPrefCode(pref.code);
                }}
                onClick={() => handleClickRegion(pref.regionId)}
              />
            );
          })}

          {/* 本土の開催地マーカー（高コントラスト4色＋4形状） */}
          {mainlandDots.map((pt) =>
            renderCategoryShape(
              pt.category,
              pt.x,
              pt.y,
              selectedRegionId ? regionUnit * 9.5 : 5.2,
              selectedRegionId ? 2.4 : 1.5,
              `dot-${pt.id}`
            )
          )}

          {/* 沖縄県インセット（全国ビュー＆沖縄ズーム遷移時） */}
          {showOkinawaInset && okinawaPref && okinawaPath && (
            <g
              transform={`translate(${OKI_TX.toFixed(1)}, ${OKI_TY.toFixed(1)}) scale(${OKI_SCALE})`}
              className="cursor-pointer"
              onMouseEnter={() => {
                setHoveredRegion('okinawa');
                setHoveredPrefCode(47);
              }}
              onClick={() => handleClickRegion('okinawa')}
            >
              <path
                d={okinawaPath.d}
                fill={isOkinawaHover ? okinawaCfg.hoverColor : okinawaCfg.dotColor}
                fillOpacity={hoveredRegion !== null && hoveredRegion !== 'okinawa' ? 0.34 : 0.92}
                strokeWidth={isOkinawaHover ? 2.4 : 1.3}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-white dark:stroke-slate-900 transition-all duration-150"
              />
              {okinawaDots.map((pt) =>
                renderCategoryShape(pt.category, pt.x, pt.y, 6.0, 1.5, `oki-${pt.id}`)
              )}
            </g>
          )}

          {/* 地方ビュー用：大型県名＋大会数ラベル */}
          {showRegionLabels &&
            zoomedPrefs.map((pref) => {
              const pathData = PREF_SVG_PATHS[pref.code];
              if (!pathData) return null;
              const count = prefStats[pref.name]?.total || 0;
              const isHovered = hoveredPrefCode === pref.code;
              const textStr = `${pref.shortName} ${count}`;
              const boxW = Math.max(regionUnit * 78, textStr.length * regionUnit * 16.5 + regionUnit * 22);
              const boxH = regionUnit * 34;
              const fontSize = regionUnit * 18.5;

              return (
                <g
                  key={`label-${pref.code}`}
                  transform={`translate(${pathData.labelX}, ${pathData.labelY})`}
                  className="cursor-pointer animate-map-fade-up"
                  onMouseEnter={() => setHoveredPrefCode(pref.code)}
                  onClick={() => handleClickPrefecture(pref.name)}
                >
                  <rect
                    x={-boxW / 2}
                    y={-boxH / 2}
                    width={boxW}
                    height={boxH}
                    rx={regionUnit * 10}
                    fill={isHovered ? '#0f172a' : 'rgba(255,255,255,0.94)'}
                    stroke={count > 0 ? zoomedRegionConfig!.color : '#94a3b8'}
                    strokeWidth={isHovered ? 2.6 : 1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={0}
                    y={fontSize * 0.36}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="900"
                    fill={isHovered ? '#ffffff' : count > 0 ? '#0f172a' : '#64748b'}
                  >
                    {textStr}
                  </text>
                </g>
              );
            })}

          {/* 全国ビュー用：SVGネイティブ 9地方カラー吹き出し（ズーム時はスッと消えて地図とズレない） */}
          <g
            style={{
              opacity: showNationalCallouts ? 1 : 0,
              transition: 'opacity 180ms ease-out',
            }}
            className={showNationalCallouts ? '' : 'pointer-events-none'}
          >
            {MAP_REGIONS.map((region) => {
              const layout = CALLOUT_LAYOUT[region.id];
              const stat = regionStats[region.id];
              const isHover = hoveredRegion === region.id;
              const cx = NATIONAL_VIEWBOX.x + NATIONAL_VIEWBOX.w * (layout.leftPct / 100);
              const cy = NATIONAL_VIEWBOX.y + NATIONAL_VIEWBOX.h * (layout.topPct / 100);

              const bw = 152;
              const bh = 74;
              const headH = 26;
              const halfW = bw / 2;
              const halfH = bh / 2;

              // 三角矢印の座標（吹き出し枠の4隅付近）
              let arrowPoints = '';
              if (layout.pointer === 'down-right') {
                arrowPoints = `${halfW - 26},${halfH - 1} ${halfW - 10},${halfH - 1} ${halfW - 18},${halfH + 14}`;
              } else if (layout.pointer === 'down-left') {
                arrowPoints = `${-halfW + 10},${halfH - 1} ${-halfW + 26},${halfH - 1} ${-halfW + 18},${halfH + 14}`;
              } else if (layout.pointer === 'up-right') {
                arrowPoints = `${halfW - 26},${-halfH + 1} ${halfW - 10},${-halfH + 1} ${halfW - 18},${-halfH - 14}`;
              } else {
                arrowPoints = `${-halfW + 10},${-halfH + 1} ${-halfW + 26},${-halfH + 1} ${-halfW + 18},${-halfH - 14}`;
              }

              return (
                <g
                  key={`callout-${region.id}`}
                  transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) scale(${isHover ? 1.08 : 1})`}
                  className="cursor-pointer transition-transform duration-150"
                  onMouseEnter={() => setHoveredRegion(region.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onClick={() => handleClickRegion(region.id)}
                >
                  {/* ソフト影 */}
                  <rect
                    x={-halfW + 2}
                    y={-halfH + 4}
                    width={bw}
                    height={bh}
                    rx={10}
                    fill="rgba(15, 23, 42, 0.14)"
                  />
                  {/* 三角矢印 */}
                  <polygon points={arrowPoints} fill={region.color} />
                  {/* 本体白枠 */}
                  <rect
                    x={-halfW}
                    y={-halfH}
                    width={bw}
                    height={bh}
                    rx={10}
                    fill="#ffffff"
                    stroke={region.color}
                    strokeWidth={isHover ? 3.5 : 2.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* 上部カラーヘッダー */}
                  <path
                    d={`M ${-halfW} ${-halfH + 10} Q ${-halfW} ${-halfH} ${-halfW + 10} ${-halfH} L ${halfW - 10} ${-halfH} Q ${halfW} ${-halfH} ${halfW} ${-halfH + 10} L ${halfW} ${-halfH + headH} L ${-halfW} ${-halfH + headH} Z`}
                    fill={region.color}
                  />
                  <text
                    x={0}
                    y={-halfH + 18.5}
                    textAnchor="middle"
                    fontSize="16"
                    fontWeight="900"
                    fill="#ffffff"
                  >
                    {region.name}
                  </text>

                  {/* 数字・単位・受付数 */}
                  <text
                    x={stat.open > 0 ? -18 : 0}
                    y={halfH - 14}
                    textAnchor="middle"
                    fontSize="28"
                    fontWeight="900"
                    fill="#0f172a"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {stat.total}
                    <tspan fontSize="13" fontWeight="800" fill="#334155" dx="2">
                      レース
                    </tspan>
                  </text>

                  {stat.open > 0 && (
                    <g transform={`translate(${halfW - 26}, ${halfH - 22})`}>
                      <rect x={-19} y={-10} width={38} height={20} rx={6} fill="#d1fae5" />
                      <text
                        x={0}
                        y={4.5}
                        textAnchor="middle"
                        fontSize="11.5"
                        fontWeight="900"
                        fill="#065f46"
                      >
                        受{stat.open}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* 全国・地方共通：大きく見やすい開催地マーカー種別凡例バー（地図を一切隠さない専用配置） */}
      <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-xs">
        <span className="text-xs sm:text-sm md:text-base font-black text-slate-800 dark:text-slate-100 shrink-0">
          📍 地図上の開催地マーカー（色＋形で区別）:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.id}
              className="inline-flex items-center gap-2 text-xs sm:text-sm md:text-base font-black text-slate-900 dark:text-white"
            >
              <svg viewBox="-12 -12 24 24" className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 drop-shadow-xs">
                {renderCategoryShape(item.id, 0, 0, 8.2, 2.0)}
              </svg>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 下部カードエリア：全国時は9地方＋海外、地方時は都道府県カード一覧 */}
      {selectedRegionId ? (
        <div
          key={`pref-cards-${selectedRegionId}`}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 animate-map-fade-up"
        >
          {zoomedPrefs.map((pref) => {
            const pStat = prefStats[pref.name] || { total: 0, open: 0, categories: {} };
            const isHovered = hoveredPrefCode === pref.code;
            const hasEvents = pStat.total > 0;

            return (
              <button
                key={pref.code}
                type="button"
                onMouseEnter={() => setHoveredPrefCode(pref.code)}
                onMouseLeave={() => setHoveredPrefCode(null)}
                onClick={() => handleClickPrefecture(pref.name)}
                className={`group text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  isHovered
                    ? 'border-teal-600 bg-teal-50/90 dark:bg-teal-950/50 shadow-md scale-[1.01]'
                    : hasEvents
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-teal-500 shadow-2xs'
                    : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-base sm:text-lg text-slate-950 dark:text-white">
                    {pref.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>

                <div className="flex items-baseline justify-between gap-1 mt-1.5">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-2xl sm:text-3xl font-black font-mono ${
                        hasEvents
                          ? 'text-slate-950 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {pStat.total}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                      レース
                    </span>
                  </div>

                  {pStat.open > 0 && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      受付 {pStat.open}
                    </span>
                  )}
                </div>

                {hasEvents && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap">
                    {(pStat.categories.trail || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-green-600" />
                        <span>トレ {pStat.categories.trail}</span>
                      </span>
                    )}
                    {(pStat.categories.cycling || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rotate-45 bg-blue-600" />
                        <span>車 {pStat.categories.cycling}</span>
                      </span>
                    )}
                    {(pStat.categories.marathon || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-[2px] bg-rose-600" />
                        <span>走 {pStat.categories.marathon}</span>
                      </span>
                    )}
                    {(pStat.categories.adventure || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-amber-500" />
                        <span>AR {pStat.categories.adventure}</span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 animate-map-fade-up">
          {MAP_REGIONS.map((region) => {
            const stat = regionStats[region.id];
            const isHover = hoveredRegion === region.id;
            return (
              <button
                key={region.id}
                type="button"
                onMouseEnter={() => setHoveredRegion(region.id)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => handleClickRegion(region.id)}
                className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                  isHover
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="text-sm sm:text-base font-black truncate">{region.name}</span>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-lg sm:text-xl font-black font-mono">{stat.total}</span>
                  {stat.open > 0 && (
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      ({stat.open})
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onMouseEnter={() => setHoveredRegion('overseas')}
            onMouseLeave={() => setHoveredRegion(null)}
            onClick={() => handleClickRegion('overseas')}
            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
              hoveredRegion === 'overseas'
                ? 'bg-indigo-700 text-white border-indigo-700 shadow-md scale-[1.02]'
                : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-indigo-950 dark:text-indigo-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-sm sm:text-base font-black truncate">海外</span>
            </div>
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-lg sm:text-xl font-black font-mono">{overseasStats.total}</span>
              {overseasStats.open > 0 && (
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  ({overseasStats.open})
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
