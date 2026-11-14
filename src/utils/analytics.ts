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

// カスタムイベント送信（申込ボタン・公式サイト・楽天商品のクリック追跡）
export const trackEvent = (
  eventName: 'entry_click' | 'official_click' | 'rakuten_click' | 'favorite_toggle' | 'calendar_add',
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
