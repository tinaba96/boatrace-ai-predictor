import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_STORAGE_KEY } from "./i18n";
import { refreshAdsOnRouteChange } from "./utils/analytics";
import App from "./App";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import HowToUse from "./pages/HowToUse";
import RaceHistory from "./pages/RaceHistory";
import RaceDetail from "./pages/RaceDetail";
import Profile from "./pages/Profile";
import AccuracyHistory from "./pages/AccuracyHistory";
import OutcomeDistribution from "./pages/OutcomeDistribution";
import Holmes from "./pages/Holmes";
import ContentHub from "./pages/ContentHub";
import AdminRules from "./pages/admin/AdminRules";
import ResponsibleGambling from "./pages/ResponsibleGambling";
import Poirot from "./pages/Poirot";
import CookieConsent from "./components/CookieConsent";
import HreflangTags from "./components/HreflangTags";

// 旧ハッシュURLからのリダイレクトを処理するコンポーネント
function HashRedirect() {
  const location = useLocation();

  useEffect(() => {
    // ハッシュがある場合、対応するパスにリダイレクト
    if (location.hash) {
      const hash = location.hash.slice(1); // '#' を除去
      const validPaths = [
        "races",
        "hit-races",
        "accuracy",
        "picks",
        "privacy",
        "terms",
        "contact",
      ];
      if (validPaths.includes(hash)) {
        // ハッシュを削除してパスに変換
        const newPath = hash === "races" ? "/" : `/${hash}`;
        window.history.replaceState(null, "", newPath);
        window.location.reload();
      }
    }
  }, [location]);

  return null;
}

// ルート変更時にAuto Adsを再スキャン
function AdRefresh() {
  const location = useLocation();

  useEffect(() => {
    refreshAdsOnRouteChange();
  }, [location.pathname]);

  return null;
}

// 言語別に共通のルート定義（/en 配下でも相対パスで再利用）
function LocalizedRoutes() {
  return (
    <Routes>
      {/* Main App - 予想ページ（トップ） */}
      <Route path="/" element={<App tab="races" />} />

      {/* タブページ（SEO対応: 個別URL） */}
      <Route path="hit-races" element={<App tab="hit-races" />} />
      <Route path="accuracy" element={<App tab="accuracy" />} />
      <Route path="picks" element={<App tab="picks" />} />
      <Route path="accuracy/history" element={<AccuracyHistory />} />
      <Route path="outcome-distribution" element={<OutcomeDistribution />} />
      <Route path="privacy" element={<App tab="privacy" />} />
      <Route path="terms" element={<App tab="terms" />} />
      <Route path="contact" element={<App tab="contact" />} />

      {/* Race History Routes */}
      <Route path="races" element={<RaceHistory />} />
      <Route path="races/:date" element={<RaceDetail />} />

      {/* Blog Routes */}
      <Route path="blog" element={<Blog />} />
      <Route path="blog/:id" element={<BlogPost />} />

      {/* Other Pages */}
      <Route path="about" element={<About />} />
      <Route path="faq" element={<FAQ />} />
      <Route path="how-to-use" element={<HowToUse />} />
      <Route path="profile" element={<Profile />} />
      <Route path="guide" element={<ContentHub />} />
      <Route path="responsible-gambling" element={<ResponsibleGambling />} />

      {/* Admin Pages (Hidden) */}
      <Route path="admin/rules" element={<AdminRules />} />

      {/* α版・動線非公開ページ */}
      <Route path="holmes" element={<Holmes />} />
      <Route path="poirot" element={<Poirot />} />

      {/* Fallback: 不明なパスはトップへ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// URL プレフィックスと i18n の言語状態を同期（URL が唯一の情報源）
function LanguageSync({ lng }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.resolvedLanguage !== lng) {
      i18n.changeLanguage(lng);
    }
  }, [i18n, lng]);

  return null;
}

// 初回ロード時のみ: 言語設定が en のユーザーが JA URL に来たら /en へ誘導
// （セッション中は再実行しない = LanguageSwitcher での JA 切替と競合しない）
let initialRedirectDone = false;

function InitialLanguageRedirect() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (initialRedirectDone) return;
    initialRedirectDone = true;

    const isEnPath = pathname === "/en" || pathname.startsWith("/en/");
    if (!isEnPath && localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en") {
      const target = pathname === "/" ? "/en/" : `/en${pathname}`;
      navigate(`${target}${search}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回マウント時のみ実行
  }, []);

  return null;
}

// 英語版レイアウト: /en 配下は言語を en に同期
function EnglishLayout() {
  return (
    <>
      <LanguageSync lng="en" />
      <LocalizedRoutes />
    </>
  );
}

// 日本語版レイアウト
function JapaneseLayout() {
  return (
    <>
      <LanguageSync lng="ja" />
      <LocalizedRoutes />
    </>
  );
}

export default function AppRouter() {
  return (
    <>
      <HashRedirect />
      <AdRefresh />
      <CookieConsent />
      <HreflangTags />
      <InitialLanguageRedirect />
      <Routes>
        <Route path="/en/*" element={<EnglishLayout />} />
        <Route path="/*" element={<JapaneseLayout />} />
      </Routes>
    </>
  );
}
