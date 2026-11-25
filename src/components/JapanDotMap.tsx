import React, { useMemo, useState } from 'react';
import { RaceEvent, EventCategory } from '../types';
import {
  PREF_SVG_PATHS,
  REGION_VIEWBOXES,
  NATIONAL_VIEWBOX,
  OKINAWA_BBOX,
  projectLatLngToMapXY,
} from '../data/japanPrefPaths';
import {
  MAP_REGIONS,
  MAP_REGION_BY_ID,
  PREFECTURES_META,
  PREFECTURE_BY_CODE,
  MapRegionId,
  getMapRegionIdByPrefecture,
} from '../data/japanMapData';
import { ArrowLeft, Globe, ChevronRight, MapPin, Compass } from 'lucide-react';

interface JapanDotMapProps {
  events: RaceEvent[];
  selectedRegionId: MapRegionId | null;
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

// 9地方の吹き出し位置（NATIONAL_VIEWBOX アスペクト比に完全一致したパーセント座標）
const CALLOUT_LAYOUT: Record<
  MapRegionId,
  { leftPct: number; topPct: number; pointer: 'down-left' | 'down-right' | 'up-left' | 'up-right' }
> = {
  hokkaido: { leftPct: 48.0, topPct: 14.0, pointer: 'down-right' },
  chubu: { leftPct: 35.5, topPct: 36.5, pointer: 'down-right' },
  tohoku: { leftPct: 79.5, topPct: 38.5, pointer: 'down-left' },
  kinki: { leftPct: 26.5, topPct: 51.0, pointer: 'down-right' },
  kanto: { leftPct: 77.5, topPct: 60.0, pointer: 'down-left' },
  chugoku: { leftPct: 14.0, topPct: 58.0, pointer: 'down-right' },
  kyushu: { leftPct: 11.5, topPct: 86.5, pointer: 'up-right' },
  shikoku: { leftPct: 38.5, topPct: 90.0, pointer: 'up-left' },
  okinawa: { leftPct: 84.5, topPct: 90.5, pointer: 'up-left' },
};

// 種目別ミニドットカラー
const EVENT_DOT_COLOR: Record<EventCategory, string> = {
  trail: '#0f766e',
  cycling: '#0284c7',
  marathon: '#4f46e5',
  adventure: '#d97706',
};

export const JapanDotMap: React.FC<JapanDotMapProps> = ({
  events,
  selectedRegionId,
  onSelectRegion,
  onSelectPrefecture,
  onResetToNational,
}) => {
  const [hoveredRegion, setHoveredRegion] = useState<MapRegionId | 'overseas' | null>(null);
  const [hoveredPrefCode, setHoveredPrefCode] = useState<number | null>(null);

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

  // 全国ビュー用の全国内大会ドット座標（本土・沖縄別）
  const { nationalMainlandDots, nationalOkinawaDots } = useMemo(() => {
    const mainland: { id: string; x: number; y: number; color: string }[] = [];
    const okinawa: { id: string; x: number; y: number; color: string }[] = [];

    for (const ev of events) {
      if (typeof ev.venue?.lat !== 'number' || typeof ev.venue?.lng !== 'number') continue;
      const rId = getMapRegionIdByPrefecture(ev.prefecture);
      if (rId === 'overseas') continue;
      const pt = projectLatLngToMapXY(ev.venue.lat, ev.venue.lng);
      const item = {
        id: ev.id,
        x: pt.x,
        y: pt.y,
        color: EVENT_DOT_COLOR[ev.category] || '#0f766e',
      };
      if (rId === 'okinawa') {
        okinawa.push(item);
      } else {
        mainland.push(item);
      }
    }
    return { nationalMainlandDots: mainland, nationalOkinawaDots: okinawa };
  }, [events]);

  // 地方ズーム時の対象都道府県リスト・viewBox・開催地ピン座標算出
  const zoomedRegionConfig = selectedRegionId ? MAP_REGION_BY_ID[selectedRegionId] : null;
  const zoomedPrefs = useMemo(() => {
    if (!selectedRegionId) return [];
    return PREFECTURES_META.filter((p) => p.regionId === selectedRegionId);
  }, [selectedRegionId]);

  const zoomedRegionBox = selectedRegionId ? REGION_VIEWBOXES[selectedRegionId] : null;

  // 地方ズーム内の大会開催地（緯度・経度 → SVG座標）＋ 同座標重なり防止の微小展開
  const zoomedEventDots = useMemo(() => {
    if (!selectedRegionId || !zoomedRegionBox) return [];
    const unit = Math.max(zoomedRegionBox.w / 1200, zoomedRegionBox.h / 620);
    const regionEvents = events.filter(
      (ev) =>
        getMapRegionIdByPrefecture(ev.prefecture) === selectedRegionId &&
        typeof ev.venue?.lat === 'number' &&
        typeof ev.venue?.lng === 'number'
    );

    const groups = new Map<string, RaceEvent[]>();
    for (const ev of regionEvents) {
      const key = `${ev.venue!.lat!.toFixed(3)},${ev.venue!.lng!.toFixed(3)}`;
      const arr = groups.get(key) || [];
      arr.push(ev);
      groups.set(key, arr);
    }

    const plotted: { id: string; x: number; y: number; color: string }[] = [];
    for (const list of groups.values()) {
      list.forEach((ev, idx) => {
        const base = projectLatLngToMapXY(ev.venue!.lat!, ev.venue!.lng!);
        let x = base.x;
        let y = base.y;
        if (list.length > 1) {
          const angle = (2 * Math.PI * idx) / list.length;
          const radius = unit * (8.5 + Math.floor(idx / 6) * 6.0);
          x += Math.cos(angle) * radius;
          y += Math.sin(angle) * radius;
        }
        plotted.push({
          id: ev.id,
          x,
          y,
          color: EVENT_DOT_COLOR[ev.category] || '#0f766e',
        });
      });
    }
    return plotted;
  }, [events, selectedRegionId, zoomedRegionBox]);

  const hoveredPrefMeta = hoveredPrefCode ? PREFECTURE_BY_CODE[hoveredPrefCode] : null;
  const hoveredPrefStat = hoveredPrefMeta ? prefStats[hoveredPrefMeta.name] : undefined;

  // ========================================================
  // Lv.2：地方ズームビュー（くっきり県境枠つき・画面一杯ワイド大型表示）
  // ========================================================
  if (selectedRegionId && zoomedRegionConfig && zoomedRegionBox) {
    const rStat = regionStats[selectedRegionId];
    const vb = zoomedRegionBox;
    // 表示幅・高さどちらでフィットしても画面上の文字サイズが約20px（従来の2倍超）になるスケール基準
    const unit = Math.max(vb.w / 1200, vb.h / 620);
    // ホバー中の県を最後（最前面）に描画して枠線が欠けないようにする
    const orderedZoomedPrefs = [...zoomedPrefs].sort((a, b) => {
      if (a.code === hoveredPrefCode) return 1;
      if (b.code === hoveredPrefCode) return -1;
      return a.code - b.code;
    });

    return (
      <div className="space-y-3 sm:space-y-4">
        {/* 地方ヘッダーバー */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onResetToNational}
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
                {rStat.total}大会
              </span>
              {rStat.open > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-black text-xs sm:text-sm">
                  受付中 {rStat.open}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-bold">
            都道府県をタップすると、その県の開催地ピンマップへズームします
          </p>
        </div>

        {/* 上段：全幅100% 画面一杯大型ワイド県境マップ */}
        <div className="relative w-full rounded-2xl bg-gradient-to-br from-sky-50/70 via-slate-50 to-slate-100/90 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-1 sm:p-2 overflow-hidden">
          {/* 右上：ホバー中の都道府県詳細バッジ（常時配置でレイアウトガタつき防止） */}
          <div
            aria-hidden={!hoveredPrefMeta}
            className={`absolute top-3 right-3 z-20 px-4 py-2 rounded-xl bg-slate-950/90 dark:bg-white/95 text-white dark:text-slate-950 text-sm sm:text-base font-black shadow-lg pointer-events-none flex items-center gap-2 transition-opacity duration-100 ${
              hoveredPrefMeta ? 'opacity-100 visible' : 'opacity-0 invisible'
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

          {/* 左下：開催地ドットの種目凡例 */}
          <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/92 dark:bg-slate-900/92 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 shadow-xs pointer-events-none">
            <span className="text-slate-500 dark:text-slate-400">開催地:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
              トレイル
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
              サイクル
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              マラソン
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              AR
            </span>
          </div>

          <svg
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-[420px] sm:h-[580px] lg:h-[670px] select-none block"
            role="img"
            aria-label={`${zoomedRegionConfig.fullName}の都道府県境マップ`}
            onMouseLeave={() => setHoveredPrefCode(null)}
          >
            {/* 1. 各都道府県のポリゴン形状（白の県境枠つき・ホバー県を最前面） */}
            {orderedZoomedPrefs.map((pref) => {
              const pathData = PREF_SVG_PATHS[pref.code];
              if (!pathData) return null;
              const pStat = prefStats[pref.name];
              const count = pStat?.total || 0;
              const isHovered = hoveredPrefCode === pref.code;

              const fillColor =
                count === 0
                  ? '#cbd5e1'
                  : isHovered
                  ? zoomedRegionConfig.hoverColor
                  : zoomedRegionConfig.dotColor;

              const fillOpacity =
                count === 0
                  ? isHovered
                    ? 0.6
                    : 0.35
                  : isHovered
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
                  strokeWidth={isHovered ? 3.2 : 2.0}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-white dark:stroke-slate-900 cursor-pointer transition-colors duration-150"
                  onMouseEnter={() => setHoveredPrefCode(pref.code)}
                  onClick={() => onSelectPrefecture(pref.name)}
                />
              );
            })}

            {/* 2. 県枠内に大会開催地を小さな種目別ドットでプロット */}
            {zoomedEventDots.map((pt) => (
              <circle
                key={pt.id}
                cx={pt.x}
                cy={pt.y}
                r={unit * 6.0}
                fill={pt.color}
                stroke="#ffffff"
                strokeWidth={1.8}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none"
              />
            ))}

            {/* 3. 自動スケーリング大型県名＋大会数ラベル（従来の2倍超サイズ） */}
            {zoomedPrefs.map((pref) => {
              const pathData = PREF_SVG_PATHS[pref.code];
              if (!pathData) return null;
              const count = prefStats[pref.name]?.total || 0;
              const isHovered = hoveredPrefCode === pref.code;
              const textStr = `${pref.shortName} ${count}`;
              const boxW = Math.max(unit * 78, textStr.length * unit * 16.5 + unit * 22);
              const boxH = unit * 34;
              const fontSize = unit * 18.5;

              return (
                <g
                  key={`label-${pref.code}`}
                  transform={`translate(${pathData.labelX}, ${pathData.labelY})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPrefCode(pref.code)}
                  onClick={() => onSelectPrefecture(pref.name)}
                >
                  <rect
                    x={-boxW / 2}
                    y={-boxH / 2}
                    width={boxW}
                    height={boxH}
                    rx={unit * 10}
                    fill={isHovered ? '#0f172a' : 'rgba(255,255,255,0.94)'}
                    stroke={count > 0 ? zoomedRegionConfig.color : '#94a3b8'}
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
          </svg>
        </div>

        {/* 下段：その地方の都道府県カード横並び（文字も大きく見やすく） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
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
                onClick={() => onSelectPrefecture(pref.name)}
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

                {/* 種目カラードット内訳 */}
                {hasEvents && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap">
                    {(pStat.categories.trail || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                        <span>トレ {pStat.categories.trail}</span>
                      </span>
                    )}
                    {(pStat.categories.cycling || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                        <span>車 {pStat.categories.cycling}</span>
                      </span>
                    )}
                    {(pStat.categories.marathon || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <span>走 {pStat.categories.marathon}</span>
                      </span>
                    )}
                    {(pStat.categories.adventure || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span>AR {pStat.categories.adventure}</span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================================================
  // Lv.1：全国ビュー（地方版と統一されたくっきり県境ポリゴン日本地図＋大型表示）
  // ========================================================
  const mainlandPrefsOrdered = [...PREFECTURES_META]
    .filter((p) => p.code !== 47)
    .sort((a, b) => {
      if (a.code === hoveredPrefCode) return 1;
      if (b.code === hoveredPrefCode) return -1;
      const aReg = hoveredRegion === a.regionId ? 1 : 0;
      const bReg = hoveredRegion === b.regionId ? 1 : 0;
      if (aReg !== bReg) return aReg - bReg;
      return a.code - b.code;
    });

  const okinawaPref = PREFECTURE_BY_CODE[47];
  const okinawaPath = PREF_SVG_PATHS[47];
  const isOkinawaHover = hoveredRegion === 'okinawa' || hoveredPrefCode === 47;
  const okinawaCfg = MAP_REGION_BY_ID.okinawa;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* タイトル・操作説明バー（ホバーバッジ出入りによる上下ガタつき防止のため高さ固定） */}
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

      {/* メイン日本地図キャンバス（画面一杯ワイド＋SVGアスペクト比一致ラッパーで吹き出しと完全整合） */}
      <div className="w-full rounded-2xl bg-gradient-to-b from-sky-50/50 via-slate-50/70 to-slate-100/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-1 sm:p-2 overflow-hidden shadow-inner">
        <div
          className="relative w-full mx-auto"
          style={{
            aspectRatio: `${NATIONAL_VIEWBOX.w} / ${NATIONAL_VIEWBOX.h}`,
            maxHeight: '720px',
            maxWidth: `calc(720px * ${NATIONAL_VIEWBOX.w} / ${NATIONAL_VIEWBOX.h})`,
          }}
        >
          {/* 左上：海外・ARWS世界戦カード（大型見やすいサイズ） */}
          <button
            type="button"
            onClick={() => onSelectRegion('overseas')}
            onMouseEnter={() => setHoveredRegion('overseas')}
            onMouseLeave={() => setHoveredRegion(null)}
            className={`absolute left-2 top-2 sm:left-3 sm:top-3 z-20 text-left rounded-xl border-2 transition-all cursor-pointer shadow-md overflow-hidden ${
              hoveredRegion === 'overseas'
                ? 'border-indigo-500 scale-105 shadow-xl'
                : 'border-indigo-400/80 dark:border-indigo-600 hover:scale-105'
            } bg-white/95 dark:bg-slate-900/95`}
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

          {/* 県境ポリゴン全国地図 SVG */}
          <svg
            viewBox={`${NATIONAL_VIEWBOX.x} ${NATIONAL_VIEWBOX.y} ${NATIONAL_VIEWBOX.w} ${NATIONAL_VIEWBOX.h}`}
            className="w-full h-full block select-none"
            role="img"
            aria-label="日本の地方別・県境アウトドアレースマップ"
            onMouseLeave={() => {
              setHoveredRegion(null);
              setHoveredPrefCode(null);
            }}
          >
            {/* 沖縄インセット区切り線 */}
            <path
              d="M 475 745 L 525 578 L 860 578"
              fill="none"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />

            {/* 本土46都道府県のポリゴン描画 */}
            {mainlandPrefsOrdered.map((pref) => {
              const pathData = PREF_SVG_PATHS[pref.code];
              if (!pathData) return null;
              const regionCfg = MAP_REGION_BY_ID[pref.regionId];
              const isRegionHover = hoveredRegion === pref.regionId;
              const isPrefHover = hoveredPrefCode === pref.code;
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
                  onClick={() => onSelectRegion(pref.regionId)}
                />
              );
            })}

            {/* 本土全大会の開催地ミニドット（どこに大会が集中しているかを可視化） */}
            {nationalMainlandDots.map((pt) => (
              <circle
                key={`nat-${pt.id}`}
                cx={pt.x}
                cy={pt.y}
                r={3.2}
                fill={pt.color}
                fillOpacity={0.82}
                stroke="#ffffff"
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
                className="pointer-events-none"
              />
            ))}

            {/* 沖縄県インセット（右下枠内に拡大表示） */}
            {okinawaPref && okinawaPath && (
              <g
                transform={`translate(${OKI_TX.toFixed(1)}, ${OKI_TY.toFixed(1)}) scale(${OKI_SCALE})`}
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredRegion('okinawa');
                  setHoveredPrefCode(47);
                }}
                onClick={() => onSelectRegion('okinawa')}
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
                {nationalOkinawaDots.map((pt) => (
                  <circle
                    key={`oki-${pt.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={4.0}
                    fill={pt.color}
                    stroke="#ffffff"
                    strokeWidth={1.0}
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                ))}
              </g>
            )}
          </svg>

          {/* 9地方カラー吹き出し（文字・カードを二回り〜三回り大きく見やすく） */}
          <div className="hidden sm:block">
            {MAP_REGIONS.map((region) => {
              const layout = CALLOUT_LAYOUT[region.id];
              const stat = regionStats[region.id];
              const isHover = hoveredRegion === region.id;

              return (
                <button
                  key={region.id}
                  type="button"
                  onMouseEnter={() => setHoveredRegion(region.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onClick={() => onSelectRegion(region.id)}
                  style={{
                    left: `${layout.leftPct}%`,
                    top: `${layout.topPct}%`,
                    borderColor: region.color,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 min-w-[120px] md:min-w-[148px] rounded-xl border-2 bg-white/95 dark:bg-slate-900/95 shadow-md transition-all cursor-pointer select-none ${
                    isHover ? 'scale-110 shadow-xl z-20 ring-2 ring-white/80' : 'hover:scale-105'
                  }`}
                  title={`${region.fullName}（${stat.total}レース / クリックで拡大）`}
                >
                  {/* 地方名カラーヘッダー */}
                  <div
                    style={{ backgroundColor: region.color }}
                    className="px-3 py-0.5 md:py-1 text-center text-white font-black text-xs sm:text-sm md:text-base tracking-wide drop-shadow-2xs rounded-t-[8px]"
                  >
                    {region.name}
                  </div>

                  {/* レース数 ＋ 受付中 */}
                  <div className="px-3 py-1 md:py-1.5 flex items-baseline justify-center gap-1 bg-white dark:bg-slate-900 rounded-b-[8px]">
                    <span className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-slate-950 dark:text-white leading-none">
                      {stat.total}
                    </span>
                    <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">
                      レース
                    </span>
                    {stat.open > 0 && (
                      <span className="ml-0.5 text-[10px] md:text-xs font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        受{stat.open}
                      </span>
                    )}
                  </div>

                  {/* 吹き出しの三角矢印 */}
                  <span
                    style={{
                      borderColor:
                        layout.pointer.startsWith('down')
                          ? `${region.color} transparent transparent transparent`
                          : `transparent transparent ${region.color} transparent`,
                    }}
                    className={`absolute w-0 h-0 border-[8px] pointer-events-none ${
                      layout.pointer === 'down-right'
                        ? '-bottom-[16px] right-4'
                        : layout.pointer === 'down-left'
                        ? '-bottom-[16px] left-4'
                        : layout.pointer === 'up-right'
                        ? '-top-[16px] right-4'
                        : '-top-[16px] left-4'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* スマホ＆PC共通：9地方＋海外クイック選択カードグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {MAP_REGIONS.map((region) => {
          const stat = regionStats[region.id];
          const isHover = hoveredRegion === region.id;
          return (
            <button
              key={region.id}
              type="button"
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              onClick={() => onSelectRegion(region.id)}
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
          onClick={() => onSelectRegion('overseas')}
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
    </div>
  );
};
