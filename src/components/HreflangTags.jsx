/**
 * HreflangTags - 全ページ共通の hreflang 代替リンクを出力
 * SUPPORTED_LANGUAGES の全言語分の代替 URL を検索エンジンに伝える
 * （デフォルト言語はプレフィックスなし、それ以外は /{code} プレフィックス）
 *
 * React 19 のネイティブ head ホイスティングを使用（react-helmet-async は
 * React 19 で link/meta タグが出力されないため使わない）
 */
import { useLocation } from "react-router-dom";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  parseLangFromPath,
  localizePath,
} from "../config/languages";

const SITE_URL = "https://www.boat-ai.jp";

// 特定言語にしか存在しないパス（存在しない言語版を hreflang で宣言してはいけない）
const LANGUAGE_ONLY_PATHS = {
  "/venues": ["en"],
};

function HreflangTags() {
  const { pathname } = useLocation();

  // 言語プレフィックスを除いた基準パス
  const { basePath } = parseLangFromPath(pathname);

  // 一部言語専用ページは全言語ペアが存在しないため hreflang を出力しない（canonical は各ページが設定）
  const isLanguageOnly = Object.keys(LANGUAGE_ONLY_PATHS).some(
    (p) => basePath === p || basePath.startsWith(`${p}/`),
  );
  if (isLanguageOnly) {
    return null;
  }

  const urlFor = (code) => `${SITE_URL}${localizePath(basePath, code)}`;

  return (
    <>
      {SUPPORTED_LANGUAGES.map(({ code, hreflang }) => (
        <link
          key={code}
          rel="alternate"
          hrefLang={hreflang}
          href={urlFor(code)}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={urlFor(DEFAULT_LANGUAGE)}
      />
    </>
  );
}

export default HreflangTags;
