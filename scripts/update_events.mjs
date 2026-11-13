/**
 * scripts/update_events.mjs
 * 大会情報の毎朝自動更新エンジン
 *
 * 1. 開催終了大会のアーカイブ移動 ＆ 次回開催（来年）の自動調査・登録
 * 2. 新しい大会の自動調査・追加（公式ページ実アクセス＋大会名＋開催日の裏取り必須）
 * 3. 全大会リンクの内容照合＆自己修復（リンク切れ・ポータルトップ・別大会・乗っ取り・過去年申込を排除）
 * 4. 開催日・エントリー期間・参加費の最新化 ＆ changelog.json / meta.json 出力
 */
import fs from 'node:fs';
import { fetchPage, pool, sleep } from './lib/http.mjs';
import { judgeEventPage, dateMentioned, isGenericPortalUrl, coreTitle } from './lib/event_match.mjs';
import { askGeminiSearch, extractJson, extractUrls, hasGeminiKey } from './lib/gemini.mjs';
import { appendChangelog, nowJstParts } from './lib/changelog.mjs';
import { normalizeRaceTitle, isSameOrOverlappingDate } from './audit-duplicates.mjs';

const EVENTS_PATH = 'src/data/events.json';
const ARCHIVE_PATH = 'src/data/events_archive.json';
const META_PATH = 'src/data/meta.json';

const REGIONS = {
  北海道: '北海道',
  青森県: '東北', 岩手県: '東北', 宮城県: '東北', 秋田県: '東北', 山形県: '東北', 福島県: '東北',
  茨城県: '関東', 栃木県: '関東', 群馬県: '関東', 埼玉県: '関東', 千葉県: '関東', 東京都: '関東', 神奈川県: '関東',
  新潟県: '甲信越', 山梨県: '甲信越', 長野県: '甲信越',
  富山県: '北陸', 石川県: '北陸', 福井県: '北陸',
  岐阜県: '東海', 静岡県: '東海', 愛知県: '東海', 三重県: '東海',
  滋賀県: '関西', 京都府: '関西', 大阪府: '関西', 兵庫県: '関西', 奈良県: '関西', 和歌山県: '関西',
  鳥取県: '中国', 島根県: '中国', 岡山県: '中国', 広島県: '中国', 山口県: '中国',
  徳島県: '四国', 香川県: '四国', 愛媛県: '四国', 高知県: '四国',
  福岡県: '九州・沖縄', 佐賀県: '九州・沖縄', 長崎県: '九州・沖縄', 熊本県: '九州・沖縄', 大分県: '九州・沖縄', 宮崎県: '九州・沖縄', 鹿児島県: '九州・沖縄', 沖縄県: '九州・沖縄',
};

const DEFAULT_GEAR = {
  trail: [
    { name: '防水透湿レインウェア', category: 'ウェア' },
    { name: 'トレイルランニングシューズ', category: 'シューズ' },
    { name: 'ハイドレーションパック・ソフトフラスク', category: 'ギア' },
    { name: 'ヘッドライト・予備電池', category: 'ライト' },
  ],
  marathon: [
    { name: 'ランニングシューズ', category: 'シューズ' },
    { name: '補給食・エネルギージェル', category: '補給' },
    { name: 'マイカップ・携帯コップ', category: 'ギア' },
  ],
  cycling: [
    { name: 'JCF公認ヘルメット', category: 'ギア' },
    { name: '前後ライト・リフレクター', category: 'ライト' },
    { name: '携帯工具・パンク修理キット', category: 'ギア' },
  ],
  adventure: [
    { name: 'コンパス・防水マップケース', category: 'ギア' },
    { name: 'ファーストエイドキット・エマージェンシーシート', category: 'ギア' },
    { name: 'ヘッドライト・防寒レインウェア', category: 'ライト' },
  ],
};

function todayJst() {
  return nowJstParts().date;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eventEndDate(ev) {
  if (ev.end_date && /^\d{4}-\d{2}-\d{2}$/.test(ev.end_date)) return ev.end_date;
  const d = ev.date || '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})[~〜](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[4].padStart(2, '0')}`;
  return d.slice(0, 10);
}

function computeStatus(ev, today) {
  const end = eventEndDate(ev);
  if (end && end < today) return 'closed';
  if (ev.entry_deadline && /^\d{4}-\d{2}-\d{2}$/.test(ev.entry_deadline) && ev.entry_deadline < today) return 'closed';
  if (ev.entry_start_date && /^\d{4}-\d{2}-\d{2}$/.test(ev.entry_start_date) && ev.entry_start_date > today) return 'upcoming';
  const soon = addDays(today, 21);
  if (ev.entry_deadline && today <= ev.entry_deadline && ev.entry_deadline <= soon) return 'closing_soon';
  return ev.entry_status === 'closed' ? 'closed' : 'open';
}

function slugifyId(title, date) {
  const y = (date || '').slice(0, 4) || '2027';
  const base = coreTitle(title).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const h = [...title].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(36).replace('-', '');
  return `${base ? base.slice(0, 28) : 'race'}-${h}-${y}`;
}

function isDuplicateEvent(cand, list) {
  const cn = normalizeRaceTitle(cand.title);
  for (const ev of list) {
    if (ev.id === cand.id) return true;
    const en = normalizeRaceTitle(ev.title);
    if (cn && en && (cn === en || cn.includes(en) || en.includes(cn))) {
      if (isSameOrOverlappingDate(cand.date, ev.date)) return true;
    }
  }
  return false;
}

/** 候補URLを実際に開いて、その大会の正しいページか検証して返す */
async function verifyCandidateUrl(ev, rawUrl, type, { requireDate = false } = {}) {
  if (!rawUrl || !/^https?:\/\//.test(rawUrl) || isGenericPortalUrl(rawUrl)) return null;
  const page = await fetchPage(rawUrl);
  const j = judgeEventPage(ev, page, type);
  if (j.verdict !== 'ok') return null;
  if (requireDate && !dateMentioned(ev.date, page.text)) return null;
  return { url: page.finalUrl || rawUrl, stale: Boolean(j.stale) };
}

/** Gemini で大会の正しい公式URL・申込URL・最新情報を検索 */
async function researchEventLinks(ev, needOfficial, needEntry) {
  if (!hasGeminiKey()) return {};
  const prompt = [
    `次の日本のスポーツ・アウトドア大会について、現在有効な公式サイトURLと申込ページURL（RUNNET、モシコム、スポーツエントリー等の個別大会ページのみ。トップページは不可）をGoogle検索で特定してください。`,
    `大会名: ${ev.title}`,
    `開催予定日: ${ev.date}`,
    `開催地: ${ev.prefecture || ''} ${ev.region || ''}`,
    `出力はJSONのみ: {"official_url": "...", "entry_url": "..."}（見つからない項目は ""）`,
  ].join('\n');
  const text = await askGeminiSearch(prompt);
  const obj = extractJson(text);
  const urls = extractUrls(text);
  const res = {};
  if (needOfficial) {
    for (const cand of [obj?.official_url, ...urls].filter(Boolean)) {
      const v = await verifyCandidateUrl(ev, cand, 'official');
      if (v) { res.official = v; break; }
    }
  }
  if (needEntry) {
    for (const cand of [obj?.entry_url, ...urls].filter(Boolean)) {
      const v = await verifyCandidateUrl(ev, cand, 'entry');
      if (v) { res.entry = v; break; }
    }
  }
  return res;
}

/** 終了した大会の次回開催を調査して返す（見つからなければ null） */
async function findNextEdition(ev, today) {
  if (!hasGeminiKey()) return null;
  const nextYear = Number((ev.date || today).slice(0, 4)) + 1;
  const prompt = [
    `「${coreTitle(ev.title)}」（開催地: ${ev.prefecture}）の次回（${nextYear}年以降、本日${today}より未来）の開催情報が公式に発表されているかGoogle検索してください。`,
    `まだ次回の日程が発表されていない場合は {"announced": false} だけ出力してください。`,
    `発表されている場合のみ次のJSONを出力（推測・前年日程の流用は厳禁）:`,
    `{"announced": true, "title": "大会正式名", "date": "YYYY-MM-DD", "entry_start_date": "YYYY-MM-DDまたは空", "entry_deadline": "YYYY-MM-DDまたは空", "entry_fee": "例: 12,000円", "official_url": "https://...", "entry_url": "https://..."}`,
  ].join('\n');
  const text = await askGeminiSearch(prompt);
  const obj = extractJson(text);
  if (!obj || !obj.announced || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date || '') || obj.date <= today) return null;

  const nextEv = {
    ...ev,
    id: slugifyId(obj.title || ev.title, obj.date),
    title: obj.title || ev.title,
    date: obj.date,
    end_date: undefined,
    month: Number(obj.date.slice(5, 7)),
    entry_start_date: /^\d{4}-\d{2}-\d{2}$/.test(obj.entry_start_date || '') ? obj.entry_start_date : null,
    entry_deadline: /^\d{4}-\d{2}-\d{2}$/.test(obj.entry_deadline || '') ? obj.entry_deadline : '',
    entry_fee: obj.entry_fee || ev.entry_fee,
    links: { official: null, entry: null, review: null, sns: null, verified: true, verified_at: today },
    added_at: today,
    updated_at: today,
  };
  nextEv.entry_status = computeStatus(nextEv, today);

  const off = await verifyCandidateUrl(nextEv, obj.official_url, 'official', { requireDate: true });
  const ent = await verifyCandidateUrl(nextEv, obj.entry_url, 'entry', { requireDate: true });
  if (!off && !ent) return null;
  nextEv.links.official = off?.url || null;
  nextEv.links.entry = ent?.url || null;
  if (off?.stale) nextEv.links.official_stale = true;
  return nextEv;
}

/** カテゴリ別に最新の大会をWebから新規発掘 */
async function discoverNewEvents(existingEvents, today, maxAdd = 8) {
  if (!hasGeminiKey()) return [];
  const endWindow = addDays(today, 300);
  const queries = [
    { cat: 'trail', sub: 'トレイルランニング', label: 'トレイルランニング大会（日本国内・15km以上）' },
    { cat: 'marathon', sub: 'ウルトラ・マラソン', label: 'ウルトラマラソン・フルマラソン大会（日本国内）' },
    { cat: 'cycling', sub: 'ロングライド・ヒルクライム', label: 'サイクルイベント・ヒルクライム・グランフォンド（日本国内）' },
    { cat: 'adventure', sub: 'ロゲイニング・アドベンチャー', label: 'アドベンチャーレース・ロゲイニング大会（日本国内）' },
  ];
  const added = [];
  for (const q of queries) {
    if (added.length >= maxAdd) break;
    const prompt = [
      `本日(${today})から${endWindow}の間に日本国内で開催される最新の「${q.label}」で、現在公式サイトやエントリーページが公開されている大会を5件、Google検索で見つけてJSON配列で出力してください。`,
      `架空の大会や過去日程は禁止。URLは必ず各大会の個別公式ページまたはRUNNET/モシコム/スポーツエントリーの個別ページ（トップページ禁止）。`,
      `フォーマット: [{"title":"","date":"YYYY-MM-DD","prefecture":"都道府県名","distance_km":数値,"elevation_m":数値,"entry_fee":"例: 10,000円","entry_start_date":"YYYY-MM-DDまたは空","entry_deadline":"YYYY-MM-DDまたは空","venue_name":"会場名","official_url":"https://...","entry_url":"https://..."}]`,
    ].join('\n');
    const text = await askGeminiSearch(prompt);
    const list = extractJson(text);
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      if (added.length >= maxAdd) break;
      if (!item?.title || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '') || item.date <= today) continue;
      const pref = item.prefecture || '';
      const cand = {
        id: slugifyId(item.title, item.date),
        category: q.cat,
        subCategory: q.sub,
        elements: [q.sub],
        title: item.title.trim(),
        date: item.date,
        month: Number(item.date.slice(5, 7)),
        region: REGIONS[pref] || '全国',
        prefecture: pref || '全国',
        distance_km: Number(item.distance_km) || 0,
        elevation_m: Number(item.elevation_m) || 0,
        entry_fee: item.entry_fee || '要確認',
        entry_status: 'open',
        entry_start_date: /^\d{4}-\d{2}-\d{2}$/.test(item.entry_start_date || '') ? item.entry_start_date : null,
        entry_deadline: /^\d{4}-\d{2}-\d{2}$/.test(item.entry_deadline || '') ? item.entry_deadline : '',
        links: { official: null, entry: null, review: null, sns: null, verified: true, verified_at: today },
        mandatory_gear: DEFAULT_GEAR[q.cat],
        venue: { name: item.venue_name || pref || '現地会場', mapQuery: `${pref} ${item.venue_name || item.title}`.trim() },
        source: { portalName: 'AI検索・公式確認' },
        added_at: today,
        updated_at: today,
      };
      cand.entry_status = computeStatus(cand, today);
      if (isDuplicateEvent(cand, [...existingEvents, ...added])) continue;

      const off = await verifyCandidateUrl(cand, item.official_url, 'official', { requireDate: true });
      const ent = await verifyCandidateUrl(cand, item.entry_url, 'entry', { requireDate: true });
      if (!off && !ent) continue;

      cand.links.official = off?.url || null;
      cand.links.entry = ent?.url || null;
      if (off?.stale) cand.links.official_stale = true;
      added.push(cand);
      console.log(`✨ 新規大会追加: ${cand.title} (${cand.date}) -> ${cand.links.official || cand.links.entry}`);
    }
    await sleep(1000);
  }
  return added;
}

/** モシコム公開検索からGemini不要で新着大会を発見（練習会・試走会は除外） */
async function discoverFromMoshicom(existingEvents, today, maxAdd = 4) {
  const queries = [
    { cat: 'trail', sub: 'トレイルランニング', kw: 'トレイルラン' },
    { cat: 'marathon', sub: 'ウルトラ・マラソン', kw: 'ウルトラマラソン' },
    { cat: 'cycling', sub: 'サイクリング・ライド', kw: 'サイクリング' },
    { cat: 'adventure', sub: 'ロゲイニング', kw: 'ロゲイニング' },
  ];
  const dayOffset = Math.floor(Date.now() / 86400000) % queries.length;
  const rotated = [...queries.slice(dayOffset), ...queries.slice(0, dayOffset)];
  const added = [];
  const prefList = Object.keys(REGIONS);

  for (const q of rotated) {
    if (added.length >= maxAdd) break;
    const searchUrl = `https://moshicom.com/search/?keyword=${encodeURIComponent(q.kw)}`;
    const listPage = await fetchPage(searchUrl);
    if (listPage.kind !== 'ok') continue;
    const links = [...new Set([...(listPage.html || '').matchAll(/href=["'](https:\/\/moshicom\.com\/\d+)[^"']*/g)].map((m) => m[1]))];
    for (const u of links.slice(0, 6)) {
      if (added.length >= maxAdd) break;
      const p = await fetchPage(u);
      if (p.kind !== 'ok') continue;
      const rawTitle = (p.title || '').split('|')[0].trim();
      if (!rawTitle || /練習会|試走|講習|クリニック|セミナー|交流会|オンライン/.test(rawTitle)) continue;
      // 開催日抽出（YYYY年M月D日）
      const dm = p.text.match(/(202[6-9])年\s*(\d{1,2})月\s*(\d{1,2})日/);
      if (!dm) continue;
      const date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
      if (date <= today) continue;
      const pref = prefList.find((pr) => p.text.includes(pr)) || '全国';
      const cand = {
        id: slugifyId(rawTitle, date),
        category: q.cat,
        subCategory: q.sub,
        elements: [q.sub],
        title: rawTitle,
        date,
        month: Number(date.slice(5, 7)),
        region: REGIONS[pref] || '全国',
        prefecture: pref,
        distance_km: 0,
        elevation_m: 0,
        entry_fee: 'モシコム確認',
        entry_status: 'open',
        entry_start_date: null,
        entry_deadline: '',
        links: { official: null, entry: p.finalUrl || u, review: null, sns: null, verified: true, verified_at: today },
        mandatory_gear: DEFAULT_GEAR[q.cat],
        venue: { name: pref, mapQuery: `${pref} ${rawTitle}`.trim() },
        source: { portalName: 'モシコム', portalUrl: u },
        added_at: today,
        updated_at: today,
      };
      if (isDuplicateEvent(cand, [...existingEvents, ...added])) continue;
      added.push(cand);
      console.log(`✨ モシコム新着大会追加: ${cand.title} (${cand.date}) -> ${u}`);
    }
  }
  return added;
}

async function main() {
  const today = todayJst();
  const { time } = nowJstParts();
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  let archive = [];
  try { archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf-8')); } catch { archive = []; }

  const stats = { events_added: 0, events_updated: 0, events_archived: 0, links_fixed: 0, links_removed: 0 };
  const logs = [];

  // 1. 開催終了大会をアーカイブへ分離し、日本開催のものは次回開催を調査（1日最大12件）
  const active = [];
  const ended = [];
  for (const ev of events) {
    if (eventEndDate(ev) < today) ended.push(ev);
    else active.push(ev);
  }
  console.log(`📅 本日(${today}): 継続 ${active.length} 件 / 開催終了 ${ended.length} 件`);

  const archiveIds = new Set(archive.map((a) => a.id));
  let nextEditionChecks = 0;
  for (const ev of ended) {
    if (!archiveIds.has(ev.id)) {
      archive.push({ ...ev, entry_status: 'closed', archived_at: today });
      archiveIds.add(ev.id);
      stats.events_archived++;
    }
  }

  // 1.5 新規大会の発見を最優先で実行（Gemini 4回枠 ＋ モシコム直接検索）
  const newEvents = await discoverNewEvents(active, today, 6);
  const moshicomNew = await discoverFromMoshicom([...active, ...newEvents], today, 4);
  for (const ne of [...newEvents, ...moshicomNew]) {
    active.push(ne);
    stats.events_added++;
    logs.push({
      id: `ev-add-${ne.id}-${today}`,
      date: today, time, type: 'event_added',
      title: `新着大会追加: ${ne.title}`,
      detail: `${ne.prefecture} / ${ne.date}（公式・申込ページ実確認済み）`,
      eventId: ne.id,
    });
  }

  // 終了大会のうち最大4件/日まで次回開催を調査
  for (const ev of ended) {
    if (nextEditionChecks >= 4 || !hasGeminiKey()) break;
    if (ev.region === '海外') continue;
    nextEditionChecks++;
    const nextEv = await findNextEdition(ev, today);
    if (nextEv && !isDuplicateEvent(nextEv, active)) {
      active.push(nextEv);
      stats.events_added++;
      logs.push({
        id: `ev-next-${nextEv.id}-${today}`,
        date: today, time, type: 'event_updated',
        title: `次回開催決定: ${nextEv.title}`,
        detail: `開催日 ${nextEv.date}（公式/申込ページで日程・リンク確認済み）`,
        eventId: nextEv.id,
      });
      console.log(`🔄 次回開催を登録: ${nextEv.title} (${nextEv.date})`);
    }
    await sleep(800);
  }

  // 2. 継続大会の全リンク実アクセス＆内容照合
  const urls = [...new Set(active.flatMap((e) => [e.links?.official, e.links?.entry].filter(Boolean)))];
  const pageCache = new Map();
  await pool(urls, 8, async (u) => { pageCache.set(u, await fetchPage(u)); });

  let geminiFixCalls = 0;
  const MAX_FIX_CALLS = 4;
  const finalActive = [];

  for (const ev of active) {
    const prevStatus = ev.entry_status;
    ev.entry_status = computeStatus(ev, today);
    if (prevStatus !== ev.entry_status) {
      ev.updated_at = today;
      stats.events_updated++;
    }

    const offUrl = ev.links?.official || null;
    const entUrl = ev.links?.entry || null;
    const offPage = offUrl ? pageCache.get(offUrl) : null;
    const entPage = entUrl ? pageCache.get(entUrl) : null;
    const offJudge = offUrl ? judgeEventPage(ev, offPage, 'official') : { verdict: 'none' };
    const entJudge = entUrl ? judgeEventPage(ev, entPage, 'entry') : { verdict: 'none' };

    const needFixOff = offUrl && (offJudge.verdict === 'dead' || offJudge.verdict === 'wrong');
    const needFixEnt = entUrl && (entJudge.verdict === 'dead' || entJudge.verdict === 'wrong');

    if ((needFixOff || needFixEnt) && geminiFixCalls < MAX_FIX_CALLS && hasGeminiKey()) {
      geminiFixCalls++;
      const fixed = await researchEventLinks(ev, needFixOff, needFixEnt);
      if (needFixOff) {
        if (fixed.official) {
          ev.links.official = fixed.official.url;
          ev.links.official_stale = fixed.official.stale || undefined;
          stats.links_fixed++;
          logs.push({ id: `fix-off-${ev.id}-${today}`, date: today, time, type: 'link_fixed', title: `公式リンク修正: ${ev.title}`, detail: `誤/切れリンクを正規ページへ差し替え`, eventId: ev.id });
          console.log(`🔧 公式リンク修復: ${ev.title} -> ${fixed.official.url}`);
        } else {
          ev.links.official = null;
          stats.links_removed++;
          console.log(`🧹 無効公式リンク除外: ${ev.title} (${offJudge.reason})`);
        }
      }
      if (needFixEnt) {
        if (fixed.entry) {
          ev.links.entry = fixed.entry.url;
          stats.links_fixed++;
          logs.push({ id: `fix-ent-${ev.id}-${today}`, date: today, time, type: 'link_fixed', title: `申込リンク修正: ${ev.title}`, detail: `トップページ/過去ページを最新申込ページへ修正`, eventId: ev.id });
          console.log(`🔧 申込リンク修復: ${ev.title} -> ${fixed.entry.url}`);
        } else {
          ev.links.entry = null;
          stats.links_removed++;
          console.log(`🧹 無効申込リンク除外: ${ev.title} (${entJudge.reason})`);
        }
      }
      await sleep(700);
    } else {
      if (needFixOff) { ev.links.official = null; stats.links_removed++; }
      if (needFixEnt) { ev.links.entry = null; stats.links_removed++; }
      if (offJudge.verdict === 'ok') {
        if (offJudge.stale) ev.links.official_stale = true;
        else delete ev.links.official_stale;
      }
    }

    ev.links.verified = Boolean(ev.links.official || ev.links.entry);
    ev.links.verified_at = today;

    // どちらのリンクも有効なものが残らなかった大会は、誤リンク防止のため一時アーカイブへ退避
    if (!ev.links.official && !ev.links.entry) {
      if (!archiveIds.has(ev.id)) {
        archive.push({ ...ev, archived_at: today, archive_reason: '有効リンク確認不可のため退避' });
        archiveIds.add(ev.id);
        stats.events_archived++;
      }
      console.log(`📦 有効リンクなしのためアーカイブ退避: ${ev.title}`);
      continue;
    }
    finalActive.push(ev);
  }

  // 開催日順にソート
  finalActive.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(finalActive, null, 2) + '\n');
  fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive.slice(-500), null, 2) + '\n');

  if (stats.events_added || stats.events_updated || stats.links_fixed || stats.events_archived) {
    if (!logs.length) {
      logs.push({
        id: `ev-sync-${today}`, date: today, time, type: 'event_updated',
        title: `大会データ定期検証完了（掲載 ${finalActive.length} 件）`,
        detail: `終了大会アーカイブ ${stats.events_archived} 件 / リンク修正 ${stats.links_fixed} 件 / ステータス更新 ${stats.events_updated} 件`,
      });
    }
    appendChangelog(logs);
  }

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { meta = {}; }
  meta.events_count = finalActive.length;
  meta.last_updated_at = new Date().toISOString();
  meta.run_summary = { ...(meta.run_summary || {}), ...stats };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');

  console.log(`\n✅ 大会更新完了: 掲載 ${finalActive.length}件 | 追加 ${stats.events_added} | 更新 ${stats.events_updated} | アーカイブ ${stats.events_archived} | リンク修復 ${stats.links_fixed} | 無効リンク除外 ${stats.links_removed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
