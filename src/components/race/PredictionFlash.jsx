/**
 * PredictionFlash - AI予想サマリカード
 *
 * 推奨買い目と予測根拠を静的カードとして表示する。
 * 上段: 結論（買い目 + 選手名）
 * 下段: 根拠（展示ST・モーター・勝率・展開予測）
 */
import { useMemo } from "react";
import { BOAT_COLORS } from "../../utils/colors";
import { TECHNIQUE_NAMES } from "../../utils/turnPrediction";
import "./PredictionFlash.css";

/**
 * secondPlace/thirdPlace分布から最有力コースを取得
 */
function getTopCourse(distribution, excludeCourses) {
  if (!distribution) return null;
  let best = null;
  let bestProb = -1;
  for (const [course, prob] of Object.entries(distribution)) {
    const c = parseInt(course);
    if (excludeCourses.includes(c)) continue;
    if (prob > bestProb) {
      bestProb = prob;
      best = c;
    }
  }
  return best;
}

/**
 * ボート番号バッジ（小）
 */
function BoatBadge({ number }) {
  const colors = BOAT_COLORS[number] || BOAT_COLORS[1];
  return (
    <span
      className="flash-boat-number"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {number}
    </span>
  );
}

/**
 * 展開予測の定性表現を取得
 */
function getTechniqueLabel(turnPrediction) {
  if (!turnPrediction?.technique || !turnPrediction?.probability) return null;
  const techName =
    TECHNIQUE_NAMES[turnPrediction.technique] || turnPrediction.technique;
  const prob = turnPrediction.probability;
  if (prob >= 0.6) return `${techName}濃厚`;
  if (prob >= 0.4) return `${techName}有力`;
  return "混戦模様";
}

/**
 * 買い目データを生成（選択モデルに連動）
 */
function buildBetData(prediction, patternIndex) {
  const tp = prediction.turnPrediction;
  if (!tp?.patterns?.length) return null;
  const pattern = tp.patterns[patternIndex] || tp.patterns[0];
  const c1 = pattern.winnerCourse;
  const c2 = getTopCourse(pattern.secondPlace, [c1]);
  const c3 = getTopCourse(pattern.thirdPlace, [c1, c2].filter(Boolean));
  if (!c1 || !c2 || !c3) return null;

  // 各コースの選手名を取得
  const players = prediction.allPlayers || [];
  const getName = (course) => {
    const player = players.find((p) => p.number === course);
    if (!player?.name) return "";
    // 姓のみ（最初の空白/全角空白まで）
    return player.name.split(/[\s　]/)[0];
  };

  return {
    courses: [c1, c2, c3],
    names: [getName(c1), getName(c2), getName(c3)],
  };
}

/**
 * 根拠データを生成
 */
function buildReasoningData(prediction) {
  const { turnPrediction, racerStats, allPlayers } = prediction;
  const items = [];

  // 1. 展示ST トップ2
  if (racerStats?.length) {
    const stSorted = racerStats
      .filter((r) => r.avgST != null && r.avgST > 0)
      .sort((a, b) => a.avgST - b.avgST)
      .slice(0, 2);
    if (stSorted.length >= 2) {
      items.push({
        key: "st",
        label: "展示ST",
        values: stSorted.map((r) => ({
          boat: r.boatNumber,
          text: r.avgST.toFixed(2),
        })),
      });
    }
  }

  // 2. モーター2連率 トップ2
  if (allPlayers?.length) {
    const motorSorted = [...allPlayers]
      .filter((p) => p.motor2Rate != null)
      .sort((a, b) => parseFloat(b.motor2Rate) - parseFloat(a.motor2Rate))
      .slice(0, 2);
    if (motorSorted.length >= 2) {
      items.push({
        key: "motor",
        label: "モーター",
        values: motorSorted.map((p) => ({
          boat: p.number,
          text: `${parseFloat(p.motor2Rate).toFixed(1)}%`,
        })),
      });
    }
  }

  // 3. 全国勝率 トップ2
  if (allPlayers?.length) {
    const winSorted = [...allPlayers]
      .filter((p) => p.winRate != null)
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, 2);
    if (winSorted.length >= 2) {
      items.push({
        key: "winrate",
        label: "勝率",
        values: winSorted.map((p) => ({
          boat: p.number,
          text: parseFloat(p.winRate).toFixed(2),
        })),
      });
    }
  }

  // 4. 展開予測（定性表現）
  const techLabel = getTechniqueLabel(turnPrediction);
  if (techLabel) {
    items.push({
      key: "prediction",
      label: "展開予測",
      text: techLabel,
    });
  }

  return items;
}

function PredictionFlash({
  prediction,
  selectedRace,
  selectedPatternIndex = 0,
}) {
  const betData = useMemo(
    () => buildBetData(prediction, selectedPatternIndex),
    [prediction, selectedPatternIndex],
  );

  const reasoningItems = useMemo(
    () => buildReasoningData(prediction),
    [prediction],
  );

  // データ不足時は非表示
  if (!prediction?.turnPrediction || !prediction?.allPlayers) return null;
  if (!betData) return null;

  return (
    <div className="prediction-flash">
      {/* 上段: 買い目 */}
      <div className="flash-bet-section">
        <span className="flash-bet-title">AI推奨買い目</span>
        <div className="flash-bet-courses">
          {betData.courses.map((course, i) => {
            const colors = BOAT_COLORS[course] || BOAT_COLORS[1];
            return (
              <div key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="flash-bet-separator">&rarr;</span>}
                <div className="flash-bet-course-wrapper">
                  <div
                    className="flash-bet-course"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {course}
                  </div>
                  <span className="flash-bet-rank">
                    {i === 0 ? "1着" : i === 1 ? "2着" : "3着"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flash-bet-names">
          {betData.names.map((name, i) => (
            <span key={i} className="flash-bet-name">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* 区切り線 */}
      <div className="flash-divider" />

      {/* 下段: 根拠 */}
      <div className="flash-reasoning">
        {reasoningItems.map((item) => (
          <div key={item.key} className="flash-reasoning-item">
            <span className="flash-label">{item.label}</span>
            <span className="flash-value">
              {item.values ? (
                <>
                  <BoatBadge number={item.values[0].boat} />
                  <span className="flash-highlight">
                    {item.values[0].text}
                  </span>{" "}
                  <BoatBadge number={item.values[1].boat} />
                  {item.values[1].text}
                </>
              ) : (
                <span className="flash-highlight">{item.text}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PredictionFlash;
