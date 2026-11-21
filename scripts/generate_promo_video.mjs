/**
 * scripts/generate_promo_video.mjs
 *
 * Gemini 動画生成モデル (gemini-omni-1.2-flash) を使用して、
 * OUTDOOR RACE HUB の最新情報（締切まじか・新規追加・注目大会）を訴求する
 * ダイナミックな縦型ショート動画（9:16 / MP4）と、X・YouTubeショート用の投稿文を自動生成します。
 *
 * 使い方:
 *   node scripts/generate_promo_video.mjs
 *   node scripts/generate_promo_video.mjs --theme=closing     # 締切まじか特集
 *   node scripts/generate_promo_video.mjs --theme=new         # 新規追加大会特集
 *   node scripts/generate_promo_video.mjs --theme=featured    # 注目ビッグレース特集
 *   node scripts/generate_promo_video.mjs --event-id=hiroshima-utmb-2027
 *   node scripts/generate_promo_video.mjs --resolution=1080p --duration=15s
 *   node scripts/generate_promo_video.mjs --dry-run           # 動画生成APIを叩かず構成とプロンプトのみ確認
 *
 * 前提:
 *   環境変数 GEMINI_API_KEY（Pay-as-you-go / 有料プランが有効なキー）が必要です。
 */
import fs from 'node:fs';
import path from 'node:path';

const EVENTS_PATH = 'src/data/events.json';
const OUT_DIR = 'promo_videos';
const SITE_URL = 'https://yachimaru-sports.github.io/outdoor-race-hub/';
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

const TEXT_MODEL = 'gemini-2.5-flash';
const VIDEO_MODEL = 'gemini-omni-1.2-flash';

function getTodayJst() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function getArgValue(prefix, defaultValue) {
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}

/**
 * events.json から動画で紹介する注目大会（締切まじか・新規追加・注目大会）を抽出する
 */
function pickTargetEvents(events, today, theme, eventId) {
  if (eventId) {
    const exact = events.find((e) => e.id === eventId);
    if (!exact) throw new Error(`指定された大会IDが見つかりません: ${eventId}`);
    return { mode: 'single', picks: [exact] };
  }

  const upcoming = events.filter((e) => (e.date || '') >= today && e.entry_status !== 'closed');

  const closingSoon = upcoming
    .filter((e) => e.entry_deadline && e.entry_deadline >= today)
    .sort((a, b) => a.entry_deadline.localeCompare(b.entry_deadline))
    .slice(0, 3);

  const newlyAdded = [...upcoming]
    .filter((e) => e.added_at)
    .sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''))
    .slice(0, 3);

  const featured = [...upcoming]
    .filter((e) => /UTMB|100|ULTRA|富士|FUJI|信越|ハセツネ|PEAKS/i.test(e.title) || (e.distance_km || 0) >= 80)
    .sort((a, b) => (b.distance_km || 0) - (a.distance_km || 0))
    .slice(0, 3);

  if (theme === 'closing' && closingSoon.length) return { mode: 'closing', picks: closingSoon };
  if (theme === 'new' && newlyAdded.length) return { mode: 'new', picks: newlyAdded };
  if (theme === 'featured' && featured.length) return { mode: 'featured', picks: featured };

  // auto: 3カテゴリから重複しないようにバランスよく3件選出
  const picks = [];
  const used = new Set();
  for (const list of [closingSoon, newlyAdded, featured]) {
    const cand = list.find((e) => !used.has(e.id));
    if (cand) {
      picks.push(cand);
      used.add(cand.id);
    }
  }
  return { mode: 'auto', picks };
}

/**
 * Gemini 2.5 Flash で、ダイナミックな動画生成プロンプトとSNS投稿用キャプションを作成する
 */
async function buildVideoPlanWithGemini(mode, picks, today, duration) {
  const summary = picks.map((e, i) => (
    `${i + 1}. 大会名: ${e.title} / カテゴリ: ${e.category} / 開催日: ${e.date} / 開催地: ${e.prefecture} / 距離: ${e.distance_km}km / 申込締切: ${e.entry_deadline || '受付中'}`
  )).join('\n');

  const prompt = [
    `あなたはスポーツ・アウトドアメディア「OUTDOOR RACE HUB」のプロモーション動画ディレクターです。`,
    `以下の大会情報（本日: ${today}、特集テーマ: ${mode}）をもとに、X（旧Twitter）および YouTubeショートで思わず手が止まる「${duration}の超ダイナミックな縦型（9:16）プロモーション動画」の生成指示書とSNS投稿文をJSONで作成してください。`,
    ``,
    `【紹介する大会】`,
    summary,
    ``,
    `【動画プロンプト作成の要件】`,
    `- "video_prompt": gemini-omni-1.2-flash へ直接渡す英語プロンプト（120〜180語程度）。`,
    `  - カメラワーク: FPVドローン空撮による急降下、トレイルランナーやサイクリストの迫力あるトラッキングショット、朝焼けの山頂、スピードランプ、ダイナミックなカット割りを含めること。`,
    `  - 映像スタイル: Ultra-cinematic, 9:16 vertical sports commercial style, high contrast, energetic motion blur, dramatic sunrise lighting.`,
    `  - 音声・BGM: Driving epic electronic rock / taiko drum beat, wind rushing, footsteps on rocky trail, energetic hype sound effects.`,
    `  - 画面内テキスト演出: Bold modern motion graphics showing "OUTDOOR RACE HUB" and key hook like "ENTRY CLOSING SOON!" or "NEW RACES 2027".`,
    `- "x_post_text": 日本語のX投稿用テキスト（120文字以内、URL除く）。締切日や大会名を入れて今すぐクリックしたくなる文面＋ハッシュタグ（#トレラン #マラソン #ロードバイク 等）。`,
    `- "youtube_title": YouTubeショート用の日本語タイトル（45文字以内、#Shorts 含む）。`,
    `- "youtube_description": YouTubeショート用の日本語説明文（検索キーワード「OUTDOOR RACE HUB」と紹介大会の概要）。`,
    ``,
    `出力はJSONのみ:`,
    `{"video_prompt": "...", "x_post_text": "...", "youtube_title": "...", "youtube_description": "..."}`,
  ].join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`構成生成エラー (${TEXT_MODEL}): HTTP ${res.status} ${errText}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('\n');
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Gemini からの構成JSON解析に失敗しました');
  return JSON.parse(m[0]);
}

/**
 * Gemini Interactions API (gemini-omni-1.2-flash) を呼び出して 9:16 動画を生成する
 */
async function generateVideoWithGemini(videoPrompt, { duration = '15s', resolution = '720p', aspectRatio = '9:16' } = {}) {
  console.log(`🎬 ${VIDEO_MODEL} で動画生成を開始します (${aspectRatio}, ${resolution}, ${duration})...`);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input: videoPrompt,
      response_format: {
        type: 'video',
        duration,
        resolution,
        aspect_ratio: aspectRatio,
      },
      store: true,
    }),
    signal: AbortSignal.timeout(300000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 429) {
      throw new Error(
        `動画生成APIクォータ制限 (HTTP 429): 現在のAPIキーでは ${VIDEO_MODEL} が利用できません。\n` +
        `Google AI Studio (https://ai.dev/rate-limit) で有料プラン (Pay-as-you-go) を有効にしてください。\n詳細: ${body}`
      );
    }
    throw new Error(`動画生成APIエラー: HTTP ${res.status} ${body}`);
  }

  const data = await res.json();

  // Base64 形式での返却パターンに対応
  if (data.output_video?.data) {
    return Buffer.from(data.output_video.data, 'base64');
  }
  if (Array.isArray(data.outputs)) {
    for (const out of data.outputs) {
      if (out?.data && (out.mime_type || '').startsWith('video/')) {
        return Buffer.from(out.data, 'base64');
      }
      if (out?.inline_data?.data) {
        return Buffer.from(out.inline_data.data, 'base64');
      }
      if (out?.uri) {
        const dl = await fetch(out.uri, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
        if (dl.ok) return Buffer.from(await dl.arrayBuffer());
      }
    }
  }
  if (data.output_video?.uri) {
    const dl = await fetch(data.output_video.uri, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
    if (dl.ok) return Buffer.from(await dl.arrayBuffer());
  }

  throw new Error(`動画データの抽出に失敗しました。レスポンスキー: ${Object.keys(data).join(', ')}`);
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('❌ 環境変数 GEMINI_API_KEY が設定されていません。');
    process.exit(1);
  }

  const isDryRun = process.argv.includes('--dry-run');
  const theme = getArgValue('--theme=', 'auto');
  const eventId = getArgValue('--event-id=', '');
  const duration = getArgValue('--duration=', '15s');
  const resolution = getArgValue('--resolution=', '720p');
  const today = getTodayJst();

  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  const { mode, picks } = pickTargetEvents(events, today, theme, eventId);

  console.log(`📌 対象大会 (${mode}):`);
  for (const e of picks) {
    console.log(`  - ${e.title} (${e.date} / 締切: ${e.entry_deadline || '受付中'})`);
  }

  const plan = await buildVideoPlanWithGemini(mode, picks, today, duration);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const postText = [
    `=== X（旧Twitter）投稿用 ===`,
    `${plan.x_post_text}`,
    `${SITE_URL}`,
    ``,
    `=== YouTubeショート投稿用 ===`,
    `タイトル: ${plan.youtube_title}`,
    `説明: ${plan.youtube_description}`,
    ``,
    `=== 動画生成プロンプト ===`,
    plan.video_prompt,
  ].join('\n');

  const postPath = path.join(OUT_DIR, 'latest_promo_post.txt');
  fs.writeFileSync(postPath, postText + '\n', 'utf-8');
  console.log(`\n📝 投稿文＆プロンプトを保存しました: ${postPath}`);
  console.log('----------------------------------------------------');
  console.log(postText);
  console.log('----------------------------------------------------');

  if (isDryRun) {
    console.log('🧪 --dry-run のため動画生成APIの呼び出しはスキップしました。');
    return;
  }

  const videoBuffer = await generateVideoWithGemini(plan.video_prompt, {
    duration,
    resolution,
    aspectRatio: '9:16',
  });

  const datedPath = path.join(OUT_DIR, `promo_${today}_${mode}.mp4`);
  const latestPath = path.join(OUT_DIR, 'latest_promo.mp4');
  fs.writeFileSync(datedPath, videoBuffer);
  fs.writeFileSync(latestPath, videoBuffer);

  console.log(`\n🎉 縦型ショート動画の生成が完了しました！`);
  console.log(`   保存先: ${datedPath}`);
  console.log(`   最新版: ${latestPath}`);
}

main().catch((err) => {
  console.error(`\n❌ エラー: ${err.message}`);
  process.exit(1);
});
