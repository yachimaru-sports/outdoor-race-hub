/**
 * scripts/generate_seo.mjs
 * vite build 後に dist/ へ SEO用静的HTML・sitemap.xml・robots.txt・JSON-LD を生成
 *
 * - dist/events/<id>/index.html : 各大会の静的ランディングページ（SportsEvent JSON-LD・必携品リスト付き）
 * - dist/events/<category>/index.html : 4競技別一覧ページ
 * - dist/areas/<slug>/index.html : 地域別一覧ページ
 * - dist/gears/index.html : おすすめ商品・特価ギア一覧ページ
 * - dist/sitemap.xml / dist/robots.txt
 * - dist/index.html へ WebSite JSON-LD を挿入
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://yachimaru-sports.github.io/outdoor-race-hub';
const DIST_DIR = 'dist';
const EVENTS_PATH = 'src/data/events.json';
const DEALS_PATH = 'src/data/deals.json';
const GEARS_PATH = 'src/data/gears.json';
const META_PATH = 'src/data/meta.json';

const CAT_INFO = {
  trail: { label: 'トレイルランニング大会一覧', short: 'トレラン' },
  marathon: { label: 'マラソン・ウルトラマラソン大会一覧', short: 'マラソン' },
  cycling: { label: 'サイクリング・ヒルクライム大会一覧', short: 'サイクル' },
  adventure: { label: 'アドベンチャーレース・ロゲイニング一覧', short: 'アドベンチャー' },
};

const REGION_SLUG = {
  北海道: 'hokkaido',
  東北: 'tohoku',
  関東: 'kanto',
  甲信越: 'koshinetsu',
  '甲信越・北陸': 'koshinetsu-hokuriku',
  中部: 'chubu',
  東海: 'tokai',
  関西: 'kansai',
  近畿: 'kinki',
  中国: 'chugoku',
  四国: 'shikoku',
  九州: 'kyushu',
  海外: 'overseas',
};

const STATUS_LABEL = {
  open: 'エントリー受付中',
  closing_soon: 'まもなく締切',
  upcoming: '受付開始前',
  closed: '受付終了',
};

const SCHEMA_STATUS = {
  open: 'https://schema.org/EventScheduled',
  closing_soon: 'https://schema.org/EventScheduled',
  upcoming: 'https://schema.org/EventScheduled',
  closed: 'https://schema.org/EventScheduled',
};

const SCHEMA_AVAILABILITY = {
  open: 'https://schema.org/InStock',
  closing_soon: 'https://schema.org/InStock',
  upcoming: 'https://schema.org/PreOrder',
  closed: 'https://schema.org/SoldOut',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 参加費文字列から数値（円）を抽出（例: "8,000円〜9,200円" -> 8000） */
function extractPriceNumber(feeStr) {
  if (!feeStr) return null;
  const cleaned = String(feeStr).replace(/,/g, '');
  const m = cleaned.match(/\d{3,6}/);
  return m ? Number(m[0]) : null;
}

function layoutHtml({ title, description, canonical, jsonLd, body }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#0f766e">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="OUTDOOR RACE HUB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE_URL}/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;background:#f8fafc;color:#0f172a;line-height:1.65}
  .wrap{max-width:860px;margin:0 auto;padding:20px 16px 48px}
  header{background:#0f172a;color:#fff;padding:12px 16px}
  header .inner{max-width:860px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  header .nav-links{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  header a{color:#5eead4;text-decoration:none;font-weight:800;font-size:15px}
  header a.sub{color:#cbd5e1;font-size:13px;font-weight:600}
  nav{font-size:13px;color:#475569;margin-bottom:14px}
  nav a{color:#0f766e;text-decoration:none}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  h1{font-size:22px;line-height:1.35;margin:0 0 12px}
  h2{font-size:16px;margin:22px 0 10px;border-left:4px solid #0f766e;padding-left:10px}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#ccfbf1;color:#115e59;margin-right:6px}
  .gear-tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0;padding:0;list-style:none}
  .gear-tags li{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:4px 10px;font-size:13px;font-weight:600}
  dl{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;margin:18px 0;font-size:14px}
  dt{color:#64748b;font-weight:700}
  dd{margin:0;font-weight:600}
  .btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
  .btn{display:inline-block;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px}
  .btn-main{background:#0f766e;color:#fff}
  .btn-sub{background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1}
  ul.list{list-style:none;padding:0;margin:16px 0;display:grid;gap:10px}
  ul.list li a{display:block;padding:12px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#0f172a;font-weight:700}
  ul.list li a span{display:block;font-size:12px;color:#64748b;font-weight:500;margin-top:2px}
</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<header><div class="inner"><a href="${SITE_URL}/">⚡ OUTDOOR RACE HUB</a><div class="nav-links"><a class="sub" href="${SITE_URL}/map/">全国レースマップ</a><a class="sub" href="${SITE_URL}/gears/">おすすめ商品・特価ギア</a></div></div></header>
<main class="wrap">${body}</main>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) return;
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  let deals = [];
  let gears = [];
  let meta = {};
  try { deals = JSON.parse(fs.readFileSync(DEALS_PATH, 'utf-8')); } catch { /* ignore */ }
  try { gears = JSON.parse(fs.readFileSync(GEARS_PATH, 'utf-8')); } catch { /* ignore */ }
  try { meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')); } catch { /* ignore */ }
  const lastmod = (meta.last_updated_at || new Date().toISOString()).slice(0, 10);

  const urls = [`${SITE_URL}/`];

  // 1. カテゴリ別一覧ページ
  for (const [cat, info] of Object.entries(CAT_INFO)) {
    const dir = path.join(DIST_DIR, 'events', cat);
    fs.mkdirSync(dir, { recursive: true });
    const list = events.filter((e) => e.category === cat);
    const canonical = `${SITE_URL}/events/${cat}/`;
    urls.push(canonical);
    const html = layoutHtml({
      title: `${info.label}｜OUTDOOR RACE HUB`,
      description: `${info.label}（${list.length}件）。毎朝6時に公式・申込リンクと開催日程を自動検証・更新。`,
      canonical,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: info.label,
        numberOfItems: list.length,
        itemListElement: list.slice(0, 30).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/events/${e.id}/`,
          name: e.title,
        })),
      },
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; ${esc(info.label)}</nav>
        <h1>${esc(info.label)}（${list.length}件）</h1>
        <p><a class="btn btn-main" href="${SITE_URL}/">検索・絞り込みアプリを開く</a></p>
        <ul class="list">
          ${list.map((e) => `<li><a href="${SITE_URL}/events/${esc(e.id)}/">${esc(e.title)}<span>${esc(e.date)} ／ ${esc(e.prefecture)} ／ ${esc(STATUS_LABEL[e.entry_status] || e.entry_status)}</span></a></li>`).join('\n')}
        </ul>`,
    });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  // 2. 地域別一覧ページ
  const regionMap = new Map();
  for (const ev of events) {
    const r = (ev.region || '').trim();
    if (!r) continue;
    if (!regionMap.has(r)) regionMap.set(r, []);
    regionMap.get(r).push(ev);
  }

  // 2.5 日本地図（全国レースマップ）専用SEOページ
  {
    const mapDir = path.join(DIST_DIR, 'map');
    fs.mkdirSync(mapDir, { recursive: true });
    const canonical = `${SITE_URL}/map/`;
    // トップURL直後に収録して優先クロールさせる
    urls.splice(1, 0, canonical);

    const prefCountMap = new Map();
    for (const ev of events) {
      const p = (ev.prefecture || '').trim();
      if (!p) continue;
      prefCountMap.set(p, (prefCountMap.get(p) || 0) + 1);
    }
    const prefEntries = [...prefCountMap.entries()].sort((a, b) => b[1] - a[1]);
    const regionEntries = [...regionMap.entries()];
    const todayIso = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const upcomingEvents = events.filter((e) => (e.end_date || e.date) >= todayIso).slice(0, 20);

    const html = layoutHtml({
      title: '全国レースマップ（日本地図から探す大会一覧）｜OUTDOOR RACE HUB（アウトドアレースハブ）',
      description: `全国${events.length}件のトレイルランニング・マラソン・サイクリング・アドベンチャーレース大会を日本地図（全国→地方→都道府県ピン）から探せる全国レースマップ。`,
      canonical,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '全国レースマップ（日本地図から探す大会一覧）',
        inLanguage: 'ja',
        url: canonical,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: regionEntries.length,
          itemListElement: regionEntries.map(([rName, rList], i) => {
            const slug = REGION_SLUG[rName] || encodeURIComponent(rName);
            return {
              '@type': 'ListItem',
              position: i + 1,
              name: `${rName}の大会一覧（${rList.length}件）`,
              url: `${SITE_URL}/areas/${slug}/`,
            };
          }),
        },
      },
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; 全国レースマップ</nav>
        <div class="card">
          <h1>全国レースマップ｜日本地図から探すトレラン・マラソン・サイクル大会（${events.length}件）</h1>
          <p>全国9地方・47都道府県＆海外のトレイルランニング、マラソン、サイクリング、アドベンチャーレースを日本地図上のピンから視覚的に探せます。</p>
          <div class="btns">
            <a class="btn btn-main" href="${SITE_URL}/#/map">🗺️ インタラクティブ日本地図（全国レースマップ）を開く</a>
            <a class="btn btn-sub" href="${SITE_URL}/">大会一覧・条件検索トップへ</a>
          </div>
          <h2>地方別エリアから探す</h2>
          <ul class="list">
            ${regionEntries
              .map(([rName, rList]) => {
                const slug = REGION_SLUG[rName] || encodeURIComponent(rName);
                return `<li><a href="${SITE_URL}/areas/${esc(slug)}/">${esc(rName)}のアウトドア・レース大会一覧<span>掲載 ${rList.length}件</span></a></li>`;
              })
              .join('\n')}
          </ul>
          <h2>競技カテゴリーから探す</h2>
          <ul class="list">
            ${Object.entries(CAT_INFO)
              .map(([cat, info]) => {
                const count = events.filter((e) => e.category === cat).length;
                return `<li><a href="${SITE_URL}/events/${esc(cat)}/">${esc(info.label)}<span>掲載 ${count}件</span></a></li>`;
              })
              .join('\n')}
          </ul>
          <h2>都道府県別の開催大会数</h2>
          <ul class="gear-tags">
            ${prefEntries.map(([p, cnt]) => `<li>${esc(p)} (${cnt}件)</li>`).join('\n')}
          </ul>
          <h2>近日開催の注目大会（抜粋）</h2>
          <ul class="list">
            ${upcomingEvents
              .map(
                (e) =>
                  `<li><a href="${SITE_URL}/events/${esc(e.id)}/">${esc(e.title)}<span>${esc(e.date)} ／ ${esc(e.prefecture)} ／ ${esc(STATUS_LABEL[e.entry_status] || e.entry_status)}</span></a></li>`
              )
              .join('\n')}
          </ul>
        </div>`,
    });
    fs.writeFileSync(path.join(mapDir, 'index.html'), html);
  }

  for (const [regionName, list] of regionMap.entries()) {
    const slug = REGION_SLUG[regionName] || encodeURIComponent(regionName);
    const dir = path.join(DIST_DIR, 'areas', slug);
    fs.mkdirSync(dir, { recursive: true });
    const canonical = `${SITE_URL}/areas/${slug}/`;
    urls.push(canonical);
    const areaTitle = `${regionName}のトレラン・マラソン・サイクル大会一覧`;
    const html = layoutHtml({
      title: `${areaTitle}｜OUTDOOR RACE HUB`,
      description: `${regionName}で開催されるトレイルランニング・マラソン・サイクリング・アドベンチャーレース（${list.length}件）の最新開催日程とエントリー情報。`,
      canonical,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: areaTitle,
        numberOfItems: list.length,
        itemListElement: list.slice(0, 30).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}/events/${e.id}/`,
          name: e.title,
        })),
      },
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; ${esc(regionName)}の大会一覧</nav>
        <h1>${esc(areaTitle)}（${list.length}件）</h1>
        <p><a class="btn btn-main" href="${SITE_URL}/">条件を絞り込んでアプリで探す</a></p>
        <ul class="list">
          ${list.map((e) => `<li><a href="${SITE_URL}/events/${esc(e.id)}/">${esc(e.title)}<span>${esc(e.date)} ／ ${esc(e.prefecture)} ／ ${esc(STATUS_LABEL[e.entry_status] || e.entry_status)}</span></a></li>`).join('\n')}
        </ul>`,
    });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  // 3. おすすめ商品・特価ギア一覧ページ
  if (deals.length > 0 || gears.length > 0) {
    const gearsDir = path.join(DIST_DIR, 'gears');
    fs.mkdirSync(gearsDir, { recursive: true });
    const canonical = `${SITE_URL}/gears/`;
    urls.push(canonical);
    const combinedItems = [
      ...deals.map((d) => ({
        title: d.title,
        sub: `${d.category || '特価ギア'} ／ ${d.price ? `¥${Number(d.price).toLocaleString()}` : ''}${d.discount_rate ? ` (${d.discount_rate}%OFF)` : ''}`,
      })),
      ...gears.slice(0, 30).map((g) => ({
        title: g.title,
        sub: `${g.gearType || '定番ギア'} ／ ${g.price ? `¥${Number(g.price).toLocaleString()}` : '価格確認'}`,
      })),
    ];
    const html = layoutHtml({
      title: `トレラン・マラソン必携装備＆特価ギア一覧｜OUTDOOR RACE HUB`,
      description: `大会の必携装備に使えるレインウェア・ザック・ヘッドライト・シューズなどの特価セール品(${deals.length}件)＆定番おすすめギア(${gears.length}件)を毎朝6時自動更新。`,
      canonical,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'トレラン・マラソン必携装備＆特価ギア一覧',
        url: canonical,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: combinedItems.length,
          itemListElement: combinedItems.slice(0, 30).map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.title,
          })),
        },
      },
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; おすすめ商品・特価ギア一覧</nav>
        <h1>トレラン・マラソン必携装備＆特価ギア一覧</h1>
        <p>毎朝6時に価格・割引率を自動検証している特価ギア（${deals.length}件）と定番装備（${gears.length}件）のラインナップです。</p>
        <p><a class="btn btn-main" href="${SITE_URL}/#/gears">アプリで特価ギア・おすすめ商品を詳しく見る</a></p>
        <ul class="list">
          ${combinedItems.map((item) => `<li><a href="${SITE_URL}/#/gears">${esc(item.title)}<span>${esc(item.sub)}</span></a></li>`).join('\n')}
        </ul>`,
    });
    fs.writeFileSync(path.join(gearsDir, 'index.html'), html);
  }

  // 4. 大会ごとの静的詳細ページ
  for (const ev of events) {
    const dir = path.join(DIST_DIR, 'events', ev.id);
    fs.mkdirSync(dir, { recursive: true });
    const canonical = `${SITE_URL}/events/${ev.id}/`;
    urls.push(canonical);
    const catInfo = CAT_INFO[ev.category] || { label: '大会一覧', short: ev.category };
    const startDate = (ev.date || '').split(/[~〜]/)[0];
    const mandatoryList = Array.isArray(ev.mandatory_gear) ? ev.mandatory_gear : [];
    const gearSummary = mandatoryList.length > 0
      ? `必携装備: ${mandatoryList.slice(0, 6).map((g) => g.name).join('・')}`
      : '';
    const desc = `${ev.title}（${ev.date}／${ev.prefecture}）の開催日・距離(${ev.distance_km ? `${ev.distance_km}km` : '公式確認'})・参加費(${ev.entry_fee || '公式確認'})・申込期間・公式リンクまとめ。${gearSummary}`;

    const priceNum = extractPriceNumber(ev.entry_fee);
    const offerUrl = ev.links?.entry || ev.links?.official || canonical;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: ev.title,
      description: desc,
      startDate,
      ...(ev.end_date ? { endDate: ev.end_date } : {}),
      eventStatus: SCHEMA_STATUS[ev.entry_status] || 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: ev.venue?.name || ev.prefecture || '日本',
        address: {
          '@type': 'PostalAddress',
          addressRegion: ev.prefecture || '',
          addressCountry: 'JP',
        },
      },
      offers: {
        '@type': 'Offer',
        url: offerUrl,
        priceCurrency: 'JPY',
        ...(priceNum !== null ? { price: priceNum } : {}),
        availability: SCHEMA_AVAILABILITY[ev.entry_status] || 'https://schema.org/InStock',
      },
      ...(ev.source?.portalName ? {
        organizer: {
          '@type': 'Organization',
          name: ev.source.portalName,
          ...(ev.source.portalUrl ? { url: ev.source.portalUrl } : {}),
        },
      } : {}),
      url: ev.links?.official || ev.links?.entry || canonical,
    };

    const regionSlug = REGION_SLUG[ev.region] || '';
    const gearHtml = mandatoryList.length > 0
      ? `<h2>必携装備・持ち物目安</h2>
         <ul class="gear-tags">
           ${mandatoryList.map((g) => `<li>${esc(g.name)}</li>`).join('\n')}
         </ul>
         <p style="font-size:13px;margin-top:10px;"><a href="${SITE_URL}/#/gears">▶ 必携装備に使える特価ギア・おすすめ商品を探す</a></p>`
      : '';

    const html = layoutHtml({
      title: `${ev.title}｜開催日・エントリー・必携装備｜OUTDOOR RACE HUB`,
      description: desc,
      canonical,
      jsonLd,
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; <a href="${SITE_URL}/events/${esc(ev.category)}/">${esc(catInfo.label)}</a>${regionSlug ? ` &gt; <a href="${SITE_URL}/areas/${esc(regionSlug)}/">${esc(ev.region)}</a>` : ''} &gt; ${esc(ev.title)}</nav>
        <div class="card">
          <div>
            <span class="badge">${esc(catInfo.short)}</span>
            <span class="badge">${esc(STATUS_LABEL[ev.entry_status] || ev.entry_status)}</span>
          </div>
          <h1>${esc(ev.title)}</h1>
          <dl>
            <dt>開催日</dt><dd>${esc(ev.date)}</dd>
            <dt>開催地</dt><dd>${esc(ev.region)} / ${esc(ev.prefecture)}${ev.venue?.name ? `（${esc(ev.venue.name)}）` : ''}</dd>
            <dt>距離 / 獲得標高</dt><dd>${ev.distance_km ? `${ev.distance_km} km` : '公式確認'}${ev.elevation_m ? ` / ${ev.elevation_m} m` : ''}</dd>
            <dt>参加費</dt><dd>${esc(ev.entry_fee || '公式サイト確認')}</dd>
            <dt>申込期間</dt><dd>${esc(ev.entry_start_date || '—')} 〜 ${esc(ev.entry_deadline || '公式サイト確認')}</dd>
            <dt>リンク確認日</dt><dd>${esc(ev.links?.verified_at || lastmod)}</dd>
          </dl>
          ${gearHtml}
          <div class="btns">
            <a class="btn btn-main" href="${SITE_URL}/?event=${encodeURIComponent(ev.id)}">アプリで必携品チェック・詳細を見る</a>
            ${ev.links?.entry ? `<a class="btn btn-sub" href="${esc(ev.links.entry)}" target="_blank" rel="noopener nofollow">申込ページへ</a>` : ''}
            ${ev.links?.official ? `<a class="btn btn-sub" href="${esc(ev.links.official)}" target="_blank" rel="noopener nofollow">大会公式サイトへ</a>` : ''}
          </div>
        </div>`,
    });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  // 5. sitemap.xml & robots.txt
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  // 6. dist/index.html に WebSite JSON-LD（日本語補強）とクローラー向け初期HTML導線を挿入
  const idxPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(idxPath)) {
    let idxHtml = fs.readFileSync(idxPath, 'utf-8');
    const webSiteLd = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'OUTDOOR RACE HUB',
      alternateName: ['アウトドアレースハブ', 'Outdoor Race Hub'],
      inLanguage: 'ja',
      url: `${SITE_URL}/`,
      description: '全国のトレラン・マラソン・サイクル・アドベンチャーレース大会情報・日本地図検索（全国レースマップ）＆必携装備特価の毎朝6時自動更新ポータル',
    })}</script>`;
    if (!idxHtml.includes('application/ld+json')) {
      idxHtml = idxHtml.replace('</head>', `${webSiteLd}\n</head>`);
    }

    const areaLinksHtml = [...regionMap.keys()]
      .map((rName) => {
        const slug = REGION_SLUG[rName] || encodeURIComponent(rName);
        return `<a href="${SITE_URL}/areas/${esc(slug)}/">${esc(rName)}</a>`;
      })
      .join(' / ');

    const seoFallbackHtml = `<div id="root"><main style="max-width:960px;margin:24px auto;padding:16px;font-family:sans-serif"><h1>OUTDOOR RACE HUB（アウトドアレースハブ）</h1><p>全国${events.length}件のトレイルランニング・マラソン・サイクリング・アドベンチャーレースの開催日程、エントリー状況、日本地図検索（全国レースマップ）、必携装備＆特価ギア情報を毎朝6時に自動更新しています。</p><nav aria-label="主要ページ一覧"><p><a href="${SITE_URL}/map/">全国レースマップ（日本地図から大会を探す）</a> | <a href="${SITE_URL}/gears/">おすすめ必携品・特価ギア一覧</a></p><p>競技別: <a href="${SITE_URL}/events/trail/">トレラン大会</a> / <a href="${SITE_URL}/events/marathon/">マラソン大会</a> / <a href="${SITE_URL}/events/cycling/">サイクル大会</a> / <a href="${SITE_URL}/events/adventure/">アドベンチャーレース</a></p><p>地方別: ${areaLinksHtml}</p></nav></main></div>`;
    idxHtml = idxHtml.replace('<div id="root"></div>', seoFallbackHtml);
    fs.writeFileSync(idxPath, idxHtml);
  }
  console.log(`🌐 SEO静的ページ生成完了: ${events.length} 大会 + 全国レースマップ + ${Object.keys(CAT_INFO).length} カテゴリ + ${regionMap.size} 地域 + 特価ギアページ + sitemap.xml (全${urls.length} URL)`);
}

main();
