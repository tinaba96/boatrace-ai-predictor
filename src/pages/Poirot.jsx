import { Helmet } from "react-helmet-async";
import Header from "../components/Header";
import "./Poirot.css";

export default function Poirot() {
  return (
    <>
      <Helmet>
        <title>ポアロ予想（α） | BoatAI</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Header />
      <main className="poirot-page">
        <div className="poirot-container">
          <div className="poirot-header">
            <h1 className="poirot-title">
              ポアロ予想
              <span className="poirot-alpha-badge">α</span>
            </h1>
            <p className="poirot-lead">
              新しい予想モデルの実験版です。既存の本命／スタンダード／穴モデルとは独立して評価中の予想を表示します。
            </p>
          </div>

          <section className="poirot-notice">
            <h2>このページについて</h2>
            <ul>
              <li>
                本ページは <strong>アルファ版（非公開リンク）</strong>{" "}
                です。動線からはアクセスできません。
              </li>
              <li>
                表示内容は実験中のため、的中率・回収率の保証はありません。
              </li>
              <li>本番採用に至った場合は通常の予想ページに統合されます。</li>
            </ul>
          </section>

          <section className="poirot-content">
            <h2>本日の予想</h2>
            <div className="poirot-placeholder">
              <p>準備中です。</p>
              <p className="poirot-placeholder-sub">
                予想モデルの学習データを収集しています。データが揃い次第ここに表示されます。
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
