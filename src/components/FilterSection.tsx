import React from 'react';
import { FilterState, ViewMode, SortOption, RaceEvent } from '../types';
import { REGIONS, PREFECTURES } from '../utils/helpers';
import { ALL_GENRES } from '../utils/presets';
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
  X,
  Trophy,
  BookmarkCheck,
  Ruler,
  Mountain,
  Bike,
  Footprints,
  Map,
} from 'lucide-react';

interface FilterSectionProps {
  events: RaceEvent[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  totalFilteredCount: number;
  favoriteIds?: string[];
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  events,
  filters,
  onFilterChange,
  onResetFilters,
  viewMode,
  onViewModeChange,
  totalFilteredCount,
  favoriteIds = [],
}) => {
  const isOnlyOpen = filters.entryStatus === 'open_or_closing';

  const toggleOnlyOpen = () => {
    onFilterChange({
      ...filters,
      entryStatus: isOnlyOpen ? 'all' : 'open_or_closing',
    });
  };

  const isOpen = (e: RaceEvent) => e.entry_status === 'open' || e.entry_status === 'closing_soon';

  // ==========================================
  // 競技ジャンル（親・種目）の定義と集計
  // ==========================================
  const genreDefinitions = [
    {
      id: 'trail',
      label: 'トレイルラン・100マイル',
      sub: 'ショート〜100mile網羅',
      icon: Mountain,
      activeColor: 'border-teal-600 bg-white dark:bg-slate-800 text-teal-950 dark:text-teal-200',
      iconBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
      activeIconBg: 'bg-teal-700 text-white',
      count: events.filter((e) => e.category === 'trail').length,
      openCount: events.filter((e) => e.category === 'trail' && isOpen(e)).length,
    },
    {
      id: 'cycling',
      label: 'サイクリング',
      sub: 'しまなみ・ロングライド',
      icon: Bike,
      activeColor: 'border-sky-600 bg-white dark:bg-slate-800 text-sky-950 dark:text-sky-200',
      iconBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
      activeIconBg: 'bg-sky-700 text-white',
      count: events.filter((e) => e.category === 'cycling').length,
      openCount: events.filter((e) => e.category === 'cycling' && isOpen(e)).length,
    },
    {
      id: 'marathon',
      label: 'マラソン・ウルトラ',
      sub: '100kmウルトラ・フル',
      icon: Footprints,
      activeColor: 'border-indigo-600 bg-white dark:bg-slate-800 text-indigo-950 dark:text-indigo-200',
      iconBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
      activeIconBg: 'bg-indigo-700 text-white',
      count: events.filter((e) => e.category === 'marathon').length,
      openCount: events.filter((e) => e.category === 'marathon' && isOpen(e)).length,
    },
    {
      id: 'adventure',
      label: 'アドベンチャー・MTB読図',
      sub: 'とれとれ・AR関西・複合',
      icon: Compass,
      badgeText: '注目',
      activeColor: 'border-amber-600 bg-white dark:bg-slate-800 text-amber-950 dark:text-amber-200',
      iconBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      activeIconBg: 'bg-amber-500 text-slate-950',
      count: events.filter((e) => e.category === 'adventure' && !e.elements?.includes('ロゲイニング')).length,
      openCount: events.filter(
        (e) => e.category === 'adventure' && !e.elements?.includes('ロゲイニング') && isOpen(e)
      ).length,
    },
    {
      id: 'rogaining',
      label: 'ロゲイニング・OMM',
      sub: '地図読み・ナビゲーション',
      icon: Map,
      activeColor: 'border-emerald-600 bg-white dark:bg-slate-800 text-emerald-950 dark:text-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      activeIconBg: 'bg-emerald-700 text-white',
      count: events.filter((e) => e.elements?.includes('ロゲイニング')).length,
      openCount: events.filter((e) => e.elements?.includes('ロゲイニング') && isOpen(e)).length,
    },
  ];

  const selectedGenres = filters.selectedCategories ?? [...ALL_GENRES];

  const handleToggleGenre = (genreId: string) => {
    let next: string[];
    if (selectedGenres.includes(genreId)) {
      next = selectedGenres.filter((id) => id !== genreId);
    } else {
      next = [...selectedGenres, genreId];
    }
    onFilterChange({
      ...filters,
      selectedCategories: next,
      category: next.length === 1 ? next[0] : 'all',
    });
  };

  const handleSelectAllGenres = () => {
    onFilterChange({
      ...filters,
      selectedCategories: [...ALL_GENRES],
      category: 'all',
    });
  };

  const handleClearAllGenres = () => {
    onFilterChange({
      ...filters,
      selectedCategories: [],
      category: 'all',
    });
  };

  // ==========================================
  // オプション定義（時期・ソート）
  // ==========================================
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

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'date-asc', label: '開催日が近い順' },
    { id: 'date-desc', label: '開催日が遠い順' },
    { id: 'category-asc', label: '種別順（トレイル・マラソン・サイクル・AR）' },
    { id: 'distance-asc', label: '距離が短い順' },
    { id: 'distance-desc', label: '距離が長い順（100マイル・ロング）' },
    { id: 'elevation-desc', label: '獲得標高が高い順（ハード）' },
  ];

  // ==========================================
  // 最下段「現在の絞込条件」チップ生成
  // ==========================================
  const activeChips: { id: string; label: string; onRemove: () => void }[] = [];

  // 競技ジャンル
  if (selectedGenres.length === 0) {
    activeChips.push({
      id: 'genre-none',
      label: '🚫 全競技OFF中 (0件)',
      onRemove: handleSelectAllGenres,
    });
  } else if (selectedGenres.length === 4 && !selectedGenres.includes('cycling')) {
    activeChips.push({
      id: 'no-cycling',
      label: '🚫 サイクリング除外中',
      onRemove: handleSelectAllGenres,
    });
  } else if (selectedGenres.length < ALL_GENRES.length) {
    const labels = selectedGenres
      .map((id) => genreDefinitions.find((g) => g.id === id)?.label.split('・')[0])
      .filter(Boolean)
      .join(' + ');
    activeChips.push({
      id: 'genre-selected',
      label: `種目: ${labels}`,
      onRemove: handleSelectAllGenres,
    });
  }

  // 距離
  if (filters.minDistance > 0 || filters.maxDistance < 900) {
    activeChips.push({
      id: 'distance',
      label: `距離: ${filters.minDistance}km 〜 ${filters.maxDistance >= 900 ? '上限なし' : `${filters.maxDistance}km`}`,
      onRemove: () => onFilterChange({ ...filters, minDistance: 0, maxDistance: 999 }),
    });
  }

  // 受付状態
  if (isOnlyOpen) {
    activeChips.push({
      id: 'only-open',
      label: '受付中のみ',
      onRemove: () => onFilterChange({ ...filters, entryStatus: 'all' }),
    });
  }

  // お気に入り
  if (filters.onlyFavorites) {
    activeChips.push({
      id: 'fav',
      label: '参戦予定のみ',
      onRemove: () => onFilterChange({ ...filters, onlyFavorites: false }),
    });
  }

  // 検索キーワード
  if (filters.searchKeyword.trim()) {
    activeChips.push({
      id: 'keyword',
      label: `検索: "${filters.searchKeyword}"`,
      onRemove: () => onFilterChange({ ...filters, searchKeyword: '' }),
    });
  }

  // エリア
  if (filters.region !== 'all') {
    activeChips.push({
      id: 'region',
      label: `エリア: ${filters.region}`,
      onRemove: () => onFilterChange({ ...filters, region: 'all' }),
    });
  }

  // 都道府県
  if (filters.prefecture !== 'all') {
    activeChips.push({
      id: 'pref',
      label: `都道府県: ${filters.prefecture}`,
      onRemove: () => onFilterChange({ ...filters, prefecture: 'all' }),
    });
  }

  // 時期
  if (filters.monthFilter && filters.monthFilter !== 'all') {
    const opt = seasonOptions.find((o) => o.id === filters.monthFilter);
    activeChips.push({
      id: 'season',
      label: opt ? opt.label : `時期: ${filters.monthFilter}`,
      onRemove: () => onFilterChange({ ...filters, monthFilter: 'all' }),
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* 0. 最上部ヘッダー：件数 ＆ 受付中トグル ＆ マイ参戦予定 ＆ 表示切替 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
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

          {/* 受付中のみ */}
          <button
            type="button"
            onClick={toggleOnlyOpen}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer select-none ${
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

          {/* マイ参戦予定 */}
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, onlyFavorites: !filters.onlyFavorites })}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer select-none ${
              filters.onlyFavorites
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-700 hover:bg-rose-100'
            }`}
            title="保存した参戦予定大会のみを表示"
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>マイ参戦予定</span>
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full font-mono font-black ${
                filters.onlyFavorites
                  ? 'bg-white text-rose-700'
                  : 'bg-rose-200 dark:bg-rose-900 text-rose-950 dark:text-rose-100'
              }`}
            >
              {favoriteIds.length}
            </span>
          </button>
        </div>

        {/* 右側：条件クリア（★ご要望：目立つように大幅強調！） ＆ 表示モード切替 */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onResetFilters}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black border-2 transition-all cursor-pointer select-none shadow-xs ${
              activeChips.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40 hover:scale-[1.02]'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-100 hover:border-rose-400'
            }`}
            title="現在の検索・絞り込み条件をすべて解除して初期状態に戻す（全リセット）"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${activeChips.length > 0 ? 'stroke-[2.5] text-white' : 'text-rose-600 dark:text-rose-400 stroke-[2.2]'}`} />
            <span>条件をクリア</span>
            {activeChips.length > 0 && (
              <span className="bg-white/25 text-white text-[11px] px-1.5 py-0.2 rounded-full font-mono font-black ml-0.5">
                {activeChips.length}
              </span>
            )}
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              onClick={() => onViewModeChange('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>一覧表</span>
            </button>
            <button
              onClick={() => onViewModeChange('card')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-950'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>カード</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          1. 競技ジャンル（親・種目）
          ★件数バッジ一回り拡大 ＆ 文字切れゼロ ＆ 美しいリッチカード
          ======================================================== */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
              競技ジャンル（種目選択・除外）:
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold hidden sm:inline">
              ※チェックを外すとその競技が非表示（除外）になります
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllGenres}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={handleClearAllGenres}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              全解除
            </button>
          </div>
        </div>

        {/* 5大ジャンルのリッチカード（★1行表示＆コンパクトに約1行サイズ縮小！） */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {genreDefinitions.map((genre) => {
            const isChecked = selectedGenres.includes(genre.id);
            const Icon = genre.icon;
            return (
              <button
                key={genre.id}
                type="button"
                onClick={() => handleToggleGenre(genre.id)}
                className={`group relative flex flex-col items-center text-center py-2 px-1.5 sm:py-2.5 sm:px-2 rounded-xl border-2 transition-all cursor-pointer select-none ${
                  isChecked
                    ? `${genre.activeColor} shadow-xs scale-[1.01]`
                    : 'border-slate-250 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 opacity-50 hover:opacity-75'
                }`}
                title={isChecked ? 'クリックしてこの競技を除外' : 'クリックしてこの競技を含める'}
              >
                {/* 左上：チェックボックス（ON / OFF） */}
                <div className="absolute top-2 left-2">
                  {isChecked ? (
                    <div className="flex items-center gap-0.5 bg-teal-600 text-white px-1.5 py-0.2 rounded shadow-2xs text-[11px] font-black leading-none">
                      <CheckSquare className="w-3 h-3 fill-white text-teal-600" />
                      <span>ON</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded text-[11px] font-black leading-none">
                      <Square className="w-3 h-3" />
                      <span>OFF</span>
                    </div>
                  )}
                </div>

                {/* 右上：登録件数 ＆ 受付中件数バッジ */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-[11px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-full leading-none flex items-center gap-1 shadow-2xs ${
                      isChecked
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through'
                    }`}
                  >
                    <span className="text-xs sm:text-[13px] font-black">{genre.count}</span>
                    <span className="text-emerald-500 dark:text-emerald-400 font-black text-[10px]">
                      (受付{genre.openCount})
                    </span>
                  </span>
                </div>

                {/* 注目バッジ（アドベンチャーなど） */}
                {genre.badgeText && isChecked && (
                  <span className="absolute top-6 left-2 text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 shadow-2xs">
                    {genre.badgeText}
                  </span>
                )}

                {/* 中央：アイコンサークル（高さを約1行分コンパクトに） */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center mt-3.5 mb-1.5 transition-transform group-hover:scale-105 shadow-2xs ${
                    isChecked ? genre.activeIconBg : genre.iconBg
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>

                {/* 競技名（★絶対に改行せず1行で美しく収まるように調整） */}
                <div
                  className={`font-black text-xs sm:text-sm lg:text-[13px] leading-tight whitespace-nowrap tracking-tight px-0.5 ${
                    isChecked
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-400 dark:text-slate-500 line-through'
                  }`}
                >
                  {genre.label}
                </div>

                {/* サブ説明 */}
                <div
                  className={`text-[11px] mt-0.5 font-bold whitespace-nowrap px-0.5 ${
                    isChecked
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {genre.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          2. 距離範囲（★一列・1行でスマートに集約！）
          ======================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850/80 border border-slate-250 dark:border-slate-750">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-slate-900 dark:text-white shrink-0 mr-1">
            <Ruler className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>距離範囲:</span>
          </div>

          {[
            { label: '全距離', min: 0, max: 999 },
            { label: '0-30km', min: 0, max: 30 },
            { label: '30-70km', min: 30, max: 70 },
            { label: '70-100km', min: 70, max: 100 },
            { label: '100km以上', min: 100, max: 999 },
          ].map((p) => {
            const isActive = filters.minDistance === p.min && filters.maxDistance === p.max;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  if (isActive && !(p.min === 0 && p.max === 999)) {
                    onFilterChange({
                      ...filters,
                      minDistance: 0,
                      maxDistance: 999,
                    });
                  } else {
                    onFilterChange({
                      ...filters,
                      minDistance: p.min,
                      maxDistance: p.max,
                    });
                  }
                }}
                className={`text-xs sm:text-sm px-3 py-1.5 rounded-lg font-black border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={isActive ? 'クリックで全距離に戻す' : `${p.label}で絞り込み`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* 右側：数値指定 ＋ 範囲バッジ */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300">
            <span>数値指定:</span>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
              <select
                value={filters.minDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  let nextMax = filters.maxDistance;
                  if (nextMax < 900 && val > nextMax) {
                    nextMax = 999;
                  }
                  onFilterChange({
                    ...filters,
                    minDistance: val,
                    maxDistance: nextMax,
                  });
                }}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-black px-1.5 py-1 rounded cursor-pointer focus:outline-none"
              >
                <option value={0}>0km〜</option>
                <option value={10}>10km〜</option>
                <option value={20}>20km〜</option>
                <option value={30}>30km〜</option>
                <option value={50}>50km〜</option>
                <option value={70}>70km〜</option>
                <option value={100}>100km〜</option>
                <option value={160}>160km〜</option>
              </select>
              <span className="text-slate-400 font-black">〜</span>
              <select
                value={filters.maxDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  let nextMin = filters.minDistance;
                  if (val < 900 && nextMin > val) {
                    nextMin = 0;
                  }
                  onFilterChange({
                    ...filters,
                    minDistance: nextMin,
                    maxDistance: val,
                  });
                }}
                className="bg-transparent text-slate-900 dark:text-white text-xs font-black px-1.5 py-1 rounded cursor-pointer focus:outline-none"
              >
                <option value={30}>〜30km</option>
                <option value={50}>〜50km</option>
                <option value={70}>〜70km</option>
                <option value={100}>〜100km</option>
                <option value={160}>〜160km</option>
                <option value={250}>〜250km</option>
                <option value={999}>上限なし (100km+)</option>
              </select>
            </div>
          </div>

          <span className="text-xs sm:text-sm font-mono font-black text-teal-950 dark:text-teal-200 bg-teal-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-teal-300 dark:border-slate-700">
            {filters.minDistance === 0 && filters.maxDistance >= 900
              ? '全距離'
              : filters.minDistance >= 100 && filters.maxDistance >= 900
              ? '100km以上'
              : `${filters.minDistance}km 〜 ${filters.maxDistance >= 900 ? '上限なし' : `${filters.maxDistance}km`}`}
          </span>
        </div>
      </div>

      {/* ========================================================
          3. 大会名・エリア・都道府県・時期・並び替え（★一列・5連グリッド）
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* 大会名キーワード */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="大会名・山域で検索..."
            value={filters.searchKeyword}
            onChange={(e) => onFilterChange({ ...filters, searchKeyword: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-950 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all font-black"
          />
        </div>

        {/* エリア */}
        <div className="relative">
          <Compass className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.region}
            onChange={(e) =>
              onFilterChange({ ...filters, region: e.target.value, prefecture: 'all' })
            }
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-black"
          >
            <option value="all">エリア：全国すべて</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}地方
              </option>
            ))}
          </select>
        </div>

        {/* 都道府県 */}
        <div className="relative">
          <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.prefecture}
            onChange={(e) => onFilterChange({ ...filters, prefecture: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-black"
          >
            <option value="all">都道府県：すべて</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* 開催時期 */}
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.monthFilter || 'all'}
            onChange={(e) => onFilterChange({ ...filters, monthFilter: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-black"
          >
            {seasonOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 並び替え */}
        <div className="relative">
          <ArrowUpDown className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({ ...filters, sortBy: e.target.value as SortOption })
            }
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition-all appearance-none cursor-pointer font-black"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================
          4. 現在の絞込条件（★一列・短縮・最下段スリム配置！）
          ======================================================== */}
      <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-teal-950 dark:text-teal-200 shrink-0 mr-1">
            <SlidersHorizontal className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>現在の絞込条件:</span>
          </div>

          {activeChips.length > 0 ? (
            activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-850 border border-teal-300 dark:border-teal-700 text-slate-900 dark:text-slate-100 text-xs font-black shadow-2xs hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all cursor-pointer group"
                title="クリックでこの条件を解除"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3 text-slate-400 group-hover:text-red-600" />
              </button>
            ))
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">
              全大会が対象です
            </span>
          )}
        </div>

        {activeChips.length > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 text-xs font-black text-teal-800 dark:text-teal-300 hover:underline cursor-pointer bg-white/70 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-700 shrink-0 self-end sm:self-auto"
          >
            <RotateCcw className="w-3 h-3" />
            <span>全条件をリセット</span>
          </button>
        )}
      </div>
    </div>
  );
};
