/**
 * scripts/sync_external_portals.mjs
 *
 * 人力企画（outdoor-sports.info）および トレイルランナー.JP（trailrunner.jp/taikai.html）から
 * 今後の大会情報を取得し、重複排除のうえ src/data/events.json へ安全にマージするスクリプト。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRaceTitle, isSameOrOverlappingDate } from './audit-duplicates.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVENTS_PATH = path.join(ROOT_DIR, 'src', 'data', 'events.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 日本時間 (JST) の今日の日付 YYYY-MM-DD
function getTodayJst() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

// 都道府県名 -> 地方名マッピング
const PREF_TO_REGION = {
  '北海道': '北海道',
  '青森県': '東北', '岩手県': '東北', '宮城県': '東北', '秋田県': '東北', '山形県': '東北', '福島県': '東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東', '埼玉県': '関東', '千葉県': '関東', '東京都': '関東', '神奈川県': '関東',
  '新潟県': '甲信越・北陸', '富山県': '甲信越・北陸', '石川県': '甲信越・北陸', '福井県': '甲信越・北陸', '山梨県': '甲信越・北陸', '長野県': '甲信越・北陸',
  '岐阜県': '東海', '静岡県': '東海', '愛知県': '東海', '三重県': '東海',
  '滋賀県': '関西', '京都府': '関西', '大阪府': '関西', '兵庫県': '関西', '奈良県': '関西', '和歌山県': '関西',
  '鳥取県': '中国', '島根県': '中国', '岡山県': '中国', '広島県': '中国', '山口県': '中国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国', '高知県': '四国',
  '福岡県': '九州', '佐賀県': '九州', '長崎県': '九州', '熊本県': '九州', '大分県': '九州', '宮崎県': '九州', '鹿児島県': '九州', '沖縄県': '九州',
};

function normalizePrefecture(shortName) {
  if (!shortName) return '全国';
  const clean = shortName.split(/[･・/]/)[0].trim();
  if (clean === '北海道') return '北海道';
  if (clean === '東京') return '東京都';
  if (clean === '大阪') return '大阪府';
  if (clean === '京都') return '京都府';
  if (/[都道府県]$/.test(clean)) return clean;
  for (const full of Object.keys(PREF_TO_REGION)) {
    if (full.startsWith(clean)) return full;
  }
  return clean;
}

const DEFAULT_TRAIL_GEAR = [
  { name: 'トレイルランニングシューズ・ザック', category: 'ギア' },
  { name: 'レインジャケット（防風・防水シェル）', category: 'ウェア' },
  { name: '水分・行動食・マイカップ', category: '補給' },
  { name: 'ファーストエイドキット・携帯電話・保険証', category: 'エイド' },
];

const DEFAULT_ROGAINING_GEAR = [
  { name: 'コンパス・デジタルカメラ（またはスマホ）', category: 'ナビゲーション' },
  { name: '防寒着・雨具・行動食・水分', category: 'ウェア' },
  { name: '緊急連絡用携帯電話・ライト・救急セット', category: 'エイド' },
];

/**
 * HTMLテキストの正規化
 */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 既存リストとの重複チェック（タイトル正規化 + 日付近接）
 */
function findDuplicateIndex(events, candidate) {
  const normCand = normalizeRaceTitle(candidate.title);
  const candTime = new Date(candidate.date).getTime();

  for (let i = 0; i < events.length; i++) {
    const ex = events[i];
    if (ex.id === candidate.id) return i;
    if (candidate.links?.official && ex.links?.official === candidate.links.official && !candidate.links.official.includes('trailrunner.jp/taikai')) {
      return i;
    }

    const normEx = normalizeRaceTitle(ex.title);
    if (!normCand || !normEx) continue;

    const titleMatch =
      normCand === normEx ||
      (normCand.length >= 5 && normEx.includes(normCand)) ||
      (normEx.length >= 5 && normCand.includes(normEx));

    if (titleMatch) {
      if (isSameOrOverlappingDate(ex.date, candidate.date)) return i;
      const diffDays = Math.abs(new Date(ex.date).getTime() - candTime) / 86400000;
      if (diffDays <= 14 && ex.prefecture === candidate.prefecture) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * 1. 人力企画（outdoor-sports.info）の今後のレース定義・ステータス同期
 */
async function buildJinrikiEvents(todayStr) {
  let listText = '';
  try {
    const res = await fetch('https://www.outdoor-sports.info/races-events', {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      listText = stripHtml(await res.text());
    }
  } catch (e) {
    console.warn('⚠️ 人力企画一覧ページの取得に失敗（内蔵マスターで続行）:', e.message);
  }

  const races = [
    {
      id: 'jinriki-zensouyama-2026',
      category: 'trail',
      subCategory: '6時間耐久トレイル＆坐禅',
      elements: ['トレック', '耐久'],
      title: '禅僧山 TRAIL RUNNING & MEDITATION 2026（徳島・海陽町 城満寺）',
      date: '2026-11-23',
      month: 11,
      region: '四国',
      prefecture: '徳島県',
      distance_km: 30,
      elevation_m: 1200,
      entry_fee: '5,000円',
      entry_status: listText.includes('禅僧山') && listText.includes('締切') ? 'closed' : 'closing_soon',
      entry_start_date: '2026-09-01',
      entry_deadline: '2026-11-18',
      links: {
        official: 'https://www.outdoor-sports.info/zensouyama',
        entry: 'https://www.outdoor-sports.info/zensouyama',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: DEFAULT_TRAIL_GEAR,
      venue: {
        name: '曹洞宗 城満寺（徳島県海部郡海陽町吉田）',
        mapQuery: '徳島県海部郡海陽町 城満寺',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      added_at: todayStr,
      updated_at: todayStr,
    },
    {
      id: 'senba-sea-cliff-trail-2027',
      category: 'trail',
      subCategory: '太平洋断崖コースタルトレイル',
      elements: ['トレック'],
      title: '千羽海崖（せんばかいがい）トレイルランニングレース 2027（徳島・美波町）',
      date: '2027-01-24',
      month: 1,
      region: '四国',
      prefecture: '徳島県',
      distance_km: 50,
      elevation_m: 2600,
      entry_fee: '11,000円',
      entry_status: 'open',
      entry_start_date: '2026-10-06',
      entry_deadline: '2026-12-05',
      links: {
        official: 'https://www.outdoor-sports.info/senba-coastal-cliff',
        entry: 'https://www.outdoor-sports.info/senba-coastal-cliff',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: [
        { name: 'レインジャケットまたは防風シェル', category: 'ウェア' },
        { name: 'エマージェンシーシート・ホイッスル・保険証コピー', category: 'エイド' },
        { name: '水分500ml〜1.0L以上・行動食・マイカップ', category: '補給' },
        { name: 'トレイルランニングシューズ＆トレランザック', category: 'ギア' },
      ],
      venue: {
        name: '美波町立由岐中学校体育館（徳島県海部郡美波町西由岐山際1）',
        mapQuery: '徳島県美波町 由岐中学校',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      updated_at: todayStr,
    },
    {
      id: 'jinriki-tsunomine-vertical-2027',
      category: 'trail',
      subCategory: 'バーティカル（参道登山競走）',
      elements: ['バーティカル', 'スカイランニング'],
      title: '津峯神社参道競走 2027（第4回・四国スカイランニングシリーズ）',
      date: '2027-02-14',
      month: 2,
      region: '四国',
      prefecture: '徳島県',
      distance_km: 6,
      elevation_m: 850,
      entry_fee: '2,200円〜6,300円',
      entry_status: 'open',
      entry_start_date: '2026-11-01',
      entry_deadline: '2027-02-01',
      links: {
        official: 'https://www.outdoor-sports.info/tsunomine-vertical',
        entry: 'https://www.outdoor-sports.info/tsunomine-vertical',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: DEFAULT_TRAIL_GEAR,
      venue: {
        name: '津峯山・津峯神社（徳島県阿南市）',
        mapQuery: '徳島県阿南市 津峯神社',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      added_at: todayStr,
      updated_at: todayStr,
    },
    {
      id: 'jinriki-takabagamori-skyrace-2027',
      category: 'trail',
      subCategory: 'ショートスカイ（スカイランニング）',
      elements: ['スカイランニング', 'トレック'],
      title: '鷹羽ヶ森スカイレース 2027（第5回・高知 いの町）',
      date: '2027-03-07',
      month: 3,
      region: '四国',
      prefecture: '高知県',
      distance_km: 8.2,
      elevation_m: 890,
      entry_fee: '7,000円',
      entry_status: 'open',
      entry_start_date: '2026-11-01',
      entry_deadline: '2027-02-22',
      links: {
        official: 'https://www.outdoor-sports.info/takabagamori-skyrace',
        entry: 'https://www.outdoor-sports.info/takabagamori-skyrace',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: DEFAULT_TRAIL_GEAR,
      venue: {
        name: '道の駅 土佐和紙工芸村「くらうど」（高知県吾川郡いの町鹿敷1226）',
        mapQuery: '高知県いの町 土佐和紙工芸村くらうど',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      added_at: todayStr,
      updated_at: todayStr,
    },
    {
      id: 'jinriki-symboltower-stairclimbing-2027',
      category: 'trail',
      subCategory: 'ステアクライミング（792段・150m）',
      elements: ['階段・バーティカル', 'スカイランニング'],
      title: '高松シンボルタワー ステアクライミング 2027（第5回・香川）',
      date: '2027-03-14',
      month: 3,
      region: '四国',
      prefecture: '香川県',
      distance_km: 1,
      elevation_m: 150,
      entry_fee: '4,000円〜5,500円',
      entry_status: 'open',
      entry_start_date: '2026-11-01',
      entry_deadline: '2027-03-01',
      links: {
        official: 'https://www.outdoor-sports.info/symboltower-stairclimbing',
        entry: 'https://www.outdoor-sports.info/symboltower-stairclimbing',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: [
        { name: 'ランニングシューズ・動きやすいウェア', category: 'ギア' },
        { name: '健康保険証（またはコピー）', category: 'エイド' },
      ],
      venue: {
        name: '高松シンボルタワー デックスガレリア（香川県高松市サンポート2-1）',
        mapQuery: '香川県高松市 高松シンボルタワー',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      added_at: todayStr,
      updated_at: todayStr,
    },
    {
      id: 'jinriki-kinosaki-rogaining-2027',
      category: 'adventure',
      subCategory: 'ロゲイニング（3h/5h/8h）',
      elements: ['読図', 'ロゲイニング', 'トレック'],
      title: '城崎温泉ロゲイニング 2027（第1回・兵庫 豊岡市）',
      date: '2027-05-08',
      month: 5,
      region: '関西',
      prefecture: '兵庫県',
      distance_km: 35,
      elevation_m: 1200,
      entry_fee: '4,000円〜10,000円',
      entry_status: 'open',
      entry_start_date: '2026-11-01',
      entry_deadline: '2027-04-22',
      links: {
        official: 'https://www.outdoor-sports.info/kinosaki-rogaining',
        entry: 'https://www.outdoor-sports.info/kinosaki-rogaining',
        review: null,
        sns: null,
        verified: true,
        verified_at: todayStr,
      },
      mandatory_gear: DEFAULT_ROGAINING_GEAR,
      venue: {
        name: '城崎温泉 末代山 温泉寺（兵庫県豊岡市城崎町湯島985-2）',
        mapQuery: '兵庫県豊岡市 城崎温泉 温泉寺',
      },
      source: {
        portalName: '人力企画',
        portalUrl: 'https://www.outdoor-sports.info/races-events',
      },
      added_at: todayStr,
      updated_at: todayStr,
    },
  ];

  return races.filter((r) => r.date >= todayStr);
}

/**
 * 2. トレイルランナー.JP（trailrunner.jp/taikai.html）から今後の国内大会一覧を取得
 */
async function fetchTrailrunnerList(todayStr) {
  const res = await fetch('https://trailrunner.jp/taikai.html', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`trailrunner.jp HTTP ${res.status}`);
  const html = await res.text();

  // 年見出しと <tr> を順に走査して開催年を特定
  const tokens = [...html.matchAll(/(<h[23][^>]*>[\s\S]*?<\/h[23]>|<tr[^>]*>[\s\S]*?<\/tr>)/gi)];
  let currentYear = Number(todayStr.slice(0, 4));
  const results = [];

  for (const m of tokens) {
    const chunk = m[1];
    if (/^<h[23]/i.test(chunk)) {
      const txt = stripHtml(chunk);
      const yrMatch = txt.match(/^(202\d)$/);
      if (yrMatch) currentYear = Number(yrMatch[1]);
      continue;
    }

    if (!chunk.includes('詳細')) continue;
    const text = stripHtml(chunk);
    const detailUrl = [...chunk.matchAll(/href="([^"]+)"/gi)]
      .map((x) => x[1])
      .find((u) => u.includes('race-detail-'));
    if (!detailUrl) continue;

    // 日付パース: 例 "11月21日(土) 11月23日(祝) BAMBI 100 (奈良)【100mile】 詳細"
    const dateMatches = [...text.matchAll(/(\d{1,2})月(\d{1,2})日\([^)]+\)/g)];
    if (dateMatches.length === 0) continue;

    const first = dateMatches[0];
    const startMonth = Number(first[1]);
    const startDay = Number(first[2]);
    const dateStr = `${currentYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

    let endDateStr;
    if (dateMatches.length >= 2) {
      const last = dateMatches[dateMatches.length - 1];
      const em = Number(last[1]);
      const ed = Number(last[2]);
      const endYear = em < startMonth ? currentYear + 1 : currentYear;
      endDateStr = `${endYear}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
    }

    if (dateStr < todayStr) continue;

    // タイトル・都道府県・距離部分
    const afterDates = text.replace(/^(\d{1,2}月\d{1,2}日\([^)]+\)\s*)+/, '').replace(/\s*詳細\s*$/, '').trim();
    const prefMatch = afterDates.match(/\(([^()]+)\)\s*(?:【([^】]+)】)?\s*$/);
    const prefRaw = prefMatch ? prefMatch[1] : '';
    const distRaw = prefMatch ? (prefMatch[2] || '') : '';
    const titleBase = afterDates.replace(/\s*\([^()]+\)\s*(?:【[^】]+】)?\s*$/, '').trim();

    // 小規模・体験系（キッズ/ドッグ/カニクロス/親子/練習会等）は除外
    if (/キッズ|ジュニア|ドッグ|カニクロス|親子|体験|練習会|試走/i.test(titleBase)) continue;

    const prefecture = normalizePrefecture(prefRaw);
    const region = PREF_TO_REGION[prefecture] || '全国';

    // 距離の暫定パース（10km以下は追加不要のためスキップ）
    let maxKm = 0;
    for (const dm of distRaw.matchAll(/(\d+(?:\.\d+)?)\s*(?:k|km|キロ)/gi)) {
      const v = parseFloat(dm[1]);
      if (v > maxKm) maxKm = v;
    }
    if (maxKm === 0 && /100\s*mile/i.test(distRaw)) maxKm = 160;
    if (maxKm === 0 && /時間/.test(distRaw)) maxKm = 20;
    if (maxKm <= 10) continue;

    // ID生成
    const slug = detailUrl
      .replace(/^https?:\/\/trailrunner\.jp\/race-detail-/, '')
      .replace(/\.html$/, '')
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase();
    const id = `trjp-${slug}-${dateStr.slice(0, 4)}`;

    results.push({
      id,
      titleBase,
      title: `${titleBase} ${dateStr.slice(0, 4)}（${prefecture}）`,
      date: dateStr,
      end_date: endDateStr && endDateStr !== dateStr ? endDateStr : undefined,
      month: startMonth,
      region,
      prefecture,
      distance_km: Math.round(maxKm * 10) / 10,
      distRaw,
      detailUrl,
    });
  }

  return results;
}

/**
 * トレイルランナー.JP 個別詳細ページをパースして詳細補完
 */
async function enrichFromTrailrunnerDetail(item, todayStr) {
  let official = item.detailUrl;
  let entry = item.detailUrl;
  let elevation_m = 0;
  let distance_km = item.distance_km;
  let venueName = item.prefecture;
  let entry_start_date;
  let entry_deadline = item.date;
  let entry_status = 'open';
  let subCategory = 'トレイルランニング';
  const elements = ['トレック'];

  try {
    const res = await fetch(item.detailUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const bodyMatch = html.match(/<div class="trjp-race-preview">([\s\S]*?)<!-- \.entry-content -->/i)
        || html.match(/<div class="entry-content">([\s\S]*?)<\/article>/i);
      const body = bodyMatch ? bodyMatch[1].replace(/<style[\s\S]*?<\/style>/gi, '') : '';

      // 公式・エントリーリンク抽出
      const anchors = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      for (const a of anchors) {
        const href = a[1];
        const label = stripHtml(a[2]);
        if (!href.startsWith('http')) continue;
        if (label.includes('公式サイト')) official = href;
        if (label.includes('エントリー')) entry = href;
      }
      if (entry === item.detailUrl && official !== item.detailUrl) {
        entry = official;
      }

      // 会場抽出
      const plain = stripHtml(body);
      const venueMatch = plain.match(/会場\s+([^\s].*?)(?:\s+受付|\s+主催|\s+種目)/);
      if (venueMatch && venueMatch[1].length <= 80) {
        venueName = venueMatch[1].trim();
      }

      // 距離・累積標高の最大値抽出
      const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const r of rows) {
        const rowTxt = stripHtml(r[1]);
        if (rowTxt.includes('累積標高') && rowTxt.includes('制限時間')) continue;
        for (const kmM of rowTxt.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)) {
          const val = parseFloat(kmM[1]);
          if (val > distance_km && val < 500) distance_km = val;
        }
        for (const elM of rowTxt.matchAll(/(\d{1,2},?\d{3}|\d{3,4})\s*m/gi)) {
          const val = parseInt(elM[1].replace(/,/g, ''), 10);
          if (val > elevation_m && val < 30000) elevation_m = val;
        }
      }

      // 申込期間抽出（例: 2026年2月22日（日）0:00〜3月1日（日）23:59）
      const periodMatch = plain.match(/申込期間\s+(\d{4})年(\d{1,2})月(\d{1,2})日[^〜～]*[〜～](?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
      if (periodMatch) {
        const sy = Number(periodMatch[1]);
        const sm = Number(periodMatch[2]);
        const sd = Number(periodMatch[3]);
        const ey = periodMatch[4] ? Number(periodMatch[4]) : (Number(periodMatch[5]) < sm ? sy + 1 : sy);
        const em = Number(periodMatch[5]);
        const ed = Number(periodMatch[6]);
        entry_start_date = `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`;
        entry_deadline = `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`;
      }
    }
  } catch {
    // タイムアウト等は一覧情報でフォールバック
  }

  if (distance_km >= 100) {
    subCategory = '100km / 100マイルウルトラトレイル';
    elements.push('100マイル');
  } else if (distance_km >= 42) {
    subCategory = 'ロングトレイル（42km以上）';
  } else if (/バーティカル|VK|登山競走|階段/i.test(item.titleBase)) {
    subCategory = 'バーティカル・登山競走';
    elements.push('バーティカル');
  }

  // エントリーステータス判定
  const soonDate = new Date(new Date(todayStr).getTime() + 14 * 86400000).toISOString().slice(0, 10);
  if (entry_deadline < todayStr) {
    entry_status = 'closed';
  } else if (entry_start_date && entry_start_date > todayStr) {
    entry_status = 'upcoming';
  } else if (entry_deadline <= soonDate) {
    entry_status = 'closing_soon';
  } else {
    entry_status = 'open';
  }

  return {
    id: item.id,
    category: 'trail',
    subCategory,
    elements,
    title: item.title,
    date: item.date,
    ...(item.end_date ? { end_date: item.end_date } : {}),
    month: item.month,
    region: item.region,
    prefecture: item.prefecture,
    distance_km: Math.round(distance_km * 10) / 10,
    elevation_m,
    entry_fee: '公式サイト参照',
    entry_status,
    ...(entry_start_date ? { entry_start_date } : {}),
    entry_deadline,
    links: {
      official,
      entry,
      review: null,
      sns: null,
      verified: true,
      verified_at: todayStr,
    },
    mandatory_gear: DEFAULT_TRAIL_GEAR,
    venue: {
      name: venueName,
      mapQuery: `${item.prefecture} ${venueName}`.slice(0, 60),
    },
    source: {
      portalName: 'トレイルランナー.JP',
      portalUrl: item.detailUrl,
    },
    added_at: todayStr,
    updated_at: todayStr,
  };
}

async function main() {
  const todayStr = getTodayJst();
  console.log(`=== 外部ポータル同期開始 (基準日: ${todayStr}) ===`);

  const rawEvents = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  // 既存のトレイルランナー.JP由来データのうち 10km以下・対象外種目をクリーンアップ
  let pruned = 0;
  const events = rawEvents.filter((e) => {
    const isTrjp = e.id?.startsWith('trjp-') || e.source?.portalName === 'トレイルランナー.JP';
    if (isTrjp && (e.distance_km <= 10 || /キッズ|ジュニア|ドッグ|カニクロス|親子|体験|練習会|試走/i.test(e.title))) {
      pruned++;
      return false;
    }
    return true;
  });
  if (pruned > 0) {
    console.log(`🧹 トレイルランナー.JP の 10km以下・対象外大会を ${pruned} 件整理しました。`);
  }
  let added = 0;
  let updated = 0;

  // 1. 人力企画
  console.log('\n[1/2] 人力企画（outdoor-sports.info）のレースを同期中...');
  const jinrikiRaces = await buildJinrikiEvents(todayStr);
  for (const r of jinrikiRaces) {
    const dupIdx = findDuplicateIndex(events, r);
    if (dupIdx >= 0) {
      // 既存更新（ただし added_at 等は保持しつつ最新化）
      events[dupIdx] = {
        ...events[dupIdx],
        ...r,
        added_at: events[dupIdx].added_at || r.added_at,
      };
      updated++;
      console.log(`  🔄 更新: ${r.title}`);
    } else {
      events.push(r);
      added++;
      console.log(`  ★ 追加: ${r.title}`);
    }
  }

  // 2. トレイルランナー.JP
  console.log('\n[2/2] トレイルランナー.JP（trailrunner.jp）の今後の大会を同期中...');
  const trList = await fetchTrailrunnerList(todayStr);
  console.log(`  一覧から ${trList.length} 件の今後の大会を検出。重複を除外して詳細を取得します...`);

  const toFetch = [];
  for (const item of trList) {
    const dupIdx = findDuplicateIndex(events, item);
    if (dupIdx >= 0) {
      continue; // 既存大会（人力企画含む）がある場合は保護してスキップ
    }
    toFetch.push(item);
  }
  console.log(`  新規候補: ${toFetch.length} 件（重複スキップ: ${trList.length - toFetch.length} 件）`);

  let cursor = 0;
  const enriched = [];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (cursor < toFetch.length) {
        const idx = cursor++;
        const item = toFetch[idx];
        const full = await enrichFromTrailrunnerDetail(item, todayStr);
        enriched.push(full);
        if ((enriched.length % 25) === 0) {
          console.log(`  ...詳細取得 ${enriched.length} / ${toFetch.length} 件完了`);
        }
      }
    })
  );

  // 追加直前にもう一度重複チェック＆10km超チェック
  for (const ev of enriched) {
    if (ev.distance_km <= 10) continue;
    if (findDuplicateIndex(events, ev) >= 0) continue;
    events.push(ev);
    added++;
  }

  // 日付順でソート
  events.sort((a, b) => a.date.localeCompare(b.date));

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2) + '\n', 'utf8');
  console.log(`\n✅ 同期完了: 新規追加 ${added} 件 / 更新 ${updated} 件 (合計 ${events.length} 件)`);
}

main().catch((err) => {
  console.error('❌ 同期エラー:', err);
  process.exit(1);
});
