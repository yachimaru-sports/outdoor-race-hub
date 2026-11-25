/**
 * scripts/build_japan_pref_paths.mjs
 *
 * 日本47都道府県のGeoJSONから、全国ビュー（Lv.1）＆地方ズーム（Lv.2）共通の
 * くっきりした県境枠つき軽量SVGポリゴンデータ（src/data/japanPrefPaths.ts）を生成する。
 *
 * 実行方法: node scripts/build_japan_pref_paths.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'src', 'data', 'japanPrefPaths.ts');

const GEOJSON_URL = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson';

const BASE_LNG = 128.0;
const BASE_LAT = 46.0;
const COS36 = Math.cos((36 * Math.PI) / 180);
const SCALE = 50;

function projectXY(lng, lat) {
  return [
    (lng - BASE_LNG) * COS36 * SCALE,
    (BASE_LAT - lat) * SCALE,
  ];
}

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

const REGION_PREF_CODES = {
  hokkaido: [1],
  tohoku: [2, 3, 4, 5, 6, 7],
  kanto: [8, 9, 10, 11, 12, 13, 14],
  chubu: [15, 16, 17, 18, 19, 20, 21, 22, 23],
  kinki: [24, 25, 26, 27, 28, 29, 30],
  chugoku: [31, 32, 33, 34, 35],
  shikoku: [36, 37, 38, 39],
  kyushu: [40, 41, 42, 43, 44, 45, 46],
  okinawa: [47],
};

// 大型文字ラベルが密集県で重なりにくい微調整オフセット（投影後座標系 px）
const LABEL_OFFSET_PX = {
  8: [3, 0],     // 茨城
  9: [0, -3],    // 栃木
  10: [-3, -2],  // 群馬
  11: [-4, -4],  // 埼玉
  12: [8, 4],    // 千葉
  13: [-2, -1],  // 東京
  14: [1, 7],    // 神奈川
  24: [2, 5],    // 三重
  25: [5, -3],   // 滋賀
  26: [-8, -9],  // 京都（北部寄り）
  27: [-1, 3],   // 大阪
  28: [-9, -1],  // 兵庫
  29: [4, 7],    // 奈良
  30: [-2, 6],   // 和歌山
  31: [4, -2],   // 鳥取
  32: [-6, 3],   // 島根
  33: [2, 2],    // 岡山
  34: [-2, 1],   // 広島
  37: [0, -4],   // 香川
  36: [3, 3],    // 徳島
  38: [-4, -1],  // 愛媛
  39: [2, 3],    // 高知
  40: [4, -5],   // 福岡
  41: [-6, 2],   // 佐賀
  42: [-10, 4],  // 長崎
  44: [5, 0],    // 大分
};

function resolvePrefCode(props) {
  if (!props) return null;
  if (typeof props.id === 'number' && props.id >= 1 && props.id <= 47) return props.id;
  if (typeof props.id === 'string' && /^\d+$/.test(props.id)) {
    const n = Number(props.id);
    if (n >= 1 && n <= 47) return n;
  }
  const namJa = String(props.nam_ja || props.name_ja || '').trim();
  if (PREF_NAME_TO_CODE[namJa]) return PREF_NAME_TO_CODE[namJa];
  const nam = String(props.nam || props.name || '').toLowerCase();
  for (const [key, code] of Object.entries(EN_NAME_TO_CODE)) {
    if (nam.includes(key)) return code;
  }
  return null;
}

function isIncludedPolygon(code, ringLngLat) {
  if (!ringLngLat || ringLngLat.length < 3) return false;
  let sumLng = 0;
  let sumLat = 0;
  for (const pt of ringLngLat) {
    sumLng += pt[0];
    sumLat += pt[1];
  }
  const avgLng = sumLng / ringLngLat.length;
  const avgLat = sumLat / ringLngLat.length;

  if (code === 13 && avgLat < 34.8) return false; // 東京：伊豆南部・小笠原除外
  if (code === 46 && avgLat < 30.2) return false; // 鹿児島：トカラ・奄美以南除外
  if (code === 47 && (avgLat < 24.0 || avgLat > 27.2)) return false; // 沖縄範囲
  if (code === 32 && avgLat > 36.4) return false; // 島根：極端な遠方除外
  if (code === 1 && avgLng > 146.2) return false; // 北海道：北方四島遠端除外
  return true;
}

function ringMetrics(pts) {
  let area2 = 0;
  let cxAcc = 0;
  let cyAcc = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[i];
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cxAcc += (x0 + x1) * cross;
    cyAcc += (y0 + y1) * cross;
  }
  const area = Math.abs(area2) * 0.5;
  if (Math.abs(area2) < 1e-6) {
    const sx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return { area, cx: sx, cy: sy };
  }
  return {
    area,
    cx: cxAcc / (3 * area2),
    cy: cyAcc / (3 * area2),
  };
}

function calcBBox(pts) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function pointToSegmentDistSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    const px = p[0] - a[0];
    const py = p[1] - a[1];
    return px * px + py * py;
  }
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  const rx = p[0] - projX;
  const ry = p[1] - projY;
  return rx * rx + ry * ry;
}

function simplifyDouglasPeucker(pts, epsilon) {
  if (pts.length <= 4) return pts;
  const epsSq = epsilon * epsilon;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDistSq = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const dSq = pointToSegmentDistSq(pts[i], pts[start], pts[end]);
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        index = i;
      }
    }
    if (maxDistSq > epsSq && index !== -1) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) out.push(pts[i]);
  }
  return out;
}

function buildRingPath(pts) {
  const rounded = pts.map(([x, y]) => [Number(x.toFixed(1)), Number(y.toFixed(1))]);
  const dedup = [];
  for (const p of rounded) {
    const prev = dedup[dedup.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) {
      dedup.push(p);
    }
  }
  if (dedup.length < 3) return '';
  return 'M' + dedup.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
}

async function main() {
  console.log('GeoJSONを取得中:', GEOJSON_URL);
  const res = await fetch(GEOJSON_URL, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const geo = await res.json();

  const EPSILON = 0.7;
  const MIN_ISLAND_AREA = 1.8;

  const prefDataMap = {};

  for (const feature of geo.features) {
    const code = resolvePrefCode(feature.properties);
    if (!code) continue;

    const geom = feature.geometry;
    const rawPolygons =
      geom.type === 'Polygon'
        ? [geom.coordinates]
        : geom.type === 'MultiPolygon'
        ? geom.coordinates
        : [];

    const candidates = [];
    for (const polyRings of rawPolygons) {
      const outerLngLat = polyRings[0];
      if (!isIncludedPolygon(code, outerLngLat)) continue;
      const outerXY = outerLngLat.map(([lng, lat]) => projectXY(lng, lat));
      const metrics = ringMetrics(outerXY);
      candidates.push({ polyRings, outerXY, metrics });
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => b.metrics.area - a.metrics.area);
    const mainPoly = candidates[0];
    const mainSimplified = simplifyDouglasPeucker(mainPoly.outerXY, EPSILON);
    const mainBbox = calcBBox(mainSimplified);

    const kept = candidates.filter((c, idx) => idx === 0 || c.metrics.area >= MIN_ISLAND_AREA);
    const pathSegments = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const item of kept) {
      const simplifiedOuter = simplifyDouglasPeucker(item.outerXY, EPSILON);
      const outerPath = buildRingPath(simplifiedOuter);
      if (!outerPath) continue;
      pathSegments.push(outerPath);

      for (const [px, py] of simplifiedOuter) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }

      for (let h = 1; h < item.polyRings.length; h++) {
        const holeXY = item.polyRings[h].map(([lng, lat]) => projectXY(lng, lat));
        const hMetrics = ringMetrics(holeXY);
        if (hMetrics.area >= MIN_ISLAND_AREA) {
          const simplifiedHole = simplifyDouglasPeucker(holeXY, EPSILON);
          const holePath = buildRingPath(simplifiedHole);
          if (holePath) pathSegments.push(holePath);
        }
      }
    }

    const offset = LABEL_OFFSET_PX[code] || [0, 0];
    const labelX = Number((mainPoly.metrics.cx + offset[0]).toFixed(1));
    const labelY = Number((mainPoly.metrics.cy + offset[1]).toFixed(1));

    prefDataMap[code] = {
      d: pathSegments.join(' '),
      labelX,
      labelY,
      bbox: [
        Number(minX.toFixed(1)),
        Number(minY.toFixed(1)),
        Number(maxX.toFixed(1)),
        Number(maxY.toFixed(1)),
      ],
      mainBbox: mainBbox.map((v) => Number(v.toFixed(1))),
    };
  }

  const coveredCount = Object.keys(prefDataMap).length;
  console.log(`生成完了都道府県数: ${coveredCount} / 47`);
  if (coveredCount < 47) {
    throw new Error(`都道府県が不足しています: ${coveredCount}/47`);
  }

  // 9地方ごとの本土フィットタイト viewBox（余白 3.5%）
  const regionViewBoxes = {};
  for (const [regionId, codes] of Object.entries(REGION_PREF_CODES)) {
    let rMinX = Infinity;
    let rMinY = Infinity;
    let rMaxX = -Infinity;
    let rMaxY = -Infinity;
    // 沖縄は全諸島含めて表示、他地方は本土（最大ポリゴン）ベースで最大化しつつ淡路島・能登等も含まれる
    const useFullBbox = regionId === 'okinawa' || regionId === 'hokkaido';
    for (const c of codes) {
      const p = prefDataMap[c];
      if (!p) continue;
      const box = useFullBbox ? p.bbox : p.mainBbox;
      if (box[0] < rMinX) rMinX = box[0];
      if (box[1] < rMinY) rMinY = box[1];
      if (box[2] > rMaxX) rMaxX = box[2];
      if (box[3] > rMaxY) rMaxY = box[3];
    }
    // 四国・中国・近畿などで瀬戸内海の小島や淡路島が途切れないよう、少しだけ下限拡張
    const rawW = rMaxX - rMinX;
    const rawH = rMaxY - rMinY;
    const padX = Math.max(4, rawW * 0.045);
    const padY = Math.max(4, rawH * 0.045);
    regionViewBoxes[regionId] = {
      x: Number((rMinX - padX).toFixed(1)),
      y: Number((rMinY - padY).toFixed(1)),
      w: Number((rawW + padX * 2).toFixed(1)),
      h: Number((rawH + padY * 2).toFixed(1)),
    };
  }

  // 全国本土（code 1..46）のバウンディングボックスを算出して全国viewBoxを決定
  let natMinX = Infinity;
  let natMinY = Infinity;
  let natMaxX = -Infinity;
  let natMaxY = -Infinity;
  for (let c = 1; c <= 46; c++) {
    const p = prefDataMap[c];
    if (!p) continue;
    const box = c === 1 ? p.bbox : p.mainBbox;
    if (box[0] < natMinX) natMinX = box[0];
    if (box[1] < natMinY) natMinY = box[1];
    if (box[2] > natMaxX) natMaxX = box[2];
    if (box[3] > natMaxY) natMaxY = box[3];
  }

  // 左右に9地方吹き出しが美しく収まりつつ日本列島が主役になるバランス余白
  const natW = natMaxX - natMinX;
  const natH = natMaxY - natMinY;
  const nationalViewBox = {
    x: Number((natMinX - 180).toFixed(1)),
    y: Number((natMinY - 22).toFixed(1)),
    w: Number((natW + 340).toFixed(1)),
    h: Number((natH + 54).toFixed(1)),
  };

  const okinawaBox = prefDataMap[47].bbox;
  const okinawaInfo = {
    x: okinawaBox[0],
    y: okinawaBox[1],
    w: Number((okinawaBox[2] - okinawaBox[0]).toFixed(1)),
    h: Number((okinawaBox[3] - okinawaBox[1]).toFixed(1)),
  };

  const prefEntries = Object.entries(prefDataMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([code, data]) => `  ${code}: { d: '${data.d}', labelX: ${data.labelX}, labelY: ${data.labelY} }`)
    .join(',\n');

  const regionEntries = Object.entries(regionViewBoxes)
    .map(([id, vb]) => `  ${id}: { x: ${vb.x}, y: ${vb.y}, w: ${vb.w}, h: ${vb.h} }`)
    .join(',\n');

  const tsContent = `// 自動生成ファイル（scripts/build_japan_pref_paths.mjs により生成）
// 日本47都道府県のSVGポリゴンパス＆全国・地方別タイトviewBox＆共通投影関数

import type { MapRegionId } from './japanMapData';

export interface PrefSvgPathData {
  d: string;
  labelX: number;
  labelY: number;
}

export interface RegionViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BASE_LNG = ${BASE_LNG};
const BASE_LAT = ${BASE_LAT};
const COS36 = ${COS36.toFixed(10)};
const SCALE = ${SCALE};

/**
 * 緯度・経度（lat, lng）を県ポリゴンと同一のSVG座標（x, y）へ投影変換する
 */
export function projectLatLngToMapXY(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - BASE_LNG) * COS36 * SCALE,
    y: (BASE_LAT - lat) * SCALE,
  };
}

/** 全国ビュー（本土46都道府県＋沖縄インセット＋吹き出し余白）の標準viewBox */
export const NATIONAL_VIEWBOX: RegionViewBox = ${JSON.stringify(nationalViewBox)};

/** 沖縄インセット配置用の元のバウンディングボックス */
export const OKINAWA_BBOX: RegionViewBox = ${JSON.stringify(okinawaInfo)};

/** 9地方ブロックごとの本土フィット最適viewBox（余白約4.5%タイト設計） */
export const REGION_VIEWBOXES: Record<MapRegionId, RegionViewBox> = {
${regionEntries}
};

/** 47都道府県の簡略化SVGポリゴンパス（JISコード 1〜47） */
export const PREF_SVG_PATHS: Record<number, PrefSvgPathData> = {
${prefEntries}
};
`;

  fs.writeFileSync(OUTPUT_PATH, tsContent, 'utf8');
  const fileSizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
  console.log(`書き出し完了: ${OUTPUT_PATH} (${fileSizeKb} KB)`);
  console.log('NATIONAL_VIEWBOX:', nationalViewBox);
  console.log('OKINAWA_BBOX:', okinawaInfo);
  console.log('地方別viewBox:', JSON.stringify(regionViewBoxes, null, 2));
}

main().catch((err) => {
  console.error('ポリゴン生成エラー:', err);
  process.exit(1);
});
