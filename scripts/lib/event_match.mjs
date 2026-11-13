/**
 * scripts/lib/event_match.mjs
 * 「リンク先が本当にその大会のページか」を判定するロジック
 *  - 大会名から固有語（地名・固有名詞）を抽出し、ページ本文に含まれているかを2文字単位で照合
 *  - RUNNET/モシコム等ポータルの「トップページ」や「検索結果ページ」は大会固有ページではないため不合格
 *  - 申込ページが過去年度のものでないかを年号で確認
 */

const GENERIC_WORDS = [
  'ウルトラマラソン', 'ハーフマラソン', 'フルマラソン', 'マラソン大会', 'マラソン', 'ウルトラ', 'トレイルランニング', 'トレイルラン', 'トレイルレース',
  'トレイル', 'トレラン', 'ランニング', 'ロードレース', 'リレーマラソン', 'ラン', 'レース', '大会', 'ジャーニー', 'スカイランニング', 'スカイレース', 'バーティカル',
  'サイクリング', 'サイクルロードレース', 'サイクル', 'ロングライド', 'ヒルクライム', 'エンデューロ', 'グランフォンド', 'ブルベ', 'クリテリウム', 'ライド', 'センチュリーライド',
  'アドベンチャーレース', 'アドベンチャー', 'ロゲイニング', 'ロゲイン', 'オリエンテーリング', 'トライアスロン', 'アクアスロン', 'デュアスロン', 'スイム', 'チャレンジ', 'フェスティバル', 'フェス',
  '選手権', '記念', '国際', '全国', '大会', '部門', 'シリーズ', 'カップ', 'ステージ', 'エクストリーム', 'マウンテン', 'ゲーム', 'ツアー', 'イベント', 'オープン',
  'in', 'the', 'of', 'and', 'race', 'trail', 'run', 'running', 'ultra', 'marathon', 'cup', 'series', 'festival', 'mtb', 'km', 'mile', 'miles', 'k',
];

export function norm(s) {
  return (s || '').normalize('NFKC').toLowerCase().replace(/[\s　・･\-‐－―—_.,，、。:：;；!！?？'"“”‘’()（）［］\[\]【】「」『』〈〉《》<>／/~〜～&＆+＋#＃@＠|｜*＊]/g, '');
}

/** 大会名から括弧内の補足（「（長野・90km）」等の説明書き）を除いた本体名 */
export function coreTitle(title) {
  const t = (title || '').normalize('NFKC');
  const stripped = t.replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length >= 3 ? stripped : t;
}

/** 大会名から固有語（比較対象）を抽出 */
export function distinctiveParts(title) {
  let t = coreTitle(title);
  t = t.replace(/第\s*\d+\s*回/g, ' ').replace(/20\d{2}\s*年?/g, ' ').replace(/\d+(\.\d+)?\s*(km|k|キロ|マイル|mile|miles|m|時間|h)/gi, ' ');
  t = t.replace(/[0-9]+/g, ' ');
  let low = t.toLowerCase();
  for (const w of [...GENERIC_WORDS].sort((a, b) => b.length - a.length)) {
    if (/^[a-z]+$/.test(w)) low = low.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ');
    else low = low.split(w.toLowerCase()).join(' ');
  }
  const stopHiragana = new Set(['から', 'まで', 'など', 'にて', 'での', 'への', 'との', 'より']);
  return low.split(/[\s　・･\-‐－―—_.,，、。:：;；!！?？'"“”‘’()（）［］\[\]【】「」『』〈〉《》<>／/~〜～&＆+＋#＃@＠|｜*＊]+/)
    .map((p) => norm(p))
    .filter((p) => p.length >= 2 && !stopHiragana.has(p));
}

function bigrams(s) {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 漢字・カタカナ・英字の連続トークンを抽出（複合語の補助照合用） */
function subTokens(s) {
  return (s.match(/[\u4e00-\u9faf]{2,}|[ァ-ヶー]{2,}|[a-z]{3,}|[ぁ-ん]{3,}/g) || []);
}

/**
 * ページ本文がその大会のものか採点 (0〜1)
 *  固有語の2文字片のうち、ページに含まれる割合。複合語内の主要漢字トークン一致も考慮
 */
export function matchScore(title, pageText) {
  const parts = distinctiveParts(title);
  const page = norm(pageText || '');
  if (!parts.length) {
    const whole = norm(coreTitle(title)).replace(/20\d{2}/g, '');
    return { score: whole && page.includes(whole) ? 1 : 0, parts, hit: [] };
  }
  let total = 0, found = 0;
  const hit = [];
  const subs = [];
  for (const p of parts) {
    if (page.includes(p)) hit.push(p);
    for (const st of subTokens(p)) {
      subs.push(st);
      if (page.includes(st)) hit.push(st);
    }
    const bg = p.length >= 2 ? bigrams(p) : [p];
    for (const b of bg) { total++; if (page.includes(b)) found++; }
  }
  const bgScore = total ? found / total : 0;
  const maxPartLen = Math.max(...parts.map((p) => p.length));
  const wholeScore = hit.length ? Math.max(...hit.map((h) => h.length)) / maxPartLen : 0;
  // 固有語が1つだけで複合語（例: 「奥三河パワー」「歴史街道丹後」）の場合、漢字部分（「奥三河」「丹後」）がページに含まれれば高信頼
  const subMatch = subs.some((st) => st.length >= 2 && page.includes(st) && st.length / maxPartLen >= 0.45);
  return { score: Math.max(bgScore * 0.9, wholeScore, subMatch ? 0.65 : 0), parts, hit: [...new Set(hit)] };
}

export const MATCH_THRESHOLD = 0.6;
export const WEAK_THRESHOLD = 0.3;

const PORTAL_HOSTS = [
  'runnet.jp', 'moshicom.com', 'www.moshicom.com', 'sportsentry.ne.jp', 'www.sportsentry.ne.jp', 'spoen.jp',
  'l-tike.com', 'www.l-tike.com', 'e-moshicom.com', 'www.e-moshicom.com', 'race.runnet.jp', 'tor.runnet.jp',
  'jtb-sports.jp', 'www.jtbsports.jp', 'peatix.com', 'r-wellness.com', 'www.r-wellness.com', 'itra.run', 'utmb.world',
  'sports-entry.com', 'www.sports-entry.com', 'spotsuna.jp', 'www.spotsuna.jp', 'japan-ultratrail.com', 'tri-x.jp', 'kokucheese.com',
];

/** ポータルのトップ／検索結果など「大会固有ではない」URLか */
export function isGenericPortalUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, '');
    const isPortal = PORTAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    if (!isPortal) return false;
    if (path === '' || path === '/index.html' || path === '/index.php') return !u.search;
    if (/\/(search|list|event_list|events?)$/i.test(path) && !u.search) return true;
    if (/search/i.test(path) && !/detail|raceid|event\/\w/i.test(path + u.search)) return true;
    return false;
  } catch { return true; }
}

/** 年号の妥当性: 大会開催年 Y がページに出てくるか、過去年だけしか出てこないか */
export function yearCheck(dateStr, pageText) {
  const y = Number((dateStr || '').slice(0, 4));
  if (!y) return { ok: true, reason: '' };
  const text = (pageText || '').normalize('NFKC');
  const reiwa = y - 2018;
  const has = text.includes(String(y)) || new RegExp(`令和\\s*${reiwa}\\s*年`).test(text) || new RegExp(`R\\s*${reiwa}[年.]`).test(text);
  if (has) return { ok: true, reason: '' };
  const prev = [y - 1, y - 2].filter((p) => text.includes(String(p)));
  if (prev.length) return { ok: false, reason: `ページに${y}年の記載がなく過去年(${prev.join(',')})のみ` };
  return { ok: true, reason: '年号記載なし' };
}

/** 月日表記がページに含まれるか（新規大会の開催日裏取り用） */
export function dateMentioned(dateStr, pageText) {
  const m = (dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const [, y, mm, dd] = m;
  const M = Number(mm), D = Number(dd);
  const t = (pageText || '').normalize('NFKC').replace(/\s+/g, '');
  const pats = [
    `${M}月${D}日`, `${mm}月${dd}日`, `${y}/${M}/${D}`, `${y}/${mm}/${dd}`, `${y}.${M}.${D}`, `${y}.${mm}.${dd}`, `${y}-${mm}-${dd}`, `${y}年${M}月${D}日`,
    `${M}/${D}(`, `${M}.${D}(`,
  ];
  return pats.some((p) => t.includes(p));
}

/** 総合判定: リンク先がこの大会の正しいページか */
export function judgeEventPage(ev, page, type = 'official') {
  if (page.kind !== 'ok') return { verdict: page.kind, reason: page.reason };
  const url = page.finalUrl || '';
  if (isGenericPortalUrl(url)) return { verdict: 'wrong', reason: `ポータルのトップ/検索ページ（${url}）` };
  const ms = matchScore(ev.title, page.text);
  const pct = Math.round(ms.score * 100);
  if (ms.score < MATCH_THRESHOLD) {
    // 一部一致でも、開催日（月日）がページに載っていれば同じ大会と判断
    if (ms.score >= WEAK_THRESHOLD && dateMentioned(ev.date, page.text)) {
      return { verdict: 'ok', score: ms.score, stale: false, reason: `一部一致${pct}%＋開催日一致` };
    }
    if (ms.score >= WEAK_THRESHOLD) {
      return { verdict: 'weak', reason: `大会名の一部のみ一致（一致度${pct}%・固有語:${ms.parts.join('/')}）`, score: ms.score };
    }
    return { verdict: 'wrong', reason: `大会名と不一致（一致度${pct}%・固有語:${ms.parts.join('/')}）`, score: ms.score };
  }
  if (type === 'entry') {
    const yc = yearCheck(ev.date, page.text);
    if (!yc.ok) return { verdict: 'wrong', reason: `申込ページが過去大会のもの（${yc.reason}）`, score: ms.score };
  }
  const yc = yearCheck(ev.date, page.text);
  return { verdict: 'ok', score: ms.score, stale: !yc.ok, reason: yc.reason };
}
