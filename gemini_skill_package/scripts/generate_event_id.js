/**
 * 大会ID自動生成ユーティリティ
 * 例: "Hiroshima Ultra-Trail 2027" -> "hiroshima-ultra-trail-2027"
 */
export function generateEventId(title, year = 2026) {
  const romanized = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${romanized}-${year}`.replace(/--+/g, '-');
}
