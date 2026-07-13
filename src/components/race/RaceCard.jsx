/**
 * RaceCard - レース一覧のカードコンポーネント
 */

import { useTranslation } from 'react-i18next'
import { GRADE_CONFIG } from '../../constants/gradeConfig'

function RaceCard({ race, selectedModel, onAnalyzeRace }) {
  const { t } = useTranslation();
  const racePrediction = race.rawData;
  const volatility = racePrediction?.volatility;
  const result = racePrediction?.result;
  const isFinished = result?.finished;

  const isHighVolatility = volatility?.level === "high";
  const isLowVolatility = volatility?.level === "low";
  const showBadge = isHighVolatility || isLowVolatility;
  const badgeColor = isHighVolatility ? "#c62828" : "#2e7d32";
  const badgeLabel = isHighVolatility ? `🌪️ ${t("volatility.levelHigh")}` : `🎯 ${t("volatility.levelLow")}`;

  const gradeConfig = GRADE_CONFIG[racePrediction?.raceGrade];

  // 的中判定（買い方別）
  let hitBadges = [];
  const hasNewFormat = !!racePrediction?.predictions;
  const hasOldFormat = !!racePrediction?.prediction;

  // モデルキーを変換
  const modelKey =
    selectedModel === "safe-bet"
      ? "safeBet"
      : selectedModel === "upset-focus"
        ? "upsetFocus"
        : "standard";

  // 予測データを取得
  let prediction;
  if (hasNewFormat) {
    prediction = racePrediction.predictions[modelKey];
  } else if (modelKey === "standard" && hasOldFormat) {
    prediction = racePrediction.prediction;
  }

  if (isFinished && prediction) {
    const topPick = prediction.topPick;
    const top3 = prediction.top3;

    const isWinHit = topPick === result.rank1;
    const isPlaceHit = topPick === result.rank1 || topPick === result.rank2;
    const is3FukuHit =
      top3.includes(result.rank1) &&
      top3.includes(result.rank2) &&
      top3.includes(result.rank3);
    const is3TanHit =
      top3[0] === result.rank1 &&
      top3[1] === result.rank2 &&
      top3[2] === result.rank3;

    if (isWinHit) hitBadges.push({ label: t("raceCard.badgeWin"), type: "win" });
    if (isPlaceHit) hitBadges.push({ label: t("raceCard.badgePlace"), type: "place" });
    if (is3FukuHit) hitBadges.push({ label: t("raceCard.badgeTrifecta"), type: "trifecta" });
    if (is3TanHit) hitBadges.push({ label: t("raceCard.badgeTrio"), type: "trio" });
  }

  return (
    <div
      className="race-card"
      style={showBadge ? { borderLeft: `4px solid ${badgeColor}` } : undefined}
    >
      <div className="race-card-header">
        <h3>{race.venue}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {showBadge && (
            <span
              style={{
                padding: "0.2rem 0.55rem",
                borderRadius: "8px",
                fontSize: "0.7rem",
                fontWeight: "700",
                background: badgeColor,
                color: "#fff",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {badgeLabel}
            </span>
          )}
          {gradeConfig && (
            <span
              style={{
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
                fontSize: "0.7rem",
                fontWeight: "700",
                background: gradeConfig.color,
                color: "#fff",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}
            >
              {gradeConfig.label}
            </span>
          )}
          <span className="race-number">{race.raceNumber}R</span>
        </div>
      </div>
      {isFinished && (
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            gap: "0.3rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {hitBadges.length > 0 ? (
            hitBadges.map((badge, idx) => (
              <span
                key={idx}
                style={{
                  padding: "0.3rem 0.6rem",
                  background: "#10b981",
                  color: "white",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                }}
              >
                ✅ {badge.label}
              </span>
            ))
          ) : (
            <span
              style={{
                padding: "0.3rem 0.6rem",
                background: "#ef4444",
                color: "white",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: "700",
              }}
            >
              {t("raceCard.missBadge")}
            </span>
          )}
        </div>
      )}
      <button className="predict-btn" onClick={() => onAnalyzeRace(race)}>
        {t("raceCard.view")}
      </button>
    </div>
  );
}

export default RaceCard;
