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

// カスタムイベント送信（申込ボタン・公式サイト・楽天商品・大会詳細閲覧のクリック追跡）
export const trackEvent = (
  eventName:
    | 'entry_click'
    | 'official_click'
    | 'rakuten_click'
    | 'favorite_toggle'
    | 'calendar_add'
    | 'event_detail_view',
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

// SPAのページ切り替え（大会一覧 / 商品一覧）をGA4のページビューとして計測
export const trackPageView = (route: 'events' | 'gears') => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      const isGears = route === 'gears';
      const pagePath = isGears ? '/outdoor-race-hub/#/gears' : '/outdoor-race-hub/';
      const pageTitle = isGears
        ? 'おすすめ商品・特価ギア | OUTDOOR RACE HUB'
        : '大会一覧 | OUTDOOR RACE HUB';

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
