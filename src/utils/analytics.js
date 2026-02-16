// Cookie同意管理
const CONSENT_KEY = 'boatai:cookie-consent';

export const getCookieConsent = () => localStorage.getItem(CONSENT_KEY);
export const setCookieConsent = (value) => localStorage.setItem(CONSENT_KEY, value);

// AdSense動的ロード
export const initAdSense = () => {
  if (document.querySelector('script[src*="adsbygoogle"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4942038531343866';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
};

// 同意済みならGA+AdSenseを初期化
export const initTrackingIfConsented = () => {
  if (getCookieConsent() === 'accepted') {
    initGA();
    initAdSense();
  }
};

// Google Analytics utility
export const initGA = () => {
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

  // 開発環境またはGA IDが設定されていない場合はスキップ
  if (!GA_MEASUREMENT_ID || import.meta.env.DEV) {
    console.log('Google Analytics is disabled in development mode');
    return;
  }

  // GA4スクリプトを動的に読み込み
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // dataLayerとgtagを初期化
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
  });
};

// ページビューをトラッキング
export const trackPageView = (url) => {
  if (window.gtag) {
    window.gtag('config', import.meta.env.VITE_GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// イベントをトラッキング
export const trackEvent = (eventName, eventParams = {}) => {
  if (window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};
