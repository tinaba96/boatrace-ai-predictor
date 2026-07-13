import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { SUPPORTED_LANGUAGES } from "../i18n";
import "./LanguageSwitcher.css";

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  // resolvedLanguage は 'en-US' → 'en' のように正規化済み
  const currentLang = i18n.resolvedLanguage || "ja";

  // 言語切替時は URL も /en プレフィックスに同期させる（SEO: 言語別 URL）
  const handleChange = (code) => {
    // changeLanguage は非同期のため、Layout のリダイレクト判定が参照する
    // localStorage を先に確定させる（競合すると /en に戻されてしまう）
    localStorage.setItem("boatai-language", code);
    i18n.changeLanguage(code);

    const isEnPath = pathname === "/en" || pathname.startsWith("/en/");
    if (code === "en" && !isEnPath) {
      const target = pathname === "/" ? "/en/" : `/en${pathname}`;
      navigate(`${target}${search}`, { replace: true });
    } else if (code !== "en" && isEnPath) {
      const stripped = pathname.replace(/^\/en(\/|$)/, "/");
      navigate(`${stripped}${search}`, { replace: true });
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
        >
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
