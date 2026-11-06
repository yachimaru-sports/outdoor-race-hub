import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkUrlLive } from './verify-links.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsFilePath = path.resolve(__dirname, '../src/data/events.json');
const events = JSON.parse(fs.readFileSync(eventsFilePath, 'utf-8'));

// 既知の正確な公式サイト＆エントリーURL辞書（手動確認済み）
const KNOWN_VALID_URLS = {
  // とれとれバイクシリーズ（正規公式トップページ）
  'toretore-obsidian-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-ueyama-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-iwamura-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
  },
  'toretore-hozukyou-2026': {
    official: 'http://toretore.web.fc2.com/',
    entry: 'http://toretore.web.fc2.com/',
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
  // トレイルラン・アドベンチャー
  'hiroshima-utmb-2027': {
    official: 'https://wangantrailrun.com/',
    entry: 'https://wangantrailrun.com/',
  },
  'hiroshima-wangantrail-108k-2027': {
    official: 'https://wangantrailrun.com/',
    entry: 'https://wangantrailrun.com/',
  },
  'hiei-international-trail-2027': {
    official: 'https://www.facebook.com/mthiei/',
    entry: 'https://runnet.jp/entry/runtes/user/pc/competitionDetailAction.do?raceId=366530&div=1',
  },
  'hasetsune-30k-2026': {
    official: 'https://www.hasetsune.org/',
    entry: 'https://www.hasetsune.org/',
  },
  'hasetsune-cup-71k-2026': {
    official: 'https://www.hasetsune.org/',
    entry: 'https://www.hasetsune.org/',
  },
  'zao-skyrun-vertical-2026': {
    official: 'https://tohokuskyrunning.wixsite.com/tohoku-skyrunning',
    entry: 'https://www.sportsentry.ne.jp/search?keyword=%E8%94%B5%E7%8E%8B%E3%82%B9%E3%82%AB%E3%82%A4%E3%83%AC%E3%83%BC%E3%82%B9',
  },
  'tour-de-daisen-2026': {
    official: 'https://www.sportsentry.ne.jp/event/t/103913',
    entry: 'https://www.sportsentry.ne.jp/event/t/103913',
  },
  'awaji-longride-2026': {
    official: 'https://www.sportsentry.ne.jp/search?keyword=%E6%B7%A1%E8%B7%AF%E5%B3%B6%E3%83%AD%E3%83%B3%E3%82%B0%E3%83%A9%E3%82%A4%E3%83%89',
    entry: 'https://www.sportsentry.ne.jp/search?keyword=%E6%B7%A1%E8%B7%AF%E5%B3%B6%E3%83%AD%E3%83%B3%E3%82%B0%E3%83%A9%E3%82%A4%E3%83%89',
  },
  'osorakan-ekiden-trail-2026': {
    official: 'https://moshicom.com/54255/',
    entry: 'https://moshicom.com/54255/',
  },
  'oku-shimanto-trail-2026': {
    official: 'https://moshicom.com/search/?keyword=%E5%A5%A5%E5%9B%9B%E4%B8%87%E5%8D%81%E3%83%88%E3%83%AC%E3%82%A4%E3%83%AB',
    entry: 'https://moshicom.com/search/?keyword=%E5%A5%A5%E5%9B%9B%E4%B8%87%E5%8D%81%E3%83%88%E3%83%AC%E3%82%A4%E3%83%AB',
  },
  'arwc-canada-2025': {
    official: 'https://www.expeditionracecanada.ca/',
    entry: 'https://www.expeditionracecanada.ca/',
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
  console.log(`====================================================`);
  console.log(`[全自動リンク検知・修復システム (Auto-Heal Links)] 開始...`);
  console.log(`====================================================`);
  console.log(`- 対象イベント件数: ${events.length} 件`);

  let healedCount = 0;
  const BATCH_SIZE = 8;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (ev) => {
        const cleanKw = getCleanSearchKeyword(ev.title);

        // 既知の正規URLがあれば優先適用
        if (KNOWN_VALID_URLS[ev.id]) {
          ev.links = { ...ev.links, ...KNOWN_VALID_URLS[ev.id] };
        }

        const [offRes, entryRes] = await Promise.all([
          checkUrlLive(ev.links?.official),
          checkUrlLive(ev.links?.entry),
        ]);

        if (!offRes.ok) {
          healedCount++;
          console.warn(`[修復] 公式リンク異常検知: ${ev.title} (${offRes.reason}) -> 安全検索へ自動置換`);
          ev.links.official = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
          ev.links.official_fallback = true;
        }

        if (!entryRes.ok) {
          healedCount++;
          console.warn(`[修復] 申込リンク異常検知: ${ev.title} (${entryRes.reason}) -> 安全検索へ自動置換`);
          ev.links.entry = `https://moshicom.com/search/?keyword=${encodeURIComponent(cleanKw)}`;
          ev.links.entry_fallback = true;
        }

        ev.links.verified = true;
        ev.links.verified_at = new Date().toISOString().split('T')[0];
      })
    );

    process.stdout.write(`進捗: ${Math.min(i + BATCH_SIZE, events.length)}/${events.length} イベント検証済...\r`);
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`全自動リンク修復処理が完了しました。`);
  console.log(`- 修復・フォールバック置換件数: ${healedCount} 件`);

  fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, 2), 'utf-8');
  console.log(`- events.json を更新保存しました: ${eventsFilePath}`);

  // CSV も同期出力
  const { exportMasterCsv } = await import('./export_master_csv.mjs');
  if (exportMasterCsv) {
    await exportMasterCsv();
  }
}

run();
