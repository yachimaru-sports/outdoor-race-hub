import React, { useState, useEffect, useMemo } from 'react';
import eventsData from './data/events.json';
import dealsData from './data/deals.json';
import { RaceEvent, DealItem, FilterState, ViewMode } from './types';
import { INITIAL_FILTERS } from './utils/presets';
import { DealsTicker } from './components/DealsTicker';
import { ToretoreBanner } from './components/ToretoreBanner';
import { FilterSection } from './components/FilterSection';
import { EventTableView } from './components/EventTableView';
import { EventCardView } from './components/EventCardView';
import { UpdateTicker } from './components/UpdateTicker';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  // 現在日付を基準に、開催日や申込締切日が過ぎている大会は自動的に「closed（終了）」へリアルタイム補正
  const events = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 21日後の日付文字列（締切間近の自動判定用）
    const soonDate = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const soonStr = `${soonDate.getFullYear()}-${String(soonDate.getMonth() + 1).padStart(2, '0')}-${String(soonDate.getDate()).padStart(2, '0')}`;

    return (eventsData as RaceEvent[]).map((ev) => {
      if (ev.date < todayStr) {
        return { ...ev, entry_status: 'closed' as const };
      }
      if (ev.entry_deadline && ev.entry_deadline < todayStr) {
        return { ...ev, entry_status: 'closed' as const };
      }
      if (
        ev.entry_status === 'open' &&
        ev.entry_deadline &&
        ev.entry_deadline >= todayStr &&
        ev.entry_deadline <= soonStr
      ) {
        return { ...ev, entry_status: 'closing_soon' as const };
      }
      return ev;
    });
  }, []);

  // 割引率15%以上の実在特価商品のみを厳選して表示（15%未満の低割引商品は除外）
  const deals = useMemo(
    () => (dealsData as DealItem[]).filter((d) => d.discount_rate >= 15),
    []
  );

  // テーマ管理（デフォルト: 'light'）
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('race_hub_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('race_hub_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // フィルター状態
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // マイ参戦予定（お気に入り）IDリスト
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('race_hub_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleToggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('race_hub_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // 表示モード（テーブル vs カード）
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('race_hub_view_mode');
      return saved === 'card' ? 'card' : 'table';
    } catch {
      return 'table';
    }
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('race_hub_view_mode', mode);
    } catch {}
  };

  // 大型スポーツ種目ナビバーからの選択ハンドラ（親チェックボックスと同期）
  const handleSelectSportNav = (
    category: string,
    featureTag = 'all',
    onlyFavorites = false
  ) => {
    const allGenres = ['trail', 'cycling', 'marathon', 'adventure', 'rogaining'];
    let selectedCategories = allGenres;
    if (category === 'all' && featureTag === 'rogaining') {
      selectedCategories = ['rogaining'];
    } else if (category !== 'all') {
      selectedCategories = [category];
    }
    setFilters((prev) => ({
      ...prev,
      category,
      selectedCategories,
      featureTag,
      onlyFavorites,
    }));
  };

  // アドベンチャーゲーム絞り込みショートカット（ピックアップカード1）
  const handleFilterAdventure = () => {
    setFilters({
      ...INITIAL_FILTERS,
      category: 'adventure',
      featureTag: 'toretore',
    });
  };

  // ピックアップカード2・3からの絞り込みショートカット
  const handleFilterFeature = (category: string, featureTag: string, region = 'all') => {
    setFilters({
      ...INITIAL_FILTERS,
      category,
      featureTag,
      region,
    });
  };

  // フィルター手動変更
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // フィルターリセット
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  // 統計値
  const totalEvents = events.length;
  const openCount = useMemo(
    () => events.filter((e) => e.entry_status === 'open' || e.entry_status === 'closing_soon').length,
    [events]
  );
  const dealsCount = deals.length;

  // フィルタリング＆ソート
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        // マイ参戦予定（お気に入り）のみ表示
        if (filters.onlyFavorites && !favoriteIds.includes(event.id)) {
          return false;
        }

        // 競技ジャンル（親・種目）のチェックボックス判定（複数選択＆除外OFF対応）
        if (filters.selectedCategories !== undefined) {
          const eventGenre = (event.elements?.includes('ロゲイニング') || event.id.includes('rogaining'))
            ? 'rogaining'
            : event.category;
          if (!filters.selectedCategories.includes(eventGenre)) {
            return false;
          }
        } else if (filters.category !== 'all' && event.category !== filters.category) {
          return false;
        }

        // エリア絞り込み
        if (filters.region !== 'all' && event.region !== filters.region) {
          return false;
        }

        // 都道府県絞り込み
        if (filters.prefecture !== 'all' && event.prefecture !== filters.prefecture) {
          return false;
        }

        // エントリー受付状況絞り込み
        if (filters.entryStatus === 'open_or_closing') {
          if (event.entry_status !== 'open' && event.entry_status !== 'closing_soon') {
            return false;
          }
        } else if (filters.entryStatus !== 'all' && event.entry_status !== filters.entryStatus) {
          return false;
        }

        // 開催時期・月別フィルター
        const monthFilter = filters.monthFilter || 'all';
        if (monthFilter !== 'all') {
          if (monthFilter === 'spring') {
            if (![3, 4, 5].includes(event.month)) return false;
          } else if (monthFilter === 'summer') {
            if (![6, 7, 8].includes(event.month)) return false;
          } else if (monthFilter === 'autumn') {
            if (![9, 10, 11].includes(event.month)) return false;
          } else if (monthFilter === 'winter') {
            if (![12, 1, 2].includes(event.month)) return false;
          } else {
            const targetMonth = Number(monthFilter);
            if (!isNaN(targetMonth) && event.month !== targetMonth) {
              return false;
            }
          }
        }

        // 競技エレメント・特徴タグフィルター
        const featureTag = filters.featureTag || 'all';
        if (featureTag !== 'all') {
          if (featureTag === '100mile') {
            if (!event.elements?.includes('100マイル') && event.distance_km < 155) {
              return false;
            }
          } else if (featureTag === '100km') {
            if (
              !event.elements?.includes('100km+') &&
              (event.distance_km < 95 || event.distance_km >= 155)
            ) {
              return false;
            }
          } else if (featureTag === 'toretore') {
            if (
              !event.id.startsWith('toretore-') &&
              !event.id.includes('rogaining') &&
              event.category !== 'adventure'
            ) {
              return false;
            }
          } else if (featureTag === 'map') {
            if (!event.elements?.includes('読図')) return false;
          } else if (featureTag === 'mtb') {
            if (!event.elements?.includes('MTB')) return false;
          } else if (featureTag === 'paddle') {
            if (!event.elements?.includes('パドル')) return false;
          } else if (featureTag === 'rogaining') {
            if (!event.elements?.includes('ロゲイニング')) return false;
          } else if (featureTag === 'night') {
            if (!event.elements?.includes('夜間')) return false;
          }
        }

        // 距離レンジ
        if (event.distance_km < filters.minDistance) {
          return false;
        }
        if (filters.maxDistance < 900 && event.distance_km > filters.maxDistance) {
          return false;
        }

        // キーワード検索
        if (filters.searchKeyword.trim()) {
          const kw = filters.searchKeyword.toLowerCase().trim();
          const matchTitle = event.title.toLowerCase().includes(kw);
          const matchPref = event.prefecture.toLowerCase().includes(kw);
          const matchRegion = event.region.toLowerCase().includes(kw);
          const matchSub = event.subCategory ? event.subCategory.toLowerCase().includes(kw) : false;
          const matchElements = event.elements
            ? event.elements.some((el) => el.toLowerCase().includes(kw))
            : false;
          const matchGear = event.mandatory_gear.some((g) => g.name.toLowerCase().includes(kw));
          if (!matchTitle && !matchPref && !matchRegion && !matchSub && !matchElements && !matchGear) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'category-asc': {
            const order: Record<string, number> = {
              trail: 1,
              marathon: 2,
              cycling: 3,
              adventure: 4,
            };
            const diff = (order[a.category] || 99) - (order[b.category] || 99);
            if (diff !== 0) return diff;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          }
          case 'date-asc':
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          case 'date-desc':
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          case 'distance-asc':
            return a.distance_km - b.distance_km;
          case 'distance-desc':
            return b.distance_km - a.distance_km;
          case 'elevation-desc':
            return b.elevation_m - a.elevation_m;
          default:
            return 0;
        }
      });
  }, [events, filters, favoriteIds]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* 1. 常時固定ヘッダー：楽天特価セールギア ＆ アップデート情報バー */}
      <header className="sticky top-0 z-50 shadow-md">
        <div id="deals-carousel">
          <DealsTicker
            deals={deals}
            totalEvents={totalEvents}
            openCount={openCount}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>
        <UpdateTicker />
      </header>

      {/* メインコンテンツ（ご要望順：注目の競技カテゴリー → すべての大会 → 条件にマッチする → 大会一覧） */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* 2. 注目の競技カテゴリー・主要大会クイック抽出 */}
        <ToretoreBanner
          onFilterAdventure={handleFilterAdventure}
          onFilterFeature={handleFilterFeature}
        />

        {/* 4. 条件にマッチする（多次元検索パネル） */}
        <div id="filter-section">
          <FilterSection
            events={events}
            filters={filters}
            favoriteIds={favoriteIds}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            totalFilteredCount={filteredEvents.length}
          />
        </div>

        {/* 5. 大会情報一覧（テーブルビュー vs カードビュー） */}
        <div id="events-section">
          {viewMode === 'table' ? (
            <EventTableView
              events={filteredEvents}
              deals={deals}
              favoriteIds={favoriteIds}
              sortBy={filters.sortBy}
              onSortChange={(newSort) => setFilters((prev) => ({ ...prev, sortBy: newSort }))}
              onToggleFavorite={handleToggleFavorite}
            />
          ) : (
            <EventCardView
              events={filteredEvents}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </div>
      </main>

      {/* フッター */}
      <Footer />
    </div>
  );
};

export default App;
