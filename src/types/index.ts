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

export interface RaceEvent {
  id: string;
  category: EventCategory;
  subCategory?: string; // 例: "MTBラリー", "アドベンチャーゲーム", "ロゲイニング", "100マイル" 等
  elements?: string[];  // 例: ["読図", "MTB", "パドル", "トレラン", "夜間"]
  title: string;
  date: string;
  month: number;
  region: string;
  prefecture: string;
  distance_km: number;
  elevation_m: number;
  entry_fee: string;    // 例: "18,000円", "8,000円", "38,000円"
  entry_status: EntryStatus;
  entry_deadline: string;
  links: EventLinks;
  review?: EventReview | null;
  mandatory_gear: MandatoryGear[];
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
}

export type SortOption =
  | 'date-asc'
  | 'date-desc'
  | 'distance-asc'
  | 'distance-desc'
  | 'elevation-desc';

export interface FilterState {
  category: string;
  region: string;
  prefecture: string;
  minDistance: number;
  maxDistance: number;
  entryStatus: string;
  searchKeyword: string;
  sortBy: SortOption;
  monthFilter?: string;    // 'all' | 'spring' | 'summer' | 'autumn' | 'winter' | '1'..'12'
  featureTag?: string;     // 'all' | 'map' | 'mtb' | 'paddle' | 'rogaining' | 'night' | 'toretore'
  onlyFavorites?: boolean; // お気に入り・参戦予定のみ
}

export interface Preset {
  id: string;
  name: string;
  isDefault?: boolean;
  filters: FilterState;
}

export type ViewMode = 'table' | 'card';
