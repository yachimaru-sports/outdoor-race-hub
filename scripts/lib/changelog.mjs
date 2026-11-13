/**
 * scripts/lib/changelog.mjs
 * src/data/changelog.json（サイト内の最新更新情報・ティッカー用）への追記ユーティリティ
 */
import fs from 'node:fs';

const CHANGELOG_PATH = 'src/data/changelog.json';
const MAX_ENTRIES = 100;

export function nowJstParts() {
  const jst = new Date(Date.now() + 9 * 3600 * 1000);
  const iso = jst.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
}

export function loadChangelog() {
  try {
    const arr = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 新しい変更ログを先頭に追加し、重複IDを除外して最大100件で保存 */
export function appendChangelog(entries) {
  if (!entries || !entries.length) return;
  const existing = loadChangelog();
  const seen = new Set();
  const merged = [];
  for (const e of [...entries, ...existing]) {
    if (!e || !e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    merged.push(e);
    if (merged.length >= MAX_ENTRIES) break;
  }
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(merged, null, 2) + '\n');
}
