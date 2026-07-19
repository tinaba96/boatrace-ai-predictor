import { useTranslation } from "react-i18next";
import { localizePath } from "../config/languages";

/**
 * 現在の言語に応じて内部リンクのパスを言語プレフィックス付きに変換するフック
 * 例: EN表示中 localize('/guide') → '/en/guide'、JA表示中はそのまま
 */
export function useLocalizedPath() {
  const { i18n } = useTranslation();

  return (path) => localizePath(path, i18n.resolvedLanguage);
}
