/**
 * scripts/build_japan_dot_grid.mjs
 *
 * 日本全国47都道府県のGeoJSONから、添付画像風の美しいドットマトリクス日本地図データ
 * （src/data/japanDotGrid.ts）を自動生成するスクリプト。
 *
 * 実行方法: node scripts/build_japan_dot_grid.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src', 'data', 'japanDotGrid.ts');
const CACHE_GEOJSON_PATH = path.join(__dirname, 'japan_prefectures_cache.geojson');

// 都道府県名 -> JISコード (1..47) マッピング
const PREF_NAME_TO_CODE = {
  北海道: 1, 青森県: 2, 岩手県: 3, 宮城県: 4, 秋田県: 5, 山形県: 6, 福島県: 7,
  茨城県: 8, 栃木県: 9, 群馬県: 10, 埼玉県: 11, 千葉県: 12, 東京都: 13, 神奈川県: 14,
  新潟県: 15, 富山県: 16, 石川県: 17, 福井県: 18, 山梨県: 19, 長野県: 20,
  岐阜県: 21, 静岡県: 22, 愛知県: 23, 三重県: 24,
  滋賀県: 25, 京都府: 26, 大阪府: 27, 兵庫県: 28, 奈良県: 29, 和歌山県: 30,
  鳥取県: 31, 島根県: 32, 岡山県: 33, 広島県: 34, 山口県: 35,
  徳島県: 36, 香川県: 37, 愛媛県: 38, 高知県: 39,
  福岡県: 40, 佐賀県: 41, 長崎県: 42, 熊本県: 43, 大分県: 44, 宮崎県: 45, 鹿児島県: 46,
  沖縄県: 47,
};

// 英語表記（dataofjapan/land の properties.nam 用）フォールバック
const EN_NAME_TO_CODE = {
  hokkaido: 1, aomori: 2, iwate: 3, miyagi: 4, akita: 5, yamagata: 6, fukushima: 7,
  ibaraki: 8, tochigi: 9, gunma: 10, saitama: 11, chiba: 12, tokyo: 13, kanagawa: 14,
  niigata: 15, toyama: 16, ishikawa: 17, fukui: 18, yamanashi: 19, nagano: 20,
  gifu: 21, shizuoka: 22, aichi: 23, mie: 24,
  shiga: 25, kyoto: 26, osaka: 27, hyogo: 28, nara: 29, wakayama: 30,
  tottori: 31, shimane: 32, okayama: 33, hiroshima: 34, yamaguchi: 35,
  tokushima: 36, kagawa: 37, ehime: 38, kochi: 39,
  fukuoka: 40, saga: 41, nagasaki: 42, kumamoto: 43, oita: 44, miyazaki: 45, kagoshima: 46,
  okinawa: 47,
};

// 県庁所在地（小面積県などの最低ドット保証用フォールバック）
const PREF_CENTERS = {
  1: [43.064, 141.347], 2: [40.824, 140.740], 3: [39.704, 141.153], 4: [38.269, 140.872],
  5: [39.719, 140.102], 6: [38.240, 140.363], 7: [37.750, 140.468], 8: [36.342, 140.447],
  9: [36.566, 139.884], 10: [36.391, 139.060], 11: [35.857, 139.649], 12: [35.605, 140.123],
  13: [35.689, 139.692], 14: [35.448, 139.642], 15: [37.902, 139.023], 16: [36.695, 137.211],
  17: [36.594, 136.626], 18: [36.065, 136.222], 19: [35.664, 138.568], 20: [36.651, 138.181],
  21: [35.391, 136.722], 22: [34.977, 138.383], 23: [35.180, 136.907], 24: [34.730, 136.509],
  25: [35.004, 135.869], 26: [35.021, 135.756], 27: [34.686, 135.520], 28: [34.691, 135.183],
  29: [34.685, 135.833], 30: [34.226, 135.168], 31: [35.504, 134.238], 32: [35.472, 133.051],
  33: [34.662, 133.935], 34: [34.397, 132.460], 35: [34.186, 131.471], 36: [34.066, 134.559],
  37: [34.340, 134.043], 38: [33.842, 132.766], 39: [33.560, 133.531], 40: [33.606, 130.418],
  41: [33.249, 130.299], 42: [32.745, 129.874], 43: [32.790, 130.742], 44: [33.238, 131.613],
  45: [31.911, 131.424], 46: [31.560, 130.558], 47: [26.212, 127.681],
};

const GEOJSON_URLS = [
  'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson',
  'https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/prefectures.json',
];

async function loadGeoJson() {
  if (fs.existsSync(CACHE_GEOJSON_PATH)) {
    console.log('キャッシュ済みGeoJSONを使用します:', CACHE_GEOJSON_PATH);
    return JSON.parse(fs.readFileSync(CACHE_GEOJSON_PATH, 'utf8'));
  }
  for (const url of GEOJSON_URLS) {
    try {
      console.log('GeoJSONを取得中:', url);
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && Array.isArray(json.features) && json.features.length >= 47) {
        fs.writeFileSync(CACHE_GEOJSON_PATH, JSON.stringify(json));
        console.log(`取得成功: ${json.features.length} フィーチャー`);
        return json;
      }
    } catch (err) {
      console.warn('取得失敗:', url, err.message);
    }
  }
  throw new Error('日本の都道府県GeoJSONを取得できませんでした。');
}

function resolvePrefCode(props) {
  if (!props) return null;
  if (typeof props.id === 'number' && props.id >= 1 && props.id <= 47) return props.id;
  if (typeof props.id === 'string' && /^\d+$/.test(props.id)) {
    const n = Number(props.id);
    if (n >= 1 && n <= 47) return n;
  }
  if (typeof props.pref === 'number' && props.pref >= 1 && props.pref <= 47) return props.pref;
  const namJa = String(props.nam_ja || props.name_ja || props.N03_001 || '').trim();
  if (PREF_NAME_TO_CODE[namJa]) return PREF_NAME_TO_CODE[namJa];
  const nam = String(props.nam || props.name || '').toLowerCase();
  for (const [key, code] of Object.entries(EN_NAME_TO_CODE)) {
    if (nam.includes(key)) return code;
  }
  return null;
}

// 点がポリゴン（外周リング + 穴リング）の内部にあるか判定（Ray Casting）
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng, lat, rings) {
  if (!rings || rings.length === 0) return false;
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

function pointInGeometry(lng, lat, geom) {
  if (!geom) return false;
  if (geom.type === 'Polygon') {
    return pointInPolygon(lng, lat, geom.coordinates);
  }
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (pointInPolygon(lng, lat, poly)) return true;
    }
  }
  return false;
}

// ポリゴンバウンディングボックスを事前計算して高速化
function computeBBox(geom) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  const visitRing = (ring) => {
    for (const pt of ring) {
      if (pt[0] < minLng) minLng = pt[0];
      if (pt[0] > maxLng) maxLng = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[1] > maxLat) maxLat = pt[1];
    }
  };
  if (geom.type === 'Polygon') {
    geom.coordinates.forEach(visitRing);
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach((p) => p.forEach(visitRing));
  }
  return { minLng, maxLng, minLat, maxLat };
}

async function main() {
  const geo = await loadGeoJson();

  const prefFeatures = [];
  for (const f of geo.features) {
    const code = resolvePrefCode(f.properties);
    if (!code) continue;
    prefFeatures.push({
      code,
      geom: f.geometry,
      bbox: computeBBox(f.geometry),
    });
  }

  console.log(`有効都道府県フィーチャー数: ${prefFeatures.length}`);

  // グリッド設計（添付画像のような見やすく美しいプロポーション）
  // 本土エリア: cols 0..55 (56列), rows 0..53 (54行)
  // ※ 緯度30.8(九州南端)〜45.6(宗谷岬)、経度129.4(長崎五島)〜145.8(根室)
  //    日本は緯度1度あたり約111km、経度1度あたり約88km(緯度37度付近)なので、
  //    縦横比を自然に保つため latDeg/row ≈ 0.275, lngDeg/col ≈ 0.30 とする
  const GRID_COLS = 58;
  const GRID_ROWS = 56;
  const MAIN_MIN_LNG = 129.3;
  const MAIN_MAX_LNG = 146.1;
  const MAIN_MIN_LAT = 30.8;
  const MAIN_MAX_LAT = 45.6;

  // 沖縄インセット領域（右下枠内）: cols 37..55, rows 41..53
  // 沖縄本島〜先島諸島（経度 123.6..128.4, 緯度 24.1..27.1）を拡大配置
  const OKI_COL_START = 38;
  const OKI_COL_END = 53;
  const OKI_ROW_START = 41;
  const OKI_ROW_END = 52;
  const OKI_MIN_LNG = 123.6;
  const OKI_MAX_LNG = 128.4;
  const OKI_MIN_LAT = 24.0;
  const OKI_MAX_LAT = 27.1;

  const dotsMap = new Map(); // "col,row" -> { col, row, code }

  // 1. 本土46都道府県のサンプリング（2x2サブセルの多点判定＋県庁所在地フォールバックで小島や細い半島も拾う）
  const mainlandFeatures = prefFeatures.filter((p) => p.code !== 47);
  const findMainlandPrefAt = (lng, lat) => {
    for (const pf of mainlandFeatures) {
      if (
        lng >= pf.bbox.minLng &&
        lng <= pf.bbox.maxLng &&
        lat >= pf.bbox.minLat &&
        lat <= pf.bbox.maxLat &&
        pointInGeometry(lng, lat, pf.geom)
      ) {
        return pf.code;
      }
    }
    return null;
  };

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      // 右下の沖縄インセットエリアは本土サンプリングをスキップ（沖縄と重ならないようにする）
      if (col >= OKI_COL_START - 2 && row >= OKI_ROW_START - 2) continue;

      const baseLng = MAIN_MIN_LNG + (col / (GRID_COLS - 1)) * (MAIN_MAX_LNG - MAIN_MIN_LNG);
      const baseLat = MAIN_MAX_LAT - (row / (GRID_ROWS - 1)) * (MAIN_MAX_LAT - MAIN_MIN_LAT);
      const stepLng = (MAIN_MAX_LNG - MAIN_MIN_LNG) / (GRID_COLS - 1);
      const stepLat = (MAIN_MAX_LAT - MAIN_MIN_LAT) / (GRID_ROWS - 1);

      // 中央＋4点オフセットで細長い半島や島を検知（多数決）
      const samples = [
        [baseLng, baseLat],
        [baseLng - stepLng * 0.25, baseLat + stepLat * 0.25],
        [baseLng + stepLng * 0.25, baseLat + stepLat * 0.25],
        [baseLng - stepLng * 0.25, baseLat - stepLat * 0.25],
        [baseLng + stepLng * 0.25, baseLat - stepLat * 0.25],
      ];

      const counts = new Map();
      for (const [sLng, sLat] of samples) {
        // 伊豆諸島・小笠原諸島の遠方離島（東京都が南方に飛びすぎるのを防ぐ）
        if (sLat < 30.8) continue;
        const code = findMainlandPrefAt(sLng, sLat);
        if (code) {
          counts.set(code, (counts.get(code) || 0) + 1);
        }
      }

      if (counts.size > 0) {
        // 中央点があればそれを優先、なければ最多得票
        const centerCode = findMainlandPrefAt(baseLng, baseLat);
        let bestCode = centerCode;
        if (!bestCode) {
          let maxC = -1;
          for (const [c, cnt] of counts.entries()) {
            if (cnt > maxC) {
              maxC = cnt;
              bestCode = c;
            }
          }
        }
        if (bestCode) {
          dotsMap.set(`${col},${row}`, { col, row, code: bestCode });
        }
      }
    }
  }

  // 2. 小面積県（東京・大阪・香川など）が最低3ドット以上あるか確認・保証
  const countByPref = () => {
    const c = new Map();
    for (const d of dotsMap.values()) {
      c.set(d.code, (c.get(d.code) || 0) + 1);
    }
    return c;
  };

  let counts = countByPref();
  for (let code = 1; code <= 46; code++) {
    const cnt = counts.get(code) || 0;
    if (cnt < 2) {
      const [lat, lng] = PREF_CENTERS[code];
      const col = Math.round(((lng - MAIN_MIN_LNG) / (MAIN_MAX_LNG - MAIN_MIN_LNG)) * (GRID_COLS - 1));
      const row = Math.round(((MAIN_MAX_LAT - lat) / (MAIN_MAX_LAT - MAIN_MIN_LAT)) * (GRID_ROWS - 1));
      dotsMap.set(`${col},${row}`, { col, row, code });
      // 隣接が空いていればもう1つ追加してクリックしやすくする
      if (!dotsMap.has(`${col + 1},${row}`)) {
        dotsMap.set(`${col + 1},${row}`, { col: col + 1, row, code });
      }
      console.log(`小面積県のドット補強: code=${code} -> (${col}, ${row})`);
    }
  }

  // 3. 沖縄県インセット（code = 47）を右下枠内に配置
  const okinawaFeatures = prefFeatures.filter((p) => p.code === 47);
  const findOkinawaAt = (lng, lat) => {
    for (const pf of okinawaFeatures) {
      if (
        lng >= pf.bbox.minLng &&
        lng <= pf.bbox.maxLng &&
        lat >= pf.bbox.minLat &&
        lat <= pf.bbox.maxLat &&
        pointInGeometry(lng, lat, pf.geom)
      ) {
        return true;
      }
    }
    return false;
  };

  let okinawaDots = 0;
  for (let row = OKI_ROW_START; row <= OKI_ROW_END; row++) {
    for (let col = OKI_COL_START; col <= OKI_COL_END; col++) {
      const lng =
        OKI_MIN_LNG + ((col - OKI_COL_START) / (OKI_COL_END - OKI_COL_START)) * (OKI_MAX_LNG - OKI_MIN_LNG);
      const lat =
        OKI_MAX_LAT - ((row - OKI_ROW_START) / (OKI_ROW_END - OKI_ROW_START)) * (OKI_MAX_LAT - OKI_MIN_LAT);
      const stepLng = (OKI_MAX_LNG - OKI_MIN_LNG) / (OKI_COL_END - OKI_COL_START);
      const stepLat = (OKI_MAX_LAT - OKI_MIN_LAT) / (OKI_ROW_END - OKI_ROW_START);

      const hit =
        findOkinawaAt(lng, lat) ||
        findOkinawaAt(lng - stepLng * 0.3, lat + stepLat * 0.3) ||
        findOkinawaAt(lng + stepLng * 0.3, lat - stepLat * 0.3) ||
        findOkinawaAt(lng + stepLng * 0.3, lat + stepLat * 0.3) ||
        findOkinawaAt(lng - stepLng * 0.3, lat - stepLat * 0.3);

      if (hit) {
        dotsMap.set(`${col},${row}`, { col, row, code: 47 });
        okinawaDots++;
      }
    }
  }
  console.log(`沖縄インセットドット数: ${okinawaDots}`);

  const dots = Array.from(dotsMap.values()).sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
  counts = countByPref();

  // ASCIIアートで日本地図を確認表示
  console.log('\n=== 生成された日本ドットマップ プレビュー ===');
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(' '));
  for (const d of dots) {
    const regionChar =
      d.code === 1 ? '北' :
      d.code <= 7 ? '東' :
      d.code <= 14 ? '関' :
      d.code <= 23 ? '中' :
      d.code <= 30 ? '近' :
      d.code <= 35 ? '国' :
      d.code <= 39 ? '四' :
      d.code <= 46 ? '九' : '沖';
    grid[d.row][d.col] = regionChar;
  }
  for (let r = 0; r < GRID_ROWS; r++) {
    const line = grid[r].join('');
    if (line.trim()) {
      console.log(String(r).padStart(2, '0') + ': ' + line);
    }
  }

  console.log(`\n総ドット数: ${dots.length}`);
  console.log(`カバー都道府県数: ${counts.size} / 47`);
  const missing = [];
  for (let c = 1; c <= 47; c++) {
    if (!counts.get(c)) missing.push(c);
  }
  if (missing.length > 0) {
    console.warn('欠損都道府県コード:', missing);
  }

  // TypeScript ファイル書き出し
  const tupleLines = dots.map((d) => `[${d.col},${d.row},${d.code}]`);
  const tsContent = `// 自動生成ファイル（scripts/build_japan_dot_grid.mjs により生成）
// 形式: [col, row, prefCode] （prefCode: JIS都道府県コード 1〜47）

export const DOT_GRID_COLS = ${GRID_COLS};
export const DOT_GRID_ROWS = ${GRID_ROWS};

/**
 * 日本全国のドットマトリクス座標データ（全 ${dots.length} ドット / 47都道府県網羅）
 */
export const JAPAN_DOT_GRID: ReadonlyArray<readonly [number, number, number]> = [
  ${tupleLines.join(',')}
];
`;

  fs.writeFileSync(OUTPUT_PATH, tsContent, 'utf8');
  console.log('書き出し完了:', OUTPUT_PATH);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
