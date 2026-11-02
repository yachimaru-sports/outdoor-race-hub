import React from 'react';

/**
 * 外部商品画像（楽天市場等）が404や通信エラーで読み込めない場合に
 * 割れ画像（破損アイコン）の発生を100%防ぐフォールバック処理
 */
export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  category: string = 'GEAR'
) => {
  const target = e.currentTarget;
  if (target.dataset.fallbackApplied) return;
  target.dataset.fallbackApplied = 'true';

  const catLabel = category.length > 5 ? category.slice(0, 5) : category;

  // スタイリッシュなダークトーンのアウトドアギアSVGプレースホルダー
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
    <rect width="120" height="120" rx="12" fill="#0f172a"/>
    <rect x="2" y="2" width="116" height="116" rx="10" stroke="#334155" stroke-width="2"/>
    <path d="M60 28L84 68H36L60 28Z" fill="#059669" opacity="0.8"/>
    <path d="M72 44L92 76H52L72 44Z" fill="#10b981" opacity="0.6"/>
    <rect x="24" y="82" width="72" height="18" rx="4" fill="#ef4444"/>
    <text x="60" y="94" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">SALE 特価</text>
  </svg>`;

  target.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
