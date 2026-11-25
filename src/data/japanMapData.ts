/**
 * 日本地図マップ用の9地方ブロック・47都道府県・海外座標マスター定義
 * 添付画像イメージの9地方カラーリングと、events.json の表記ゆれ吸収・地理座標フォールバックを担当
 */

export type MapRegionId =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kinki'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu'
  | 'okinawa';

export interface MapRegionConfig {
  id: MapRegionId;
  name: string;        // 吹き出しヘッダー表記（例: "関東", "中国"）
  fullName: string;    // パンくず・見出し表記（例: "関東地方", "中国地方"）
  color: string;       // メインアクセント色
  dotColor: string;    // ドット基本色（ライト）
  dotColorDark: string;// ドット基本色（ダーク）
  hoverColor: string;  // ホバー時ハイライト色
  // 全国ビューSVG（viewBox 0 0 800 720 想定）における吹き出しアンカー座標（パーセント相当）
  calloutPos: { x: number; y: number; tailDir: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' };
}

export interface PrefectureMeta {
  code: number;          // JIS都道府県コード (1..47)
  name: string;          // 正式名称（例: "岡山県"）
  shortName: string;     // 短縮名（例: "岡山"）
  regionId: MapRegionId; // 所属9地方ブロック
  center: [number, number]; // 代表緯度経度 [lat, lng]
  defaultZoom: number;   // 県内表示時の標準ズーム
}

/** 9地方ブロック定義（添付画像イメージのカラー設計を踏襲） */
export const MAP_REGIONS: MapRegionConfig[] = [
  {
    id: 'hokkaido',
    name: '北海道',
    fullName: '北海道',
    color: '#38bdf8',
    dotColor: '#4bb4e6',
    dotColorDark: '#38bdf8',
    hoverColor: '#0284c7',
    calloutPos: { x: 475, y: 120, tailDir: 'bottom-right' },
  },
  {
    id: 'tohoku',
    name: '東北',
    fullName: '東北地方',
    color: '#14b8a6',
    dotColor: '#2aa89d',
    dotColorDark: '#2dd4bf',
    hoverColor: '#0f766e',
    calloutPos: { x: 645, y: 270, tailDir: 'bottom-left' },
  },
  {
    id: 'kanto',
    name: '関東',
    fullName: '関東地方',
    color: '#22c55e',
    dotColor: '#48b86d',
    dotColorDark: '#4ade80',
    hoverColor: '#15803d',
    calloutPos: { x: 615, y: 455, tailDir: 'bottom-left' },
  },
  {
    id: 'chubu',
    name: '中部',
    fullName: '中部地方',
    color: '#c2d33b',
    dotColor: '#c9d64f',
    dotColorDark: '#d9e354',
    hoverColor: '#84a216',
    calloutPos: { x: 400, y: 265, tailDir: 'bottom-right' },
  },
  {
    id: 'kinki',
    name: '近畿',
    fullName: '近畿地方',
    color: '#f5b041',
    dotColor: '#f0b254',
    dotColorDark: '#fbbf24',
    hoverColor: '#d97706',
    calloutPos: { x: 265, y: 340, tailDir: 'bottom-right' },
  },
  {
    id: 'chugoku',
    name: '中国',
    fullName: '中国地方',
    color: '#ef4444',
    dotColor: '#e2554e',
    dotColorDark: '#f87171',
    hoverColor: '#b91c1c',
    calloutPos: { x: 145, y: 410, tailDir: 'bottom-right' },
  },
  {
    id: 'shikoku',
    name: '四国',
    fullName: '四国地方',
    color: '#f97316',
    dotColor: '#e67e3c',
    dotColorDark: '#fb923c',
    hoverColor: '#c2410c',
    calloutPos: { x: 350, y: 635, tailDir: 'top-left' },
  },
  {
    id: 'kyushu',
    name: '九州',
    fullName: '九州地方',
    color: '#f472b6',
    dotColor: '#f19ab6',
    dotColorDark: '#f472b6',
    hoverColor: '#db2777',
    calloutPos: { x: 175, y: 635, tailDir: 'top-left' },
  },
  {
    id: 'okinawa',
    name: '沖縄',
    fullName: '沖縄県',
    color: '#a855f7',
    dotColor: '#a267a7',
    dotColorDark: '#c084fc',
    hoverColor: '#7e22ce',
    calloutPos: { x: 650, y: 625, tailDir: 'top-left' },
  },
];

export const MAP_REGION_BY_ID: Record<MapRegionId, MapRegionConfig> = Object.fromEntries(
  MAP_REGIONS.map((r) => [r.id, r])
) as Record<MapRegionId, MapRegionConfig>;

/** 47都道府県マスターデータ */
export const PREFECTURES_META: PrefectureMeta[] = [
  // 北海道
  { code: 1, name: '北海道', shortName: '北海道', regionId: 'hokkaido', center: [43.0642, 141.3469], defaultZoom: 7 },
  // 東北
  { code: 2, name: '青森県', shortName: '青森', regionId: 'tohoku', center: [40.8244, 140.7400], defaultZoom: 9 },
  { code: 3, name: '岩手県', shortName: '岩手', regionId: 'tohoku', center: [39.7036, 141.1527], defaultZoom: 8 },
  { code: 4, name: '宮城県', shortName: '宮城', regionId: 'tohoku', center: [38.2688, 140.8721], defaultZoom: 9 },
  { code: 5, name: '秋田県', shortName: '秋田', regionId: 'tohoku', center: [39.7186, 140.1024], defaultZoom: 9 },
  { code: 6, name: '山形県', shortName: '山形', regionId: 'tohoku', center: [38.2404, 140.3633], defaultZoom: 9 },
  { code: 7, name: '福島県', shortName: '福島', regionId: 'tohoku', center: [37.7503, 140.4676], defaultZoom: 9 },
  // 関東
  { code: 8, name: '茨城県', shortName: '茨城', regionId: 'kanto', center: [36.3418, 140.4468], defaultZoom: 9 },
  { code: 9, name: '栃木県', shortName: '栃木', regionId: 'kanto', center: [36.5657, 139.8836], defaultZoom: 9 },
  { code: 10, name: '群馬県', shortName: '群馬', regionId: 'kanto', center: [36.3907, 139.0604], defaultZoom: 9 },
  { code: 11, name: '埼玉県', shortName: '埼玉', regionId: 'kanto', center: [35.8570, 139.6489], defaultZoom: 10 },
  { code: 12, name: '千葉県', shortName: '千葉', regionId: 'kanto', center: [35.6051, 140.1233], defaultZoom: 9 },
  { code: 13, name: '東京都', shortName: '東京', regionId: 'kanto', center: [35.6895, 139.6917], defaultZoom: 10 },
  { code: 14, name: '神奈川県', shortName: '神奈川', regionId: 'kanto', center: [35.4478, 139.6425], defaultZoom: 10 },
  // 中部（甲信越・北陸・東海）
  { code: 15, name: '新潟県', shortName: '新潟', regionId: 'chubu', center: [37.9026, 139.0232], defaultZoom: 8 },
  { code: 16, name: '富山県', shortName: '富山', regionId: 'chubu', center: [36.6953, 137.2113], defaultZoom: 9 },
  { code: 17, name: '石川県', shortName: '石川', regionId: 'chubu', center: [36.5945, 136.6256], defaultZoom: 9 },
  { code: 18, name: '福井県', shortName: '福井', regionId: 'chubu', center: [36.0652, 136.2216], defaultZoom: 9 },
  { code: 19, name: '山梨県', shortName: '山梨', regionId: 'chubu', center: [35.6642, 138.5684], defaultZoom: 9 },
  { code: 20, name: '長野県', shortName: '長野', regionId: 'chubu', center: [36.6513, 138.1810], defaultZoom: 8 },
  { code: 21, name: '岐阜県', shortName: '岐阜', regionId: 'chubu', center: [35.3912, 136.7223], defaultZoom: 9 },
  { code: 22, name: '静岡県', shortName: '静岡', regionId: 'chubu', center: [34.9769, 138.3831], defaultZoom: 9 },
  { code: 23, name: '愛知県', shortName: '愛知', regionId: 'chubu', center: [35.1802, 136.9066], defaultZoom: 9 },
  // 近畿（三重含む7府県）
  { code: 24, name: '三重県', shortName: '三重', regionId: 'kinki', center: [34.7303, 136.5086], defaultZoom: 9 },
  { code: 25, name: '滋賀県', shortName: '滋賀', regionId: 'kinki', center: [35.0045, 135.8686], defaultZoom: 9 },
  { code: 26, name: '京都府', shortName: '京都', regionId: 'kinki', center: [35.0214, 135.7556], defaultZoom: 9 },
  { code: 27, name: '大阪府', shortName: '大阪', regionId: 'kinki', center: [34.6863, 135.5200], defaultZoom: 10 },
  { code: 28, name: '兵庫県', shortName: '兵庫', regionId: 'kinki', center: [34.6913, 135.1830], defaultZoom: 9 },
  { code: 29, name: '奈良県', shortName: '奈良', regionId: 'kinki', center: [34.6853, 135.8327], defaultZoom: 9 },
  { code: 30, name: '和歌山県', shortName: '和歌山', regionId: 'kinki', center: [34.2260, 135.1675], defaultZoom: 9 },
  // 中国
  { code: 31, name: '鳥取県', shortName: '鳥取', regionId: 'chugoku', center: [35.5039, 134.2377], defaultZoom: 9 },
  { code: 32, name: '島根県', shortName: '島根', regionId: 'chugoku', center: [35.4723, 133.0505], defaultZoom: 9 },
  { code: 33, name: '岡山県', shortName: '岡山', regionId: 'chugoku', center: [34.6618, 133.9344], defaultZoom: 9 },
  { code: 34, name: '広島県', shortName: '広島', regionId: 'chugoku', center: [34.3966, 132.4596], defaultZoom: 9 },
  { code: 35, name: '山口県', shortName: '山口', regionId: 'chugoku', center: [34.1861, 131.4705], defaultZoom: 9 },
  // 四国
  { code: 36, name: '徳島県', shortName: '徳島', regionId: 'shikoku', center: [34.0658, 134.5593], defaultZoom: 9 },
  { code: 37, name: '香川県', shortName: '香川', regionId: 'shikoku', center: [34.3401, 134.0434], defaultZoom: 10 },
  { code: 38, name: '愛媛県', shortName: '愛媛', regionId: 'shikoku', center: [33.8416, 132.7657], defaultZoom: 9 },
  { code: 39, name: '高知県', shortName: '高知', regionId: 'shikoku', center: [33.5597, 133.5311], defaultZoom: 9 },
  // 九州
  { code: 40, name: '福岡県', shortName: '福岡', regionId: 'kyushu', center: [33.6064, 130.4183], defaultZoom: 9 },
  { code: 41, name: '佐賀県', shortName: '佐賀', regionId: 'kyushu', center: [33.2494, 130.2988], defaultZoom: 10 },
  { code: 42, name: '長崎県', shortName: '長崎', regionId: 'kyushu', center: [32.7448, 129.8737], defaultZoom: 9 },
  { code: 43, name: '熊本県', shortName: '熊本', regionId: 'kyushu', center: [32.7898, 130.7417], defaultZoom: 9 },
  { code: 44, name: '大分県', shortName: '大分', regionId: 'kyushu', center: [33.2382, 131.6126], defaultZoom: 9 },
  { code: 45, name: '宮崎県', shortName: '宮崎', regionId: 'kyushu', center: [31.9111, 131.4239], defaultZoom: 9 },
  { code: 46, name: '鹿児島県', shortName: '鹿児島', regionId: 'kyushu', center: [31.5602, 130.5581], defaultZoom: 9 },
  // 沖縄
  { code: 47, name: '沖縄県', shortName: '沖縄', regionId: 'okinawa', center: [26.2124, 127.6809], defaultZoom: 9 },
];

export const PREFECTURE_BY_CODE: Record<number, PrefectureMeta> = Object.fromEntries(
  PREFECTURES_META.map((p) => [p.code, p])
);

export const PREFECTURE_BY_NAME: Record<string, PrefectureMeta> = Object.fromEntries(
  PREFECTURES_META.map((p) => [p.name, p])
);

/**
 * 大会データの prefecture から9地方ブロックID（または海外）を決定的に解決する
 * events.json の region 表記ゆれ（「関西/近畿」「東海/甲信越/中部」など）に左右されない
 */
export function getMapRegionIdByPrefecture(prefecture: string): MapRegionId | 'overseas' {
  const meta = PREFECTURE_BY_NAME[prefecture?.trim()];
  return meta ? meta.regionId : 'overseas';
}

/** P1フィルターの region 名との相互変換用 */
export function getP1RegionFilterValue(regionId: MapRegionId | 'overseas'): string {
  switch (regionId) {
    case 'hokkaido':
      return '北海道';
    case 'tohoku':
      return '東北';
    case 'kanto':
      return '関東';
    case 'chubu':
      return '中部';
    case 'kinki':
      return '近畿';
    case 'chugoku':
      return '中国';
    case 'shikoku':
      return '四国';
    case 'kyushu':
    case 'okinawa':
      return '九州';
    case 'overseas':
      return '海外';
  }
}

/** 海外主要国・地域の代表座標 [lat, lng] */
export const OVERSEAS_COORDS: Record<string, [number, number]> = {
  ニュージーランド: [-43.5321, 172.6362],
  フランス: [45.9237, 6.8694],
  スペイン: [42.6000, -8.5500],
  アメリカ: [40.0150, -105.2705],
  チリ: [-39.2817, -71.9544],
  メキシコ: [17.0732, -96.7266],
  モロッコ: [31.6295, -7.9811],
  フィンランド: [61.2500, 28.7000],
  クロアチア: [45.1000, 15.2000],
  海外: [25.0000, 15.0000],
};
