/**
 * scripts/update_daily_hero.mjs
 *
 * 近日開催（または注目の開催中）大会から日替わりで1件をピックアップし、
 * その開催地にちなんだ本物の自然風景写真（権利クリア・人物顔なし・文字なし・横長）を
 * 4層の安全ガードを通して選定し、src/data/meta.json の daily_hero を更新します。
 *
 * 【4層安全ガード】
 *   1. 大会・景勝地の安全な言い換え（公園・駅・人名地名などを除き、都道府県別代表自然景勝地を補完）
 *   2. 権利＆メタデータ厳格フィルタ（CC0 / Public domain / CC BY / CC BY-SA のみ許可、人物・施設・地図・衛星を除外）
 *   3. Gemini 2.5 Flash Vision による実画像目視審査（顔・人物・文字・透かし・人工物をブロック）
 *   4. 安全なローカルギャラリーへの自動フェイルセーフ（審査未通過・API不可時は自前の自然風景を採用）
 *
 * オプション:
 *   --event-id=<id>  : 指定した大会IDを優先対象にする
 *   --dry-run        : 画像保存や meta.json 更新を行わず、選定・審査ログのみ出力する
 */
import fs from 'node:fs';
import path from 'node:path';

const EVENTS_PATH = 'src/data/events.json';
const META_PATH = 'src/data/meta.json';
const OUT_IMG_PATH = path.join('public', 'hero-bg', 'daily-featured.jpg');
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const UA = 'OutdoorRaceHub/2.0 (https://yachimaru-sports.github.io/outdoor-race-hub/)';

// 許可するフリーライセンス（NC/ND/Fair use/Copyright はすべて拒否）
const ALLOWED_LICENSE_RE = /^(CC0(\s+1\.0)?|Public domain|PD[\w-]*|CC[\s-]BY(\s+\d\.\d)?|CC[\s-]BY-SA(\s+\d\.\d)?)$/i;

// 英語の不適切メタデータ語（区切り文字正規化後に単語境界で判定）
const BAN_EN_RE = /\b(map|location|relief|topographic|srtm|landsat|satellite|aerial|chart|diagram|logo|icon|emblem|flag|sign|marker|poster|banner|flyer|stamp|leaflet|timetable|route|plan|schematic|newspaper|book|scan|document|manuscript|portrait|people|person|human|man|woman|boy|girl|player|baseball|soccer|football|basketball|volleyball|tennis|athlete|politician|actor|actress|singer|musician|crowd|ceremony|wedding|parade|meeting|conference|interview|selfie|face|headshot|uniform|coach|manager|school|university|college|hospital|station|train|locomotive|bus|truck|car|helicopter|aircraft|fighter|jsdf|military|grave|cemetery|tomb|statue|monument|memorial|toilet|parking|factory|office|food|ramen|sushi|dish|meal|building|stadium|ballpark|gymnasium|fireworks)\b/i;

// 日本語の不適切メタデータ語
const BAN_JA_RE = /(地図|案内図|航空写真|衛星|路線図|新聞|人物|選手|野球|試合|集合写真|記念写真|表彰|式典|顔|存命人物|校舎|高等学校|中学校|小学校|駐屯地|駅舎|電車|車両|看板|石碑|銅像|墓|料理|球場|体育館|花火)/;

// 人物記事の典型表現
const PERSON_BIO_RE = /(\d{4}年.*生\)|年生|年没|出身|元プロ野球|政治家|俳優|女優|歌手|タレント|アナウンサー)/;

// 施設・人工物・曖昧地名（検索クエリには使わない）
const BAN_QUERY_FACILITY_RE = /(公園|運動公園|総合公園|スポーツ公園|緑地|広場|市民センター|コミュニティセンター|体育館|アリーナ|スタジアム|球場|競技場|駅|役場|役所|学校|大学|記念館|観光物産館|道の駅|駐車場)/;

// 自然地形キーワード（「公園」は意図的に除外）
const SCENIC_KEYWORD_RE = /(山地|山脈|連峰|連山|山|岳|峰|峠|高原|湿原|渓谷|峡|湖|半島|海岸|海道|古道|島|の森|砂丘|アルプス|富士|白神|伊豆|屋久|阿蘇|蔵王|大雪|霧島|熊野|しまなみ|びわ湖|琵琶湖|霞ヶ浦|八ヶ岳|妙高|乗鞍|信越|飛騨|大台|四国カルスト|石鎚|剣山)/;

// 47都道府県ごとの代表自然景勝地マップ（人物・施設を避け、美しい風景に確実に辿り着くための安全網）
const PREF_SCENIC_MAP = {
  '北海道': ['大雪山 風景', '知床 自然 風景'],
  '青森県': ['白神山地 風景', '十和田湖 風景'],
  '岩手県': ['八幡平 風景', '岩手山 風景'],
  '宮城県': ['蔵王連峰 風景', '松島 風景'],
  '秋田県': ['田沢湖 風景', '鳥海山 風景'],
  '山形県': ['月山 風景', '蔵王 山 風景'],
  '福島県': ['磐梯山 風景', '尾瀬 湿原 風景'],
  '茨城県': ['霞ヶ浦 風景', '筑波山 風景'],
  '栃木県': ['日光 男体山 風景', '那須岳 風景'],
  '群馬県': ['谷川岳 風景', '赤城山 風景'],
  '埼玉県': ['奥秩父 山岳 風景', '長瀞 渓谷 風景'],
  '千葉県': ['九十九里浜 風景', '鋸山 風景'],
  '東京都': ['奥多摩 風景', '高尾山 風景'],
  '神奈川県': ['箱根 芦ノ湖 風景', '丹沢 山岳 風景'],
  '新潟県': ['妙高山 風景', '越後駒ヶ岳 風景'],
  '富山県': ['立山連峰 風景', '黒部峡谷 風景'],
  '石川県': ['白山 山岳 風景', '能登半島 海岸 風景'],
  '福井県': ['越前海岸 風景', '荒島岳 風景'],
  '山梨県': ['富士山 山中湖 風景', '南アルプス 風景'],
  '長野県': ['北アルプス 山岳 風景', '上高地 風景'],
  '岐阜県': ['乗鞍岳 風景', '奥飛騨 山岳 風景'],
  '静岡県': ['富士山 風景', '伊豆半島 海岸 風景'],
  '愛知県': ['三河湾 風景', '茶臼山 風景'],
  '三重県': ['御在所岳 風景', '熊野古道 自然 風景'],
  '滋賀県': ['琵琶湖 風景', '伊吹山 風景'],
  '京都府': ['天橋立 風景', '京都 北山 風景'],
  '大阪府': ['金剛山 風景', '箕面の滝 風景'],
  '兵庫県': ['淡路島 海岸 風景', '六甲山 風景'],
  '奈良県': ['大台ヶ原 風景', '吉野山 風景'],
  '和歌山県': ['熊野古道 風景', '白浜 海岸 風景'],
  '鳥取県': ['大山 山岳 風景', '鳥取砂丘 風景'],
  '島根県': ['隠岐諸島 風景', '宍道湖 風景'],
  '岡山県': ['蒜山高原 風景', '瀬戸内海 多島美 風景'],
  '広島県': ['宮島 弥山 風景', '瀬戸内海 しまなみ海道 風景'],
  '山口県': ['秋吉台 風景', '角島 海岸 風景'],
  '徳島県': ['剣山 風景', '祖谷渓 風景'],
  '香川県': ['瀬戸内海 小豆島 風景', '屋島 風景'],
  '愛媛県': ['石鎚山 風景', 'しまなみ海道 風景'],
  '高知県': ['四万十川 風景', '四国カルスト 風景'],
  '福岡県': ['英彦山 風景', '糸島 海岸 風景'],
  '佐賀県': ['虹の松原 風景', '背振山 風景'],
  '長崎県': ['雲仙岳 風景', '九十九島 風景'],
  '熊本県': ['阿蘇山 草千里 風景', '天草 海岸 風景'],
  '大分県': ['くじゅう連山 風景', '由布岳 風景'],
  '宮崎県': ['霧島連山 えびの高原 風景', '高千穂峡 風景'],
  '鹿児島県': ['屋久島 風景', '桜島 風景'],
  '沖縄県': ['やんばる 森 風景', '石垣島 海岸 風景'],
};

function getTodayJst() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    dateStr: now.toISOString().slice(0, 10),
    month: now.getUTCMonth() + 1,
    dayOfYear: Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000),
  };
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasBannedMetadata(text) {
  const raw = String(text || '');
  if (!raw) return false;
  if (BAN_JA_RE.test(raw)) return true;
  const normalizedEn = raw.replace(/[_/.\-:;()[\]]+/g, ' ');
  return BAN_EN_RE.test(normalizedEn);
}

function extractPrefCore(prefecture) {
  const p = String(prefecture || '').trim();
  if (!p) return '';
  if (p === '北海道') return '北海道';
  return p.replace(/[都府県]$/, '');
}

function calcEventDurationDays(ev) {
  const startMatch = String(ev.date || '').match(/\d{4}-\d{2}-\d{2}/);
  const endSource = ev.end_date || (String(ev.date || '').includes('~') ? ev.date.split('~')[1] : ev.date);
  const endMatch = String(endSource || '').match(/\d{4}-\d{2}-\d{2}/);
  if (!startMatch || !endMatch) return 1;
  const s = Date.parse(`${startMatch[0]}T00:00:00Z`);
  const e = Date.parse(`${endMatch[0]}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

function extractPrefFromPlaceLabel(label) {
  const m = String(label || '').match(/(北海道|東京都|京都府|大阪府|[^・（(\s]{2,3}県)/);
  return m ? m[1] : '';
}

/** meta.json の daily_hero から直近最大14日分の背景履歴を読み込む */
function loadRecentHeroHistory() {
  try {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    const dh = meta?.daily_hero;
    if (!dh || typeof dh !== 'object') return [];

    const merged = [];
    if (dh.event_id || dh.source_url || dh.image) {
      merged.push({
        date: dh.date || '',
        event_id: dh.event_id || '',
        place_label: dh.place_label || '',
        prefecture: extractPrefFromPlaceLabel(dh.place_label),
        source_url: dh.source_url || '',
        image: dh.image || '',
      });
    }
    if (Array.isArray(dh.recent_history)) {
      for (const item of dh.recent_history) {
        if (!item || typeof item !== 'object') continue;
        merged.push({
          date: item.date || '',
          event_id: item.event_id || '',
          place_label: item.place_label || '',
          prefecture: item.prefecture || extractPrefFromPlaceLabel(item.place_label),
          source_url: item.source_url || '',
          image: item.image || '',
        });
      }
    }

    const seen = new Set();
    const deduped = [];
    for (const h of merged) {
      const key = `${h.date}|${h.event_id}|${h.source_url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(h);
      if (deduped.length >= 14) break;
    }
    return deduped;
  } catch {
    return [];
  }
}

/** 近日開催の国内大会から直近履歴を避けたローテーション順で最大5件の候補を選出 */
function pickCandidateEvents(events, todayStr, dayOfYear, recentHistory = []) {
  const future30 = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 30 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  let pool = events.filter((e) => {
    if (e.region === '海外') return false;
    const endStr = e.end_date || (e.date.includes('~') ? e.date.split('~')[1].trim() : e.date);
    return endStr >= todayStr && e.date <= future30;
  });

  if (pool.length === 0) {
    pool = events.filter((e) => e.region !== '海外' && (e.end_date || e.date) >= todayStr);
  }
  if (pool.length === 0) return [];

  const scored = pool.map((e) => {
    const combined = `${e.title || ''} ${e.venue?.name || ''}`;
    let score = 0;
    if (SCENIC_KEYWORD_RE.test(combined)) score += 3;
    if (e.category === 'trail' || e.category === 'cycling' || e.category === 'adventure') score += 1;
    if (calcEventDurationDays(e) >= 45) score -= 3;
    if (/(BRM|パーマネント|スタンプラリー|キャンペーン|1周コース)/i.test(combined)) score -= 2;
    const prefMatches = String(e.venue?.name || '').match(/(?:北海道|東京都|京都府|大阪府|[^\s]{2,3}県)/g) || [];
    if (prefMatches.length >= 2) score -= 2;
    return { ev: e, score };
  });

  const maxScore = Math.max(...scored.map((s) => s.score));
  const priorityPool = scored
    .filter((s) => s.score >= Math.max(1, maxScore - 1))
    .map((s) => s.ev)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  const baseGroup = priorityPool.length > 0
    ? priorityPool
    : scored.map((s) => s.ev).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  const startIdx = dayOfYear % baseGroup.length;
  const rotated = [...baseGroup.slice(startIdx), ...baseGroup.slice(0, startIdx)];
  const rest = scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.ev)
    .filter((e) => !rotated.some((r) => r.id === e.id));

  const allOrdered = [...rotated, ...rest];
  const recentEventIds = new Set(recentHistory.map((h) => h.event_id).filter(Boolean));
  const recent3Prefs = new Set(recentHistory.slice(0, 3).map((h) => h.prefecture).filter(Boolean));
  const lastEventId = recentHistory[0]?.event_id || '';

  const getTier = (ev) => {
    if (!recentEventIds.has(ev.id) && !recent3Prefs.has(ev.prefecture)) return 0;
    if (!recentEventIds.has(ev.id)) return 1;
    if (ev.id !== lastEventId) return 2;
    return 3;
  };

  return allOrdered
    .map((ev, idx) => ({ ev, tier: getTier(ev), idx }))
    .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
    .map((item) => item.ev)
    .slice(0, 5);
}

/** 施設名や曖昧語を除いた検索安全地名をサニタイズ */
function sanitizePlaceTerm(term) {
  let t = String(term || '').trim();
  if (!t) return '';
  t = t.replace(/[「」『』【】()（）]/g, ' ').replace(/\s+/g, ' ').trim();
  if (BAN_QUERY_FACILITY_RE.test(t)) return '';
  if (hasBannedMetadata(t)) return '';
  if (t.length < 2 || t.length > 24) return '';
  return t;
}

const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const exhaustedModels = new Set();
let lastGeminiCallAt = 0;

/** Gemini API呼び出し共通ラッパー（モデルフォールバック＆RPD枯渇即時スキップ対応） */
async function callGeminiJson(body, timeoutMs = 20000) {
  if (!GEMINI_API_KEY) return { ok: false, status: 0, error: 'GEMINI_API_KEY未設定' };

  for (const model of GEMINI_MODELS) {
    if (exhaustedModels.has(model)) continue;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const elapsed = Date.now() - lastGeminiCallAt;
      if (elapsed < 1500) {
        await new Promise((r) => setTimeout(r, 1500 - elapsed));
      }
      lastGeminiCallAt = Date.now();

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
          const m = rawText.match(/\{[\s\S]*\}/);
          if (!m) {
            break; // JSON解析失敗時は次のモデルへ
          }
          return { ok: true, parsed: JSON.parse(m[0]), model };
        }

        const errText = await res.text().catch(() => '');
        if (res.status === 404 || res.status === 403) {
          exhaustedModels.add(model);
          console.log(`   ⏭️ モデル利用不可 (${model}: HTTP ${res.status}) -> 次モデルへ切替`);
          break;
        }

        if (res.status === 429) {
          const retryMatch = errText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
          const retrySec = retryMatch ? Number(retryMatch[1]) : 0;
          const isDailyQuota = /PerDay|GenerateRequestsPerDay/i.test(errText) || retrySec > 60;
          if (isDailyQuota) {
            exhaustedModels.add(model);
            console.log(`   ⏭️ 日次クォータ枯渇 (${model}) -> 待機せず次モデルへ切替`);
            break;
          }
          if (attempt === 0 && retrySec <= 30) {
            const waitMs = Math.min(15000, Math.max(2000, Math.ceil(retrySec * 1000) + 1000));
            console.log(`   ⏳ 一時制限 (${model}: HTTP 429) のため ${Math.round(waitMs / 1000)}秒待機して再試行...`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          break;
        }

        if (res.status === 503 && attempt === 0) {
          console.log(`   ⏳ 一時混雑 (${model}: HTTP 503) のため 5秒待機して再試行...`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        break;
      } catch (err) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        console.log(`   ⏭️ 通信エラー (${model}: ${err.message}) -> 次モデルへ切替`);
        break;
      }
    }
  }

  return { ok: false, status: 429, error: '利用可能な全Geminiモデルが上限またはエラー' };
}

/** 大会情報から風景検索に最適な日本の自然景勝地ラベルとクエリ群を抽出 */
async function extractScenicPlaces(ev) {
  const prefDefaults = PREF_SCENIC_MAP[ev.prefecture] || [`${ev.prefecture} 自然 風景`];
  let placeLabel = '';
  const queries = [];

  if (GEMINI_API_KEY) {
    try {
      const prompt = [
        '次の日本のアウトドアスポーツ大会の開催地にちなんだ、Wikimedia Commonsで「人物・施設が写らない美しい日本の自然風景写真」を検索するための情報をJSONで返してください。',
        `大会名: ${ev.title}`,
        `都道府県: ${ev.prefecture}`,
        `会場: ${ev.venue?.name || ''}`,
        '【厳禁ルール】',
        '- 「〇〇公園」「運動公園」「市民センター」「体育館」「駅」「球場」など人工施設名や、人名と紛らわしい短い地名（例:「和田」）は絶対に使わないでください。',
        '- 代わりにその市町村・地域を代表する実在の自然景勝地（山・湖・海・渓谷・高原・半島・島・森）を選んでください。',
        '例: 茨城県稲敷市「和田公園」→ {"place_label": "霞ヶ浦", "queries": ["霞ヶ浦 風景", "筑波山 風景"]}',
        '例: 「白神山地一周シライチ一周キャンペーン2026」→ {"place_label": "白神山地", "queries": ["白神山地 風景", "十和田湖 風景"]}',
        '出力はJSONのみ: {"place_label": "短い自然地名", "queries": ["検索語1 風景", "検索語2 風景"]}',
      ].join('\n');

      const gRes = await callGeminiJson(
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        },
        12000
      );

      if (gRes.ok && gRes.parsed) {
        const cleanLabel = sanitizePlaceTerm(gRes.parsed.place_label);
        if (cleanLabel) placeLabel = cleanLabel;
        if (Array.isArray(gRes.parsed.queries)) {
          for (const q of gRes.parsed.queries) {
            const cq = sanitizePlaceTerm(q);
            if (cq) queries.push(cq);
          }
        }
      }
    } catch {
      // ルールベースと都道府県マップへフォールバック
    }
  }

  // ルールベース抽出（「公園」は正規表現から完全除外）
  const combined = `${ev.title || ''} ${ev.venue?.name || ''}`;
  const scenicMatch = combined.match(
    /([一-龥ァ-ヶ]{2,10}(?:山地|山脈|連峰|連山|山|岳|峰|峠|高原|湿原|渓谷|峡|湖|半島|海岸|海道|古道|島|の森|砂丘))/
  );
  if (scenicMatch) {
    const cleanRule = sanitizePlaceTerm(scenicMatch[1]);
    if (cleanRule) {
      if (!placeLabel) placeLabel = cleanRule;
      queries.push(`${cleanRule} 風景`);
    }
  }

  // 都道府県別代表自然景勝地マップを安全網として末尾に補完
  for (const dq of prefDefaults) {
    queries.push(dq);
  }

  const dedupedQueries = [...new Set(queries)].slice(0, 4);
  if (!placeLabel) {
    placeLabel = prefDefaults[0].replace(/\s*(自然|風景).*$/, '').trim();
  }

  return {
    placeLabel,
    queries: dedupedQueries,
  };
}

/** Wikimedia Commons の page オブジェクトから権利・メタデータ検証済み候補を生成 */
function evaluateCommonsPage(page, queryLabel) {
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  if (info.mime !== 'image/jpeg') return null;

  const w = Number(info.width || 0);
  const h = Number(info.height || 0);
  if (w < 1000 || h < 600) return null;
  const aspect = w / h;
  if (aspect < 1.25 || aspect > 2.45) return null;

  const em = info.extmetadata || {};
  const license = stripHtml(em.LicenseShortName?.value || '');
  if (!license || !ALLOWED_LICENSE_RE.test(license)) return null;
  if (/\b(NC|ND|Fair\s*use|Copyright)\b/i.test(license)) return null;

  const title = String(page.title || '');
  const desc = stripHtml(em.ImageDescription?.value || '');
  const cats = stripHtml(em.Categories?.value || '');
  const metaBlob = `${title} ${desc} ${cats}`;
  if (hasBannedMetadata(metaBlob)) return null;

  const saveUrl = info.thumburl || info.url || '';
  if (!saveUrl || !/^https?:\/\//i.test(saveUrl)) return null;
  const author = stripHtml(em.Artist?.value || '') || 'Wikimedia Commons contributor';
  const sourceUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

  return {
    title: title.replace(/^File:/, ''),
    saveUrl,
    license,
    author: author.slice(0, 80),
    sourceUrl,
    width: w,
    height: h,
    queryLabel,
    description: desc.slice(0, 120),
  };
}

/** Wikimedia Commons（主経路）と Wikipedia（厳格検証付き補助経路）から安全候補を収集 */
async function collectSafeCandidates(queries, prefecture) {
  const candidates = [];
  const seenUrls = new Set();
  const prefCore = extractPrefCore(prefecture);

  const pushCandidate = (cand) => {
    if (!cand || seenUrls.has(cand.saveUrl)) return;
    seenUrls.add(cand.saveUrl);
    candidates.push(cand);
  };

  for (const q of queries) {
    if (candidates.length >= 6) break;

    // 1. Wikimedia Commons 直接検索（主経路）
    try {
      const cmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&format=json&origin=*`;
      const res = await fetch(cmUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
        for (const p of pages) {
          pushCandidate(evaluateCommonsPage(p, q));
          if (candidates.length >= 6) break;
        }
      }
    } catch {
      // 次へ
    }

    if (candidates.length >= 6) break;

    // 2. 日本語版 Wikipedia 記事検索（補助経路：検索順位ソート＋都道府県一致＋Commonsで権利確認）
    try {
      const wpQuery = prefCore && !q.includes(prefCore) ? `${prefCore} ${q}` : q;
      const wpUrl = `https://ja.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wpQuery)}&gsrlimit=5&prop=pageimages|extracts|categories&exintro=1&explaintext=1&exchars=200&cllimit=30&piprop=name|original|thumbnail&pithumbsize=1200&format=json&origin=*`;
      const res = await fetch(wpUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        const pages = Object.values(j?.query?.pages || {}).sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
        const fileNames = [];
        for (const p of pages) {
          const catText = (p.categories || []).map((c) => c.title).join(' ');
          const articleBlob = `${p.title || ''} ${p.extract || ''} ${catText}`;
          if (hasBannedMetadata(articleBlob) || PERSON_BIO_RE.test(articleBlob)) continue;
          if (prefCore && !articleBlob.includes(prefCore)) continue;
          if (p.pageimage && !hasBannedMetadata(p.pageimage)) {
            fileNames.push(`File:${p.pageimage}`);
          }
        }
        if (fileNames.length > 0) {
          const fileInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileNames.slice(0, 4).join('|'))}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&format=json&origin=*`;
          const fRes = await fetch(fileInfoUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
          if (fRes.ok) {
            const fj = await fRes.json();
            for (const fp of Object.values(fj?.query?.pages || {})) {
              pushCandidate(evaluateCommonsPage(fp, wpQuery));
              if (candidates.length >= 6) break;
            }
          }
        }
      }
    } catch {
      // 次へ
    }
  }

  return candidates;
}

/** Gemini 2.5 Flash Vision API による実画像目視審査ゲート */
async function verifyImageWithGeminiVision(imageBuffer, mimeType, context) {
  if (!GEMINI_API_KEY) {
    return { ok: false, reason: 'GEMINI_API_KEY未設定のため外部画像は不採用' };
  }

  try {
    const prompt = [
      'あなたはアウトドア・トレラン・サイクリング大会ポータルサイトの背景画像審査員です。',
      `想定開催地・大会情報: ${context.prefecture} / ${context.placeLabel} / ${context.eventTitle}`,
      `候補ファイル名: ${context.fileName}`,
      '',
      '以下の厳格な基準で画像を審査し、JSONのみで回答してください。',
      '1. 人物の顔が判別できる、人物が前景や中景に大きく写っている、スポーツ選手・観光客が目立つ場合は必ず has_identifiable_person_or_face=true かつ approved=false にする（超遠景で点のように小さく個人識別不能な風景のみ許容）。',
      '2. 衛星写真・航空地図・校舎・駅・鉄道・自動車アップ・看板・記念碑・野球場・屋内・暗すぎる/ぼやけた写真は is_clean_outdoor_nature_or_landscape=false かつ approved=false にする。',
      '3. 透かし（ウォーターマーク）・撮影日付スタンプ・大きな文字・ロゴ・ポスターが含まれる場合は has_text_logo_watermark_or_sign=true かつ approved=false にする。',
      '4. 日本の美しい自然風景・山岳・湖畔・海岸・トレイル道など、アウトドア大会サイトのヒーロー背景として爽やかで心地よい写真なら approved=true とする。',
      '5. quality_score は 1〜10 の整数で採点する。',
      '',
      '出力JSONスキーマ:',
      '{"approved":boolean,"has_identifiable_person_or_face":boolean,"is_clean_outdoor_nature_or_landscape":boolean,"has_text_logo_watermark_or_sign":boolean,"matches_place_and_race_vibe":boolean,"quality_score":number,"reason":"日本語30字以内の理由"}',
    ].join('\n');

    const gRes = await callGeminiJson(
      {
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      },
      25000
    );

    if (!gRes.ok || !gRes.parsed) {
      return { ok: false, reason: gRes.error || 'Gemini Vision 審査エラー' };
    }

    const parsed = gRes.parsed;
    const rawScore = Number(parsed.quality_score || 0);
    const score = rawScore > 0 && rawScore <= 1 ? Math.round(rawScore * 10) : rawScore;
    const passed =
      parsed.approved === true &&
      parsed.has_identifiable_person_or_face === false &&
      parsed.is_clean_outdoor_nature_or_landscape === true &&
      parsed.has_text_logo_watermark_or_sign === false &&
      parsed.matches_place_and_race_vibe === true &&
      score >= 7;

    return {
      ok: passed,
      score,
      model: gRes.model,
      reason: String(parsed.reason || '').trim() || (passed ? '安全審査合格' : '審査基準未達'),
      detail: parsed,
    };
  } catch (err) {
    return { ok: false, reason: `Gemini Vision通信エラー: ${err.message}` };
  }
}

/** 審査不可・候補全滅時に必ず使用する安全な自前自然ギャラリーを選択（直前と同一画像を回避） */
function pickSafeLocalFallback(target, month, lastImage = '') {
  const isCycling = target?.category === 'cycling';
  const catalog = [
    { image: 'hero-bg/spring-trail.webp', label: '新緑の山岳トレイル（春）', season: 'spring', cycling: false },
    { image: 'hero-bg/summer-cycling.webp', label: '瀬戸内海沿いのロード（夏）', season: 'summer', cycling: true },
    { image: 'hero-bg/summer-alpine.webp', label: '雲海を望む稜線（夏）', season: 'summer', cycling: false },
    { image: 'hero-bg/autumn-cycling.webp', label: '朝霧の湖畔サイクルロード（秋）', season: 'autumn', cycling: true },
    { image: 'hero-bg/autumn-trail.webp', label: '紅葉の山岳トレイル（秋）', season: 'autumn', cycling: false },
    { image: 'hero-bg/winter-trail.webp', label: '冬の朝焼けと雪山稜線（冬）', season: 'winter', cycling: false },
  ];

  const season = month >= 3 && month <= 5
    ? 'spring'
    : month >= 6 && month <= 8
      ? 'summer'
      : month >= 9 && month <= 11
        ? 'autumn'
        : 'winter';

  const ordered = [...catalog].sort((a, b) => {
    const scoreA = (a.season === season ? 2 : 0) + (a.cycling === isCycling ? 1 : 0);
    const scoreB = (b.season === season ? 2 : 0) + (b.cycling === isCycling ? 1 : 0);
    return scoreB - scoreA;
  });

  const chosen = ordered.find((item) => item.image !== lastImage) || ordered[0];
  return { image: chosen.image, label: chosen.label };
}

function saveMetaDailyHero(entry, recentHistory = []) {
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    meta = {};
  }

  const currentSummary = {
    date: entry.date,
    event_id: entry.event_id || '',
    place_label: entry.place_label || '',
    prefecture: extractPrefFromPlaceLabel(entry.place_label),
    source_url: entry.source_url || '',
    image: entry.image || '',
  };

  const nextHistory = [
    currentSummary,
    ...recentHistory.filter(
      (h) => !(h.date === currentSummary.date && h.event_id === currentSummary.event_id)
    ),
  ].slice(0, 14);

  meta.daily_hero = {
    ...entry,
    recent_history: nextHistory,
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const idArg = process.argv.find((a) => a.startsWith('--event-id='));
  const { dateStr, month, dayOfYear } = getTodayJst();
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  const recentHistory = loadRecentHeroHistory();
  const recentSourceUrls = new Set(recentHistory.map((h) => h.source_url).filter(Boolean));
  const lastImage = recentHistory[0]?.image || '';

  const candidateEvents = idArg
    ? [events.find((e) => e.id === idArg.slice('--event-id='.length))].filter(Boolean)
    : pickCandidateEvents(events, dateStr, dayOfYear, recentHistory);

  if (candidateEvents.length === 0) {
    console.log('⚠️ ピックアップ対象の近日大会が見つかりませんでした。自前自然ギャラリーを適用します。');
    const fb = pickSafeLocalFallback(null, month, lastImage);
    if (!isDryRun) {
      saveMetaDailyHero(
        {
          date: dateStr,
          event_id: '',
          event_title: '季節のアウトドア自然風景',
          event_date: dateStr,
          place_label: fb.label,
          image: fb.image,
          source_type: 'curated_local',
          license: 'Original',
          author: 'OUTDOOR RACE HUB',
          source_url: '',
          ai_verified: true,
          ai_reason: '事前審査済みの安全な自前自然ギャラリーを使用',
          updated_at: new Date().toISOString(),
        },
        recentHistory
      );
    }
    return;
  }

  console.log(`🛡️ 本日の背景更新を開始 (${dateStr} JST / mode: ${isDryRun ? 'DRY-RUN' : '本番'} / 履歴: ${recentHistory.length}件)`);

  for (const target of candidateEvents) {
    if (exhaustedModels.size >= GEMINI_MODELS.length) break;
    const { placeLabel, queries } = await extractScenicPlaces(target);
    console.log(`🏔️ 候補大会: ${target.title} (${target.prefecture} / ${target.date})`);
    console.log(`   変換景勝地: 「${placeLabel}」 / 検索クエリ: ${queries.join(' | ')}`);

    const candidates = await collectSafeCandidates(queries, target.prefecture);
    console.log(`   ライセンス＆メタデータ通過候補数: ${candidates.length}件`);

    for (const cand of candidates.slice(0, 4)) {
      if (exhaustedModels.size >= GEMINI_MODELS.length) break;
      if (cand.sourceUrl && recentSourceUrls.has(cand.sourceUrl)) {
        console.log(`   ⏭️ 直近14日以内に使用済み画像のためスキップ: ${cand.title}`);
        continue;
      }
      try {
        const imgRes = await fetch(cand.saveUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
        if (!imgRes.ok) {
          console.log(`   ⏭️ 取得失敗 (${imgRes.status}): ${cand.title}`);
          continue;
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        // JPEGマジックバイト (FF D8) および最低サイズ・上限サイズ確認
        if (buf.length < 15000 || buf.length > 8 * 1024 * 1024 || buf[0] !== 0xff || buf[1] !== 0xd8) {
          console.log(`   ⏭️ JPEG形式/サイズ不正 (${Math.round(buf.length / 1024)}KB): ${cand.title}`);
          continue;
        }

        const review = await verifyImageWithGeminiVision(buf, 'image/jpeg', {
          prefecture: target.prefecture,
          placeLabel,
          eventTitle: target.title,
          fileName: cand.title,
        });

        if (!review.ok) {
          console.log(`   🚫 AI審査不合格 [${cand.license}]: ${cand.title} -> ${review.reason}`);
          continue;
        }

        console.log(`   ✅ AI審査合格 (${review.score}/10, ${review.model}) [${cand.license}]: ${cand.title} -> ${review.reason}`);
        const newEntry = {
          date: dateStr,
          event_id: target.id,
          event_title: target.title,
          event_date: target.date,
          place_label: `${target.prefecture}・${placeLabel}`,
          image: 'hero-bg/daily-featured.jpg',
          source_type: 'wikimedia_commons',
          license: cand.license,
          author: cand.author,
          source_url: cand.sourceUrl,
          ai_verified: true,
          ai_reason: review.reason,
          updated_at: new Date().toISOString(),
        };

        if (isDryRun) {
          console.log('🧪 --dry-run のためファイル保存をスキップしました。採用予定メタ:', JSON.stringify(newEntry, null, 2));
        } else {
          fs.mkdirSync(path.dirname(OUT_IMG_PATH), { recursive: true });
          fs.writeFileSync(OUT_IMG_PATH, buf);
          saveMetaDailyHero(newEntry, recentHistory);
          console.log(`🎉 本日の開催地風景を更新しました: ${OUT_IMG_PATH} (${Math.round(buf.length / 1024)} KB)`);
          console.log(`   出典: ${cand.author} / ${cand.license} (${cand.sourceUrl})`);
        }
        return;
      } catch (e) {
        console.log(`   ⏭️ 候補処理例外: ${cand.title} -> ${e.message}`);
      }
    }
  }

  // 全候補でAI審査通過画像を得られなかった場合は、前日画像を残さず安全な自前ギャラリーへ切り替え
  const primaryTarget = candidateEvents[0];
  const fb = pickSafeLocalFallback(primaryTarget, month, lastImage);
  const fallbackEntry = {
    date: dateStr,
    event_id: primaryTarget.id,
    event_title: primaryTarget.title,
    event_date: primaryTarget.date,
    place_label: `${primaryTarget.prefecture}（${fb.label}）`,
    image: fb.image,
    source_type: 'curated_local',
    license: 'Original',
    author: 'OUTDOOR RACE HUB',
    source_url: '',
    ai_verified: true,
    ai_reason: '事前審査済みの安全な自前自然ギャラリーを使用',
    updated_at: new Date().toISOString(),
  };

  if (isDryRun) {
    console.log('🧪 --dry-run フォールバック結果:', JSON.stringify(fallbackEntry, null, 2));
  } else {
    saveMetaDailyHero(fallbackEntry, recentHistory);
    console.log(`🛡️ 安全な自前自然ギャラリーへフォールバックしました: ${fb.image} (${fb.label})`);
  }
}

main().catch((e) => {
  console.warn('⚠️ update_daily_hero 例外:', e.message);
});
