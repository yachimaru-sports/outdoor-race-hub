import React, { useMemo, useState } from 'react';
import { RaceEvent } from '../types';
import { JAPAN_DOT_GRID } from '../data/japanDotGrid';
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

// 全国ビューSVGの座標系（0 0 800 660）
const SVG_W = 800;
const SVG_H = 660;
const MAP_OFFSET_X = 135;
const MAP_OFFSET_Y = 38;
const CELL_W = 9.2;
const CELL_H = 10.4;

const dotToXY = (col: number, row: number) => ({
  x: MAP_OFFSET_X + col * CELL_W,
  y: MAP_OFFSET_Y + row * CELL_H,
});

// 9地方の吹き出し位置（800x660座標系に対するパーセント配置用）
const CALLOUT_LAYOUT: Record<
  MapRegionId,
  { leftPct: number; topPct: number; pointer: 'down-left' | 'down-right' | 'up-left' | 'up-right' }
> = {
  hokkaido: { leftPct: 48.5, topPct: 12.5, pointer: 'down-right' },
  chubu: { leftPct: 37.5, topPct: 33.5, pointer: 'down-right' },
  tohoku: { leftPct: 83.5, topPct: 34.0, pointer: 'down-left' },
  kinki: { leftPct: 26.5, topPct: 46.5, pointer: 'down-right' },
  kanto: { leftPct: 81.5, topPct: 60.5, pointer: 'down-left' },
  chugoku: { leftPct: 13.0, topPct: 55.5, pointer: 'down-right' },
  kyushu: { leftPct: 14.0, topPct: 85.0, pointer: 'up-right' },
  shikoku: { leftPct: 40.5, topPct: 86.5, pointer: 'up-left' },
  okinawa: { leftPct: 82.0, topPct: 86.0, pointer: 'up-left' },
};

// 地方ズーム時の県別微差シェード（視認性向上）
const PREF_SHADE_OPACITIES = [1.0, 0.84, 0.92, 0.76, 0.88, 0.80, 0.95, 0.72, 0.90];

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

  // 地方ズーム時の対象都道府県リストとズーム用 viewBox 計算
  const zoomedRegionConfig = selectedRegionId ? MAP_REGION_BY_ID[selectedRegionId] : null;
  const zoomedPrefs = useMemo(() => {
    if (!selectedRegionId) return [];
    return PREFECTURES_META.filter((p) => p.regionId === selectedRegionId);
  }, [selectedRegionId]);

  const { zoomedDots, zoomedViewBox, prefCentroids } = useMemo(() => {
    if (!selectedRegionId) {
      return {
        zoomedDots: [],
        zoomedViewBox: `0 0 ${SVG_W} ${SVG_H}`,
        prefCentroids: {} as Record<number, { x: number; y: number }>,
      };
    }

    const filtered = JAPAN_DOT_GRID.filter(([, , code]) => {
      const meta = PREFECTURE_BY_CODE[code];
      return meta && meta.regionId === selectedRegionId;
    });

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const sumByCode: Record<number, { sx: number; sy: number; n: number }> = {};

    for (const [col, row, code] of filtered) {
      const { x, y } = dotToXY(col, row);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (!sumByCode[code]) sumByCode[code] = { sx: 0, sy: 0, n: 0 };
      sumByCode[code].sx += x;
      sumByCode[code].sy += y;
      sumByCode[code].n += 1;
    }

    const padX = Math.max(36, (maxX - minX) * 0.24);
    const padY = Math.max(36, (maxY - minY) * 0.24);
    const vbX = minX - padX;
    const vbY = minY - padY;
    const vbW = Math.max(120, maxX - minX + padX * 2);
    const vbH = Math.max(120, maxY - minY + padY * 2);

    const centroids: Record<number, { x: number; y: number }> = {};
    for (const [cStr, acc] of Object.entries(sumByCode)) {
      centroids[Number(cStr)] = { x: acc.sx / acc.n, y: acc.sy / acc.n };
    }

    return {
      zoomedDots: filtered,
      zoomedViewBox: `${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`,
      prefCentroids: centroids,
    };
  }, [selectedRegionId]);

  const hoveredPrefMeta = hoveredPrefCode ? PREFECTURE_BY_CODE[hoveredPrefCode] : null;
  const hoveredPrefStat = hoveredPrefMeta ? prefStats[hoveredPrefMeta.name] : undefined;

  // ========================================================
  // Lv.2：地方ズームビュー
  // ========================================================
  if (selectedRegionId && zoomedRegionConfig) {
    const rStat = regionStats[selectedRegionId];
    return (
      <div className="space-y-4">
        {/* 地方ヘッダーバー */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onResetToNational}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>全国へ戻る</span>
            </button>

            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0"
                style={{ backgroundColor: zoomedRegionConfig.color }}
              />
              <h2 className="text-base sm:text-xl font-black text-slate-950 dark:text-white">
                {zoomedRegionConfig.fullName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-mono font-black text-xs">
                {rStat.total}大会
              </span>
              {rStat.open > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-black text-[11px]">
                  受付中 {rStat.open}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">
            都道府県をタップすると、その県の開催地ピンマップへズームします
          </p>
        </div>

        {/* 地方マップ（左）＋ 都道府県カード選択（右） */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* 地方拡大ドットマップ */}
          <div className="lg:col-span-7 relative rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-950 dark:to-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-5 overflow-hidden">
            {/* ホバー中の都道府県ツールチップ */}
            {hoveredPrefMeta && (
              <div className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-xl bg-slate-950/90 dark:bg-white/95 text-white dark:text-slate-950 text-xs font-black shadow-lg pointer-events-none flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-400 dark:text-teal-600" />
                <span>{hoveredPrefMeta.name}</span>
                <span className="font-mono text-amber-300 dark:text-teal-700">
                  {hoveredPrefStat?.total || 0}大会
                </span>
              </div>
            )}

            <svg
              viewBox={zoomedViewBox}
              className="w-full h-[270px] sm:h-[360px] select-none"
              role="img"
              aria-label={`${zoomedRegionConfig.fullName}の都道府県マップ`}
              onMouseLeave={() => setHoveredPrefCode(null)}
            >
              {zoomedDots.map(([col, row, code], idx) => {
                const pref = PREFECTURE_BY_CODE[code];
                if (!pref) return null;
                const { x, y } = dotToXY(col, row);
                const pStat = prefStats[pref.name];
                const count = pStat?.total || 0;
                const isHovered = hoveredPrefCode === code;
                const prefIndex = zoomedPrefs.findIndex((p) => p.code === code);
                const shadeOpacity = PREF_SHADE_OPACITIES[prefIndex % PREF_SHADE_OPACITIES.length];

                const fillColor =
                  count === 0
                    ? '#94a3b8'
                    : isHovered
                    ? zoomedRegionConfig.hoverColor
                    : zoomedRegionConfig.dotColor;

                return (
                  <g
                    key={`${col}-${row}-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPrefCode(code)}
                    onClick={() => onSelectPrefecture(pref.name)}
                  >
                    <rect
                      x={x - CELL_W / 2}
                      y={y - CELL_H / 2}
                      width={CELL_W}
                      height={CELL_H}
                      fill="transparent"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 4.4 : 3.8}
                      fill={fillColor}
                      fillOpacity={count === 0 ? (isHovered ? 0.65 : 0.35) : isHovered ? 1 : shadeOpacity}
                      stroke={isHovered ? '#ffffff' : 'transparent'}
                      strokeWidth={isHovered ? 0.9 : 0}
                      className="pointer-events-none transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* 県名＋大会数ラベル */}
              {zoomedPrefs.map((pref) => {
                const pos = prefCentroids[pref.code];
                if (!pos) return null;
                const count = prefStats[pref.name]?.total || 0;
                const isHovered = hoveredPrefCode === pref.code;

                return (
                  <g
                    key={pref.code}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPrefCode(pref.code)}
                    onMouseLeave={() => setHoveredPrefCode(null)}
                    onClick={() => onSelectPrefecture(pref.name)}
                  >
                    <rect
                      x={-22}
                      y={-9}
                      width={44}
                      height={18}
                      rx={6}
                      fill={isHovered ? '#0f172a' : 'rgba(255,255,255,0.92)'}
                      stroke={count > 0 ? zoomedRegionConfig.color : '#cbd5e1'}
                      strokeWidth={isHovered ? 1.5 : 1}
                    />
                    <text
                      x={0}
                      y={3.2}
                      textAnchor="middle"
                      fontSize="8.2"
                      fontWeight="800"
                      fill={isHovered ? '#ffffff' : count > 0 ? '#0f172a' : '#64748b'}
                    >
                      {pref.shortName} {count}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 都道府県リストカード */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
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
                  className={`group text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    isHovered
                      ? 'border-teal-600 bg-teal-50/90 dark:bg-teal-950/50 shadow-md scale-[1.01]'
                      : hasEvents
                      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-teal-500 shadow-2xs'
                      : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-black text-sm text-slate-950 dark:text-white">
                      {pref.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>

                  <div className="flex items-baseline justify-between gap-1 mt-1.5">
                    <div className="flex items-baseline gap-0.5">
                      <span
                        className={`text-xl font-black font-mono ${
                          hasEvents
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {pStat.total}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        レース
                      </span>
                    </div>

                    {pStat.open > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        受付 {pStat.open}
                      </span>
                    )}
                  </div>

                  {/* 種目カラードット内訳 */}
                  {hasEvents && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex-wrap">
                      {(pStat.categories.trail || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-teal-600" />
                          <span>トレ {pStat.categories.trail}</span>
                        </span>
                      )}
                      {(pStat.categories.cycling || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-sky-600" />
                          <span>車 {pStat.categories.cycling}</span>
                        </span>
                      )}
                      {(pStat.categories.marathon || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          <span>走 {pStat.categories.marathon}</span>
                        </span>
                      )}
                      {(pStat.categories.adventure || 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
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
      </div>
    );
  }

  // ========================================================
  // Lv.1：全国ドットマトリクス日本地図ビュー（添付画像オマージュ）
  // ========================================================
  return (
    <div className="space-y-4">
      {/* タイトル・操作説明バー（ホバーバッジ出入りによる上下ガタつき防止のため高さ固定） */}
      <div className="flex flex-nowrap items-center justify-between gap-2 min-h-[32px]">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 truncate">
            地方ブロックまたは日本地図をタップして拡大表示（全{events.length}大会）
          </span>
        </div>
        <div
          aria-hidden={!hoveredPrefMeta}
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-black shadow-xs shrink-0 transition-opacity duration-100 ${
            hoveredPrefMeta ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 text-teal-400 dark:text-teal-600 shrink-0" />
          <span>{hoveredPrefMeta ? hoveredPrefMeta.name : '都道府県'}</span>
          <span className="font-mono text-amber-300 dark:text-teal-700">
            {hoveredPrefStat?.total || 0}大会
          </span>
        </div>
      </div>

      {/* メイン日本地図キャンバス（PC・タブレットでは吹き出し付き、スマホでは見やすいコンパクト表示＋下部カード） */}
      <div className="relative w-full max-w-[880px] mx-auto rounded-2xl bg-gradient-to-b from-white via-slate-50/70 to-slate-100/70 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
        {/* 左上：海外・ARWS世界戦カード */}
        <button
          type="button"
          onClick={() => onSelectRegion('overseas')}
          onMouseEnter={() => setHoveredRegion('overseas')}
          onMouseLeave={() => setHoveredRegion(null)}
          className={`absolute left-2.5 top-2.5 sm:left-4 sm:top-4 z-20 text-left rounded-xl border-2 transition-all cursor-pointer shadow-md overflow-hidden ${
            hoveredRegion === 'overseas'
              ? 'border-indigo-500 scale-105 shadow-xl'
              : 'border-indigo-400/80 dark:border-indigo-600 hover:scale-105'
          } bg-white/95 dark:bg-slate-900/95`}
        >
          <div className="bg-indigo-600 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-black flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>海外・世界戦</span>
          </div>
          <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-baseline gap-1">
            <span className="text-base sm:text-xl font-black font-mono text-slate-950 dark:text-white">
              {overseasStats.total}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
              レース
            </span>
            {overseasStats.open > 0 && (
              <span className="hidden sm:inline-block ml-1 text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                受付{overseasStats.open}
              </span>
            )}
          </div>
        </button>

        {/* ドット日本地図 SVG */}
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="日本の地方別アウトドアレースマップ"
          onMouseLeave={() => {
            setHoveredRegion(null);
            setHoveredPrefCode(null);
          }}
        >
          {/* 沖縄インセット区切り線（添付画像風） */}
          <path
            d="M 455 570 L 502 465 L 650 465"
            fill="none"
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-700"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* 全ドット描画 */}
          {JAPAN_DOT_GRID.map(([col, row, code], idx) => {
            const pref = PREFECTURE_BY_CODE[code];
            if (!pref) return null;
            const regionCfg = MAP_REGION_BY_ID[pref.regionId];
            const { x, y } = dotToXY(col, row);
            const isRegionHover = hoveredRegion === pref.regionId;
            const isPrefHover = hoveredPrefCode === code;
            const isDimmed = hoveredRegion !== null && hoveredRegion !== pref.regionId;

            return (
              <g
                key={`${col}-${row}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredRegion(pref.regionId);
                  setHoveredPrefCode(code);
                }}
                onClick={() => onSelectRegion(pref.regionId)}
              >
                <rect
                  x={x - CELL_W / 2}
                  y={y - CELL_H / 2}
                  width={CELL_W}
                  height={CELL_H}
                  fill="transparent"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isPrefHover ? 4.7 : isRegionHover ? 4.3 : 3.7}
                  fill={isRegionHover ? regionCfg.hoverColor : regionCfg.dotColor}
                  fillOpacity={isDimmed ? 0.32 : 1}
                  className="pointer-events-none transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>

        {/* 9地方カラー吹き出し（sm以上では地図上に華やかに配置） */}
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
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 min-w-[92px] md:min-w-[106px] rounded-lg border-2 bg-white/95 dark:bg-slate-900/95 shadow-md transition-all cursor-pointer select-none ${
                  isHover ? 'scale-110 shadow-xl z-20 ring-2 ring-white/70' : 'hover:scale-105'
                }`}
                title={`${region.fullName}（${stat.total}レース / クリックで拡大）`}
              >
                {/* 地方名カラーヘッダー */}
                <div
                  style={{ backgroundColor: region.color }}
                  className="px-2.5 py-0.5 text-center text-white font-black text-xs tracking-wide drop-shadow-2xs rounded-t-[5px]"
                >
                  {region.name}
                </div>

                {/* レース数 ＋ 受付中 */}
                <div className="px-2.5 py-1 flex items-baseline justify-center gap-1 bg-white dark:bg-slate-900 rounded-b-[5px]">
                  <span className="text-lg md:text-xl font-black font-mono text-slate-950 dark:text-white leading-none">
                    {stat.total}
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    レース
                  </span>
                  {stat.open > 0 && (
                    <span className="ml-0.5 text-[9px] font-black px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
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
                  className={`absolute w-0 h-0 border-[7px] pointer-events-none ${
                    layout.pointer === 'down-right'
                      ? '-bottom-[14px] right-3'
                      : layout.pointer === 'down-left'
                      ? '-bottom-[14px] left-3'
                      : layout.pointer === 'up-right'
                      ? '-top-[14px] right-3'
                      : '-top-[14px] left-3'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* スマホ＆PC共通：9地方＋海外クイック選択カードグリッド（スマホでは主操作、PCでは一覧比較用） */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 transition-all cursor-pointer text-left ${
                isHover
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white shadow-md scale-[1.02]'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: region.color }}
                />
                <span className="text-xs sm:text-sm font-black truncate">{region.name}</span>
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-sm sm:text-base font-black font-mono">{stat.total}</span>
                {stat.open > 0 && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
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
          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 transition-all cursor-pointer text-left ${
            hoveredRegion === 'overseas'
              ? 'bg-indigo-700 text-white border-indigo-700 shadow-md scale-[1.02]'
              : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 text-indigo-950 dark:text-indigo-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="text-xs sm:text-sm font-black truncate">海外</span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-sm sm:text-base font-black font-mono">{overseasStats.total}</span>
            {overseasStats.open > 0 && (
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                ({overseasStats.open})
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
