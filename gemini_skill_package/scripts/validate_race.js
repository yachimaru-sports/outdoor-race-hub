/**
 * 大会データの必須項目バリデーション
 */
export function validateRaceEvent(event) {
  const errors = [];
  if (!event.id) errors.push('id が未指定です');
  if (!event.title) errors.push('title が未指定です');
  if (!event.category) errors.push('category が未指定です');
  if (!event.date || !/^\d{4}-\d{2}-\d{2}/.test(event.date)) errors.push('date は YYYY-MM-DD 形式である必要があります');
  if (!event.official_url || event.official_url === '#' || event.official_url.endsWith('.jp/')) {
    errors.push('official_url はポータルトップではなく固有ページである必要があります');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
