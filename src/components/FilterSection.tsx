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
  Tag,
  Bike,
  ExternalLink,
  X,
  Trophy,
  Sparkles,
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

  // 競技ジャンル（親・種目）の定義と集計
  const isOpen = (e: RaceEvent) => e.entry_status === 'open' || e.entry_status === 'closing_soon';

  const genreDefinitions = [
    {
      id: 'trail',
      label: 'トレイルラン・100マイル',
      icon: '⛰️',
      sub: 'ショート〜100mile網羅',
      count: events.filter((e) => e.category === 'trail').length,
      openCount: events.filter((e) => e.category === 'trail' && isOpen(e)).length,
    },
    {
      id: 'cycling',
      label: 'サイクリング',
      icon: '🚴',
      sub: 'しまなみ・ロングライド',
      count: events.filter((e) => e.category === 'cycling').length,
      openCount: events.filter((e) => e.category === 'cycling' && isOpen(e)).length,
    },
    {
      id: 'marathon',
      label: 'マラソン・ウルトラ',
      icon: '🏃',
      sub: '100kmウルトラ・フル',
      count: events.filter((e) => e.category === 'marathon').length,
      openCount: events.filter((e) => e.category === 'marathon' && isOpen(e)).length,
    },
    {
      id: 'adventure',
      label: 'アドベンチャー・MTB読図',
      icon: '🧭',
      sub: 'とれとれ・AR関西・複合',
      count: events.filter((e) => e.category === 'adventure' && !e.elements?.includes('ロゲイニング')).length,
      openCount: events.filter(
        (e) => e.category === 'adventure' && !e.elements?.includes('ロゲイニング') && isOpen(e)
      ).length,
    },
    {
      id: 'rogaining',
      label: 'ロゲイニング・OMM',
      icon: '🗺️',
      sub: '地図読み・ナビゲーション',
      count: events.filter((e) => e.elements?.includes('ロゲイニング')).length,
      openCount: events.filter((e) => e.elements?.includes('ロゲイニング') && isOpen(e)).length,
    },
  ];

  // 現在選択されている競技ジャンル（未指定時は全選択扱い）
  const selectedGenres = filters.selectedCategories ?? [...ALL_GENRES];

  // チェックボックス切り替え
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

  // 全選択・全解除
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

  // クイック切替プリセット
  const handleQuickPreset = (preset: 'no_bike' | 'run_only' | 'nav_only' | 'bike_only') => {
    let next: string[] = [];
    switch (preset) {
      case 'no_bike':
        next = ['trail', 'marathon', 'adventure', 'rogaining'];
        break;
      case 'run_only':
        next = ['trail', 'marathon'];
        break;
      case 'nav_only':
        next = ['adventure', 'rogaining'];
        break;
      case 'bike_only':
        next = ['cycling'];
        break;
    }
    onFilterChange({
      ...filters,
      selectedCategories: next,
      category: next.length === 1 ? next[0] : 'all',
    });
  };

  // 競技エレメント・特徴タグ（子・過酷度や必要スキル・装備）
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
      count: events.filter(
        (e) => e.elements?.includes('100km+') || (e.distance_km >= 95 && e.distance_km < 155)
      ).length,
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
      id: 'night',
      label: '夜間行動・ナイトラン',
      icon: '🔦',
      count: events.filter((e) => e.elements?.includes('夜間')).length,
    },
    {
      id: 'toretore',
      label: 'とれとれバイク・AR関西',
      icon: '🏆',
      count: events.filter(
        (e) => e.id.startsWith('toretore-') || e.id.includes('rogaining') || e.category === 'adventure'
      ).length,
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

  const sortOptions: { id: SortOption; label: string }[] = [
    { id: 'date-asc', label: '開催日が近い順' },
    { id: 'date-desc', label: '開催日が遠い順' },
    { id: 'category-asc', label: '種別順（トレイル・マラソン・サイクル・AR）' },
    { id: 'distance-asc', label: '距離が短い順' },
    { id: 'distance-desc', label: '距離が長い順（100マイル・ロング）' },
    { id: 'elevation-desc', label: '獲得標高が高い順（ハード）' },
  ];

  const activeFeature = filters.featureTag || 'all';

  // 適用中フィルターの判定とバッジ生成
  const activeChips: { id: string; label: string; onRemove: () => void }[] = [];

  // 競技ジャンルの除外/絞り込み状態判定
  if (selectedGenres.length === 0) {
    activeChips.push({
      id: 'genre-none',
      label: '🚫 全競技OFF中 (0件)',
      onRemove: handleSelectAllGenres,
    });
  } else if (
    selectedGenres.length === 4 &&
    !selectedGenres.includes('cycling')
  ) {
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

  // 受付状態
  if (isOnlyOpen) {
    activeChips.push({
      id: 'only-open',
      label: 'エントリー受付中のみ',
      onRemove: () => onFilterChange({ ...filters, entryStatus: 'all' }),
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

  // 特徴タグ
  if (activeFeature !== 'all') {
    const ft = featureTags.find((f) => f.id === activeFeature);
    activeChips.push({
      id: 'feature',
      label: ft ? `${ft.icon} ${ft.label}` : activeFeature,
      onRemove: () => onFilterChange({ ...filters, featureTag: 'all' }),
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

  // 検索キーワード
  if (filters.searchKeyword.trim()) {
    activeChips.push({
      id: 'keyword',
      label: `検索: "${filters.searchKeyword}"`,
      onRemove: () => onFilterChange({ ...filters, searchKeyword: '' }),
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* 1. 最上段ヘッダー：件数表示 ＆「エントリー受付中のみ表示」ワンクリックチェック */}
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
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

      {/* 2. 【親情報】競技ジャンル・種目チェックボックス＆クイック切替 */}
      <div className="bg-slate-50 dark:bg-slate-850/80 rounded-2xl p-4 sm:p-5 border-2 border-slate-250 dark:border-slate-750 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-750 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-teal-700 text-white">
              <Trophy className="w-4 h-4" />
            </div>
            <span className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
              競技ジャンル（親・種目）:
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold hidden sm:inline">
              ※チェックを外すとその競技が即座に非表示（除外）になります
            </span>
          </div>

          {/* 一括操作 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllGenres}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={handleClearAllGenres}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              全解除
            </button>
          </div>
        </div>

        {/* 5大ジャンルのチェックボックスカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {genreDefinitions.map((genre) => {
            const isChecked = selectedGenres.includes(genre.id);
            return (
              <label
                key={genre.id}
                onClick={() => handleToggleGenre(genre.id)}
                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-white dark:bg-slate-800 border-teal-600 dark:border-teal-500 shadow-2xs'
                    : 'bg-slate-100/70 dark:bg-slate-900/60 border-slate-300 dark:border-slate-800 opacity-60 hover:opacity-80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* チェックボックスアイコン */}
                  <div className="shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400 fill-teal-50 dark:fill-teal-950" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-base">{genre.icon}</span>
                      <span
                        className={`text-xs sm:text-[13px] font-black truncate ${
                          isChecked
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-500 dark:text-slate-500 line-through'
                        }`}
                      >
                        {genre.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-bold">
                      {genre.sub}
                    </div>
                  </div>
                </div>

                {/* 件数バッジ */}
                <div className="shrink-0 text-right font-mono ml-2">
                  <span
                    className={`text-xs font-black px-1.5 py-0.5 rounded ${
                      isChecked
                        ? 'bg-slate-150 text-slate-900 dark:bg-slate-700 dark:text-slate-200'
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                    }`}
                  >
                    {genre.count}
                  </span>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ({genre.openCount})
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* ⚡ ワンタップ切替ショートカット（自転車以外、ラン系のみ、読図系のみ、自転車のみ） */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-750 text-xs">
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-extrabold mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>ワンタップ切替:</span>
          </div>

          <button
            type="button"
            onClick={() => handleQuickPreset('no_bike')}
            className={`px-3 py-1.5 rounded-lg font-black transition-all border cursor-pointer ${
              selectedGenres.length === 4 && !selectedGenres.includes('cycling')
                ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="サイクリング以外の全競技（トレラン・マラソン・ロゲ・アドベンチャー）を一撃抽出"
          >
            🚫 自転車以外（ラン・読図・AR）
          </button>

          <button
            type="button"
            onClick={() => handleQuickPreset('run_only')}
            className={`px-3 py-1.5 rounded-lg font-black transition-all border cursor-pointer ${
              selectedGenres.length === 2 &&
              selectedGenres.includes('trail') &&
              selectedGenres.includes('marathon')
                ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="トレイルラン＋マラソンのみ"
          >
            🏃 ラン系のみ（トレラン・マラソン）
          </button>

          <button
            type="button"
            onClick={() => handleQuickPreset('nav_only')}
            className={`px-3 py-1.5 rounded-lg font-black transition-all border cursor-pointer ${
              selectedGenres.length === 2 &&
              selectedGenres.includes('adventure') &&
              selectedGenres.includes('rogaining')
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="アドベンチャーレース＋ロゲイニングのみ"
          >
            🧭 読図系のみ（アドベンチャー・ロゲ）
          </button>

          <button
            type="button"
            onClick={() => handleQuickPreset('bike_only')}
            className={`px-3 py-1.5 rounded-lg font-black transition-all border cursor-pointer ${
              selectedGenres.length === 1 && selectedGenres.includes('cycling')
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                : 'bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title="サイクリングのみ"
          >
            🚴 自転車のみ
          </button>
        </div>
      </div>

      {/* 3. 🎯【現在適用中の絞り込み状態】チップバー（一目で把握＆ワンタップ解除） */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-xs">
          <span className="font-extrabold text-teal-900 dark:text-teal-200 flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>適用中の条件:</span>
          </span>

          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-850 border border-teal-300 dark:border-teal-700 text-slate-900 dark:text-slate-100 font-black shadow-2xs hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all cursor-pointer group"
              title="クリックでこの条件を解除"
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3 text-slate-400 group-hover:text-red-600" />
            </button>
          ))}

          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-teal-800 dark:text-teal-300 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>全条件をリセット</span>
          </button>
        </div>
      )}

      {/* 4. 中段：横一列・直感検索ボックス（キーワード・地域・時期・ソート） */}
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

      {/* 5. 外部ポータル直通検索バー（スポエンCYCLE・スポーツエントリー・RUNNET・モシコム） */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-extrabold">
          <ExternalLink className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>各ポータルサイトで直通検索:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* スポエンCYCLE */}
          <a
            href={
              filters.searchKeyword.trim()
                ? `https://cycle.spoen.jp/search/?keyword=${encodeURIComponent(filters.searchKeyword.trim())}`
                : 'https://cycle.spoen.jp/'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700 font-black shadow-2xs transition-all hover:scale-105 cursor-pointer"
            title="スポエンCYCLEでサイクルイベントを直接検索"
          >
            <Bike className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>スポエンCYCLEで検索</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>

          {/* スポーツエントリー */}
          <a
            href="https://www.sportsentry.ne.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-700 font-bold shadow-2xs transition-all hover:scale-105 cursor-pointer"
            title="スポーツエントリーで大会を検索"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
            <span>スポーツエントリー</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>

          {/* RUNNET */}
          <a
            href="https://runnet.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-bold shadow-2xs transition-all hover:scale-105 cursor-pointer"
            title="RUNNETで大会を検索"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span>RUNNET</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>

          {/* モシコム */}
          <a
            href={
              filters.searchKeyword.trim()
                ? `https://moshicom.com/search/?keyword=${encodeURIComponent(filters.searchKeyword.trim())}`
                : 'https://moshicom.com/'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold shadow-2xs transition-all hover:scale-105 cursor-pointer"
            title="e-moshicomで検索"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>モシコム</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </a>
        </div>
      </div>

      {/* 6. 【子情報】競技エレメント・特徴タグ（過酷度・スキル・必要装備） */}
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

      {/* 7. 距離レンジ ＆ ステータス詳細（2行固定 ＆ km表記 ＆ 2度押しキャンセル） */}
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

            {/* 5つの距離ボタン（2度押しで全距離に戻るトグル対応＆km表記） */}
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
                  className={`text-xs px-3 py-1.5 rounded-lg font-black border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                  title={isActive ? 'クリックで全距離に戻す' : `${p.label}で絞り込み`}
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

        {/* 2行目：数値ドロップダウン ＋ 受付状態 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              数値で細かく指定:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-850 p-1 rounded-xl border border-slate-250 dark:border-slate-700">
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
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
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
              <span className="text-xs font-bold text-slate-400">〜</span>
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
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
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

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              受付状態:
            </span>
            <select
              value={filters.entryStatus}
              onChange={(e) => onFilterChange({ ...filters, entryStatus: e.target.value })}
              className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
            >
              <option value="all">すべての受付状態</option>
              <option value="open_or_closing">🟢 受付中＋締切間近のみ</option>
              <option value="open">🟢 エントリー受付中</option>
              <option value="closing_soon">🔴 締切間近のみ</option>
              <option value="upcoming">🔵 告知・準備中</option>
              <option value="closed">⚫ 受付終了</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
