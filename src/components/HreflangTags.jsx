/**
 * HreflangTags - 全ページ共通の hreflang 代替リンクを出力
 * そのページが提供されている言語分の代替 URL を検索エンジンに伝える
 * （デフォルト言語はプレフィックスなし、それ以外は /{code} プレフィックス）
 *
 * React 19 のネイティブ head ホイスティングを使用（react-helmet-async は
 * React 19 で link/meta タグが出力されないため使わない）
 */
import { useLocation } from "react-router-dom";
import {
  DEFAULT_LANGUAGE,
  parseLangFromPath,
  localizePath,
  getAvailableLanguages,
} from "../config/languages";

const SITE_URL = "https://www.boat-ai.jp";

function HreflangTags() {
  const { pathname } = useLocation();

  // 言語プレフィックスを除いた基準パス
  const { basePath } = parseLangFromPath(pathname);

  // 1言語でしか提供されていないページは代替が存在しないため hreflang を出力しない
  // （canonical は各ページが設定）
  const languages = getAvailableLanguages(basePath);
  if (languages.length < 2) {
    return null;
  }

  const urlFor = (code) => `${SITE_URL}${localizePath(basePath, code)}`;

  return (
    <>
      {languages.map(({ code, hreflang }) => (
        <link
          key={code}
          rel="alternate"
          hrefLang={hreflang}
          href={urlFor(code)}
        />
      ))}
      {languages.some(({ code }) => code === DEFAULT_LANGUAGE) && (
        <link
          rel="alternate"
          hrefLang="x-default"
          href={urlFor(DEFAULT_LANGUAGE)}
        />
      )}
    </>
  );
}

export default HreflangTags;
