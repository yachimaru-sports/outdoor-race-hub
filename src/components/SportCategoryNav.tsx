import React from 'react';
import { RaceEvent, FilterState } from '../types';
import { ALL_GENRES } from '../utils/presets';
import { Compass, Mountain, Bike, Footprints, Map, Layers, BookmarkCheck } from 'lucide-react';

interface SportCategoryNavProps {
  events: RaceEvent[];
  filters: FilterState;
  favoriteIds: string[];
  onSelectNav: (category: string, featureTag?: string, onlyFavorites?: boolean) => void;
}

export const SportCategoryNav: React.FC<SportCategoryNavProps> = ({
  events,
  filters,
  favoriteIds,
  onSelectNav,
}) => {
  const isOpen = (e: RaceEvent) => e.entry_status === 'open' || e.entry_status === 'closing_soon';

  const totalCount = events.length;
  const totalOpen = events.filter(isOpen).length;

  const advEvents = events.filter(
    (e) => e.category === 'adventure' && !e.elements?.includes('ロゲイニング')
  );
  const advCount = advEvents.length;
  const advOpen = advEvents.filter(isOpen).length;

  const rogEvents = events.filter((e) => e.elements?.includes('ロゲイニング'));
  const rogainingCount = rogEvents.length;
  const rogainingOpen = rogEvents.filter(isOpen).length;

  const trailEvents = events.filter((e) => e.category === 'trail');
  const trailCount = trailEvents.length;
  const trailOpen = trailEvents.filter(isOpen).length;

  const cyclingEvents = events.filter((e) => e.category === 'cycling');
  const cyclingCount = cyclingEvents.length;
  const cyclingOpen = cyclingEvents.filter(isOpen).length;

  const marathonEvents = events.filter((e) => e.category === 'marathon');
  const marathonCount = marathonEvents.length;
  const marathonOpen = marathonEvents.filter(isOpen).length;

  const favoriteEvents = events.filter((e) => favoriteIds.includes(e.id));
  const favoriteOpen = favoriteEvents.filter(isOpen).length;

  const selectedCats = filters.selectedCategories ?? [...ALL_GENRES];
  const isAllCategories = selectedCats.length === ALL_GENRES.length;

  const navItems = [
    {
      id: 'all',
      label: 'すべての大会',
      sub: '全国・中国・四国 網羅',
      count: totalCount,
      openCount: totalOpen,
      icon: Layers,
      activeColor:
        'border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-950 dark:text-teal-200',
      iconBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      activeIconBg: 'bg-teal-700 text-white',
      isSelected: isAllCategories && (!filters.featureTag || filters.featureTag === 'all') && !filters.onlyFavorites,
      isExcluded: false,
      onClick: () => onSelectNav('all', 'all', false),
    },
    {
      id: 'adventure-main',
      genreId: 'adventure',
      label: 'アドベンチャー・MTB読図',
      sub: 'とれとれ・AR関西・複合',
      count: advCount,
      openCount: advOpen,
      icon: Compass,
      badgeText: '注目',
      activeColor:
        'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200',
      iconBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      activeIconBg: 'bg-amber-500 text-slate-950',
      isSelected: selectedCats.length === 1 && selectedCats.includes('adventure') && !filters.onlyFavorites,
      isExcluded: !selectedCats.includes('adventure'),
      onClick: () => onSelectNav('adventure', 'all', false),
    },
    {
      id: 'rogaining',
      genreId: 'rogaining',
      label: 'ロゲイニング・OMM',
      sub: '地図読み・ナビゲーション',
      count: rogainingCount,
      openCount: rogainingOpen,
      icon: Map,
      activeColor:
        'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      activeIconBg: 'bg-emerald-700 text-white',
      isSelected: selectedCats.length === 1 && selectedCats.includes('rogaining') && !filters.onlyFavorites,
      isExcluded: !selectedCats.includes('rogaining'),
      onClick: () => onSelectNav('all', 'rogaining', false),
    },
    {
      id: 'trail',
      genreId: 'trail',
      label: 'トレイルラン・100マイル',
      sub: 'ショート〜100mile網羅',
      count: trailCount,
      openCount: trailOpen,
      icon: Mountain,
      activeColor:
        'border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-950 dark:text-teal-200',
      iconBg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
      activeIconBg: 'bg-teal-700 text-white',
      isSelected: selectedCats.length === 1 && selectedCats.includes('trail') && !filters.onlyFavorites,
      isExcluded: !selectedCats.includes('trail'),
      onClick: () => onSelectNav('trail', 'all', false),
    },
    {
      id: 'cycling',
      genreId: 'cycling',
      label: 'サイクリング',
      sub: 'しまなみ・ロングライド',
      count: cyclingCount,
      openCount: cyclingOpen,
      icon: Bike,
      activeColor:
        'border-sky-700 bg-sky-50 dark:bg-sky-950/50 text-sky-950 dark:text-sky-200',
      iconBg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
      activeIconBg: 'bg-sky-700 text-white',
      isSelected: selectedCats.length === 1 && selectedCats.includes('cycling') && !filters.onlyFavorites,
      isExcluded: !selectedCats.includes('cycling'),
      onClick: () => onSelectNav('cycling', 'all', false),
    },
    {
      id: 'marathon',
      genreId: 'marathon',
      label: 'マラソン・ウルトラ',
      sub: '100kmウルトラ・フル',
      count: marathonCount,
      openCount: marathonOpen,
      icon: Footprints,
      activeColor:
        'border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200',
      iconBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
      activeIconBg: 'bg-indigo-700 text-white',
      isSelected: selectedCats.length === 1 && selectedCats.includes('marathon') && !filters.onlyFavorites,
      isExcluded: !selectedCats.includes('marathon'),
      onClick: () => onSelectNav('marathon', 'all', false),
    },
    {
      id: 'favorites',
      label: 'マイ参戦予定リスト',
      sub: '保存大会＆必携品管理',
      count: favoriteIds.length,
      openCount: favoriteOpen,
      icon: BookmarkCheck,
      activeColor:
        'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200',
      iconBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
      activeIconBg: 'bg-rose-600 text-white',
      isSelected: !!filters.onlyFavorites,
      isExcluded: false,
      onClick: () => onSelectNav('all', 'all', true),
    },
  ];

  return (
    <section className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-3.5 sm:py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const handleClick = () => {
              if (item.isSelected && item.id !== 'all') {
                onSelectNav('all', 'all', false);
              } else {
                item.onClick();
              }
            };

            return (
              <button
                key={item.id}
                onClick={handleClick}
                className={`group relative flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  item.isSelected
                    ? `${item.activeColor} shadow-xs scale-[1.01]`
                    : item.isExcluded
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 opacity-50 hover:opacity-75'
                    : 'border-slate-250 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
                title={
                  item.isSelected && item.id !== 'all'
                    ? 'もう一度クリックすると解除（すべて表示）'
                    : item.isExcluded
                    ? '現在除外中（クリックでこの競技のみ表示）'
                    : `${item.label}のみ表示`
                }
              >
                {/* 除外中バッジ */}
                {item.isExcluded && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black px-1.5 py-0.2 rounded bg-red-600 text-white shadow-xs border border-white">
                    除外中
                  </span>
                )}

                {/* 右上件数ピル（全大会数 ＆ 申込可能件数を両方明記） */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-full leading-none flex items-center gap-1 shadow-2xs ${
                      item.isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : item.isExcluded
                        ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through'
                        : 'bg-slate-150 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                    title={`全${item.count}大会中、${item.openCount}大会がエントリー受付中・申込可能`}
                  >
                    <span>{item.count}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px]">
                      (受付{item.openCount})
                    </span>
                  </span>
                </div>

                {/* 注目バッジ */}
                {item.badgeText && !item.isExcluded && (
                  <span className="absolute top-2 left-2 text-[11px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                    {item.badgeText}
                  </span>
                )}

                {/* アイコンサークル */}
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105 shadow-2xs ${
                    item.isSelected ? item.activeIconBg : item.iconBg
                  }`}
                >
                  <Icon className="w-5.5 h-5.5 stroke-[2.2]" />
                </div>

                {/* スポーツ種目名 */}
                <div
                  className={`font-black text-[13px] sm:text-sm leading-tight ${
                    item.isSelected
                      ? 'text-inherit'
                      : item.isExcluded
                      ? 'text-slate-400 dark:text-slate-500 line-through'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {item.label}
                </div>

                {/* サブ説明 */}
                <div
                  className={`text-xs mt-1 line-clamp-1 font-bold ${
                    item.isSelected
                      ? 'text-inherit opacity-90'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {item.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
