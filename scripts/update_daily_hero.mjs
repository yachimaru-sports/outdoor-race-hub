/**
 * scripts/update_daily_hero.mjs
 *
 * 近日開催（または注目の開催中）大会から日替わりで1件をピックアップし、
 * その開催地にちなんだ本物の自然風景写真（文字なし・横長）を
 * Wikimedia Commons / Wikipedia API から取得して public/hero-bg/daily-featured.jpg に保存し、
 * src/data/meta.json の daily_hero を更新します。
 */
import fs from 'node:fs';
import path from 'node:path';

const EVENTS_PATH = 'src/data/events.json';
const META_PATH = 'src/data/meta.json';
const OUT_IMG_PATH = path.join('public', 'hero-bg', 'daily-featured.jpg');
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const UA = 'OutdoorRaceHub/1.0 (https://yachimaru-sports.github.io/outdoor-race-hub/)';

const BAN_IMAGE_RE = /map|location|relief|topographic|srtm|chart|diagram|logo|icon|emblem|flag|sign|marker|poster|banner|flyer|stamp|leaflet|timetable|route|course_図|地図|案内図/i;

function getTodayJst() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    dateStr: now.toISOString().slice(0, 10),
    dayOfYear: Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000),
  };
}

/** 近日開催の大会リストから日替わりで1件を選ぶ */
function pickDailyEvent(events, todayStr, dayOfYear) {
  const future30 = new Date(new Date(`${todayStr}T00:00:00Z`).getTime() + 30 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  // まずは直近30日以内に開催（または開催中）の日本国内大会を優先
  let pool = events.filter((e) => {
    if (e.region === '海外') return false;
    const endStr = e.end_date || (e.date.includes('~') ? e.date.split('~')[1].trim() : e.date);
    return endStr >= todayStr && e.date <= future30;
  });

  if (pool.length === 0) {
    pool = events.filter((e) => e.region !== '海外' && (e.end_date || e.date) >= todayStr);
  }
  if (pool.length === 0) return null;

  // 地名・自然景勝地が含まれやすい大会を優先しつつ日替わり選出
  return pool[dayOfYear % pool.length];
}

/** 大会情報から風景検索に最適な日本の地名・自然名キーワードを抽出 */
async function extractScenicPlace(ev) {
  if (GEMINI_API_KEY) {
    try {
      const prompt = [
        `次の日本のスポーツ大会の開催地にちなんだ、Wikipedia/Wikimediaで美しい自然風景写真が検索できる「短い地名・山名・景勝地名（日本語1〜2語）」をJSONで返してください。`,
        `大会名: ${ev.title}`,
        `都道府県: ${ev.prefecture}`,
        `会場: ${ev.venue?.name || ''}`,
        `例: 「白神山地一周シライチ一周キャンペーン2026」→ {"place": "白神山地"}`,
        `例: 「IZU TRAIL Journey 2026」→ {"place": "伊豆半島"}`,
        `出力はJSONのみ: {"place": "..."}`,
      ].join('\n');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
          signal: AbortSignal.timeout(12000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const txt = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed.place && parsed.place.length >= 2 && parsed.place.length <= 20) {
            return parsed.place.trim();
          }
        }
      }
    } catch {
      // フォールバックへ
    }
  }

  // ルールベース抽出（タイトルや会場から山・半島・湖・高原・著名地名を優先抽出）
  const combined = `${ev.title} ${ev.venue?.name || ''}`;
  const scenicMatch = combined.match(
    /([一-龥ァ-ヶ]{2,10}(?:山地|山脈|山|岳|峰|峠|高原|湿原|渓谷|峡|湖|半島|海岸|海道|古道|公園|の森))/
  );
  if (scenicMatch) return scenicMatch[1];

  const parenMatch = ev.title.match(/[（(]([^）)]+)[）)]/);
  if (parenMatch) {
    const clean = parenMatch[1].replace(/\d+km.*$/i, '').split(/[・〜\s]/)[0].trim();
    if (clean.length >= 2) return clean;
  }

  return `${ev.prefecture} 風景`;
}

/** Wikipedia / Wikimedia Commons から文字なし・横長の綺麗な風景画像URLを取得 */
async function findScenicImageUrl(placeQuery, prefecture) {
  const queries = [placeQuery, `${prefecture} 自然`, prefecture].filter(Boolean);

  for (const q of queries) {
    // 1. 日本語版 Wikipedia の記事画像から地図を除いた横長写真を探す
    try {
      const wpUrl = `https://ja.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600&format=json&origin=*`;
      const res = await fetch(wpUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        const pages = Object.values(j?.query?.pages || {});
        for (const p of pages) {
          const orig = p.original;
          const thumb = p.thumbnail;
          const src = thumb?.source || orig?.source || '';
          const w = orig?.width || thumb?.width || 0;
          const h = orig?.height || thumb?.height || 0;
          if (!src || !/\.jpe?g(\?|$)/i.test(src)) continue;
          if (BAN_IMAGE_RE.test(src)) continue;
          if (w >= 900 && w > h) {
            return { url: thumb?.source || orig.source, sourceTitle: p.title };
          }
        }
      }
    } catch {
      // 次へ
    }

    // 2. Wikimedia Commons ファイル検索で横長のJPEG写真を探す
    try {
      const cmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=8&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1600&format=json&origin=*`;
      const res = await fetch(cmUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = await res.json();
        const pages = Object.values(j?.query?.pages || {});
        for (const p of pages) {
          const info = p.imageinfo?.[0];
          if (!info) continue;
          if (info.mime !== 'image/jpeg') continue;
          const src = info.thumburl || info.url || '';
          if (!src || BAN_IMAGE_RE.test(p.title + ' ' + src)) continue;
          if ((info.width || 0) >= 1000 && (info.width || 0) > (info.height || 0)) {
            return { url: src, sourceTitle: p.title.replace(/^File:/, '') };
          }
        }
      }
    } catch {
      // 次へ
    }
  }
  return null;
}

async function main() {
  const { dateStr, dayOfYear } = getTodayJst();
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));

  // 引数 --event-id=... が指定されていればその大会を優先
  const idArg = process.argv.find((a) => a.startsWith('--event-id='));
  const target = idArg
    ? events.find((e) => e.id === idArg.slice('--event-id='.length))
    : pickDailyEvent(events, dateStr, dayOfYear);

  if (!target) {
    console.log('⚠️ ピックアップ対象の近日大会が見つかりませんでした。');
    return;
  }

  const place = await extractScenicPlace(target);
  console.log(`🏔️ 本日のピックアップ大会: ${target.title} (${target.date}) -> 検索地名: 「${place}」`);

  const found = await findScenicImageUrl(place, target.prefecture);
  if (!found) {
    console.log('⚠️ 適切な横長風景写真が見つからなかったため、季節デフォルト背景を維持します。');
    return;
  }

  const imgRes = await fetch(found.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) {
    console.log(`⚠️ 画像ダウンロード失敗 (HTTP ${imgRes.status})。季節デフォルト背景を維持します。`);
    return;
  }

  const buf = Buffer.from(await imgRes.arrayBuffer());
  fs.mkdirSync(path.dirname(OUT_IMG_PATH), { recursive: true });
  fs.writeFileSync(OUT_IMG_PATH, buf);

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { meta = {}; }
  meta.daily_hero = {
    date: dateStr,
    event_id: target.id,
    event_title: target.title,
    event_date: target.date,
    place_label: `${target.prefecture}・${place}`,
    image: 'hero-bg/daily-featured.jpg',
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n', 'utf-8');

  console.log(`✅ 本日の開催地風景を更新しました: ${OUT_IMG_PATH} (${Math.round(buf.length / 1024)} KB)`);
  console.log(`   キャプション: ${meta.daily_hero.place_label} / ${target.title}`);
}

main().catch((e) => {
  console.warn('⚠️ update_daily_hero 例外（処理は継続）:', e.message);
});
