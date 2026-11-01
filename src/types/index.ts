export type EventCategory = 'trail' | 'adventure' | 'cycling' | 'marathon';
export type EntryStatus = 'open' | 'upcoming' | 'closing_soon' | 'closed';

export interface MandatoryGear {
  name: string;
  category: string;
}

export interface EventLinks {
  official: string | null;
  entry: string | null;
  review: string | null;
  sns: string | null;
}

export interface EventReview {
  rating: number;
  count: number;
}

export interface EventVenue {
  name: string;        // 正式な集合場所・受付会場・スタート地点（例: "道の駅ことなみ", "iti SETOUCHI"）
  address?: string;     // 集合場所の住所
  mapQuery?: string;    // Googleマップ用ピンポイント確定クエリ
}

export interface EventSource {
  portalName: 'RUNNET' | 'モシコム' | 'スポエンCYCLE' | 'スポーツエントリー' | '公式サイト' | '大会事務局' | string;
  portalUrl?: string;   // 大会情報を入手・検証した元サイトのURL
}

export interface RaceEvent {
  id: string;
  category: EventCategory;
  subCategory?: string; // 例: "MTBラリー", "アドベンチャーゲーム", "ロゲイニング", "100マイル" 等
  elements?: string[];  // 例: ["読図", "MTB", "パドル", "トレラン", "夜間"]
  title: string;
  date: string;         // 開始日（例: "2026-06-06"）
  end_date?: string;    // 終了日（2日間以上の大会用、例: "2026-06-07"）
  month: number;
  region: string;
  prefecture: string;
  distance_km: number;
  elevation_m: number;
  entry_fee: string;    // 例: "8,000円〜9,200円", "18,000円"
  entry_status: EntryStatus;
  entry_deadline: string;
  entry_start_date?: string; // エントリー受付開始日（例: "2026-04-01"）
  links: EventLinks;
  review?: EventReview | null;
  mandatory_gear: MandatoryGear[];
  venue?: EventVenue;   // 集合場所・受付場所データ（Googleマップ高精度連携用）
  source?: EventSource; // 大会情報の入手元ポータルデータ
}

export interface GearItem {
  id: string;
  sports: string[];        // ["trail", "adventure", "rogaining"] 等
  gearType: string;        // "レインジャケット", "ベースレイヤー" 等
  matchKeywords: string[]; // ["レインジャケット", "ゴアテックス", "レインウェア", "雨具"]
  title: string;           // 正式商品名
  brand?: string;          // ブランド
  standardTitle: string;   // 定番おすすめの解説
  standardUrl: string;     // 公式/定番サイトURL
  dealKeyword: string;     // 楽天セール検索ワード
  originalPrice?: number;
  minPrice?: number;
  price?: number;
  discountRate?: number;
  dealUrl?: string;
  imageUrl?: string;
}

export interface DealItem {
  id: string;
  title: string;
  category: string;
  price: number;
  original_price: number;
  discount_rate: number;
  point_rate: number;
  image_url: string;
  affiliate_url: string;
  badge: string;
  updated_at: string;
  registered_at?: string; // 新規登録日時（登録後1〜2日間のNEWバッジ判定用）
}

export type SortOption =
  | 'date-asc'
  | 'date-desc'
  | 'category-asc'
  | 'distance-asc'
  | 'distance-desc'
  | 'elevation-desc';

export interface FilterState {
  category: string;
  selectedCategories?: string[]; // 複数選択・除外対応の競技ジャンル（親）
  selectedElements?: string[];   // 複数選択対応の競技エレメント（子・特徴条件）
  region: string;
  prefecture: string;
  minDistance: number;
  maxDistance: number;
  entryStatus: string;
  searchKeyword: string;
  sortBy: SortOption;
  monthFilter?: string;    // 'all' | 'spring' | 'summer' | 'autumn' | 'winter' | '1'..'12'
  featureTag?: string;     // 後方互換用
  onlyFavorites?: boolean; // お気に入り・参戦予定のみ
}

export interface Preset {
  id: string;
  name: string;
  isDefault?: boolean;
  filters: FilterState;
}

export type ViewMode = 'table' | 'card';
