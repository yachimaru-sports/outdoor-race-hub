import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsFilePath = path.resolve(__dirname, '../src/data/events.json');
const events = JSON.parse(fs.readFileSync(eventsFilePath, 'utf-8'));

// 既知の正確な公式サイト＆エントリーURL辞書（手動確認済み）
const KNOWN_VALID_URLS = {
  'hiroshima-wangantrail-108k-2027': {
    official: 'https://hiroshima.utmb.world/ja',
    entry: 'https://hiroshima.utmb.world/ja',
  },
  'mt-fuji-100-2027': {
    official: 'https://mtfuji100.com/',
    entry: 'https://mtfuji100.com/',
  },
  'shinetsu-five-mountains-100m-2026': {
    official: 'https://www.sfmt100.com/',
    entry: 'https://www.sfmt100.com/',
  },
  'koumi-100-2026': {
    official: 'https://www.outdoorsportsjapan.com/trail/koumi100/',
    entry: 'https://www.outdoorsportsjapan.com/trail/koumi100/',
  },
  'osj-koushu-alps-100mile-2026': {
    official: 'https://www.outdoorsportsjapan.com/trail/koshu-alps/',
    entry: 'https://www.outdoorsportsjapan.com/trail/koshu-alps/',
  },
  'osj-ontake-100mile-2026': {
    official: 'https://www.outdoorsportsjapan.com/trail/ontake100/',
    entry: 'https://www.outdoorsportsjapan.com/trail/ontake100/',
  },
  'sainokuni-100m-2027': {
    official: 'https://trainic-world.org/sainokuni/',
    entry: 'https://trainic-world.org/sainokuni/',
  },
  'deep-japan-ultra-100-2026': {
    official: 'https://deepjapanultra.com/',
    entry: 'https://deepjapanultra.com/',
  },
  'ftr-chichibu-okumusashi-100k-2026': {
    official: 'https://funrun-r.com/ftr100/',
    entry: 'https://funrun-r.com/ftr100/',
  },
  'hasetsune-cup-71k-2026': {
    official: 'https://www.hasetsune.org/',
    entry: 'https://www.hasetsune.org/',
  },
  'toretore-kamiyama-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-hozukyo-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-tomisu-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-narayoshino-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'mannou-rogaining-2026': {
    official: 'https://www.outdoor-sports.info/mannou-rogaining',
    entry: 'https://www.outdoor-sports.info/mannou-rogaining',
  },
  'kochi-navigames-2026-winter': {
    official: 'https://navigationgames.jp/',
    entry: 'https://navigationgames.jp/',
  },
  'omm-japan-2026': {
    official: 'https://theomm.jp/',
    entry: 'https://theomm.jp/',
  },
};

// URL死活チェック
async function checkUrl(url, timeoutMs = 4000) {
  if (!url || url === '#' || url.trim() === '') return false;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };
    let res;
    try {
      res = await fetch(url, { method: 'HEAD', headers, signal: controller.signal, redirect: 'follow' });
    } catch {
      res = await fetch(url, { method: 'GET', headers, signal: controller.signal, redirect: 'follow' }).catch(() => null);
    } finally {
      clearTimeout(id);
    }
    return res && (res.status < 400 || res.status === 403);
  } catch {
    return false;
  }
}

function getCleanSearchKeyword(title) {
  let kw = title
    .replace(/（[^）]+）/g, ' ')
    .replace(/\([^)]+\)/g, ' ')
    .replace(/【[^】]+】/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/202[5-8]/g, ' ')
    .replace(/第\d+回/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = kw.split(' ');
  return parts.slice(0, 2).join(' ').trim();
}

async function run() {
  console.log(`Starting parallel link healing for ${events.length} events...`);
  let healedCount = 0;

  const BATCH_SIZE = 15;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (ev) => {
        const cleanKw = getCleanSearchKeyword(ev.title);

        if (KNOWN_VALID_URLS[ev.id]) {
          ev.links = { ...ev.links, ...KNOWN_VALID_URLS[ev.id] };
        }

        const [offOk, entryOk] = await Promise.all([
          checkUrl(ev.links?.official),
          checkUrl(ev.links?.entry),
        ]);

        if (!offOk) {
          healedCount++;
          ev.links.official = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
          ev.links.official_fallback = true;
        }

        if (!entryOk) {
          healedCount++;
          ev.links.entry = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
          ev.links.entry_fallback = true;
        }

        ev.links.verified = true;
        ev.links.verified_at = new Date().toISOString().split('T')[0];
      })
    );

    process.stdout.write(`Processed ${Math.min(i + BATCH_SIZE, events.length)}/${events.length} events...\r`);
  }

  console.log(`\n\n=== 並列修復完了 ===`);
  console.log(`修復・安全URL置換件数: ${healedCount}件`);

  fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, 2), 'utf-8');
  console.log(`Successfully updated ${eventsFilePath}`);
}

run();
