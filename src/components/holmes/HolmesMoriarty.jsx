import { useState, useEffect } from "react";
import {
  getMoriartyStats,
  getMoriartyRecommendations,
  getMoriartyROIHistory,
  getMoriartyVenueBreakdown,
  getMoriartyCalibrationData,
} from "../../services/moriartyService";
import MoriartyStatsHeader from "./MoriartyStatsHeader";
import MoriartyDataMaturity from "./MoriartyDataMaturity";
import MoriartyROIChart from "./MoriartyROIChart";
import MoriartyVenueBreakdown from "./MoriartyVenueBreakdown";
import MoriartyCalibrationDiagram from "./MoriartyCalibrationDiagram";
import MoriartyRecommendationList from "./MoriartyRecommendationList";
import { MoriartyExplanation } from "./explanations";
import "./HolmesMoriarty.css";

function getStage(totalBets) {
  if (totalBets < 30) return "starting";
  if (totalBets < 100) return "gathering";
  if (totalBets < 300) return "growing";
  return "mature";
}

function HolmesMoriarty() {
  const [stats, setStats] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [roiHistory, setRoiHistory] = useState([]);
  const [venueBreakdown, setVenueBreakdown] = useState([]);
  const [calibrationData, setCalibrationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      getMoriartyStats(),
      getMoriartyRecommendations(null),
      getMoriartyROIHistory(30),
      getMoriartyVenueBreakdown(30),
      getMoriartyCalibrationData(),
    ])
      .then(([s, recs, roi, venue, cal]) => {
        setStats(s || {});
        setRecommendations(recs || []);
        setRoiHistory(roi || []);
        setVenueBreakdown(venue || []);
        setCalibrationData(cal || []);
      })
      .catch((err) => {
        console.error("[HolmesMoriarty] fetch error:", err);
        setError("データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, []);

  const totalBets = stats.total_bets ?? 0;
  const stage = getStage(totalBets);

  if (loading) {
    return (
      <div className="holmes-detective-card moriarty-card">
        <div className="moriarty-loading">データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="holmes-detective-card moriarty-card">
        <div className="moriarty-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="holmes-detective-card moriarty-card">
      <div className="holmes-detective-header">
        <div
          className="holmes-detective-icon"
          style={{ background: "#1f2937" }}
        >
          🎩
        </div>
        <div className="holmes-detective-meta">
          <div className="holmes-detective-name">モリアーティ予想</div>
          <div className="holmes-detective-title">
            犯罪界のナポレオン - 数学的最適化の教授
          </div>
          <div className="holmes-detective-tech">
            技術: <code>Probability Calibration + Kelly Criterion</code>
          </div>
        </div>
        <div className="holmes-status-badge moriarty-status-badge">稼働中</div>
      </div>

      {stage === "starting" && (
        <div className="moriarty-stage-starting">
          <section className="holmes-section">
            <h3>⏳ データ蓄積中</h3>
            <p className="moriarty-stage-desc">
              運用 {stats.operation_days ?? 0} 日目 / 推奨レース {totalBets} 件
            </p>
            <MoriartyDataMaturity totalBets={totalBets} stage={stage} />
            <div className="moriarty-notice moriarty-notice--warning">
              初期段階のため数値は参考程度です。30件到達でチャートが表示されます。
            </div>
          </section>
          {recommendations.length > 0 && (
            <section className="holmes-section">
              <h3>本日の推奨レース</h3>
              <MoriartyRecommendationList recommendations={recommendations} />
            </section>
          )}
        </div>
      )}

      {stage === "gathering" && (
        <>
          <section className="holmes-section">
            <MoriartyStatsHeader stats={stats} />
          </section>
          <section className="holmes-section">
            <MoriartyDataMaturity totalBets={totalBets} stage={stage} />
          </section>
          <section className="holmes-section">
            <h3>累積回収率推移</h3>
            <MoriartyROIChart data={roiHistory} showSampleWarning />
          </section>
          <section className="holmes-section">
            <h3>本日の推奨レース</h3>
            <MoriartyRecommendationList recommendations={recommendations} />
          </section>
        </>
      )}

      {stage === "growing" && (
        <>
          <section className="holmes-section">
            <MoriartyStatsHeader stats={stats} />
          </section>
          <section className="holmes-section">
            <h3>累積回収率推移</h3>
            <MoriartyROIChart data={roiHistory} />
          </section>
          <section className="holmes-section">
            <h3>会場別回収率</h3>
            <MoriartyVenueBreakdown data={venueBreakdown} />
          </section>
          <section className="holmes-section">
            <h3>本日の推奨レース</h3>
            <MoriartyRecommendationList recommendations={recommendations} />
          </section>
        </>
      )}

      {stage === "mature" && (
        <>
          <section className="holmes-section">
            <MoriartyStatsHeader stats={stats} />
          </section>
          <section className="holmes-section">
            <h3>累積回収率推移</h3>
            <MoriartyROIChart data={roiHistory} />
          </section>
          <section className="holmes-section">
            <h3>会場別回収率</h3>
            <MoriartyVenueBreakdown data={venueBreakdown} />
          </section>
          <section className="holmes-section">
            <h3>予測キャリブレーション</h3>
            <MoriartyCalibrationDiagram data={calibrationData} />
          </section>
          <section className="holmes-section">
            <h3>本日の推奨レース</h3>
            <MoriartyRecommendationList recommendations={recommendations} />
          </section>
        </>
      )}
      <MoriartyExplanation />
    </div>
  );
}

export default HolmesMoriarty;
