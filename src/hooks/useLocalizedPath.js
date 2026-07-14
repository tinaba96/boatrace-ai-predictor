import { useTranslation } from "react-i18next";

/**
 * 現在の言語に応じて内部リンクのパスを /en プレフィックス付きに変換するフック
 * 例: EN表示中 localize('/guide') → '/en/guide'、JA表示中はそのまま
 */
export function useLocalizedPath() {
  const { i18n } = useTranslation();

  return (path) => {
    if (i18n.resolvedLanguage !== "en") return path;
    if (path === "/") return "/en/";
    if (path === "/en" || path.startsWith("/en/")) return path;
    return `/en${path}`;
  };
}
