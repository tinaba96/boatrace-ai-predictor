/**
 * EnglishVenueGuide - 会場別英語ガイド（/en/venues, /en/venues/:slug）
 * インバウンド観光クエリ（アクセス・入場料・初心者向け）の受け皿 + AI予想への導線（BOA-133）
 */
import { Link, useParams, Navigate } from "react-router-dom";
import Header from "../components/Header";
import { VENUE_GUIDES_EN, getVenueGuideEn } from "../data/venueGuidesEn";
import "./EnglishGuide.css";
import "./EnglishVenueGuide.css";

const SITE_URL = "https://www.boat-ai.jp";

// 会場一覧ページ（/en/venues）
export function EnglishVenueGuides() {
  return (
    <div className="app">
      <title>Boat Race Venues in Japan: Visitor Guides | BoatAI</title>
      <meta
        name="description"
        content="English visitor guides to Japan's Kyotei (boat race) venues: how to get there, entrance fees, night races, and betting tips for Heiwajima, Suminoe, Edogawa, Tamagawa and Fukuoka."
      />
      <link rel="canonical" href={`${SITE_URL}/en/venues`} />

      <Header />

      <div className="eg-container">
        <section className="eg-hero">
          <h1>🏟️ Boat Race Venue Guides</h1>
          <p className="eg-hero-lead">
            Japan has 24 Kyotei venues, and most welcome visitors for a ¥100
            entrance fee. These guides cover the venues easiest for travelers to
            reach — how to get there, what makes each one unique, and how to
            enjoy your first visit. New to the sport? Start with our{" "}
            <Link to="/en/guide">beginner&apos;s guide</Link>.
          </p>
        </section>

        <div className="evg-list">
          {VENUE_GUIDES_EN.map((v) => (
            <Link key={v.slug} to={`/en/venues/${v.slug}`} className="evg-card">
              <div className="evg-card-head">
                <h2>
                  {v.name} <span className="eg-kanji">{v.kanji}</span>
                </h2>
                <span className="evg-region">{v.region}</span>
              </div>
              <p className="evg-tagline">{v.tagline}</p>
              <div className="evg-badges">
                {v.facts.nightRace && (
                  <span className="evg-badge evg-badge--night">
                    🌙 Night races
                  </span>
                )}
                <span className="evg-badge">{v.facts.water}</span>
              </div>
            </Link>
          ))}
        </div>

        <section className="eg-cta">
          <h2>Check today&apos;s AI predictions before you go</h2>
          <Link to="/en/" className="eg-cta-button">
            🏁 View Free Predictions
          </Link>
        </section>
      </div>
    </div>
  );
}

// 会場詳細ページ（/en/venues/:slug）
export default function EnglishVenueGuide() {
  const { slug } = useParams();
  const venue = getVenueGuideEn(slug);

  if (!venue) {
    return <Navigate to="/en/venues" replace />;
  }

  return (
    <div className="app">
      <title>{`Boat Race ${venue.name} (${venue.kanji}): Access & Visitor Guide | BoatAI`}</title>
      <meta
        name="description"
        content={`How to visit Boat Race ${venue.name} in ${venue.region}: access from the nearest station, entrance fee, water characteristics and betting tips. ${venue.tagline}.`}
      />
      <link rel="canonical" href={`${SITE_URL}/en/venues/${venue.slug}`} />

      <Header />

      <div className="eg-container">
        <nav className="evg-breadcrumb">
          <Link to="/en/venues">← All venues</Link>
        </nav>

        <section className="eg-hero">
          <h1>
            🚤 Boat Race {venue.name}{" "}
            <span className="eg-kanji">{venue.kanji}</span>
          </h1>
          <p className="evg-tagline evg-tagline--hero">{venue.tagline}</p>
        </section>

        <section className="eg-section">
          <h2>Why visit</h2>
          {venue.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section className="eg-section">
          <h2>🚉 Getting there</h2>
          <ul className="eg-list">
            {venue.access.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <p className="eg-note">
            Entrance fee: ¥100 (most venues). Free shuttle buses run on race
            days only — check the official venue site for the day&apos;s
            schedule.
          </p>
        </section>

        <section className="eg-section">
          <h2>⚡ Quick facts</h2>
          <div className="eg-facts-grid">
            <div className="eg-fact">
              <strong>Water</strong>
              <span>{venue.facts.water}</span>
            </div>
            <div className="eg-fact">
              <strong>Race style</strong>
              <span>{venue.facts.character}</span>
            </div>
            <div className="eg-fact">
              <strong>Night races</strong>
              <span>{venue.facts.nightRace ? "Yes 🌙" : "No (daytime)"}</span>
            </div>
            <div className="eg-fact">
              <strong>Entrance</strong>
              <span>¥100</span>
            </div>
          </div>
        </section>

        <section className="eg-section eg-highlight">
          <h2>💡 Betting tip</h2>
          <p>{venue.tip}</p>
        </section>

        <section className="eg-section eg-disclaimer">
          <h2>⚖️ Before you bet</h2>
          <p>
            Betting requires being physically in Japan and aged 20 or older.
            BoatAI provides information and AI analysis only — see our{" "}
            <Link to="/en/guide">beginner&apos;s guide</Link> for the rules and
            bet types.
          </p>
        </section>

        <section className="eg-cta">
          <h2>
            See today&apos;s AI predictions
            {venue.facts.nightRace ? " — including night races" : ""}
          </h2>
          <Link to="/en/" className="eg-cta-button">
            🏁 View Free Predictions
          </Link>
        </section>
      </div>
    </div>
  );
}
