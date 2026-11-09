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
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Store,
  Globe,
  HandHeart,
  BadgePercent,
} from 'lucide-react';

interface GearCatalogPageProps {
  gears: GearItem[];
  deals: DealItem[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBackToEvents: () => void;
}

// 楽天アフィリエイトID（検索経由の購入も売上としてカウント）
const RAKUTEN_AFFILIATE_ID = '58fb598b.0ed2da59.58fb598c.27018da5';

// 楽天市場の検索結果へのアフィリエイトURL生成関数
const buildRakutenSearchAffiliateUrl = (keyword: string) => {
  const targetUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`;
  return `https://hb.afl.rakuten.co.jp/ichiba/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(targetUrl)}&link_type=picttext`;
};

// 人気のワンタップ楽天検索タグ候補
const POPULAR_SEARCH_TAGS = [
  'インナーファクト 靴下',
  'サロモン トレランザック',
  'ペツル ヘッドライト',
  'ウルトラマラソン 補給食 ジェル',
  'ノースフェイス レインウェア',
  'ガーミン GPSウォッチ',
  'CW-X サポートタイツ',
  'トレッキングポール 折りたたみ',
  'トレランシューズ',
];

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

  // サイト内検索キーワード
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 楽天市場ダイレクト検索用キーワード
  const [rakutenKeyword, setRakutenKeyword] = useState<string>('');

  // 特価品（40%OFF以上）のみ絞り込み
  const [onlySuperDeals, setOnlySuperDeals] = useState<boolean>(false);

  // ソート順
  const [sortBy, setSortBy] = useState<SortOption>('discount_desc');

  // スマホでの表示形式（'rich': じっくり詳細紹介モード / 'compact': 2列コンパクト比較モード）
  const [mobileViewMode, setMobileViewMode] = useState<'rich' | 'compact'>('rich');

  // スマホでの装備種別折りたたみ状態
  const [isFilterExpandedMobile, setIsFilterExpandedMobile] = useState<boolean>(false);

  // deals データを id をキーとしたマップに変換
  const dealsMap = useMemo(() => {
    const map = new Map<string, DealItem>();
    deals.forEach((d) => map.set(d.gear_id ?? d.id, d));
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
        isBestDeal: Boolean(gear.isBestDeal || deal?.isBestDeal),
      };
    });
  }, [gears, dealsMap]);

  // 40%OFF以上の商品数
  const superDealsCount = useMemo(() => {
    return combinedGears.filter((g) => g.discountRate >= 40).length;
  }, [combinedGears]);

  // 利用可能なギア種別一覧とその件数
  const gearTypeOptions = useMemo(() => {
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

      // 3. 超高割引率（40%OFF以上）
      if (onlySuperDeals && item.discountRate < 40) {
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
  }, [combinedGears, selectedSport, selectedGearType, onlySuperDeals, searchQuery]);

  // ソート処理
  const sortedGears = useMemo(() => {
    const list = [...filteredGears];
    switch (sortBy) {
      case 'discount_desc':
        list.sort((a, b) => (b.isBestDeal ? 1 : 0) - (a.isBestDeal ? 1 : 0) || b.discountRate - a.discountRate || (b.savedAmount - a.savedAmount));
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'recommended':
      default:
        list.sort((a, b) => (b.isBestDeal ? 1 : 0) - (a.isBestDeal ? 1 : 0) || (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.discountRate - a.discountRate);
        break;
    }
    return list;
  }, [filteredGears, sortBy]);

  // フィルター全解除
  const handleResetFilters = () => {
    setSelectedSport('all');
    setSelectedGearType('all');
    setSearchQuery('');
    setOnlySuperDeals(false);
    setSortBy('discount_desc');
  };

  // 楽天市場ダイレクト検索の実行（別タブでアフィリエイト付きURLを開く）
  const handleRakutenSearch = (e?: React.FormEvent, customWord?: string) => {
    if (e) e.preventDefault();
    const query = customWord ?? rakutenKeyword;
    if (!query.trim()) return;
    const url = buildRakutenSearchAffiliateUrl(query.trim());
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ページ先頭へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors w-full">
      {/* 1. ギアカタログ専用ヘッダーナビバー */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-amber-500/60 shadow-xl select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          {/* 戻るボタン ＆ サイトタイトル */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onBackToEvents}
              className="group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-750 hover:border-teal-400 transition-all text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              title="大会スケジュール一覧へ戻る"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden xs:inline">大会一覧へ</span>
              <span className="xs:hidden">大会へ</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center shadow-md font-black shrink-0">
                <ShoppingBag className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  <span>おすすめギア</span>
                  <span className="text-amber-400 text-[11px] sm:text-xs font-black px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40">
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
          <div className="flex items-center gap-2">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">
        {/* 2. 魅力的なヒーローバナーセクション（スマホではスリム化） */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-amber-500/40 p-4 sm:p-6 lg:p-8 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-2 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/50 text-amber-300 text-[11px] sm:text-xs font-black">
              <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse fill-red-500 shrink-0" />
              <span>全レース実戦検証 ＆ レギュレーション完全準拠</span>
            </div>

            <h2 className="text-lg sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              大会完走を勝ち取る、<br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-200">
                プロ厳選ギア ＆ リアルタイム最安値
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed hidden xs:block">
              100マイル、過酷なアドベンチャーレース、ロングライド、ウルトラマラソンで実際に必携品として指定される定番装備を網羅。
              提携プロショップ・公式ストアおよび楽天市場の最新セール価格でお得に揃えられます。
            </p>

            {/* 3大メリットバッジ */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-1 text-[10px] sm:text-xs font-bold">
              <span className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                必携品チェックリスト直結
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                提携プロショップ＆公式通販対応
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                楽天ポイント還元＆セール連動
              </span>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* ★【新設】公式提携プロショップ＆ブランド 特設セクション★ */}
        {/* ======================================================== */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 border-2 border-teal-500/50 p-4 sm:p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-500/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black">
                <Store className="w-4.5 h-4.5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>厳選プロショップ ＆ ブランドパートナー</span>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-400/40 px-2 py-0.5 rounded-full font-bold">
                    公式提携
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 font-medium">
                  中四国・全国のトレイルランナーを支える実力派専門店と、アスリート御用達の国産ブランドをご紹介
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* パートナー1：INNER FACT */}
            <div className="rounded-xl bg-slate-950/70 border border-amber-500/40 p-4 space-y-3 flex flex-col justify-between hover:border-amber-400 transition-all shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black">
                      BRAND
                    </span>
                    <h4 className="text-base font-black text-amber-300">
                      INNER FACT（インナーファクト）
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">国産アスリートブランド</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  天然ラミー（麻）素材が生み出す**「マメ・靴擦れゼロ」「股擦れゼロ」**の圧倒的実力。過酷な100マイルやウルトラマラソンを走破するトップランナーから絶大な支持を集める必携ギア。
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-300 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">ラミー五本指ソックス</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">足袋型ソックス</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">無縫製インナーパンツ</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-800">
                <a
                  href="https://inner-fact.co.jp/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer text-center"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>公式サイトを見る（全商品・最新情報）</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => handleRakutenSearch(undefined, 'インナーファクト')}
                  className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>楽天で探す</span>
                </button>
              </div>
            </div>

            {/* パートナー2：RUNPLUS */}
            <div className="rounded-xl bg-slate-950/70 border border-teal-500/40 p-4 space-y-3 flex flex-col justify-between hover:border-teal-400 transition-all shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-teal-500 text-slate-950 text-[10px] font-black">
                      PRO SHOP
                    </span>
                    <h4 className="text-base font-black text-teal-300">
                      RUNPLUS（ランプラス）
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">広島市実店舗 ＆ 公式通販</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  広島市にある**マウンテンランニング（トレイルランニング / 軽ハイキング）専門店**。Teton Bros.やOMMなど、山岳レースで真に役立つ実戦ギアを厳選セレクト。中四国のアウトドアシーンを支える拠点。
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-300 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Teton Bros. 取扱</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">OMM 厳選ギア</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">実店舗・装備相談</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-800">
                <a
                  href="https://runplus.shopselect.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer text-center"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>RUNPLUS 公式通販ストアを見る</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://www.facebook.com/runplus.hiroshima/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  <span>実店舗情報</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* ★楽天市場 公式ギア＆補給食 最安値検索バナー★ */}
        {/* ======================================================== */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-slate-950 border-2 border-red-600/70 p-3.5 sm:p-5 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            {/* バナーヘッダー */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-md shadow-md tracking-wider flex items-center gap-1">
                  <span>Rakuten</span>
                  <span className="text-[10px] bg-white text-red-700 px-1 rounded font-black">楽天市場</span>
                </span>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                  <span>ギア・補給食・消耗品 最安値サーチ</span>
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-bold bg-slate-900/80 border border-amber-500/30 px-2 py-1 rounded-lg w-fit">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>楽天ポイント付与＆セール価格対応</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              当カタログ掲載外の<strong className="text-amber-300">「他メーカー品」「別サイズ・カラー」「ジェルなどの補給食・消耗品」</strong>も、こちらから楽天市場を一括検索できます。
            </p>

            {/* 検索フォーム */}
            <form onSubmit={handleRakutenSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rakutenKeyword}
                  onChange={(e) => setRakutenKeyword(e.target.value)}
                  placeholder="楽天市場で探す（例: インナーファクト, ノースフェイス ザック, モルテン...）"
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-red-500 transition-all"
                />
                {rakutenKeyword && (
                  <button
                    type="button"
                    onClick={() => setRakutenKeyword('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs sm:text-sm font-black shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>楽天市場で最安値を検索</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* ワンタップ検索タグ */}
            <div className="pt-1">
              <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                <span>🔥 人気キーワードをワンタップで楽天検索：</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SEARCH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRakutenSearch(undefined, tag)}
                    className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-red-950/80 hover:text-amber-300 text-slate-200 border border-slate-700 hover:border-red-500 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{tag}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. 区分・カテゴリー選択セクション（スマホ最適化UI） */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
          {/* ① 競技区分タブ（スマホでは横スクロールで省スペース化） */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>1. 参戦競技から選ぶ</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                該当: {filteredGears.length} 件
              </span>
            </div>

            {/* PC向けグリッド / スマホ向け横スクロール */}
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                      setSelectedGearType('all');
                    }}
                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer shrink-0 sm:shrink ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-800 dark:bg-teal-600 dark:border-teal-500 shadow-md ring-2 ring-teal-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-black whitespace-nowrap">{tab.label}</div>
                      <div className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {tab.count} 品目
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ② 装備種別（gearType）フィルター（スマホ向け折りたたみ対応） */}
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>2. 装備の種類で絞り込む</span>
              </h3>
              <div className="flex items-center gap-2">
                {selectedGearType !== 'all' && (
                  <button
                    onClick={() => setSelectedGearType('all')}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    種別解除
                  </button>
                )}
                <button
                  onClick={() => setIsFilterExpandedMobile(!isFilterExpandedMobile)}
                  className="sm:hidden text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <span>{isFilterExpandedMobile ? '閉じる' : 'すべて見る'}</span>
                  {isFilterExpandedMobile ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* 種別ピル一覧 */}
            <div className={`flex flex-wrap gap-1.5 sm:gap-2 ${!isFilterExpandedMobile ? 'max-h-16 overflow-hidden sm:max-h-none' : ''}`}>
              <button
                onClick={() => setSelectedGearType('all')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedGearType === 'all'
                    ? 'bg-slate-900 text-white border-slate-950 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-250 dark:border-slate-700 hover:bg-slate-200'
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
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-xs ring-2 ring-amber-400/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-250 dark:border-slate-700 hover:bg-slate-200'
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

          {/* ③ サイト内検索バー ＆ ソート ＆ 特価フィルター */}
          <div className="pt-2 border-t border-slate-150 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
            {/* キーワード検索 */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="カタログ内をキーワード検索（インナーファクト, ティートンブロス...）"
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
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between sm:justify-start">
              {/* 40%OFF以上超目玉特価チェック */}
              <label className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-black cursor-pointer transition-all select-none shadow-xs ${
                onlySuperDeals
                  ? 'border-red-500 bg-red-600 text-white shadow-md ring-2 ring-red-400/40'
                  : 'border-red-300 dark:border-red-900/60 bg-red-50/90 dark:bg-red-950/40 text-red-900 dark:text-red-200 hover:bg-red-100'
              }`}>
                <input
                  type="checkbox"
                  checked={onlySuperDeals}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOnlySuperDeals(checked);
                    if (checked) {
                      setSortBy('discount_desc');
                    }
                  }}
                  className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
                />
                <Flame className={`w-3.5 h-3.5 ${onlySuperDeals ? 'text-amber-300 fill-amber-300 animate-bounce' : 'text-red-600 fill-red-600'}`} />
                <span>40%OFF超特価のみ</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  onlySuperDeals ? 'bg-white/25 text-white' : 'bg-red-200 dark:bg-red-900/80 text-red-900 dark:text-red-200'
                }`}>
                  {superDealsCount}件
                </span>
              </label>

              {/* ソート順セレクタ */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">並び替え:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="discount_desc">割引率順（おすすめ）</option>
                  <option value="recommended">新着順</option>
                  <option value="price_asc">価格が安い順</option>
                  <option value="price_desc">価格が高い順</option>
                </select>
              </div>

              {/* リセットボタン */}
              {(selectedSport !== 'all' || selectedGearType !== 'all' || searchQuery || onlySuperDeals) && (
                <button
                  onClick={handleResetFilters}
                  className="px-2 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="すべての検索条件をリセット"
                >
                  <RotateCcw className="w-3 h-3" />
                  解除
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* スマホ専用：表示モード切り替え（詳細紹介 vs 2列コンパクト） */}
        {/* ======================================================== */}
        <div className="sm:hidden flex items-center justify-between bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-300">
            <span>表示形式：</span>
            <span className="text-teal-600 dark:text-teal-400">
              {mobileViewMode === 'rich' ? '📖 詳細紹介モード' : '⚡ 2列コンパクトモード'}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-250 dark:border-slate-700">
            <button
              onClick={() => setMobileViewMode('rich')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                mobileViewMode === 'rich'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>詳細重視</span>
            </button>
            <button
              onClick={() => setMobileViewMode('compact')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                mobileViewMode === 'compact'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2列一覧</span>
            </button>
          </div>
        </div>

        {/* 4. おすすめ商品カードグリッド一覧 */}
        {sortedGears.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4">
            <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto stroke-[1.5]" />
            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-200">
              カタログ内に該当するギアが見つかりませんでした
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              絞り込み条件を変更するか、下のボタンから楽天市場全品から探してみてください。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                onClick={handleResetFilters}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>絞り込み条件をリセットする</span>
              </button>
              {searchQuery && (
                <button
                  onClick={() => handleRakutenSearch(undefined, searchQuery)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 text-white text-xs font-black shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  <span>「{searchQuery}」を楽天市場で全件検索</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`grid gap-3 sm:gap-5 ${
            mobileViewMode === 'compact'
              ? 'grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            {sortedGears.map((item) => {
              // 楽天市場での別型番・類似品検索用URL（アフィリエイト付き）
              const rakutenAlternativeSearchUrl = buildRakutenSearchAffiliateUrl(
                `${item.brand ? item.brand + ' ' : ''}${item.title}`
              );

              // 提携ショップ品（RUNPLUSなど）かどうかの判定
              const isPartnerItem = item.id.startsWith('gear-runplus-');
              const isInnerFact = item.id.startsWith('gear-innerfact-');

              return (
                <div
                  key={item.id}
                  className={`group flex flex-col rounded-2xl transition-all duration-200 overflow-hidden relative ${
                    item.isBestDeal
                      ? 'bg-gradient-to-b from-amber-500/10 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900 border-2 border-amber-400 dark:border-amber-400 shadow-md hover:shadow-2xl ring-2 ring-amber-400/30'
                      : isPartnerItem || isInnerFact
                      ? 'bg-white dark:bg-slate-900 border-2 border-teal-500/50 dark:border-teal-500/60 hover:border-teal-400 shadow-sm hover:shadow-xl'
                      : 'bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-400 shadow-xs hover:shadow-xl'
                  }`}
                >
                  {/* 最安No.1特価品専用ハイライトトップバー */}
                  {item.isBestDeal ? (
                    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-slate-950 font-black text-[10px] sm:text-[11px] py-1 px-2.5 sm:px-3 flex items-center justify-between shadow-xs">
                      <span className="flex items-center gap-1 truncate">
                        <span>👑</span>
                        <span>カテゴリ最大値引き！No.1 目玉特価</span>
                      </span>
                      <span className="text-[9px] sm:text-[10px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded font-black shrink-0">
                        BEST DEAL
                      </span>
                    </div>
                  ) : (isPartnerItem || isInnerFact) ? (
                    <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white font-black text-[10px] sm:text-[11px] py-1 px-2.5 sm:px-3 flex items-center justify-between shadow-xs">
                      <span className="flex items-center gap-1 truncate">
                        <span>⭐</span>
                        <span>{isInnerFact ? '公式ブランドパートナー（INNER FACT）' : '提携専門店 RUNPLUS 厳選取扱'}</span>
                      </span>
                      <span className="text-[9px] bg-slate-950 text-teal-300 px-1.5 py-0.2 rounded font-black shrink-0">
                        OFFICIAL
                      </span>
                    </div>
                  ) : null}

                  {/* カード上部：画像 ＆ 各種セールバッジ */}
                  <div className="relative w-full aspect-square bg-white dark:bg-slate-950 p-3 sm:p-4 flex items-center justify-center border-b border-slate-150 dark:border-slate-800 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      onError={(e) => handleImageError(e, item.gearType)}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* 左上バッジ群：割引率 ＆ 定番 ＆ 新着 */}
                    <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                      {item.isBestDeal ? (
                        <span className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white font-black text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md shadow-lg border border-amber-300 leading-tight flex items-center gap-1">
                          <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                          <span>{item.discountRate}% OFF 最安</span>
                        </span>
                      ) : item.discountRate > 0 ? (
                        <span className="bg-red-600 text-white font-black text-[11px] sm:text-xs px-2 py-0.5 rounded-md shadow-md border border-white/80 leading-tight">
                          {item.discountRate}% OFF
                        </span>
                      ) : (
                        <span className="bg-slate-900/90 text-teal-300 font-extrabold text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded shadow border border-teal-500/30 leading-tight backdrop-blur-xs">
                          {item.badge || '必携定番'}
                        </span>
                      )}
                      {item.isNew && (
                        <span className="bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded shadow border border-white/90 leading-tight">
                          🆕 新着
                        </span>
                      )}
                    </div>

                    {/* 右上バッジ：ポイント還元 */}
                    {item.pointRate > 1 && (
                      <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-md shadow-md flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-red-600 text-red-600" />
                        <span>P{item.pointRate}倍</span>
                      </div>
                    )}

                    {/* ギア種別ピル */}
                    <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-xs text-white font-bold text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md">
                      {item.gearType}
                    </div>
                  </div>

                  {/* カード中部：商品詳細情報（スマホで超目立つレイアウトに刷新！） */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2.5 sm:space-y-3">
                    <div className="space-y-2">
                      {/* ブランド ＆ 対象スポーツピル */}
                      <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black truncate max-w-[150px]">
                          {item.brand || '厳選ギア'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.sports?.slice(0, 2).map((sp) => (
                            <span key={sp} className="text-[9px] sm:text-[10px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                              {sp === 'trail' ? 'トレイル' : sp === 'cycling' ? 'サイクル' : sp === 'marathon' ? 'マラソン' : 'アドベンチャー'}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 商品タイトル */}
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-amber-500 transition-colors">
                        {item.title}
                      </h4>

                      {/* ★【商品紹介の大幅強化】プロの選定理由・おすすめ解説★ */}
                      <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-slate-50 dark:from-amber-950/30 dark:via-slate-800/80 dark:to-slate-850 rounded-xl p-2.5 sm:p-3 border-2 border-amber-400/50 dark:border-amber-500/40 shadow-xs">
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-amber-800 dark:text-amber-300 mb-1">
                          <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 fill-amber-500" />
                          <span>プロ厳選！大会必携おすすめポイント</span>
                        </div>
                        <p className={`text-slate-800 dark:text-slate-200 font-bold leading-relaxed ${
                          mobileViewMode === 'compact' ? 'line-clamp-2 text-[10px]' : 'line-clamp-4 text-xs'
                        }`}>
                          {item.standardTitle}
                        </p>
                      </div>
                    </div>

                    {/* 価格 ＆ お得額（スマホでも一目でわかる大文字表示） */}
                    <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <div>
                          <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold">
                            {item.originalPrice > item.price ? 'セール特価（税込）' : '実売価格（税込）'}
                          </div>
                          <div className="text-lg sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                            {formatPrice(item.price)}
                          </div>
                        </div>

                        {item.originalPrice > item.price && (
                          <div className="text-right">
                            <div className="text-[9px] sm:text-[10px] text-slate-400 line-through font-mono">
                              定価 {formatPrice(item.originalPrice)}
                            </div>
                            <div className="text-[11px] sm:text-xs font-black text-red-600 dark:text-red-400 font-mono flex items-center justify-end gap-0.5">
                              <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>¥{item.savedAmount.toLocaleString()}引</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* アクションボタン群 */}
                      <div className="pt-2 flex flex-col gap-1.5">
                        {/* パターン1: RUNPLUS（提携BASEストア）商品の場合 */}
                        {isPartnerItem ? (
                          <>
                            <a
                              href={item.affiliateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
                            >
                              <Store className="w-3.5 h-3.5 shrink-0" />
                              <span>提携専門店 RUNPLUS 公式通販で購入</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            <a
                              href="https://runplus.shopselect.net/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-[10px] sm:text-[11px] transition-colors border border-slate-250 dark:border-slate-700 text-center"
                            >
                              <span>RUNPLUS 取扱一覧を見る</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            </a>
                          </>
                        ) : isInnerFact ? (
                          /* パターン2: INNER FACT（楽天＆公式併記）商品の場合 */
                          <>
                            <a
                              href={item.affiliateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                              <span>楽天市場の公式販売ページを開く</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            <a
                              href="https://inner-fact.co.jp/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-black text-[10px] sm:text-[11px] transition-colors border border-amber-300 dark:border-amber-700 text-center"
                            >
                              <Globe className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>INNER FACT 公式サイトで全商品を見る</span>
                              <ExternalLink className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            </a>
                          </>
                        ) : (
                          /* パターン3: 通常商品 */
                          <>
                            <a
                              href={item.affiliateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
                            >
                              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                              <span>楽天市場の公式販売ページを開く</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            <a
                              href={rakutenAlternativeSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-[10px] sm:text-[11px] transition-colors border border-slate-250 dark:border-slate-700 text-center"
                              title="楽天市場で他のサイズ・別メーカーの商品を検索"
                            >
                              <Search className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>他サイズ・別メーカーを楽天で検索</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======================================================== */}
        {/* 5. ページ下部：楽天市場全品サーチ案内バナー（離脱防止） */}
        {/* ======================================================== */}
        <section className="bg-gradient-to-r from-slate-900 via-red-950 to-slate-900 rounded-2xl border border-red-500/40 p-5 sm:p-6 text-white text-center space-y-3 shadow-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/30 border border-red-400 text-red-300 text-xs font-black">
            <Search className="w-3.5 h-3.5" />
            <span>お探しのギアが見つからないときは？</span>
          </div>
          <h3 className="text-base sm:text-xl font-black">
            楽天市場でアウトドア・トレラン用品をまとめて探す
          </h3>
          <p className="text-xs text-slate-300 max-w-xl mx-auto">
            他ブランドの最新シューズや消耗品（ジェル・電解質パウダー・テーピング）も、楽天市場のセール価格でお得に購入できます。
          </p>
          <div className="pt-1">
            <a
              href={buildRakutenSearchAffiliateUrl('トレイルランニング ギア 必携品')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs sm:text-sm shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>楽天市場のアウトドアギア特設を検索</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* 6. ページ下部：大会スケジュール一覧へのCTAリンク */}
        <section className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl border border-teal-500/40 p-5 sm:p-8 text-center text-white space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md">
            <Mountain className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-base sm:text-2xl font-black">
              装備が揃ったら、次のレースへ挑戦しよう！
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              全国＆中四国の厳選トレイルラン、ロングライド、アドベンチャーレース、ウルトラマラソンのエントリー状況を網羅しています。
            </p>
          </div>
          <button
            onClick={onBackToEvents}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer"
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
            ※価格・ポイント倍率は楽天市場および提携公式ストアの最新情報に基づきます。
          </p>
        </div>
      </footer>
    </div>
  );
};
