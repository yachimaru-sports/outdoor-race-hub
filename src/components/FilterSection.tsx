import React from 'react';
import { FilterState, ViewMode, SortOption, RaceEvent } from '../types';
import { REGIONS, PREFECTURES } from '../utils/helpers';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ArrowUpDown,
  Compass,
  MapPin,
  Calendar,
  CheckSquare,
  Square,
  RotateCcw,
  Tag,
} from 'lucide-react';

interface FilterSectionProps {
  events: RaceEvent[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalFilteredCount: number;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  events,
  filters,
  onFilterChange,
  onResetFilters,
  viewMode,
  onViewModeChange,
  totalFilteredCount,
}) => {
  const isOnlyOpen = filters.entryStatus === 'open_or_closing';

  const toggleOnlyOpen = () => {
    onFilterChange({
      ...filters,
      entryStatus: isOnlyOpen ? 'all' : 'open_or_closing',
    });
  };

  // e-moshicom風の件数付き「こだわり特徴・エレメントタグ」集計
  const featureTags = [
    {
      id: 'all',
      label: 'すべて表示',
      icon: '🌐',
      count: events.length,
    },
    {
      id: '100mile',
      label: '100マイル (160km級)',
      icon: '👑',
      count: events.filter((e) => e.elements?.includes('100マイル') || e.distance_km >= 155).length,
    },
    {
      id: '100km',
      label: '100km級ウルトラ・ロング',
      icon: '🔥',
      count: events.filter((e) => e.elements?.includes('100km+') || (e.distance_km >= 95 && e.distance_km < 155)).length,
    },
    {
      id: 'toretore',
      label: 'とれとれバイク・AR関西',
      icon: '🏆',
      count: events.filter((e) => e.id.startsWith('toretore-') || e.id.includes('rogaining') || e.category === 'adventure').length,
    },
    {
      id: 'map',
      label: '2.5万図・読図あり',
      icon: '🧭',
      count: events.filter((e) => e.elements?.includes('読図')).length,
    },
    {
      id: 'mtb',
      label: 'MTBセクション',
      icon: '🚵',
      count: events.filter((e) => e.elements?.includes('MTB')).length,
    },
    {
      id: 'paddle',
      label: 'カヤック・パックラフト',
      icon: '🚣',
      count: events.filter((e) => e.elements?.includes('パドル')).length,
    },
    {
      id: 'rogaining',
      label: 'ロゲイニング・OMM',
      icon: '🗺️',
      count: events.filter((e) => e.elements?.includes('ロゲイニング')).length,
    },
    {
      id: 'night',
      label: '夜間行動・ナイトラン',
      icon: '🔦',
      count: events.filter((e) => e.elements?.includes('夜間')).length,
    },
    {
      id: 'daytrip',
      label: '1日完結・日帰り可',
      icon: '☀️',
      count: events.filter((e) => e.elements?.includes('日帰り')).length,
    },
  ];

  const seasonOptions = [
    { id: 'all', label: 'すべての時期・月' },
    { id: 'spring', label: '🌸 春シーズン (3〜5月)' },
    { id: 'summer', label: '🌿 夏シーズン (6〜8月)' },
    { id: 'autumn', label: '🍁 秋シーズン (9〜11月)' },
    { id: 'winter', label: '❄️ 冬シーズン (12〜2月)' },
    { id: '1', label: '1月開催' },
    { id: '2', label: '2月開催' },
    { id: '3', label: '3月開催' },
    { id: '4', label: '4月開催' },
    { id: '5', label: '5月開催' },
    { id: '6', label: '6月開催' },
    { id: '7', label: '7月開催' },
    { id: '8', label: '8月開催' },
    { id: '9', label: '9月開催' },
    { id: '10', label: '10月開催' },
    { id: '11', label: '11月開催' },
    { id: '12', label: '12月開催' },
  ];

  const statusOptions = [
    { id: 'all', label: 'すべての受付状況' },
    { id: 'open_or_closing', label: '🟢 受付中＋締切間近のみ' },
    { id: 'open', label: '🟢 エントリー受付中' },
    { id: 'closing_soon', label: '🔴 締切間近のみ' },
    { id: 'upcoming', label: '🔵 告知・準備中' },
    { id: 'closed', label: '⚫ 受付終了' },
  ];

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'date-asc', label: '開催日が近い順' },
    { id: 'date-desc', label: '開催日が遠い順' },
    { id: 'distance-asc', label: '距離が短い順' },
    { id: 'distance-desc', label: '距離が長い順（100マイル・ロング）' },
    { id: 'elevation-desc', label: '獲得標高が高い順（ハード）' },
  ];

  const activeFeature = filters.featureTag || 'all';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* 上段ヘッダー：件数表示 ＆「エントリー可能のみ」ワンクリックチェック */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              ＼ 条件にマッチする大会
            </span>
            <span className="text-3xl sm:text-4xl font-black font-mono text-teal-700 dark:text-teal-400 tracking-tight">
              {totalFilteredCount}
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              件 ／
            </span>
          </div>

          {/* RUNNET / SPORTS ENTRY風「受付中のみ」ワンクリックチェックボックス */}
          <button
            type="button"
            onClick={toggleOnlyOpen}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 transition-all cursor-pointer select-none ${
              isOnlyOpen
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 border-emerald-400 dark:border-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {isOnlyOpen ? (
              <CheckSquare className="w-4 h-4 fill-white text-emerald-700" />
            ) : (
              <Square className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            )}
            <span>エントリー受付中・申込可能のみ表示</span>
          </button>
        </div>

        {/* 右側：条件クリア ＆ 表示モード切替（テーブル / カード） */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>条件をクリア</span>
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              onClick={() => onViewModeChange('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950'
              }`}
            >
              <List className="w-4 h-4" />
              <span>一覧表</span>
            </button>
            <button
              onClick={() => onViewModeChange('card')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>カード</span>
            </button>
          </div>
        </div>
      </div>

      {/* 中段：横一列・直感検索ボックス */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. キーワード検索 */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="大会名・開催県・装備名で検索..."
            value={filters.searchKeyword}
            onChange={(e) => onFilterChange({ ...filters, searchKeyword: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-950 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all font-bold"
          />
        </div>

        {/* 2. エリア（地方） */}
        <div className="relative">
          <Compass className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.region}
            onChange={(e) =>
              onFilterChange({ ...filters, region: e.target.value, prefecture: 'all' })
            }
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-bold"
          >
            <option value="all">エリア：全国すべて</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}地方
              </option>
            ))}
          </select>
        </div>

        {/* 3. 都道府県 */}
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.prefecture}
            onChange={(e) => onFilterChange({ ...filters, prefecture: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-bold"
          >
            <option value="all">都道府県：すべて</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* 4. 開催時期・シーズン */}
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.monthFilter || 'all'}
            onChange={(e) => onFilterChange({ ...filters, monthFilter: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-bold"
          >
            {seasonOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 5. 並び替え（ソート順） */}
        <div className="relative">
          <ArrowUpDown className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({ ...filters, sortBy: e.target.value as SortOption })
            }
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-bold"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 下段1：e-moshicom風「件数バッジ付き こだわり特徴・種目エレメントタグ」 */}
      <div className="bg-slate-100/80 dark:bg-slate-850/60 rounded-xl p-4 border border-slate-300 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
          <Tag className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          <span>競技エレメント・特徴タグでワンクリック抽出（100マイル・アドベンチャー・読図）:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {featureTags.map((tag) => {
            const isSelected = activeFeature === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    featureTag: isSelected && tag.id !== 'all' ? 'all' : tag.id,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-[13px] font-extrabold transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:border-teal-600 hover:text-teal-800 dark:hover:text-teal-300 shadow-2xs'
                }`}
              >
                <span>{tag.icon}</span>
                <span>{tag.label}</span>
                <span
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                    isSelected
                      ? 'bg-white/25 text-white'
                      : 'bg-teal-100 dark:bg-slate-700 text-teal-950 dark:text-teal-200'
                  }`}
                >
                  {tag.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 下段2：距離レンジ ＆ ステータス詳細（★2行固定 ＆ 厳密な連動） */}
      <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
        {/* 1行目：距離範囲ラベル ＋ 5つの指定ボタン ＋ 範囲バッジ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              <SlidersHorizontal className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                距離範囲:
              </span>
            </div>

            {/* ユーザー指定の5つの距離ボタン */}
            {[
              { label: '全距離', min: 0, max: 999 },
              { label: '0-30まで', min: 0, max: 30 },
              { label: '30-70まで', min: 30, max: 70 },
              { label: '70-100まで', min: 70, max: 100 },
              { label: '100以上', min: 100, max: 999 },
            ].map((p) => {
              const isActive = filters.minDistance === p.min && filters.maxDistance === p.max;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      ...filters,
                      minDistance: p.min,
                      maxDistance: p.max,
                    })
                  }
                  className={`text-xs px-3 py-1.5 rounded-lg font-black border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="shrink-0">
            <span className="text-xs sm:text-sm font-mono font-black text-teal-950 dark:text-teal-200 bg-teal-100 dark:bg-slate-800 px-3.5 py-1 rounded-full border border-teal-300 dark:border-slate-700">
              {filters.minDistance === 0 && filters.maxDistance >= 900
                ? '全距離 (すべて)'
                : filters.minDistance >= 100 && filters.maxDistance >= 900
                ? '100km以上'
                : `${filters.minDistance}km 〜 ${filters.maxDistance >= 900 ? '上限なし' : `${filters.maxDistance}km`}`}
            </span>
          </div>
        </div>

        {/* 2行目：数値ドロップダウン（矛盾ゼロ連動） ＋ 受付状態 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              数値で細かく指定:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-250 dark:border-slate-700">
              <select
                value={filters.minDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  let nextMax = filters.maxDistance;
                  if (nextMax < 900 && val > nextMax) {
                    nextMax = 999; // 矛盾回避：下限が上限を超えたら上限なしにする
                  }
                  onFilterChange({
                    ...filters,
                    minDistance: val,
                    maxDistance: nextMax,
                  });
                }}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer"
                title="下限距離"
              >
                <option value={0}>0km〜</option>
                <option value={30}>30km〜</option>
                <option value={70}>70km〜</option>
                <option value={100}>100km〜</option>
              </select>
              <span className="text-xs text-slate-500 font-bold px-0.5">〜</span>
              <select
                value={filters.maxDistance >= 900 ? 999 : filters.maxDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  let nextMin = filters.minDistance;
                  if (val < 900 && val < nextMin) {
                    nextMin = 0; // 矛盾回避：上限が下限を下回ったら下限を0kmにする
                  }
                  onFilterChange({
                    ...filters,
                    maxDistance: val,
                    minDistance: nextMin,
                  });
                }}
                className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100 cursor-pointer"
                title="上限距離"
              >
                <option value={30}>〜30km</option>
                <option value={70}>〜70km</option>
                <option value={100}>〜100km</option>
                <option value={999}>上限なし (100km+)</option>
              </select>
            </div>
          </div>

          {/* 受付状況の詳細ドロップダウン */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300">
              受付状態:
            </span>
            <select
              value={filters.entryStatus}
              onChange={(e) => onFilterChange({ ...filters, entryStatus: e.target.value })}
              className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-teal-700 cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
