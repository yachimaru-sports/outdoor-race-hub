/**
 * scripts/post_to_x.mjs
 * 毎朝8時の自動更新・GitHub Pagesデプロイ完了後に、
 * 最新の更新内容（大会情報・特価ギア）から X（@yachimaru000）向けの
 * 投稿用テキスト・ワンタップ投稿リンク・画像URLを生成するスクリプト。
 *
 * オプション:
 *   --dry-run             : プレビュー表示のみ
 *   --draft-file=<path>   : メール送信用テキストファイルを指定パスへ出力
 *   --post-api            : X API v2 (OAuth 1.0a) での直接自動投稿も試みる
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SITE_URL = 'https://yachimaru-sports.github.io/outdoor-race-hub/';
const OGP_IMAGE_URL = 'https://yachimaru-sports.github.io/outdoor-race-hub/og-image.jpg';
const META_PATH = 'src/data/meta.json';
const CHANGELOG_PATH = 'src/data/changelog.json';
const EVENTS_PATH = 'src/data/events.json';
const DEALS_PATH = 'src/data/deals.json';

const isDryRun = process.argv.includes('--dry-run');
const shouldPostApi = process.argv.includes('--post-api');
const draftFileArg = process.argv.find((a) => a.startsWith('--draft-file='));
const draftFilePath = draftFileArg ? draftFileArg.slice('--draft-file='.length) : null;

/** 日本時間（JST）の YYYY-MM-DD を取得 */
function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** Xの文字数ウェイトを計算（半角1、全角2、URLは23扱い） */
function calcTweetWeight(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
  const urlMatches = text.match(/https?:\/\/\S+/g) || [];
  let weight = urlMatches.length * 23;
  for (const ch of withoutUrls) {
    weight += ch.charCodeAt(0) <= 0x7f ? 1 : 2;
  }
  return weight;
}

/** 指定ウェイト以内に文字列を省略する */
function truncateByWeight(str, maxWeight) {
  let weight = 0;
  let result = '';
  for (const ch of str) {
    const w = ch.charCodeAt(0) <= 0x7f ? 1 : 2;
    if (weight + w > maxWeight - 2) {
      return result + '…';
    }
    weight += w;
    result += ch;
  }
  return result;
}

/** 当日の更新データから投稿文と注目画像情報を組み立てる */
function buildTweetPayload() {
  const today = getTodayJST();
  let meta = {};
  let changelog = [];
  let events = [];
  let deals = [];

  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { /* ignore */ }
  try { changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf-8')); } catch { /* ignore */ }
  try { events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8')); } catch { /* ignore */ }
  try { deals = JSON.parse(fs.readFileSync(DEALS_PATH, 'utf-8')); } catch { /* ignore */ }

  const todayLogs = changelog.filter((c) => c.date === today);
  const priceDrop = todayLogs.find((c) => c.type === 'price_drop');
  const dealAdded = todayLogs.find((c) => c.type === 'deal_added');
  const eventAdded = todayLogs.find((c) => c.type === 'event_added');

  // まもなく締切の大会を1件取得
  const closingSoon = events.find(
    (e) => e.entry_status === 'closing_soon' && e.entry_deadline >= today
  );

  // 本日の注目ギア（値下げ品 or 新着品 or 割引率トップ）の画像を取得
  const targetGearId = priceDrop?.gearId || dealAdded?.gearId;
  let featuredDeal = targetGearId ? deals.find((d) => d.id === targetGearId) : null;
  if (!featuredDeal && deals.length > 0) {
    featuredDeal = [...deals].sort((a, b) => (b.discount_rate || 0) - (a.discount_rate || 0))[0];
  }

  const lines = [];
  lines.push(`⚡【毎朝8時更新】OUTDOOR RACE HUB`);

  const eventsCount = meta.events_count || events.length || 0;
  const dealsCount = meta.deals_count || deals.length || 0;
  lines.push(`大会${eventsCount}件・特価ギア${dealsCount}件を最新化しました！`);

  // 本日のハイライトを優先度順に最大2つピックアップ
  const highlights = [];
  if (eventAdded) {
    highlights.push(`🆕 ${truncateByWeight(eventAdded.title.replace(/^新規大会追加:\s*/, ''), 56)}`);
  }
  if (priceDrop) {
    highlights.push(`🔥 ${truncateByWeight(priceDrop.title.replace(/^値下げ検知:\s*/, ''), 44)} (${priceDrop.detail || '値下げ'})`);
  } else if (dealAdded) {
    highlights.push(`🏷️ ${truncateByWeight(dealAdded.title.replace(/^新着特価ギア発掘:\s*/, ''), 46)} (${dealAdded.detail || '特価'})`);
  }
  if (highlights.length < 2 && closingSoon) {
    highlights.push(`⏳締切間近: ${truncateByWeight(closingSoon.title, 44)}(〜${closingSoon.entry_deadline.slice(5)})`);
  }

  if (highlights.length > 0) {
    lines.push('');
    lines.push(...highlights);
  }

  lines.push('');
  lines.push(SITE_URL);
  lines.push('#トレラン #マラソン #サイクル #アウトドア');

  let text = lines.join('\n');

  if (calcTweetWeight(text) > 280 && highlights.length > 1) {
    const fallbackLines = [
      lines[0],
      lines[1],
      '',
      highlights[0],
      '',
      SITE_URL,
      '#トレラン #マラソン #アウトドア',
    ];
    text = fallbackLines.join('\n');
  }
  if (calcTweetWeight(text) > 280) {
    text = [
      lines[0],
      lines[1],
      '',
      SITE_URL,
      '#トレラン #マラソン #アウトドア',
    ].join('\n');
  }

  return {
    today,
    tweetText: text,
    intentUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
    featuredDeal,
  };
}

/** メール送信用本文を作成 */
function buildMailBody({ today, tweetText, intentUrl, featuredDeal }) {
  const sections = [
    `OUTDOOR RACE HUB の毎朝更新（${today}）が完了しました！`,
    `そのままX（@yachimaru000）へ投稿できるテキストをお送りします。`,
    '',
    '========================================',
    '📱 ワンタップでX投稿画面を開く（スマホ・PC対応）',
    '========================================',
    intentUrl,
    '',
    '========================================',
    '📋 コピペ用X投稿テキスト',
    '========================================',
    tweetText,
    '',
    '========================================',
    '🖼️ 画像・アイキャッチについて',
    '========================================',
    '※サイトURLを含めて投稿すると、自動で大きなアイキャッチ画像（OGPカード）が表示されます：',
    `サイトOGP画像: ${OGP_IMAGE_URL}`,
  ];

  if (featuredDeal?.image_url) {
    sections.push('');
    sections.push(`本日の注目ギア画像（${featuredDeal.title}）:`);
    sections.push(featuredDeal.image_url);
  }

  sections.push('');
  sections.push('※画像付きで投稿したい場合は、上記の画像URLを開いて保存し、Xの投稿画面で添付してください。');

  return sections.join('\n');
}

/** RFC 3986 準拠のパーセントエンコード */
function percentEncode(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** OAuth 1.0a Authorization ヘッダー生成 */
function createOAuthHeader(method, url, { apiKey, apiSecret, accessToken, accessTokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
    .join(', ');

  return `OAuth ${headerString}`;
}

async function main() {
  const payload = buildTweetPayload();
  const weight = calcTweetWeight(payload.tweetText);

  console.log('--- 生成されたX投稿内容 ---');
  console.log(payload.tweetText);
  console.log(`--- 文字数ウェイト: ${weight} / 280 ---`);

  if (draftFilePath) {
    fs.mkdirSync(path.dirname(draftFilePath), { recursive: true });
    fs.writeFileSync(draftFilePath, buildMailBody(payload), 'utf-8');
    console.log(`✉️ メール送信用テキストを出力しました: ${draftFilePath}`);
  }

  if (isDryRun || !shouldPostApi) {
    if (isDryRun) console.log('🧪 --dry-run モードのためAPI投稿はスキップしました。');
    return;
  }

  const apiKey = process.env.X_API_KEY?.trim();
  const apiSecret = process.env.X_API_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim();

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('⚠️ X APIキー（GitHub Secrets）が未設定のため、API投稿をスキップします。');
    return;
  }

  const endpoint = 'https://api.twitter.com/2/tweets';
  const authHeader = createOAuthHeader('POST', endpoint, {
    apiKey,
    apiSecret,
    accessToken,
    accessTokenSecret,
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: payload.tweetText }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('❌ X API 投稿エラー:', res.status, JSON.stringify(data));
    process.exitCode = 1;
    return;
  }

  console.log('✅ X（@yachimaru000）への自動投稿に成功しました！ Tweet ID:', data?.data?.id);
}

main().catch((err) => {
  console.error('❌ 予期せぬエラー:', err);
  process.exitCode = 1;
});
