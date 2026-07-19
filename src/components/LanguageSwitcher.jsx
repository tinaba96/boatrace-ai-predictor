import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  localizePath,
} from "../config/languages";
import { trackLanguageSwitch } from "../utils/analytics";
import "./LanguageSwitcher.css";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // resolvedLanguage は 'en-US' → 'en' のように正規化済み
  const currentLang = i18n.resolvedLanguage || DEFAULT_LANGUAGE;

  // 言語切替時は URL も言語プレフィックスに同期させる（SEO: 言語別 URL）
  const handleChange = (code) => {
    if (code === currentLang) return;
    trackLanguageSwitch(currentLang, code);

    // changeLanguage は非同期のため、Layout のリダイレクト判定が参照する
    // localStorage を先に確定させる（競合すると切替前の言語 URL に戻されてしまう）
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    i18n.changeLanguage(code);

    const target = localizePath(pathname, code);
    if (target !== pathname) {
      navigate(`${target}${search}`, { replace: true });
    }
  };

  return (
    <div
      className="language-switcher"
      role="group"
      aria-label={t("language.switchLabel")}
    >
      <span className="language-switcher-icon" aria-hidden="true">
        🌐
      </span>
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          className={`language-switcher-btn ${currentLang === lang.code ? "active" : ""}`}
          onClick={() => handleChange(lang.code)}
          aria-pressed={currentLang === lang.code}
          title={lang.label}
          aria-label={lang.label}
        >
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
