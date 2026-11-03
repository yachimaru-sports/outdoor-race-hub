import { FilterState, Preset } from '../types';

export const ALL_GENRES = ['trail', 'cycling', 'marathon', 'adventure', 'rogaining'] as const;

export const INITIAL_FILTERS: FilterState = {
  category: 'all',
  selectedCategories: ['trail', 'cycling', 'marathon', 'adventure', 'rogaining'],
  region: 'all',
  prefecture: 'all',
  minDistance: 0,
  maxDistance: 999, // 初期状態は全距離（国内・海外・100マイル・ARWSまで全レース同列表示）
  entryStatus: 'open_or_closing', // デフォルトで「申込可能（エントリー受付中＋締切間近）」を表示
  searchKeyword: '',
  sortBy: 'date-asc',
  monthFilter: 'all',
  featureTag: 'all',
  onlyFavorites: false,
};

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'preset-toretore-adventure',
    name: '🧭 とれとれバイク・アドベンチャー',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      featureTag: 'toretore',
    },
  },
  {
    id: 'preset-100mile-races',
    name: '👑 国内100マイルレース (160km級)',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      featureTag: '100mile',
      sortBy: 'date-asc',
    },
  },
  {
    id: 'preset-chugoku-all',
    name: '⛰️ 中国地方（広島・岡山・山口・島根・鳥取）',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      region: '中国',
    },
  },
  {
    id: 'preset-shikoku-all',
    name: '🌊 四国地方（愛媛・香川・徳島・高知）',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      region: '四国',
    },
  },
  {
    id: 'preset-map-navigation',
    name: '🗺️ 2.5万図・読図・ロゲイニング',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      featureTag: 'map',
    },
  },
  {
    id: 'preset-open-entries',
    name: '🟢 今すぐエントリー可能',
    isDefault: true,
    filters: {
      ...INITIAL_FILTERS,
      entryStatus: 'open_or_closing',
    },
  },
];
