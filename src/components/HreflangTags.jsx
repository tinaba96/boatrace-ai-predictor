/**
 * HreflangTags - 全ページ共通の hreflang 代替リンクを出力
 * 日本語版（プレフィックスなし）と英語版（/en プレフィックス）の対応を検索エンジンに伝える
 *
 * React 19 のネイティブ head ホイスティングを使用（react-helmet-async は
 * React 19 で link/meta タグが出力されないため使わない）
 */
import { useLocation } from "react-router-dom";

const SITE_URL = "https://www.boat-ai.jp";

function HreflangTags() {
  const { pathname } = useLocation();

  // /en プレフィックスを除いた基準パス
  const basePath = pathname.replace(/^\/en(\/|$)/, "/") || "/";
  const jaUrl = `${SITE_URL}${basePath}`;
  const enUrl =
    basePath === "/" ? `${SITE_URL}/en/` : `${SITE_URL}/en${basePath}`;

  return (
    <>
      <link rel="alternate" hrefLang="ja" href={jaUrl} />
      <link rel="alternate" hrefLang="en" href={enUrl} />
      <link rel="alternate" hrefLang="x-default" href={jaUrl} />
    </>
  );
}

export default HreflangTags;
