/**
 * scripts/geocode_events.mjs
 *
 * src/data/events.json の全大会データ（国内・海外）に対して、
 * 開催会場・市区町村・都道府県代表の緯度・経度（venue.lat / venue.lng / venue.coordPrecision）を
 * 無料の公的API（国土地理院 住所検索API ＋ OpenStreetMap Nominatim）で自動付与するスクリプト。
 *
 * ※ 国土地理院APIが「県名のみ」に部分一致して県庁所在地を返す現象を自動検知し、
 *    OpenStreetMap Nominatim や市区町村・施設名検索へ自動フォールバックします。
 *
 * 既存の大会フィールド（date, links, mandatory_gear 等）は一切改変せず、venue のみ安全に拡張します。
 * 実行方法: npm run geocode:events
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');
const CACHE_PATH = path.join(__dirname, 'geocode_cache.json');
const FORCE_MODE = process.argv.includes('--force');

const UA = 'OutdoorRaceHubGeocoder/1.0 (+https://yachimaru-sports.github.io/outdoor-race-hub/)';

// 47都道府県ごとの代表座標 [lat, lng]・県庁所在地名・妥当範囲 [minLat, maxLat, minLng, maxLng]
const PREF_BOUNDS = {
  北海道: { capital: '札幌', center: [43.0642, 141.3469], box: [41.2, 45.7, 139.2, 146.0] },
  青森県: { capital: '青森市', center: [40.8244, 140.7400], box: [40.1, 41.6, 139.4, 141.8] },
  岩手県: { capital: '盛岡', center: [39.7036, 141.1527], box: [38.7, 40.5, 140.6, 142.2] },
  宮城県: { capital: '仙台', center: [38.2688, 140.8721], box: [37.7, 39.1, 140.2, 141.7] },
  秋田県: { capital: '秋田市', center: [39.7186, 140.1024], box: [38.8, 40.6, 139.6, 141.0] },
  山形県: { capital: '山形市', center: [38.2404, 140.3633], box: [37.7, 39.2, 139.5, 140.7] },
  福島県: { capital: '福島市', center: [37.7503, 140.4676], box: [36.7, 38.1, 139.1, 141.1] },
  茨城県: { capital: '水戸', center: [36.3418, 140.4468], box: [35.7, 36.9, 139.6, 140.9] },
  栃木県: { capital: '宇都宮', center: [36.5657, 139.8836], box: [36.1, 37.2, 139.3, 140.3] },
  群馬県: { capital: '前橋', center: [36.3907, 139.0604], box: [36.0, 37.1, 138.3, 139.7] },
  埼玉県: { capital: 'さいたま', center: [35.8570, 139.6489], box: [35.7, 36.3, 138.7, 139.95] },
  千葉県: { capital: '千葉市', center: [35.6051, 140.1233], box: [34.8, 36.15, 139.7, 141.0] },
  東京都: { capital: '新宿', center: [35.6895, 139.6917], box: [24.0, 35.95, 138.9, 154.0] },
  神奈川県: { capital: '横浜', center: [35.4478, 139.6425], box: [35.1, 35.7, 138.9, 139.85] },
  新潟県: { capital: '新潟市', center: [37.9026, 139.0232], box: [36.7, 38.6, 137.6, 140.0] },
  富山県: { capital: '富山市', center: [36.6953, 137.2113], box: [36.2, 37.1, 136.7, 137.8] },
  石川県: { capital: '金沢', center: [36.5945, 136.6256], box: [36.0, 37.9, 136.2, 137.4] },
  福井県: { capital: '福井市', center: [36.0652, 136.2216], box: [35.4, 36.35, 135.4, 136.9] },
  山梨県: { capital: '甲府', center: [35.6642, 138.5684], box: [35.15, 36.0, 138.15, 139.15] },
  長野県: { capital: '長野市', center: [36.6513, 138.1810], box: [35.15, 37.05, 137.3, 138.8] },
  岐阜県: { capital: '岐阜市', center: [35.3912, 136.7223], box: [35.1, 36.5, 136.25, 137.7] },
  静岡県: { capital: '静岡市', center: [34.9769, 138.3831], box: [34.5, 35.65, 137.45, 139.2] },
  愛知県: { capital: '名古屋', center: [35.1802, 136.9066], box: [34.55, 35.45, 136.65, 137.85] },
  三重県: { capital: '津市', center: [34.7303, 136.5086], box: [33.7, 35.3, 135.8, 136.98] },
  滋賀県: { capital: '大津', center: [35.0045, 135.8686], box: [34.75, 35.75, 135.75, 136.5] },
  京都府: { capital: '京都市', center: [35.0214, 135.7556], box: [34.7, 35.8, 134.8, 136.1] },
  大阪府: { capital: '大阪市', center: [34.6863, 135.5200], box: [34.25, 35.08, 135.08, 135.76] },
  兵庫県: { capital: '神戸', center: [34.6913, 135.1830], box: [34.15, 35.7, 134.2, 135.5] },
  奈良県: { capital: '奈良市', center: [34.6853, 135.8327], box: [33.85, 34.8, 135.55, 136.25] },
  和歌山県: { capital: '和歌山市', center: [34.2260, 135.1675], box: [33.4, 34.4, 135.0, 136.05] },
  鳥取県: { capital: '鳥取市', center: [35.5039, 134.2377], box: [35.0, 35.65, 133.1, 134.55] },
  島根県: { capital: '松江', center: [35.4723, 133.0505], box: [34.25, 36.4, 131.6, 133.45] },
  岡山県: { capital: '岡山市', center: [34.6618, 133.9344], box: [34.25, 35.35, 133.25, 134.45] },
  広島県: { capital: '広島市', center: [34.3966, 132.4596], box: [34.0, 35.15, 132.0, 133.5] },
  山口県: { capital: '山口市', center: [34.1861, 131.4705], box: [33.7, 34.85, 130.75, 132.4] },
  徳島県: { capital: '徳島市', center: [34.0658, 134.5593], box: [33.5, 34.3, 133.6, 134.85] },
  香川県: { capital: '高松', center: [34.3401, 134.0434], box: [34.0, 34.6, 133.4, 134.5] },
  愛媛県: { capital: '松山', center: [33.8416, 132.7657], box: [32.85, 34.35, 132.0, 133.7] },
  高知県: { capital: '高知市', center: [33.5597, 133.5311], box: [32.7, 33.92, 132.45, 134.35] },
  福岡県: { capital: '福岡市', center: [33.6064, 130.4183], box: [33.0, 34.05, 130.0, 131.25] },
  佐賀県: { capital: '佐賀市', center: [33.2494, 130.2988], box: [32.95, 33.65, 129.7, 130.58] },
  長崎県: { capital: '長崎市', center: [32.7448, 129.8737], box: [32.5, 34.75, 128.5, 130.4] },
  熊本県: { capital: '熊本市', center: [32.7898, 130.7417], box: [32.05, 33.25, 129.95, 131.35] },
  大分県: { capital: '大分市', center: [33.2382, 131.6126], box: [32.7, 33.75, 130.8, 132.15] },
  宮崎県: { capital: '宮崎市', center: [31.9111, 131.4239], box: [31.3, 32.88, 130.65, 131.9] },
  鹿児島県: { capital: '鹿児島市', center: [31.5602, 130.5581], box: [27.0, 32.35, 128.3, 131.25] },
  沖縄県: { capital: '那覇', center: [26.2124, 127.6809], box: [24.0, 27.95, 122.8, 131.4] },
};

const OVERSEAS_FALLBACK = {
  ニュージーランド: [-44.6961, 169.1321],
  フランス: [45.9237, 6.8694],
  スペイン: [42.6000, -8.5500],
  アメリカ: [40.0150, -105.2705],
  ハワイ: [21.3069, -157.8583],
  ホノルル: [21.3069, -157.8583],
  チリ: [-39.2817, -71.9544],
  メキシコ: [17.0732, -96.7266],
  モロッコ: [31.6295, -7.9811],
  フィンランド: [61.2500, 28.7000],
  クロアチア: [45.1000, 15.2000],
  海外: [25.0000, 15.0000],
};

const KNOWN_SPOT_COORDS = {
  'Mt.TAKAO BASE CAMP': [35.6327, 139.2698],
  '夕やけ小やけふれあいの里': [35.6642, 139.1932],
  '御岳山': [35.7830, 139.1496],
  '富栖の里': [34.9964, 134.5978],
  '道の駅ことなみ': [34.1282, 133.9022],
  'ホシアカリ山びこ': [34.0956, 132.5175],
  '備前国総社宮': [34.6873, 133.9612],
  '旧吹屋小学校': [34.8617, 133.4706],
  '総社市スポーツセンター': [34.6770, 133.7580],
  '白神山地': [40.5170, 140.1500],
  'サッポロ・テイネ': [43.0772, 141.1981],
  '富良野': [43.3421, 142.3832],
  'ホノルル': [21.2690, -157.8170],
};

const NOISE_VENUE_RE =
  /^(スタート|ゴール|受付|集合|予定|※前回実績|未定|詳細|要確認|\d+スポット|【.+】|.+の1周コース)$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isWithinPrefBox(prefecture, lat, lng) {
  const meta = PREF_BOUNDS[prefecture];
  if (!meta) return true;
  const [minLat, maxLat, minLng, maxLng] = meta.box;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/** 国土地理院APIが県名のみにマッチして県庁所在地を返しただけの偽ヒットかを判定 */
function isSuspiciousCapitalFallback(prefecture, query, lat, lng) {
  const meta = PREF_BOUNDS[prefecture];
  if (!meta) return false;
  const [cLat, cLng] = meta.center;
  const nearCapital = Math.abs(lat - cLat) < 0.008 && Math.abs(lng - cLng) < 0.008;
  if (!nearCapital) return false;
  // クエリ自身が県庁所在地やその施設を明示している場合は許容
  const cap = meta.capital.replace(/[市]$/, '');
  if (query.includes(cap) || query.includes('日本橋') || query.includes('東京')) return false;
  return true;
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

async function queryGsi(q) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((item) => item?.geometry?.coordinates?.length === 2)
        .map((item) => ({
          lat: Number(item.geometry.coordinates[1]),
          lng: Number(item.geometry.coordinates[0]),
          label: item.properties?.title || q,
        }));
    }
  } catch {
    // ignore
  }
  return null;
}

async function queryNominatim(q, isDomestic = true) {
  const countryParam = isDomestic ? '&countrycodes=jp' : '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3${countryParam}&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((item) => ({
        lat: Number(item.lat),
        lng: Number(item.lon),
        label: item.display_name || q,
      }));
    }
  } catch {
    // ignore
  }
  return null;
}

function buildCandidateQueries(ev) {
  const pref = (ev.prefecture || '').trim();
  const vName = (ev.venue?.name || '').trim();
  const vAddr = (ev.venue?.address || '').trim();
  const queries = [];
  const pushQ = (q, precision, spotOnly) => {
    const cleaned = q.replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned === pref || NOISE_VENUE_RE.test(cleaned)) return;
    if (!queries.some((x) => x.q === cleaned)) {
      queries.push({ q: cleaned, precision, spotOnly });
    }
  };

  // 1. 具体的な住所
  if (vAddr && vAddr !== pref && vAddr.length > pref.length) {
    const noZip = vAddr.replace(/〒?\d{3}-?\d{4}/g, '').trim();
    const withPref = noZip.startsWith(pref) ? noZip : `${pref} ${noZip}`;
    pushQ(withPref, 'exact', noZip);
  }

  // 2. venue.name カッコ内の住所や地名
  const vParens = vName.match(/[(（]([^)）]+)[)）]/);
  if (vParens && vParens[1]) {
    const inner = vParens[1].trim();
    if (!/受付|集合|当日|案内|詳細|予定/.test(inner)) {
      const withPref = inner.startsWith(pref) ? inner : `${pref} ${inner}`;
      pushQ(withPref, 'exact', inner);
    }
  }

  // 3. venue.name の分割・クレンジング
  const splitParts = vName
    .split(/[／/]/)
    .map((s) =>
      s
        .replace(/^(スタート|ゴール|受付|集合|会場)[:：]\s*/, '')
        .replace(/[(（][^)）]+[)）]/g, '')
        .replace(/（?当日.*|※.*|ほか$/g, '')
        .trim()
    )
    .filter((s) => s && s !== pref && !NOISE_VENUE_RE.test(s) && !/コース|1周|未定|予定|スタート|ゴール/.test(s));

  for (const part of splitParts) {
    const cleanPart = part.replace(/(地区|周辺|付近|特設会場|会場)$/, '').trim();
    if (cleanPart && cleanPart !== pref && !NOISE_VENUE_RE.test(cleanPart)) {
      const withPref = cleanPart.startsWith(pref) ? cleanPart : `${pref} ${cleanPart}`;
      pushQ(withPref, 'exact', cleanPart);
    }
  }

  // 4. 市区町村名の直接抽出
  const combinedText = `${vAddr} ${vName} ${ev.title}`;
  const muniMatch = combinedText.match(/([^\s　（(・、,【]+[市町村区郡])/);
  if (muniMatch && muniMatch[1] && !muniMatch[1].endsWith('都') && !muniMatch[1].endsWith('県')) {
    const muni = muniMatch[1].replace(/^(?:[^\s]+[都道府県])/, '');
    if (muni.length >= 2) {
      pushQ(`${pref}${muni}`, 'city', muni);
    }
  }

  // 5. タイトルカッコ内の地名・山名
  const tParens = ev.title.match(/[(（]([^)）]+)[)）]/);
  if (tParens && tParens[1]) {
    const parts = tParens[1]
      .split(/[・〜~\s,、]+/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length >= 2 &&
          !/^\d/.test(s) &&
          !/km|マイル|mile|フル|ハーフ|ウルトラ|大会|トレイル/i.test(s) &&
          !PREF_BOUNDS[s] &&
          !PREF_BOUNDS[`${s}県`] &&
          !PREF_BOUNDS[`${s}府`]
      );
    for (const p of parts.slice(0, 2)) {
      pushQ(`${pref} ${p}`, 'city', p);
    }
  }

  return queries;
}

async function geocodeDomesticEvent(ev, cache) {
  const pref = (ev.prefecture || '').trim();
  const vName = (ev.venue?.name || '').trim();

  // 補助辞書チェック
  for (const [spot, coords] of Object.entries(KNOWN_SPOT_COORDS)) {
    if (vName.includes(spot) || ev.title.includes(spot)) {
      if (isWithinPrefBox(pref, coords[0], coords[1])) {
        return { lat: coords[0], lng: coords[1], coordPrecision: 'exact', source: 'spot-dict' };
      }
    }
  }

  const candidates = buildCandidateQueries(ev);

  // 第1パス：国土地理院API（ただし県庁座標の偽フォールバックは却下！）
  for (const cand of candidates) {
    const cacheKey = `gsi:${pref}:${cand.q}`;
    let hits = cache[cacheKey];
    if (hits === undefined) {
      hits = await queryGsi(cand.q);
      cache[cacheKey] = hits || null;
      await sleep(120);
    }
    if (Array.isArray(hits)) {
      const valid = hits.find(
        (h) =>
          isWithinPrefBox(pref, h.lat, h.lng) &&
          !isSuspiciousCapitalFallback(pref, cand.q, h.lat, h.lng)
      );
      if (valid) {
        return {
          lat: Number(valid.lat.toFixed(5)),
          lng: Number(valid.lng.toFixed(5)),
          coordPrecision: cand.precision,
          source: `gsi(${cand.q})`,
        };
      }
    }
  }

  // 第2パス：OpenStreetMap Nominatim（施設名・公園・温泉・山名に強い）
  for (const cand of candidates.slice(0, 3)) {
    const queriesToTry = [cand.q];
    if (cand.spotOnly && cand.spotOnly !== cand.q && cand.spotOnly.length >= 3) {
      queriesToTry.push(`${cand.spotOnly} ${pref}`);
    }
    for (const nq of queriesToTry) {
      const cacheKey = `nom:${pref}:${nq}`;
      let hits = cache[cacheKey];
      if (hits === undefined) {
        hits = await queryNominatim(nq, true);
        cache[cacheKey] = hits || null;
        await sleep(1100);
      }
      if (Array.isArray(hits)) {
        const valid = hits.find((h) => isWithinPrefBox(pref, h.lat, h.lng));
        if (valid) {
          return {
            lat: Number(valid.lat.toFixed(5)),
            lng: Number(valid.lng.toFixed(5)),
            coordPrecision: cand.precision,
            source: `nominatim(${nq})`,
          };
        }
      }
    }
  }

  // 第3パス：都道府県代表座標へフォールバック
  const prefMeta = PREF_BOUNDS[pref];
  if (prefMeta) {
    return {
      lat: prefMeta.center[0],
      lng: prefMeta.center[1],
      coordPrecision: 'prefecture',
      source: 'pref-center',
    };
  }

  return null;
}

async function geocodeOverseasEvent(ev, cache) {
  const pref = (ev.prefecture || '').trim();
  const vName = (ev.venue?.name || '').trim();

  for (const [k, coords] of Object.entries(KNOWN_SPOT_COORDS)) {
    if (ev.title.includes(k) || vName.includes(k)) {
      return { lat: coords[0], lng: coords[1], coordPrecision: 'city', source: `spot(${k})` };
    }
  }

  if (vName && vName !== pref && !/詳細|要確認|未定/.test(vName)) {
    const q = `${vName} ${pref}`.trim();
    const cacheKey = `nom-overseas:${q}`;
    let hits = cache[cacheKey];
    if (hits === undefined) {
      hits = await queryNominatim(q, false);
      cache[cacheKey] = hits || null;
      await sleep(1100);
    }
    if (Array.isArray(hits) && hits.length > 0) {
      return {
        lat: Number(hits[0].lat.toFixed(5)),
        lng: Number(hits[0].lng.toFixed(5)),
        coordPrecision: 'city',
        source: `nominatim-overseas(${q})`,
      };
    }
  }

  const fb = OVERSEAS_FALLBACK[pref] || OVERSEAS_FALLBACK['海外'];
  return {
    lat: fb[0],
    lng: fb[1],
    coordPrecision: 'prefecture',
    source: 'overseas-fallback',
  };
}

async function main() {
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const cache = loadCache();

  let updated = 0;
  let skipped = 0;
  const stats = { exact: 0, city: 0, prefecture: 0, missing: 0 };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const hasCoords =
      typeof ev.venue?.lat === 'number' &&
      typeof ev.venue?.lng === 'number' &&
      !Number.isNaN(ev.venue.lat) &&
      !Number.isNaN(ev.venue.lng);

    if (hasCoords && !FORCE_MODE) {
      skipped++;
      const prec = ev.venue.coordPrecision || 'exact';
      stats[prec] = (stats[prec] || 0) + 1;
      continue;
    }

    const isDomestic = Boolean(PREF_BOUNDS[ev.prefecture?.trim()]);
    const geo = isDomestic
      ? await geocodeDomesticEvent(ev, cache)
      : await geocodeOverseasEvent(ev, cache);

    if (geo) {
      ev.venue = {
        name: ev.venue?.name || ev.prefecture || '会場未定',
        ...(ev.venue || {}),
        lat: geo.lat,
        lng: geo.lng,
        coordPrecision: geo.coordPrecision,
      };
      updated++;
      stats[geo.coordPrecision] = (stats[geo.coordPrecision] || 0) + 1;
      console.log(
        `[${i + 1}/${events.length}] ${ev.prefecture} | ${ev.title.slice(0, 26)} -> ${geo.coordPrecision} (${geo.lat}, ${geo.lng}) [${geo.source}]`
      );
    } else {
      stats.missing++;
      console.warn(`[${i + 1}/${events.length}] 座標未取得: ${ev.id} (${ev.prefecture})`);
    }

    if ((i + 1) % 20 === 0) {
      saveCache(cache);
    }
  }

  saveCache(cache);
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf8');

  console.log('\n================================================');
  console.log(`ジオコーディング完了: 全 ${events.length} 大会`);
  console.log(`  新規/再付与: ${updated}件 / スキップ(既存): ${skipped}件`);
  console.log(`  精度内訳 -> 詳細会場(exact): ${stats.exact} / 市区町村(city): ${stats.city} / 県代表(prefecture): ${stats.prefecture} / 欠損: ${stats.missing}`);
  console.log('================================================');
}

main().catch((err) => {
  console.error('ジオコーディングエラー:', err);
  process.exit(1);
});
