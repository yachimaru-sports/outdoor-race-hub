/**
 * scripts/generate_seo.mjs
 * vite build 後に dist/ へ SEO用静的HTML・sitemap.xml・robots.txt・JSON-LD を生成
 *
 * - dist/events/<id>/index.html : 各大会の静的ランディングページ（SportsEvent JSON-LD付き）
 * - dist/events/<category>/index.html : 4競技別一覧ページ
 * - dist/sitemap.xml / dist/robots.txt
 * - dist/index.html へ WebSite + ItemList JSON-LD を挿入
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://yachimaru-sports.github.io/outdoor-race-hub';
const DIST_DIR = 'dist';
const EVENTS_PATH = 'src/data/events.json';
const META_PATH = 'src/data/meta.json';

const CAT_INFO = {
  trail: { label: 'トレイルランニング大会一覧', short: 'トレラン' },
  marathon: { label: 'マラソン・ウルトラマラソン大会一覧', short: 'マラソン' },
  cycling: { label: 'サイクリング・ヒルクライム大会一覧', short: 'サイクル' },
  adventure: { label: 'アドベンチャーレース・ロゲイニング一覧', short: 'アドベンチャー' },
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

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
<meta name="twitter:card" content="summary">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;background:#f8fafc;color:#0f172a;line-height:1.65}
  .wrap{max-width:860px;margin:0 auto;padding:20px 16px 48px}
  header{background:#0f172a;color:#fff;padding:12px 16px}
  header a{color:#5eead4;text-decoration:none;font-weight:800;font-size:15px}
  nav{font-size:13px;color:#475569;margin-bottom:14px}
  nav a{color:#0f766e;text-decoration:none}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  h1{font-size:22px;line-height:1.35;margin:0 0 12px}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#ccfbf1;color:#115e59;margin-right:6px}
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
<header><div style="max-width:860px;margin:0 auto"><a href="${SITE_URL}/">⚡ OUTDOOR RACE HUB</a></div></header>
<main class="wrap">${body}</main>
</body>
</html>`;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) return;
  const events = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf-8'));
  let meta = {};
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
      description: `${info.label}（${list.length}件）。毎朝8時に公式・申込リンクと開催日程を自動検証・更新。`,
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

  // 2. 大会ごとの静的詳細ページ
  for (const ev of events) {
    const dir = path.join(DIST_DIR, 'events', ev.id);
    fs.mkdirSync(dir, { recursive: true });
    const canonical = `${SITE_URL}/events/${ev.id}/`;
    urls.push(canonical);
    const catInfo = CAT_INFO[ev.category] || { label: '大会一覧', short: ev.category };
    const startDate = (ev.date || '').split(/[~〜]/)[0];
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: ev.title,
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
      url: ev.links?.official || ev.links?.entry || canonical,
    };
    const html = layoutHtml({
      title: `${ev.title}｜開催日・エントリー情報｜OUTDOOR RACE HUB`,
      description: `${ev.title}（${ev.date}／${ev.prefecture}）の開催日・参加費(${ev.entry_fee || '公式確認'})・申込期間・公式リンク・必携装備まとめ。`,
      canonical,
      jsonLd,
      body: `
        <nav><a href="${SITE_URL}/">トップ</a> &gt; <a href="${SITE_URL}/events/${esc(ev.category)}/">${esc(catInfo.label)}</a> &gt; ${esc(ev.title)}</nav>
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
          <div class="btns">
            <a class="btn btn-main" href="${SITE_URL}/?event=${encodeURIComponent(ev.id)}">アプリで必携品・詳細を見る</a>
            ${ev.links?.entry ? `<a class="btn btn-sub" href="${esc(ev.links.entry)}" target="_blank" rel="noopener nofollow">申込ページへ</a>` : ''}
            ${ev.links?.official ? `<a class="btn btn-sub" href="${esc(ev.links.official)}" target="_blank" rel="noopener nofollow">大会公式サイトへ</a>` : ''}
          </div>
        </div>`,
    });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }

  // 3. sitemap.xml & robots.txt
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  // 4. dist/index.html に WebSite JSON-LD を挿入
  const idxPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(idxPath)) {
    const idxHtml = fs.readFileSync(idxPath, 'utf-8');
    const webSiteLd = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'OUTDOOR RACE HUB',
      url: `${SITE_URL}/`,
      description: 'トレラン・マラソン・サイクル・アドベンチャーレース大会情報と必携装備特価の毎朝8時自動更新ポータル',
    })}</script>`;
    if (!idxHtml.includes('application/ld+json')) {
      fs.writeFileSync(idxPath, idxHtml.replace('</head>', `${webSiteLd}\n</head>`));
    }
  }
  console.log(`🌐 SEO静的ページ生成完了: ${events.length} 大会 + 4 カテゴリ + sitemap.xml`);
}

main();
