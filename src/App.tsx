import React, { useState, useEffect, useMemo } from 'react';
import eventsData from './data/events.json';
import dealsData from './data/deals.json';
import gearsData from './data/gears.json';
import metaData from './data/meta.json';
import { RaceEvent, DealItem, GearItem, FilterState, ViewMode } from './types';
import { INITIAL_FILTERS } from './utils/presets';
import { DealsTicker } from './components/DealsTicker';
import { ToretoreBanner } from './components/ToretoreBanner';
import { FilterSection } from './components/FilterSection';
import { EventTableView } from './components/EventTableView';
import { EventCardView } from './components/EventCardView';
import { MobileEventCardList } from './components/MobileEventCardList';
import { EventDetailModal } from './components/EventDetailModal';
import { UpdateTicker, UPDATE_NEWS_DATA } from './components/UpdateTicker';
import { Footer } from './components/Footer';
import { GearCatalogPage } from './components/GearCatalogPage';
import { ShoppingBag, ChevronRight } from 'lucide-react';

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
      const baseDate = ev.date.split(/[~～]/)[0].trim();
      if (baseDate < todayStr) {
        return { ...ev, entry_status: 'closed' as const };
      }
      if (ev.entry_deadline && ev.entry_deadline < todayStr) {
        return { ...ev, entry_status: 'closed' as const };
      }
      if (ev.entry_start_date && ev.entry_start_date > todayStr) {
        return { ...ev, entry_status: 'upcoming' as const };
      }
      if (
        ev.entry_deadline &&
        ev.entry_deadline >= todayStr &&
        ev.entry_deadline <= soonStr &&
        (ev.entry_status === 'open' || ev.entry_status === 'upcoming')
      ) {
        return { ...ev, entry_status: 'closing_soon' as const };
      }
      if (
        ev.entry_status === 'upcoming' &&
        ev.entry_start_date &&
        ev.entry_start_date <= todayStr
      ) {
        return { ...ev, entry_status: 'open' as const };
      }
      return ev;
    });
  }, []);

  // 厳選特価・おすすめギア商品（常時最上段カルーセルに表示）
  const deals = useMemo(() => {
    const list = dealsData as DealItem[];
    const discounted = list.filter((d) => (d.discount_rate || 0) >= 15);
    return discounted.length > 0 ? discounted : list;
  }, []);

  // 専門ギアマスター（定番おすすめ＆特価セール情報）
  const gears = useMemo(() => gearsData as GearItem[], []);

  // 画面ルーティング管理 ('events': 大会一覧, 'gears': おすすめ商品専用ページ)
  const [currentRoute, setCurrentRoute] = useState<'events' | 'gears'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('gear')) return 'gears';
    }
    return 'events';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('gear')) {
        setCurrentRoute('gears');
      } else {
        setCurrentRoute('events');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: 'events' | 'gears') => {
    setCurrentRoute(route);
    if (route === 'gears') {
      window.location.hash = '#/gears';
    } else {
      window.location.hash = '#/';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 大会詳細モーダルの選択状態（?event=<id> クエリによるディープリンク対応）
  const [selectedEvent, setSelectedEvent] = useState<RaceEvent | null>(() => {
    if (typeof window !== 'undefined') {
      const id = new URLSearchParams(window.location.search).get('event');
      if (id) return (eventsData as RaceEvent[]).find((e) => e.id === id) || null;
    }
    return null;
  });

  const handleOpenEventById = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    if (found) {
      setCurrentRoute('events');
      setSelectedEvent(found);
    }
  };

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

  // PC用画面 / スマホ用画面の切り替え管理（'auto': 画面幅自動 / 'pc': 強制PC版 / 'mobile': 強制スマホ版）
  const [displayMode, setDisplayMode] = useState<'auto' | 'pc' | 'mobile'>(() => {
    try {
      const saved = localStorage.getItem('race_hub_display_mode');
      return saved === 'pc' || saved === 'mobile' ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [isNarrowScreen, setIsNarrowScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isPcView = displayMode === 'pc' || (displayMode === 'auto' && !isNarrowScreen);

  useEffect(() => {
    try {
      localStorage.setItem('race_hub_display_mode', displayMode);
    } catch {}
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      vp.setAttribute(
        'content',
        displayMode === 'pc'
          ? 'width=1280'
          : 'width=device-width, initial-scale=1.0'
      );
    }
  }, [displayMode]);

  const toggleDisplayMode = () => {
    setDisplayMode((prev) => {
      if (prev === 'pc') return 'mobile';
      if (prev === 'mobile') return 'pc';
      return isNarrowScreen ? 'pc' : 'mobile';
    });
  };

  // フィルター状態（前回の表示条件を localStorage から復元し、変更時に自動保存）
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const saved = localStorage.getItem('race_hub_filters');
      if (!saved) return INITIAL_FILTERS;
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return INITIAL_FILTERS;
      }
      return {
        ...INITIAL_FILTERS,
        ...parsed,
        selectedCategories: Array.isArray(parsed.selectedCategories)
          ? parsed.selectedCategories
          : INITIAL_FILTERS.selectedCategories,
        excludedCategories: Array.isArray(parsed.excludedCategories)
          ? parsed.excludedCategories
          : INITIAL_FILTERS.excludedCategories,
        selectedElements: Array.isArray(parsed.selectedElements)
          ? parsed.selectedElements
          : INITIAL_FILTERS.selectedElements,
        minDistance:
          typeof parsed.minDistance === 'number' && !Number.isNaN(parsed.minDistance)
            ? parsed.minDistance
            : INITIAL_FILTERS.minDistance,
        maxDistance:
          typeof parsed.maxDistance === 'number' && !Number.isNaN(parsed.maxDistance)
            ? parsed.maxDistance
            : INITIAL_FILTERS.maxDistance,
      };
    } catch {
      return INITIAL_FILTERS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('race_hub_filters', JSON.stringify(filters));
    } catch {}
  }, [filters]);

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

  // アドベンチャーゲーム絞り込みショートカット（3ステートトグル：抽出 ➔ 除外 ➔ 解除）
  const handleFilterAdventure = () => {
    const isAdventureIncluded =
      filters.featureTag === 'toretore' && filters.featureMode !== 'exclude';
    const isAdventureExcluded =
      filters.featureTag === 'toretore' && filters.featureMode === 'exclude';

    if (!isAdventureIncluded && !isAdventureExcluded) {
      // 1. 抽出（これのみ表示）
      setFilters({
        ...INITIAL_FILTERS,
        category: 'adventure',
        featureTag: 'toretore',
        featureMode: 'include',
        selectedCategories: ['adventure'],
      });
    } else if (isAdventureIncluded) {
      // 2. 除外（これ以外を表示）
      setFilters({
        ...INITIAL_FILTERS,
        category: 'all',
        featureTag: 'toretore',
        featureMode: 'exclude',
        excludedCategories: ['adventure'],
      });
    } else {
      // 3. 元通り（解除）
      setFilters(INITIAL_FILTERS);
    }
  };

  // ピックアップカード2・3・4からの絞り込みショートカット（3ステートトグル：抽出 ➔ 除外 ➔ 解除）
  const handleFilterFeature = (category: string, featureTag: string, region = 'all') => {
    // ARWS & ARWC（世界アドベンチャーレース）カードの場合
    if (featureTag === 'arws') {
      const isIncluded = filters.featureTag === 'arws' && filters.featureMode !== 'exclude';
      const isExcluded = filters.featureTag === 'arws' && filters.featureMode === 'exclude';

      if (!isIncluded && !isExcluded) {
        // 1. 抽出（これのみ）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'adventure',
          selectedCategories: ['adventure'],
          featureTag: 'arws',
          featureMode: 'include',
          maxDistance: 1000,
          entryStatus: 'all',
        });
      } else if (isIncluded) {
        // 2. 除外（これ以外：ARWSを完全除外して国内一般レースのみ表示！）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'all',
          featureTag: 'arws',
          featureMode: 'exclude',
        });
      } else {
        // 3. 元通り（解除）
        setFilters(INITIAL_FILTERS);
      }
      return;
    }

    // 100マイルカードの場合
    if (featureTag === '100mile') {
      const isIncluded = filters.featureTag === '100mile' && filters.featureMode !== 'exclude';
      const isExcluded = filters.featureTag === '100mile' && filters.featureMode === 'exclude';

      if (!isIncluded && !isExcluded) {
        // 1. 抽出（100マイルのみ）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'all',
          featureTag: '100mile',
          featureMode: 'include',
        });
      } else if (isIncluded) {
        // 2. 除外（100マイルを除外：ミドル・ショートのみ表示！）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'all',
          featureTag: '100mile',
          featureMode: 'exclude',
        });
      } else {
        // 3. 元通り（解除）
        setFilters(INITIAL_FILTERS);
      }
      return;
    }

    // 地域（中国・四国）カードの場合
    if (region !== 'all') {
      const isRegionIncluded = filters.region === region && filters.regionMode !== 'exclude';
      const isRegionExcluded = filters.region === region && filters.regionMode === 'exclude';

      if (!isRegionIncluded && !isRegionExcluded) {
        // 1. 抽出（該当地域のみ）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'all',
          featureTag: 'all',
          region: region,
          regionMode: 'include',
        });
      } else if (isRegionIncluded) {
        // 2. 除外（該当地域以外）
        setFilters({
          ...INITIAL_FILTERS,
          category: 'all',
          featureTag: 'all',
          region: region,
          regionMode: 'exclude',
        });
      } else {
        // 3. 元通り（解除）
        setFilters(INITIAL_FILTERS);
      }
      return;
    }

    // その他の汎用処理
    if (filters.category === category && filters.featureTag === featureTag) {
      setFilters(INITIAL_FILTERS);
    } else {
      setFilters({
        ...INITIAL_FILTERS,
        category,
        featureTag,
        selectedCategories: category === 'all' ? undefined : [category],
      });
    }
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
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return events
      .filter((event) => {
        const isFavorite = favoriteIds.includes(event.id);
        const endDateStr = event.date.includes('~') ? event.date.split('~')[1].trim() : event.date;
        const isFutureOrActive = event.date >= todayStr || endDateStr >= todayStr;

        // マイ参戦予定（お気に入り）のみ表示モードの場合
        // 自分が申し込んだ・保存した大会は、受付が終了（closed）していても開催日まで100%確実に全件表示！
        if (filters.onlyFavorites) {
          if (!isFavorite) return false;
          return true;
        }

        // 自分が保存（マイ参戦予定）している大会で、開催日前のものは、
        // 「受付中のみ表示」フィルターで隠れてしまわないように特別にデフォルト常時表示（保存アイテム保護）
        const isProtectedFavorite = isFavorite && isFutureOrActive;

        // 競技ジャンル（親・種目）の除外判定（NOT検索対応）
        const eventGenre = (event.elements?.includes('ロゲイニング') || event.id.includes('rogaining'))
          ? 'rogaining'
          : event.category;

        if (filters.excludedCategories && filters.excludedCategories.includes(eventGenre)) {
          return false;
        }

        // 競技ジャンル（親・種目）のチェックボックス判定（複数選択＆除外OFF対応）
        if (filters.selectedCategories !== undefined) {
          if (!filters.selectedCategories.includes(eventGenre)) {
            return false;
          }
        } else if (filters.category !== 'all' && event.category !== filters.category) {
          return false;
        }

        // エリア絞り込み（抽出 / 除外対応）
        if (filters.region !== 'all') {
          if (filters.regionMode === 'exclude') {
            if (event.region === filters.region) return false;
          } else {
            if (event.region !== filters.region) return false;
          }
        }

        // 都道府県絞り込み
        if (filters.prefecture !== 'all' && event.prefecture !== filters.prefecture) {
          return false;
        }

        const hasKeyword = filters.searchKeyword.trim().length > 0;

        // エントリー受付状況絞り込み（※保存済みアイテム、またはユーザーが特定大会を検索している時は隠さず表示）
        if (!isProtectedFavorite && !hasKeyword) {
          if (filters.entryStatus === 'open_or_closing') {
            if (event.entry_status !== 'open' && event.entry_status !== 'closing_soon') {
              return false;
            }
          } else if (filters.entryStatus !== 'all' && event.entry_status !== filters.entryStatus) {
            return false;
          }
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

        // 競技エレメント・特徴チェックボックス（複数選択＆AND絞り込み対応）
        if (filters.selectedElements && filters.selectedElements.length > 0) {
          for (const el of filters.selectedElements) {
            if (el === '100mile') {
              if (!event.elements?.includes('100マイル') && event.distance_km < 155) return false;
            } else if (el === '100km') {
              if (!event.elements?.includes('100km+') && (event.distance_km < 95 || event.distance_km >= 155)) return false;
            } else if (el === 'map') {
              if (!event.elements?.includes('読図')) return false;
            } else if (el === 'mtb') {
              if (!event.elements?.includes('MTB')) return false;
            } else if (el === 'paddle') {
              if (!event.elements?.includes('パドル')) return false;
            } else if (el === 'night') {
              if (!event.elements?.includes('夜間')) return false;
            } else if (el === 'toretore') {
              if (!event.id.startsWith('toretore-') && !event.id.includes('rogaining') && event.category !== 'adventure') return false;
            }
          }
        } else {
          // 単一タグ（クイック抽出・除外）の判定（3ステート対応）
          const featureTag = filters.featureTag || 'all';
          if (featureTag !== 'all') {
            const isExclude = filters.featureMode === 'exclude';
            let match = false;

            if (featureTag === '100mile') {
              match = Boolean(event.elements?.includes('100マイル') || event.distance_km >= 155);
            } else if (featureTag === '100km') {
              match = Boolean(event.elements?.includes('100km+') || (event.distance_km >= 95 && event.distance_km < 155));
            } else if (featureTag === 'toretore') {
              match = Boolean(event.id.startsWith('toretore-') || event.id.includes('rogaining') || event.category === 'adventure');
            } else if (featureTag === 'map') {
              match = Boolean(event.elements?.includes('読図'));
            } else if (featureTag === 'mtb') {
              match = Boolean(event.elements?.includes('MTB'));
            } else if (featureTag === 'paddle') {
              match = Boolean(event.elements?.includes('パドル'));
            } else if (featureTag === 'rogaining') {
              match = Boolean(event.elements?.includes('ロゲイニング'));
            } else if (featureTag === 'night') {
              match = Boolean(event.elements?.includes('夜間'));
            } else if (featureTag === 'arws') {
              match = Boolean(
                event.elements?.some((e) => /arws|arwc|世界選手権|ワールドシリーズ/i.test(e)) ||
                /arws|arwc|magnificent|qualifier/i.test(event.title) ||
                event.id.startsWith('arws-') ||
                event.id.startsWith('arwc-')
              );
            }

            if (isExclude) {
              if (match) return false; // 除外モード：合致したレースを完全非表示
            } else {
              if (!match) return false; // 抽出モード：合致したレースのみ表示
            }
          }
        }

        // 距離レンジ（ARWS抽出時のみ世界遠征レースのため距離上限チェックをバイパス）
        if (!(filters.featureTag === 'arws' && filters.featureMode !== 'exclude')) {
          if (event.distance_km < filters.minDistance) {
            return false;
          }
          if (filters.maxDistance < 900 && event.distance_km > filters.maxDistance) {
            return false;
          }
        }

        // キーワード検索
        if (filters.searchKeyword.trim()) {
          const kw = filters.searchKeyword.toLowerCase().trim();
          const matchTitle = event.title.toLowerCase().includes(kw);
          const matchPref = event.prefecture.toLowerCase().includes(kw);
          const matchRegion = event.region.toLowerCase().includes(kw);
          const matchSub = event.subCategory ? event.subCategory.toLowerCase().includes(kw) : false;
          const matchVenue = event.venue?.name ? event.venue.name.toLowerCase().includes(kw) : false;
          const matchId = event.id.toLowerCase().includes(kw);
          const matchElements = event.elements
            ? event.elements.some((el) => el.toLowerCase().includes(kw))
            : false;
          const matchGear = event.mandatory_gear.some((g) => g.name.toLowerCase().includes(kw));
          if (!matchTitle && !matchPref && !matchRegion && !matchSub && !matchVenue && !matchId && !matchElements && !matchGear) {
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

  const latestNews = UPDATE_NEWS_DATA[0];
  const lastUpdated = (() => {
    // meta.json (毎朝8時自動同期日時)・deals.json・UPDATE_NEWS_DATA のうち最新日時を JST で自動表示
    try {
      const candidates: number[] = [];
      if (metaData && (metaData as { last_updated_at?: string }).last_updated_at) {
        const t = new Date((metaData as { last_updated_at: string }).last_updated_at).getTime();
        if (!isNaN(t) && t > 0) candidates.push(t);
      }
      for (const d of dealsData as Array<{ updated_at?: string }>) {
        if (d.updated_at) {
          const t = new Date(d.updated_at).getTime();
          if (!isNaN(t) && t > 0) candidates.push(t);
        }
      }
      if (latestNews && latestNews.date && latestNews.time) {
        const newsIso = `${latestNews.date.replace(/\./g, '-')}T${latestNews.time}:00+09:00`;
        const t = new Date(newsIso).getTime();
        if (!isNaN(t) && t > 0) candidates.push(t);
      }
      if (candidates.length > 0) {
        const latestTime = new Date(Math.max(...candidates));
        const formatter = new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(latestTime);
        const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
        return `${getPart('year')}.${getPart('month')}.${getPart('day')} ${getPart('hour')}:${getPart('minute')}`;
      }
    } catch {}
    return latestNews ? `${latestNews.date} ${latestNews.time}` : '2026.11.11 18:30';
  })();

  // 固定ヘッダーの高さ分を考慮したスムーズジャンプハンドラ
  const handleJumpToSection = (targetId: string) => {
    if (targetId === 'gears-catalog' || targetId === 'gears-page') {
      navigateTo('gears');
      return;
    }
    const element = document.getElementById(targetId);
    if (element) {
      const headerOffset = 115;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      element.classList.add('ring-4', 'ring-teal-500', 'transition-all');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-teal-500');
      }, 2200);
    }
  };

  if (currentRoute === 'gears') {
    return (
      <GearCatalogPage
        gears={gears}
        deals={deals}
        theme={theme}
        onToggleTheme={toggleTheme}
        onBackToEvents={() => navigateTo('events')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-150 w-full">
      {/* 1. 常時固定統合ヘッダー：添付画像の2段ヘッダー（楽天特価カルーセル ＆ アップデート情報バー）を常時最上部に完全固定 */}
      <header className="sticky top-0 z-50 shadow-xl w-full bg-slate-950 border-b border-slate-800 select-none">
        <div id="deals-carousel" className="w-full">
          <DealsTicker
            deals={deals}
            totalEvents={totalEvents}
            openCount={openCount}
            lastUpdated={lastUpdated}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenCatalog={() => navigateTo('gears')}
            isPcView={isPcView}
            onToggleDisplayMode={isNarrowScreen || displayMode !== 'auto' ? toggleDisplayMode : undefined}
          />
        </div>
        <UpdateTicker onJumpToTarget={handleJumpToSection} onOpenEvent={handleOpenEventById} />
      </header>

      {/* メインコンテンツ（ご要望順：注目の競技カテゴリー → すべての大会 → 条件にマッチする → 大会一覧） */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8 overflow-x-hidden">
        {(() => {
          const rs = (metaData as { run_summary?: Record<string, number> }).run_summary;
          if (!rs) return null;
          const items = [
            rs.events_added ? `新着大会 +${rs.events_added}件` : null,
            rs.events_updated ? `日程・状態更新 ${rs.events_updated}件` : null,
            rs.links_fixed ? `リンク修復 ${rs.links_fixed}件` : null,
            rs.deals_added ? `特価ギア追加 +${rs.deals_added}件` : null,
            rs.price_drops ? `値下げ ${rs.price_drops}件` : null,
          ].filter(Boolean);
          if (!items.length) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 text-xs shadow-2xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]">
                毎朝8時 自動更新レポート
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                本日の更新：{items.join(' ／ ')}
              </span>
            </div>
          );
        })()}
        {/* ★ おすすめ商品専用カタログへのクイックジャンプバナー */}
        <div
          onClick={() => navigateTo('gears')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 dark:from-amber-600 dark:via-orange-600 dark:to-amber-700 p-3.5 sm:p-4.5 text-slate-950 shadow-md hover:shadow-xl hover:scale-[1.008] transition-all cursor-pointer border border-amber-300 dark:border-amber-500 select-none"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md shrink-0 group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-white text-[10px] font-black tracking-wider uppercase">
                    専用ページOPEN
                  </span>
                  <span className="text-[11px] font-black text-slate-900 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                    最大25%OFF セール連動
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-950 mt-0.5">
                  大会必携品・おすすめギア攻略カタログ専用ページはこちら
                </h2>
                <p className="text-[11px] text-slate-900 font-bold hidden sm:block">
                  トレイルラン・サイクル・アドベンチャー・ウルトラマラソンの必須装備28選を競技区分・種別ごとに徹底比較！
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-950 text-white font-black text-xs sm:text-sm shadow-md group-hover:bg-slate-900 transition-colors whitespace-nowrap">
              <span>専用カタログを開く</span>
              <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* 2. 注目の競技カテゴリー・主要大会クイック抽出 */}
        <ToretoreBanner
          filters={filters}
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

        {/* 5. 大会情報一覧（PC表示 / スマホ表示の自動・手動切替に対応） */}
        <div id="events-section">
          {isPcView ? (
            <div>
              {viewMode === 'table' ? (
                <EventTableView
                  events={filteredEvents}
                  deals={deals}
                  favoriteIds={favoriteIds}
                  sortBy={filters.sortBy}
                  onSortChange={(newSort) => setFilters((prev) => ({ ...prev, sortBy: newSort }))}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectEvent={setSelectedEvent}
                />
              ) : (
                <EventCardView
                  events={filteredEvents}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectEvent={setSelectedEvent}
                />
              )}
            </div>
          ) : (
            <div>
              <MobileEventCardList
                events={filteredEvents}
                deals={deals}
                favoriteIds={favoriteIds}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          )}
        </div>
      </main>

      {/* 大会詳細モーダル */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          deals={deals}
          gears={gears}
          isFavorite={favoriteIds.includes(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onOpenCatalog={() => {
            setSelectedEvent(null);
            navigateTo('gears');
          }}
        />
      )}

      {/* フッター */}
      <Footer onOpenCatalog={() => navigateTo('gears')} />
    </div>
  );
};

export default App;
