/**
 * 対応言語の唯一の情報源
 * React 非依存の純粋な JS モジュール（sitemap 生成等の Node スクリプトからも import する）
 * 言語追加の手順は docs/operation/add-language.md を参照
 */
export const SUPPORTED_LANGUAGES = [
  { code: "ja", label: "日本語", ogLocale: "ja_JP", hreflang: "ja" },
  { code: "en", label: "English", ogLocale: "en_US", hreflang: "en" },
];

// URL プレフィックスなしで配信するデフォルト言語
export const DEFAULT_LANGUAGE = "ja";

// 言語設定の localStorage キー（LanguageSwitcher / AppRouter からも参照）
export const LANGUAGE_STORAGE_KEY = "boatai-language";

// 言語コードから定義を取得（未対応コードはデフォルト言語の定義を返す）
export function getLanguage(code) {
  return (
    SUPPORTED_LANGUAGES.find((l) => l.code === code) ??
    SUPPORTED_LANGUAGES.find((l) => l.code === DEFAULT_LANGUAGE)
  );
}

/**
 * パスから言語コードとプレフィックス除去後の基準パスを得る
 * 例: '/en/guide' → { lng: 'en', basePath: '/guide' }、'/guide' → { lng: 'ja', basePath: '/guide' }
 */
export function parseLangFromPath(pathname) {
  for (const { code } of SUPPORTED_LANGUAGES) {
    if (code === DEFAULT_LANGUAGE) continue;
    if (pathname === `/${code}` || pathname.startsWith(`/${code}/`)) {
      return { lng: code, basePath: pathname.slice(code.length + 1) || "/" };
    }
  }
  return { lng: DEFAULT_LANGUAGE, basePath: pathname || "/" };
}

/**
 * パスを指定言語のプレフィックス付きに変換する（既存プレフィックスは付け替え）
 * 例: localizePath('/guide', 'en') → '/en/guide'、localizePath('/en/guide', 'ja') → '/guide'
 */
export function localizePath(path, lng) {
  const { basePath } = parseLangFromPath(path);
  if (!lng || lng === DEFAULT_LANGUAGE) return basePath;
  return basePath === "/" ? `/${lng}/` : `/${lng}${basePath}`;
}
