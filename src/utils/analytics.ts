/**
 * 管理者専用アクセス解析＆イベント計測ユーティリティ (Google Analytics 4 / GA4 対応)
 * サイトの裏側で「どの大会がクリックされたか」「どの楽天商品がクリックされたか」を安全に集計
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

// カスタムイベント送信（申込ボタン・公式サイト・楽天商品・大会詳細閲覧・マップ操作のクリック追跡）
export const trackEvent = (
  eventName:
    | 'entry_click'
    | 'official_click'
    | 'rakuten_click'
    | 'favorite_toggle'
    | 'calendar_add'
    | 'event_detail_view'
    | 'guide_open'
    | 'map_open'
    | 'map_zoom_region'
    | 'map_zoom_prefecture'
    | 'map_pin_click',
  params: Record<string, any> = {}
) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, params);
    } catch (e) {
      // 解析エラーで画面が止まるのを防止
    }
  }
};

// SPAのページ切り替え（大会一覧 / 商品一覧 / 全国マップ）をGA4のページビューとして計測
export const trackPageView = (route: 'events' | 'gears' | 'map') => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      const pagePath =
        route === 'gears'
          ? '/outdoor-race-hub/#/gears'
          : route === 'map'
          ? '/outdoor-race-hub/#/map'
          : '/outdoor-race-hub/';
      const pageTitle =
        route === 'gears'
          ? 'おすすめ商品・特価ギア | アウトドアレースハブ（OUTDOOR RACE HUB）'
          : route === 'map'
          ? '全国レースマップ | アウトドアレースハブ（OUTDOOR RACE HUB）'
          : '大会一覧 | アウトドアレースハブ（OUTDOOR RACE HUB）';

      window.gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
        page_location: window.location.href,
      });
    } catch (e) {
      // 解析エラーで画面が止まるのを防止
    }
  }
};
