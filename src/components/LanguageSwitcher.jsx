import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import "./LanguageSwitcher.css";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  // resolvedLanguage は 'en-US' → 'en' のように正規化済み
  const currentLang = i18n.resolvedLanguage || "ja";

  const handleChange = (code) => {
    i18n.changeLanguage(code);
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
        >
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
