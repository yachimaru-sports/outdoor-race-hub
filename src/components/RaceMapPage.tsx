import React, { useMemo, useState } from 'react';
import {
  RaceEvent,
  DealItem,
  GearItem,
  SortOption,
  ViewMode,
  EventCategory,
} from '../types';
import {
  MAP_REGION_BY_ID,
  PREFECTURE_BY_NAME,
  MapRegionId,
  getMapRegionIdByPrefecture,
  getP1RegionFilterValue,
} from '../data/japanMapData';
import {
  CATEGORY_LABELS,
  ENTRY_STATUS_CONFIG,
  formatEventDateSlash,
  isEventClosingSoon,
} from '../utils/helpers';
import { JapanDotMap } from './JapanDotMap';
import { PrefecturePinMap } from './PrefecturePinMap';
import { EventTableView } from './EventTableView';
import { EventCardView } from './EventCardView';
import { MobileEventCardList } from './MobileEventCardList';
import { trackEvent } from '../utils/analytics';
import {
  ArrowLeft,
  Map as MapIcon,
  ShoppingBag,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  ChevronRight,
  RotateCcw,
  Mountain,
  Bike,
  Footprints,
  Compass,
  CheckSquare,
  Square,
  Flame,
  BookmarkCheck,
  Search,
  ArrowUpDown,
  List,
  LayoutGrid,
  MapPin,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface RaceMapPageProps {
  events: RaceEvent[];
  deals: DealItem[];
  gears: GearItem[];
  favoriteIds: string[];
  theme: 'light' | 'dark';
  isPcView: boolean;
  showDisplayModeToggle?: boolean;
  onToggleTheme: () => void;
  onToggleDisplayMode: () => void;
  onToggleFavorite: (id: string) => void;
  onSelectEvent: (event: RaceEvent) => void;
  onBackToEvents: () => void;
  onOpenCatalog: () => void;
  onOpenGuide: () => void;
  onApplyAreaToEventsPage: (region?: string, prefecture?: string) => void;
}

const SEASON_OPTIONS = [
  { id: 'all', label: 'すべての時期' },
  { id: 'spring', label: '🌸 春 (3〜5月)' },
  { id: 'summer', label: '🌿 夏 (6〜8月)' },
  { id: 'autumn', label: '🍁 秋 (9〜11月)' },
  { id: 'winter', label: '❄️ 冬 (12〜2月)' },
  { id: '1', label: '1月' },
  { id: '2', label: '2月' },
  { id: '3', label: '3月' },
  { id: '4', label: '4月' },
  { id: '5', label: '5月' },
  { id: '6', label: '6月' },
  { id: '7', label: '7月' },
  { id: '8', label: '8月' },
  { id: '9', label: '9月' },
  { id: '10', label: '10月' },
  { id: '11', label: '11月' },
  { id: '12', label: '12月' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'date-asc', label: '開催日が近い順' },
  { id: 'date-desc', label: '開催日が遠い順' },
  { id: 'category-asc', label: '種別順（トレイル・マラソン・サイクル・AR）' },
  { id: 'distance-asc', label: '距離が短い順' },
  { id: 'distance-desc', label: '距離が長い順（100マイル・ロング）' },
  { id: 'elevation-desc', label: '獲得標高が高い順（ハード）' },
];

export const RaceMapPage: React.FC<RaceMapPageProps> = ({
  events,
  deals,
  gears,
  favoriteIds,
  theme,
  isPcView,
  showDisplayModeToggle = false,
  onToggleTheme,
  onToggleDisplayMode,
  onToggleFavorite,
  onSelectEvent,
  onBackToEvents,
  onOpenCatalog,
  onOpenGuide,
  onApplyAreaToEventsPage,
}) => {
  // 3段階ズーム階層の状態
  const [selectedRegionId, setSelectedRegionId] = useState<MapRegionId | null>(null);
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
  const [isOverseas, setIsOverseas] = useState<boolean>(false);

  // ピン選択と連動制御
  const [selectedPinEventId, setSelectedPinEventId] = useState<string | null>(null);
  const [pinOnlyFilter, setPinOnlyFilter] = useState<boolean>(false);

  // マップ上のクイック絞り込み＆下部リストソート状態
  const [categoryFilter, setCategoryFilter] = useState<'all' | EventCategory>('all');
  const [onlyOpen, setOnlyOpen] = useState<boolean>(false);
  const [onlyClosingSoon, setOnlyClosingSoon] = useState<boolean>(false);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // 1. 属性フィルター適用後の全大会（日本地図のカウントにも反映）
  const attributeFilteredEvents = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const kw = keyword.toLowerCase().trim();

    return events.filter((ev) => {
      if (onlyFavorites && !favoriteIds.includes(ev.id)) return false;
      if (onlyClosingSoon && !isEventClosingSoon(ev, todayStr)) return false;
      if (onlyOpen && ev.entry_status !== 'open' && ev.entry_status !== 'closing_soon') {
        return false;
      }

      if (categoryFilter !== 'all') {
        const isAdventureLike =
          ev.category === 'adventure' || Boolean(ev.elements?.includes('ロゲイニング'));
        if (categoryFilter === 'adventure') {
          if (!isAdventureLike) return false;
        } else if (ev.category !== categoryFilter) {
          return false;
        }
      }

      if (monthFilter !== 'all') {
        if (monthFilter === 'spring' && ![3, 4, 5].includes(ev.month)) return false;
        else if (monthFilter === 'summer' && ![6, 7, 8].includes(ev.month)) return false;
        else if (monthFilter === 'autumn' && ![9, 10, 11].includes(ev.month)) return false;
        else if (monthFilter === 'winter' && ![12, 1, 2].includes(ev.month)) return false;
        else if (!['spring', 'summer', 'autumn', 'winter'].includes(monthFilter)) {
          const m = Number(monthFilter);
          if (!Number.isNaN(m) && ev.month !== m) return false;
        }
      }

      if (kw) {
        const hit =
          ev.title.toLowerCase().includes(kw) ||
          ev.prefecture.toLowerCase().includes(kw) ||
          ev.region.toLowerCase().includes(kw) ||
          (ev.venue?.name || '').toLowerCase().includes(kw) ||
          (ev.subCategory || '').toLowerCase().includes(kw);
        if (!hit) return false;
      }

      return true;
    });
  }, [
    events,
    onlyFavorites,
    favoriteIds,
    onlyClosingSoon,
    onlyOpen,
    categoryFilter,
    monthFilter,
    keyword,
  ]);

  // 2. 現在のズーム階層（全国 / 地方 / 県 / 海外）に属する大会＋ソート
  const areaEvents = useMemo(() => {
    const list = attributeFilteredEvents.filter((ev) => {
      const rId = getMapRegionIdByPrefecture(ev.prefecture);
      if (isOverseas) {
        return rId === 'overseas';
      }
      if (selectedPrefecture) {
        return ev.prefecture === selectedPrefecture;
      }
      if (selectedRegionId) {
        return rId === selectedRegionId;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      // 特定ピン選択中（かつ全体表示）のときは、選択大会を先頭に浮上させて見やすくする
      if (selectedPinEventId && !pinOnlyFilter) {
        if (a.id === selectedPinEventId && b.id !== selectedPinEventId) return -1;
        if (b.id === selectedPinEventId && a.id !== selectedPinEventId) return 1;
      }

      switch (sortBy) {
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
  }, [
    attributeFilteredEvents,
    isOverseas,
    selectedPrefecture,
    selectedRegionId,
    sortBy,
    selectedPinEventId,
    pinOnlyFilter,
  ]);

  // 下部リスト表示用（ピン単体絞り込みトグルがONなら1件のみ）
  const displayedListEvents = useMemo(() => {
    if (selectedPinEventId && pinOnlyFilter) {
      return areaEvents.filter((e) => e.id === selectedPinEventId);
    }
    return areaEvents;
  }, [areaEvents, selectedPinEventId, pinOnlyFilter]);

  const selectedPinEvent = useMemo(
    () => (selectedPinEventId ? areaEvents.find((e) => e.id === selectedPinEventId) || null : null),
    [areaEvents, selectedPinEventId]
  );

  // 階層操作ハンドラ
  const handleResetToNational = () => {
    setSelectedRegionId(null);
    setSelectedPrefecture(null);
    setIsOverseas(false);
    setSelectedPinEventId(null);
    setPinOnlyFilter(false);
  };

  const handleSelectRegion = (regionId: MapRegionId | 'overseas') => {
    setSelectedPinEventId(null);
    setPinOnlyFilter(false);

    if (regionId === 'overseas') {
      setIsOverseas(true);
      setSelectedRegionId(null);
      setSelectedPrefecture(null);
      trackEvent('map_zoom_region', { region: 'overseas' });
      return;
    }

    setIsOverseas(false);
    setSelectedRegionId(regionId);
    trackEvent('map_zoom_region', { region: regionId });

    // 北海道・沖縄など1都道府県のみのブロックは、2段目を飛ばして直接Lv.3県内マップへ
    if (regionId === 'hokkaido') {
      setSelectedPrefecture('北海道');
      trackEvent('map_zoom_prefecture', { prefecture: '北海道' });
    } else if (regionId === 'okinawa') {
      setSelectedPrefecture('沖縄県');
      trackEvent('map_zoom_prefecture', { prefecture: '沖縄県' });
    } else {
      setSelectedPrefecture(null);
    }
  };

  const handleSelectPrefecture = (prefName: string) => {
    setIsOverseas(false);
    const meta = PREFECTURE_BY_NAME[prefName];
    if (meta) {
      setSelectedRegionId(meta.regionId);
    }
    setSelectedPrefecture(prefName);
    setSelectedPinEventId(null);
    setPinOnlyFilter(false);
    trackEvent('map_zoom_prefecture', { prefecture: prefName });
  };

  const handleStepBack = () => {
    if (selectedPinEventId) {
      setSelectedPinEventId(null);
      setPinOnlyFilter(false);
      return;
    }
    if (selectedPrefecture) {
      if (selectedRegionId === 'hokkaido' || selectedRegionId === 'okinawa') {
        handleResetToNational();
      } else {
        setSelectedPrefecture(null);
      }
      return;
    }
    if (selectedRegionId || isOverseas) {
      handleResetToNational();
    }
  };

  const handleSelectPin = (eventId: string) => {
    setSelectedPinEventId(eventId);
    const ev = events.find((e) => e.id === eventId);
    trackEvent('map_pin_click', {
      event_id: eventId,
      event_title: ev?.title,
      prefecture: ev?.prefecture,
    });
  };

  const handleResetFilters = () => {
    setCategoryFilter('all');
    setOnlyOpen(false);
    setOnlyClosingSoon(false);
    setOnlyFavorites(false);
    setMonthFilter('all');
    setKeyword('');
  };

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    onlyOpen ||
    onlyClosingSoon ||
    onlyFavorites ||
    monthFilter !== 'all' ||
    keyword.trim().length > 0;

  const isPinMapStage = Boolean(selectedPrefecture || isOverseas);
  const activeRegionConfig = selectedRegionId ? MAP_REGION_BY_ID[selectedRegionId] : null;
  const activePrefMeta = selectedPrefecture ? PREFECTURE_BY_NAME[selectedPrefecture] : null;

  const currentAreaLabel = isOverseas
    ? '海外・ARWS世界戦'
    : selectedPrefecture
    ? selectedPrefecture
    : activeRegionConfig
    ? activeRegionConfig.fullName
    : '日本全国（全エリア）';

  const zoomStageNumber = isPinMapStage ? 3 : selectedRegionId ? 2 : 1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors">
      {/* 常時固定ヘッダーバー */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-teal-500/40 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToEvents}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-black text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">大会一覧(P1)へ戻る</span>
              <span className="sm:hidden">一覧へ</span>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <MapIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-sm sm:text-lg font-black tracking-tight truncate">
                    全国レースマップ
                  </h1>
                  <span className="text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 shrink-0">
                    {attributeFilteredEvents.length}件表示中
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-400 font-bold">
                  全国 → 地方 → 県内開催地ピンの3段階ズームで探せるインタラクティブ日本地図
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-[11px] sm:text-xs shadow-sm cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">ギア特集</span>
            </button>

            {showDisplayModeToggle && (
              <button
                type="button"
                onClick={onToggleDisplayMode}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold cursor-pointer"
                title={isPcView ? 'スマホ表示に切り替え' : 'PC表示に切り替え'}
              >
                {isPcView ? (
                  <Smartphone className="w-3.5 h-3.5 text-teal-400" />
                ) : (
                  <Monitor className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenGuide}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-teal-300 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              title="使い方ガイド"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden md:inline">使い方</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer"
              aria-label="テーマ切り替え"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* 1. パンくずナビ ＆ ズーム段階インジケーター */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="マップ階層" className="flex items-center gap-1.5 flex-wrap text-xs sm:text-sm font-black">
            <button
              type="button"
              onClick={handleResetToNational}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                zoomStageNumber === 1
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              日本全国 ({attributeFilteredEvents.length})
            </button>

            {activeRegionConfig && !isOverseas && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    if (
                      activeRegionConfig.id === 'hokkaido' ||
                      activeRegionConfig.id === 'okinawa'
                    ) {
                      return;
                    }
                    setSelectedPrefecture(null);
                    setSelectedPinEventId(null);
                    setPinOnlyFilter(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    zoomStageNumber === 2
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer'
                  }`}
                >
                  {activeRegionConfig.fullName}
                </button>
              </>
            )}

            {selectedPrefecture && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="px-2.5 py-1 rounded-lg bg-teal-700 text-white">
                  {selectedPrefecture} ({areaEvents.length})
                </span>
              </>
            )}

            {isOverseas && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white">
                  海外・ARWS世界戦 ({areaEvents.length})
                </span>
              </>
            )}

            {selectedPinEvent && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 truncate max-w-[210px] sm:max-w-xs">
                  📍 {selectedPinEvent.title}
                </span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
              ステップ {zoomStageNumber}/3
            </span>
            {(selectedRegionId || selectedPrefecture || isOverseas || selectedPinEventId) && (
              <button
                type="button"
                onClick={handleStepBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>1段階戻る</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. マップ連動クイック絞り込みバー */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-black text-slate-700 dark:text-slate-300 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>地図を絞込:</span>
            </span>

            {[
              { id: 'all', label: 'すべて', icon: null },
              { id: 'trail', label: 'トレイル', icon: Mountain },
              { id: 'cycling', label: 'サイクル', icon: Bike },
              { id: 'marathon', label: 'マラソン', icon: Footprints },
              { id: 'adventure', label: 'AR・ロゲ', icon: Compass },
            ].map((item) => {
              const Icon = item.icon;
              const active = categoryFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategoryFilter(item.id as 'all' | EventCategory)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setOnlyOpen((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                onlyOpen
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
              }`}
            >
              {onlyOpen ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              <span>受付中のみ</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyClosingSoon((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                onlyClosingSoon
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>締切まじか</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyFavorites((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                onlyFavorites
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>予定 ({favoriteIds.length})</span>
            </button>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-black text-slate-900 dark:text-white cursor-pointer"
              aria-label="開催時期で絞り込み"
            >
              {SEASON_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="大会名・会場で絞込..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer ml-auto"
              >
                <RotateCcw className="w-3 h-3" />
                <span>条件クリア</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. インタラクティブ地図メインカード */}
        <section className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 sm:p-5 shadow-sm">
          {!isPinMapStage ? (
            <JapanDotMap
              events={attributeFilteredEvents}
              selectedRegionId={selectedRegionId}
              onSelectRegion={handleSelectRegion}
              onSelectPrefecture={handleSelectPrefecture}
              onResetToNational={handleResetToNational}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 左2/3：リアル地形ピンマップ */}
              <div className="lg:col-span-8">
                <PrefecturePinMap
                  events={areaEvents}
                  title={isOverseas ? '海外・ARWS世界戦' : selectedPrefecture || ''}
                  isOverseas={isOverseas}
                  fallbackCenter={activePrefMeta?.center || [35.68, 139.76]}
                  fallbackZoom={isOverseas ? 2 : activePrefMeta?.defaultZoom || 9}
                  selectedEventId={selectedPinEventId}
                  onSelectPin={handleSelectPin}
                  onOpenEventDetail={onSelectEvent}
                />
              </div>

              {/* 右1/3：県内開催会場クイックリスト（タップでピンと連動） */}
              <div className="lg:col-span-4 flex flex-col bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 max-h-[340px] lg:max-h-[505px]">
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      開催場所一覧（{areaEvents.length}件）
                    </span>
                  </div>
                  {selectedPinEventId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPinEventId(null);
                        setPinOnlyFilter(false);
                      }}
                      className="text-[11px] font-black text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                    >
                      選択解除
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {areaEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8 font-bold">
                      該当大会がありません
                    </p>
                  ) : (
                    areaEvents.map((ev) => {
                      const isSel = selectedPinEventId === ev.id;
                      const cat = CATEGORY_LABELS[ev.category];
                      const status = ENTRY_STATUS_CONFIG[ev.entry_status];
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => handleSelectPin(ev.id)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSel
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400/50 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${cat.badgeBg}`}
                            >
                              {cat.shortLabel}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                              {formatEventDateSlash(ev.date, ev.end_date)}
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-950 dark:text-white line-clamp-2 leading-snug">
                            {ev.title}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                            <span className="truncate">
                              📍 {ev.venue?.name || ev.prefecture}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border shrink-0 ${status.badge}`}>
                              {status.label}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 4. 地図のすぐ下：P1と完全共通のソート・一覧セクション */}
        <section className="space-y-3">
          {/* リスト操作ヘッダー */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                <h2 className="text-sm sm:text-lg font-black text-slate-950 dark:text-white">
                  {currentAreaLabel}の大会
                </h2>
                <span className="text-lg sm:text-2xl font-black font-mono text-teal-700 dark:text-teal-400">
                  {displayedListEvents.length}件
                </span>
              </div>

              {selectedPinEvent && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPinOnlyFilter((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black border cursor-pointer transition-colors ${
                      pinOnlyFilter
                        ? 'bg-amber-500 text-slate-950 border-amber-600'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    <span>
                      {pinOnlyFilter ? '選択ピンのみ表示中（全件に戻す）' : '選択ピン大会のみに絞る'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPinEventId(null);
                      setPinOnlyFilter(false);
                    }}
                    className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
                    title="ピン選択を解除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* ソートセレクト（P1と完全同一オプション） */}
              <div className="relative">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-slate-900 dark:text-white cursor-pointer"
                  aria-label="大会一覧の並び替え"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* PC表示時：一覧表 / カード切替 */}
              {isPcView && (
                <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>一覧表</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                      viewMode === 'card'
                        ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>カード</span>
                  </button>
                </div>
              )}

              {/* P1の詳細検索へ地域条件を引き継いで遷移 */}
              <button
                type="button"
                onClick={() => {
                  const p1Region = isOverseas
                    ? '海外'
                    : selectedRegionId
                    ? getP1RegionFilterValue(selectedRegionId)
                    : undefined;
                  onApplyAreaToEventsPage(p1Region, selectedPrefecture || undefined);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 text-xs font-black cursor-pointer"
                title="距離範囲や必須装備などの詳細検索へこの地域条件を引き継いで移動"
              >
                <span>P1でさらに詳細検索</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 選択中のピン強調バナー */}
          {selectedPinEvent && !pinOnlyFilter && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between gap-2">
              <span>
                📍 選択中のピン「<strong>{selectedPinEvent.title}</strong>」をリストの最上部に表示しています
              </span>
              <button
                type="button"
                onClick={() => onSelectEvent(selectedPinEvent)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shrink-0 cursor-pointer"
              >
                詳細を開く
              </button>
            </div>
          )}

          {/* P1共通の大会リスト（PCテーブル / PCカード / スマホカード） */}
          {isPcView ? (
            viewMode === 'table' ? (
              <EventTableView
                events={displayedListEvents}
                deals={deals}
                gears={gears}
                favoriteIds={favoriteIds}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onToggleFavorite={onToggleFavorite}
                onSelectEvent={onSelectEvent}
              />
            ) : (
              <EventCardView
                events={displayedListEvents}
                favoriteIds={favoriteIds}
                onToggleFavorite={onToggleFavorite}
                onSelectEvent={onSelectEvent}
              />
            )
          ) : (
            <MobileEventCardList
              events={displayedListEvents}
              deals={deals}
              gears={gears}
              favoriteIds={favoriteIds}
              onToggleFavorite={onToggleFavorite}
              onSelectEvent={onSelectEvent}
            />
          )}
        </section>
      </main>
    </div>
  );
};
