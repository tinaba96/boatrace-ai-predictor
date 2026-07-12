import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import jaCommon from "./locales/ja/common.json";
import enCommon from "./locales/en/common.json";

// 対応言語一覧（言語追加時はここに追記 + locales/{lng}/ を作成）
export const SUPPORTED_LANGUAGES = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: { common: jaCommon },
      en: { common: enCommon },
    },
    // 未翻訳キーは日本語にフォールバック
    fallbackLng: "ja",
    defaultNS: "common",
    ns: ["common"],
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    detection: {
      // localStorage優先 → ブラウザ言語で自動検出
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "boatai-language",
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
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
// 初期化時点の言語も反映（languageChanged は初期化前のリスナー登録時のみ発火するため）
document.documentElement.lang = i18n.resolvedLanguage || "ja";

export default i18n;
