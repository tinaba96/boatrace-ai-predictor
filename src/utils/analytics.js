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

// 表示言語をユーザープロパティとして設定（i18n の languageChanged から呼ばれる）
// GA4 側でカスタムディメンション「app_language」として登録すると言語別分析が可能
export const trackLanguage = (lng) => {
  if (window.gtag) {
    window.gtag('set', 'user_properties', { app_language: lng });
  }
};

// 言語切替イベント（LanguageSwitcher から呼ばれる）
export const trackLanguageSwitch = (fromLng, toLng) => {
  trackEvent('language_change', {
    from_language: fromLng,
    to_language: toLng,
  });
};

// SPA ルート変更時にAuto Adsを再スキャン
export const refreshAdsOnRouteChange = () => {
  try {
    const adsbygoogle = window.adsbygoogle || [];
    adsbygoogle.push({});
  } catch (e) {
    // AdSense未読み込み時は無視
  }
};
