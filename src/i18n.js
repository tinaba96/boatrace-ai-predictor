import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { trackLanguage } from "./utils/analytics";
import { SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from "./config/languages";

// 翻訳リソースを SUPPORTED_LANGUAGES から動的に構築
// （言語追加 = config/languages.js への追記 + locales/{lng}/common.json の作成のみ）
const localeModules = import.meta.glob("./locales/*/common.json", {
  eager: true,
});
const resources = Object.fromEntries(
  SUPPORTED_LANGUAGES.map(({ code }) => {
    const mod = localeModules[`./locales/${code}/common.json`];
    if (!mod) {
      throw new Error(
        `翻訳ファイルがありません: src/locales/${code}/common.json`,
      );
    }
    return [code, { common: mod.default }];
  }),
);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // 未翻訳キーは日本語にフォールバック
    fallbackLng: "ja",
    defaultNS: "common",
    ns: ["common"],
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    detection: {
      // localStorage優先 → ブラウザ言語で自動検出
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: {
      // ReactはXSS対策済みのためエスケープ不要
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// スクリーンリーダーの読み上げ言語・SEOのため <html lang> を言語切替に同期
// GA4 の言語別分析のためユーザープロパティも送信
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  trackLanguage(lng);
});
// 初期化時点の言語も反映（languageChanged は初期化前のリスナー登録時のみ発火するため）
document.documentElement.lang = i18n.resolvedLanguage || "ja";
trackLanguage(i18n.resolvedLanguage || "ja");

export default i18n;
