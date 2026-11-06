import React, { useState, useMemo, useEffect } from 'react';
import { GearItem, DealItem } from '../types';
import { formatPrice } from '../utils/helpers';
import { handleImageError } from '../utils/imageFallback';
import {
  ArrowLeft,
  ShoppingBag,
  Flame,
  Search,
  ExternalLink,
  SlidersHorizontal,
  Mountain,
  Bike,
  Footprints,
  Compass,
  Tag,
  Sparkles,
  Award,
  CheckCircle2,
  TrendingDown,
  RotateCcw,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';

interface GearCatalogPageProps {
  gears: GearItem[];
  deals: DealItem[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBackToEvents: () => void;
}

// 競技区分タブ定義
const SPORT_TABS = [
  { id: 'all', label: 'すべて表示', icon: Sparkles, count: 0 },
  { id: 'trail', label: 'トレイルランニング', icon: Mountain, count: 0 },
  { id: 'cycling', label: 'サイクリング / ロード', icon: Bike, count: 0 },
  { id: 'marathon', label: 'マラソン / ウルトラ', icon: Footprints, count: 0 },
  { id: 'adventure', label: 'アドベンチャー / 読図', icon: Compass, count: 0 },
];

// ソート順定義
type SortOption = 'recommended' | 'discount_desc' | 'price_asc' | 'price_desc';

export const GearCatalogPage: React.FC<GearCatalogPageProps> = ({
  gears,
  deals,
  theme,
  onToggleTheme,
  onBackToEvents,
}) => {
  // 選択中の競技区分（sports）
  const [selectedSport, setSelectedSport] = useState<string>('all');

  // 選択中のギア種別（gearType）
  const [selectedGearType, setSelectedGearType] = useState<string>('all');

  // 検索キーワード
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 特価品（20%OFF以上）のみ絞り込み
  const [onlyHighDiscount, setOnlyHighDiscount] = useState<boolean>(false);

  // ソート順
  const [sortBy, setSortBy] = useState<SortOption>('discount_desc');

  // deals データを id をキーとしたマップに変換（ポイント倍率・アフィリエイトURL補完用）
  const dealsMap = useMemo(() => {
    const map = new Map<string, DealItem>();
    deals.forEach((d) => map.set(d.id, d));
    return map;
  }, [deals]);

  // gears と deals を統合したリッチなアイテム配列
  const combinedGears = useMemo(() => {
    return gears.map((gear) => {
      const deal = dealsMap.get(gear.id);
      const originalPrice = deal?.original_price || gear.originalPrice || 0;
      const price = deal?.price || gear.price || 0;
      const discountRate = deal?.discount_rate ?? gear.discountRate ?? 0;
      const pointRate = deal?.point_rate || 1;
      const affiliateUrl = deal?.affiliate_url || gear.dealUrl || gear.standardUrl;
      const imageUrl = gear.imageUrl || deal?.image_url || '';
      const savedAmount = originalPrice > price ? originalPrice - price : 0;
      const isNew = Boolean(deal?.registered_at && (Date.now() - new Date(deal.registered_at).getTime()) < 7 * 24 * 60 * 60 * 1000);

      return {
        ...gear,
        deal,
        originalPrice,
        price,
        discountRate,
        pointRate,
        affiliateUrl,
        imageUrl,
        savedAmount,
        isNew,
      };
    });
  }, [gears, dealsMap]);

  // 利用可能なギア種別（gearType）一覧とその件数
  const gearTypeOptions = useMemo(() => {
    // 現在選択中のスポーツに合致するアイテムからギア種別を抽出
    const relevantGears = selectedSport === 'all'
      ? combinedGears
      : combinedGears.filter((g) => {
          if (!g.sports) return false;
          if (g.sports.includes(selectedSport) || g.sports.includes('all')) return true;
          if (selectedSport === 'adventure' && (g.sports.includes('cycling') || g.sports.includes('trail') || g.sports.includes('rogaining'))) return true;
          return false;
        });

    const typeCounts = new Map<string, number>();
    relevantGears.forEach((g) => {
      const type = g.gearType || 'その他';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });

    const list = Array.from(typeCounts.entries()).map(([type, count]) => ({
      type,
      count,
    }));
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [combinedGears, selectedSport]);

  // 競技区分タブごとの件数
  const sportTabsWithCount = useMemo(() => {
    return SPORT_TABS.map((tab) => {
      if (tab.id === 'all') {
        return { ...tab, count: combinedGears.length };
      }
      const count = combinedGears.filter((g) => {
        if (!g.sports) return false;
        if (g.sports.includes(tab.id) || g.sports.includes('all')) return true;
        if (tab.id === 'adventure' && (g.sports.includes('cycling') || g.sports.includes('trail') || g.sports.includes('rogaining'))) return true;
        return false;
      }).length;
      return { ...tab, count };
    });
  }, [combinedGears]);

  // フィルタリング処理
  const filteredGears = useMemo(() => {
    return combinedGears.filter((item) => {
      // 1. 競技区分フィルター
      if (selectedSport !== 'all') {
        const matchesSport = item.sports?.includes(selectedSport) ||
          item.sports?.includes('all') ||
          (selectedSport === 'adventure' && (item.sports?.includes('cycling') || item.sports?.includes('trail') || item.sports?.includes('rogaining')));
        if (!matchesSport) return false;
      }

      // 2. ギア種別フィルター
      if (selectedGearType !== 'all') {
        if (item.gearType !== selectedGearType) return false;
      }

      // 3. 高割引率（20%OFF以上）
      if (onlyHighDiscount && item.discountRate < 20) {
        return false;
      }

      // 4. 検索キーワード
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inBrand = item.brand?.toLowerCase().includes(q) || false;
        const inDesc = item.standardTitle.toLowerCase().includes(q);
        const inType = item.gearType.toLowerCase().includes(q);
        const inKeywords = item.matchKeywords?.some((kw) => kw.toLowerCase().includes(q)) || false;
        if (!inTitle && !inBrand && !inDesc && !inType && !inKeywords) {
          return false;
        }
      }

      return true;
    });
  }, [combinedGears, selectedSport, selectedGearType, onlyHighDiscount, searchQuery]);

  // ソート処理
  const sortedGears = useMemo(() => {
    const list = [...filteredGears];
    switch (sortBy) {
      case 'discount_desc':
        list.sort((a, b) => b.discountRate - a.discountRate || (b.savedAmount - a.savedAmount));
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'recommended':
      default:
        // 新着優先、次に割引率
        list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.discountRate - a.discountRate);
        break;
    }
    return list;
  }, [filteredGears, sortBy]);

  // フィルター全解除
  const handleResetFilters = () => {
    setSelectedSport('all');
    setSelectedGearType('all');
    setSearchQuery('');
    setOnlyHighDiscount(false);
    setSortBy('discount_desc');
  };

  // ページ先頭へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors w-full">
      {/* 1. ギアカタログ専用ヘッダーナビバー */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-amber-500/60 shadow-xl select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          {/* 戻るボタン ＆ サイトタイトル */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToEvents}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-750 hover:border-teal-400 transition-all text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              title="大会スケジュール一覧へ戻る"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden xs:inline">大会一覧へ戻る</span>
              <span className="xs:hidden">大会へ</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shadow-md font-black">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>おすすめギア</span>
                  <span className="text-amber-400 text-xs sm:text-sm font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40">
                    必携品カタログ
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400 font-bold hidden sm:block">
                  OUTDOOR RACE HUB 公式 厳選装備＆特価セール比較
                </p>
              </div>
            </div>
          </div>

          {/* 右側：テーマ切り替え ＆ カタログ統計 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>厳選 {combinedGears.length} 品目掲載</span>
            </div>

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors shadow-2xs cursor-pointer"
              aria-label="テーマ切り替え"
              title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-200" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
        {/* 2. 魅力的なヒーローバナーセクション */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-amber-500/40 p-4 sm:p-6 lg:p-8 text-white shadow-xl">
          {/* 背景の装飾グロー */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/50 text-amber-300 text-xs sm:text-sm font-black">
              <Flame className="w-4 h-4 text-red-500 animate-pulse fill-red-500" />
              <span>全レース実戦検証 ＆ レギュレーション完全準拠</span>
            </div>

            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              大会完走を勝ち取る、<br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-200">
                プロ厳選ギア ＆ リアルタイム最安値
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              100マイル、過酷なアドベンチャーレース、ロングライド、ウルトラマラソンで実際に必携品として指定される定番装備を網羅。
              楽天市場のリアルタイム価格と連動し、15〜25%以上のセール特価やポイント還元で最もお得に揃えられます。
            </p>

            {/* 3大メリットバッジ */}
            <div className="flex flex-wrap gap-2 pt-2 text-[11px] sm:text-xs font-bold">
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                必携品チェックリスト直結
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                最大25%OFF 特価セール連動
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                楽天ポイント最大10倍還元
              </span>
            </div>
          </div>
        </section>

        {/* 3. 区分・カテゴリー選択セクション（ユーザー要望のコア機能！） */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          {/* ① 競技区分タブ（大型ボタンスタイル） */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>1. 参戦競技から選ぶ</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold hidden sm:inline">
                  （※選択中のボタンをもう一度押すと解除・全表示）
                </span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                該当: {filteredGears.length} 件
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {sportTabsWithCount.map((tab) => {
                const isSelected = selectedSport === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedSport('all');
                      } else {
                        setSelectedSport(tab.id);
                      }
                      setSelectedGearType('all'); // スポーツ切り替え時はギア種別をリセット
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-800 dark:bg-teal-600 dark:border-teal-500 shadow-md ring-2 ring-teal-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate">{tab.label}</div>
                      <div className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {tab.count} 品目
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ② 装備種別（gearType）フィルター */}
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>2. 装備の種類で絞り込む</span>
              </h3>
              {selectedGearType !== 'all' && (
                <button
                  onClick={() => setSelectedGearType('all')}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  種別解除
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => setSelectedGearType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedGearType === 'all'
                    ? 'bg-slate-900 text-white border-slate-950 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-250 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750'
                }`}
              >
                すべての種別 ({filteredGears.length})
              </button>

              {gearTypeOptions.map((opt) => {
                const isSelected = selectedGearType === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedGearType(isSelected ? 'all' : opt.type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs ring-2 ring-amber-400/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-250 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span>{opt.type}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ③ 検索バー ＆ ソート ＆ 特価フィルター */}
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* キーワード検索 */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="商品名・ブランド（LEKI, SALOMON, PETZL...）・キーワードで検索"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* フィルター＆ソートコントロール群 */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* 20%OFF以上特価チェック */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-200 text-xs font-bold cursor-pointer transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 select-none">
                <input
                  type="checkbox"
                  checked={onlyHighDiscount}
                  onChange={(e) => setOnlyHighDiscount(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                />
                <Flame className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                <span>20%OFF以上の特価品のみ</span>
              </label>

              {/* ソート順セレクタ */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">並び替え:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="discount_desc">割引率が高い順（おすすめ）</option>
                  <option value="recommended">新着順</option>
                  <option value="price_asc">価格が安い順</option>
                  <option value="price_desc">価格が高い順</option>
                </select>
              </div>

              {/* リセットボタン */}
              {(selectedSport !== 'all' || selectedGearType !== 'all' || searchQuery || onlyHighDiscount) && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="すべての検索条件をリセット"
                >
                  <RotateCcw className="w-3 h-3" />
                  リセット
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 4. おすすめ商品カードグリッド一覧 */}
        {sortedGears.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto stroke-[1.5]" />
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-200">
              該当するギアが見つかりませんでした
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              絞り込み条件（競技区分・ギア種別・キーワード）を変更するか、条件をリセットしてお試しください。
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-3 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              絞り込み条件を初期化する
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {sortedGears.map((item) => {
              return (
                <div
                  key={item.id}
                  className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-400 shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden relative"
                >
                  {/* カード上部：画像 ＆ 各種セールバッジ */}
                  <div className="relative w-full aspect-square bg-white dark:bg-slate-950 p-4 flex items-center justify-center border-b border-slate-150 dark:border-slate-800 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      onError={(e) => handleImageError(e, item.gearType)}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* 左上バッジ群：割引率 ＆ 新着 */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
                      {item.discountRate > 0 && (
                        <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 rounded-md shadow-md border border-white/80 leading-tight">
                          {item.discountRate}% OFF
                        </span>
                      )}
                      {item.isNew && (
                        <span className="bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow border border-white/90 leading-tight">
                          🆕 新着
                        </span>
                      )}
                    </div>

                    {/* 右上バッジ：ポイント還元 */}
                    {item.pointRate > 1 && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md shadow-md flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-red-600 text-red-600" />
                        <span>P{item.pointRate}倍</span>
                      </div>
                    )}

                    {/* ギア種別ピル（画像下部に控えめに配置） */}
                    <div className="absolute bottom-2 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white font-bold text-[10px] px-2 py-0.5 rounded-md">
                      {item.gearType}
                    </div>
                  </div>

                  {/* カード中部：商品詳細情報 */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      {/* ブランド ＆ 対象スポーツピル */}
                      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black">
                          {item.brand || '厳選ギア'}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.sports?.slice(0, 2).map((sp) => (
                            <span key={sp} className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                              {sp === 'trail' ? 'トレイル' : sp === 'cycling' ? 'サイクル' : sp === 'marathon' ? 'マラソン' : 'アドベンチャー'}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 商品タイトル */}
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-amber-500 transition-colors">
                        {item.title}
                      </h4>

                      {/* プロの選定理由・おすすめ解説（ハイライト枠） */}
                      <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-750 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5 fill-amber-500/30" />
                          <p className="line-clamp-3 text-[11px] sm:text-xs font-semibold">
                            {item.standardTitle}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 価格 ＆ お得額 */}
                    <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold">セール特価（税込）</div>
                          <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                            {formatPrice(item.price)}
                          </div>
                        </div>

                        {item.originalPrice > item.price && (
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 line-through font-mono">
                              定価 {formatPrice(item.originalPrice)}
                            </div>
                            <div className="text-xs font-extrabold text-red-600 dark:text-red-400 font-mono flex items-center justify-end gap-0.5">
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span>¥{item.savedAmount.toLocaleString()}引</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* アクションボタン群 */}
                      <div className="pt-2 flex flex-col gap-1.5">
                        <a
                          href={item.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                          <span>楽天市場の公式販売ページを開く</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {item.standardUrl && (
                          <a
                            href={`https://search.rakuten.co.jp/search/mall/${encodeURIComponent((item.brand ? item.brand + ' ' : '') + item.title)}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors border border-slate-250 dark:border-slate-700"
                          >
                            <Search className="w-3 h-3 text-slate-400" />
                            <span>他サイズ・カラーを楽天市場で検索</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. ページ下部：大会スケジュール一覧へのCTAリンク */}
        <section className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl border border-teal-500/40 p-6 sm:p-8 text-center text-white space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Mountain className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-lg sm:text-2xl font-black">
              装備が揃ったら、次のレースへ挑戦しよう！
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              全国＆中四国の厳選トレイルラン、ロングライド、アドベンチャーレース、ウルトラマラソンのエントリー状況を網羅しています。
            </p>
          </div>
          <button
            onClick={onBackToEvents}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>大会スケジュール一覧を見る（OUTDOOR RACE HUB）</span>
          </button>
        </section>
      </main>

      {/* フッター */}
      <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span className="font-black text-slate-900 dark:text-slate-100">OUTDOOR RACE HUB</span>
            <span>— 必携品・おすすめギア攻略カタログ</span>
          </div>
          <p className="text-[11px]">
            ※価格・ポイント倍率は楽天市場の最新セール情報に基づきます。
          </p>
        </div>
      </footer>
    </div>
  );
};
