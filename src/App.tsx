import React, { useState, useEffect, useMemo } from 'react';
import eventsData from './data/events.json';
import dealsData from './data/deals.json';
import { RaceEvent, DealItem, FilterState, Preset, ViewMode } from './types';
import { INITIAL_FILTERS, DEFAULT_PRESETS } from './utils/presets';
import { DealsTicker } from './components/DealsTicker';
import { Header } from './components/Header';
import { SportCategoryNav } from './components/SportCategoryNav';
import { PresetBar } from './components/PresetBar';
import { ToretoreBanner } from './components/ToretoreBanner';
import { FilterSection } from './components/FilterSection';
import { EventTableView } from './components/EventTableView';
import { EventCardView } from './components/EventCardView';
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

  // プリセット管理
  const [presets, setPresets] = useState<Preset[]>(() => {
    try {
      const saved = localStorage.getItem('race_hub_presets_v3');
      if (saved) {
        const parsed: Preset[] = JSON.parse(saved);
        const userCustom = parsed.filter((p) => !p.isDefault);
        return [...DEFAULT_PRESETS, ...userCustom];
      }
      return DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
    }
  });

  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // 大型スポーツ種目ナビバーからの選択ハンドラ
  const handleSelectSportNav = (
    category: string,
    featureTag = 'all',
    onlyFavorites = false
  ) => {
    setFilters((prev) => ({
      ...prev,
      category,
      featureTag,
      onlyFavorites,
    }));
    setActivePresetId(null);
  };

  // アドベンチャーゲーム絞り込みショートカット（ピックアップカード1）
  const handleFilterAdventure = () => {
    setFilters({
      ...INITIAL_FILTERS,
      category: 'adventure',
      featureTag: 'toretore',
    });
    setActivePresetId('preset-toretore-adventure');
  };

  // ピックアップカード2・3からの絞り込みショートカット
  const handleFilterFeature = (category: string, featureTag: string, region = 'all') => {
    setFilters({
      ...INITIAL_FILTERS,
      category,
      featureTag,
      region,
    });
    setActivePresetId(null);
  };

  // プリセット選択
  const handleSelectPreset = (preset: Preset) => {
    setFilters({
      ...INITIAL_FILTERS,
      ...preset.filters,
    });
    setActivePresetId(preset.id);
  };

  // フィルター手動変更時、プリセット解除
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setActivePresetId(null);
  };

  // プリセット新規保存
  const handleSavePreset = (name: string) => {
    const newPreset: Preset = {
      id: `custom-preset-${Date.now()}`,
      name: `📌 ${name}`,
      isDefault: false,
      filters: { ...filters },
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setActivePresetId(newPreset.id);
    try {
      localStorage.setItem('race_hub_presets_v3', JSON.stringify(updated));
    } catch {}
  };

  // プリセット削除
  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    if (activePresetId === id) {
      setActivePresetId(null);
    }
    try {
      localStorage.setItem('race_hub_presets_v3', JSON.stringify(updated));
    } catch {}
  };

  // フィルターリセット
  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setActivePresetId(null);
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

        // カテゴリ絞り込み
        if (filters.category !== 'all' && event.category !== filters.category) {
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
          } else if (featureTag === 'daytrip') {
            if (!event.elements?.includes('日帰り')) return false;
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
      {/* 1. 特価速報カルーセルティッカー（引き締めダーク帯） */}
      <DealsTicker deals={deals} />

      {/* 2. メインヘッダー */}
      <Header
        totalEvents={totalEvents}
        openCount={openCount}
        dealsCount={dealsCount}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 3. e-moshicom風の大型ビジュアル・スポーツ種目ナビゲーションバー */}
      <SportCategoryNav
        events={events}
        filters={filters}
        favoriteIds={favoriteIds}
        onSelectNav={handleSelectSportNav}
      />

      {/* 4. マイプリセットバー */}
      <PresetBar
        presets={presets}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onResetFilters={handleResetFilters}
        currentFilters={filters}
      />

      {/* メインコンテンツ（ゆったりとした余白構造） */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-7 sm:py-9 space-y-7 sm:space-y-8">
        {/* 5. 3連ビジュアルピックアップカード（とれとれバイク＆AR関西 / 読図・ロゲイニング / 中国地方・UTMB） */}
        <ToretoreBanner
          onFilterAdventure={handleFilterAdventure}
          onFilterFeature={handleFilterFeature}
        />

        {/* 6. 多次元検索パネル（受付中ワンクリック・時期選択・競技エレメントタグ・距離スライダー） */}
        <FilterSection
          events={events}
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          totalFilteredCount={filteredEvents.length}
        />

        {/* 7. ハイブリッド表示（テーブルビュー vs カードビュー） */}
        {viewMode === 'table' ? (
          <EventTableView
            events={filteredEvents}
            deals={deals}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : (
          <EventCardView
            events={filteredEvents}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>

      {/* フッター */}
      <Footer />
    </div>
  );
};

export default App;
