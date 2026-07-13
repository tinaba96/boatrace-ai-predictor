/**
 * PredictionFlash - 注目データカード
 *
 * 推奨買い目と各艇の選出理由を静的カードとして表示する。
 * 上段: 買い目（コース + 選手名）
 * 下段: 各艇の予想根拠（上位3因子ランキング）+ 展開ストーリー
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BOAT_COLORS } from "../../utils/colors";
import { TECHNIQUE_NAMES } from "../../utils/turnPrediction";
import { MODEL_NAMES, MODEL_KEY_MAP } from "../../constants";
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

  const players = prediction.allPlayers || [];
  const getName = (course) => {
    const player = players.find((p) => p.number === course);
    if (!player?.name) return "";
    return player.name.split(/[\s　]/)[0];
  };

  return {
    courses: [c1, c2, c3],
    names: [getName(c1), getName(c2), getName(c3)],
    technique: pattern.technique,
  };
}

/**
 * 各艇の突出した指標を上位N件返す（全艇中の順位付き）
 * BOA-64: findTopStat → findTopStats に拡張（上位3因子ランキング）
 */
function findTopStats(boatNumber, allPlayers, racerStats, n = 3) {
  const player = allPlayers.find((p) => p.number === boatNumber);
  if (!player) return [];

  const candidates = [];
  const racer = racerStats?.find((r) => r.boatNumber === boatNumber);

  // 展示ST（小さいほど良い → 順位は昇順）
  if (racer?.avgST > 0) {
    const stAll = racerStats
      .filter((r) => r.avgST > 0)
      .sort((a, b) => a.avgST - b.avgST);
    const rank = stAll.findIndex((r) => r.boatNumber === boatNumber) + 1;
    if (rank > 0) {
      candidates.push({
        labelKey: "flash.statST",
        value: racer.avgST.toFixed(2),
        rank,
        total: stAll.length,
      });
    }
  }

  // モーター2連率（大きいほど良い）
  if (player.motor2Rate != null) {
    const motorAll = [...allPlayers]
      .filter((p) => p.motor2Rate != null)
      .sort((a, b) => parseFloat(b.motor2Rate) - parseFloat(a.motor2Rate));
    const rank = motorAll.findIndex((p) => p.number === boatNumber) + 1;
    if (rank > 0) {
      candidates.push({
        labelKey: "flash.statMotor",
        value: `${parseFloat(player.motor2Rate).toFixed(1)}%`,
        rank,
        total: motorAll.length,
      });
    }
  }

  // 全国勝率（大きいほど良い）
  if (player.winRate != null) {
    const winAll = [...allPlayers]
      .filter((p) => p.winRate != null)
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
    const rank = winAll.findIndex((p) => p.number === boatNumber) + 1;
    if (rank > 0) {
      candidates.push({
        labelKey: "table.nationalWinRate",
        value: parseFloat(player.winRate).toFixed(2),
        rank,
        total: winAll.length,
      });
    }
  }

  // 当地勝率（大きいほど良い）
  if (player.localWinRate != null) {
    const localAll = [...allPlayers]
      .filter((p) => p.localWinRate != null)
      .sort((a, b) => parseFloat(b.localWinRate) - parseFloat(a.localWinRate));
    const rank = localAll.findIndex((p) => p.number === boatNumber) + 1;
    if (rank > 0) {
      candidates.push({
        labelKey: "table.localWinRate",
        value: parseFloat(player.localWinRate).toFixed(2),
        rank,
        total: localAll.length,
      });
    }
  }

  // コース1着率（担当コースでの勝率、3走以上のみ）
  if (racer) {
    const course = String(racer.course || racer.boatNumber);
    const counts = racer.courseRaceCounts?.[course];
    if (counts && counts.total >= 3 && counts.wins > 0) {
      const courseWinRate = counts.wins / counts.total;
      const courseRates = racerStats
        .map((r) => {
          const c = String(r.course || r.boatNumber);
          const cnt = r.courseRaceCounts?.[c];
          if (!cnt || cnt.total < 3) return null;
          return { boatNumber: r.boatNumber, rate: cnt.wins / cnt.total };
        })
        .filter(Boolean)
        .sort((a, b) => b.rate - a.rate);
      const rank = courseRates.findIndex((r) => r.boatNumber === boatNumber) + 1;
      if (rank > 0) {
        candidates.push({
          labelKey: "flash.courseRecord",
          labelParams: { course },
          value: `${(courseWinRate * 100).toFixed(0)}%`,
          rank,
          total: courseRates.length,
        });
      }
    }
  }

  candidates.sort((a, b) => a.rank - b.rank);
  return candidates.slice(0, n);
}

/**
 * 突出した攻撃実績を検出する（2勝以上 AND 勝率30%以上の場合のみ）
 */
function findAttackHighlight(boatNumber, racerStats) {
  const racer = racerStats?.find(
    (r) => r.boatNumber === boatNumber || r.course === boatNumber,
  );
  if (!racer) return null;

  const course = String(racer.course || racer.boatNumber);
  const counts = racer.courseRaceCounts?.[course];
  if (!counts || counts.wins < 2 || counts.total < 3) return null;

  const winRate = counts.wins / counts.total;
  if (winRate < 0.3) return null;

  const attackDist = racer.attackDistribution?.[course];
  if (!attackDist) return null;

  // 最も高い攻撃率の決まり手を取得
  let bestTech = null;
  let bestRate = 0;
  for (const [tech, rate] of Object.entries(attackDist)) {
    if (tech === "nige" || tech === "megumare") continue;
    if (rate > bestRate) {
      bestRate = rate;
      bestTech = tech;
    }
  }

  if (!bestTech || bestRate < 0.3) return null;

  return {
    techKey: bestTech,
    rate: bestRate,
    wins: counts.wins,
    total: counts.total,
    course: parseInt(course),
  };
}

function PredictionFlash({
  prediction,
  selectedRace,
  selectedPatternIndex = 0,
  selectedModel,
}) {
  const { t } = useTranslation();
  const betData = useMemo(
    () => buildBetData(prediction, selectedPatternIndex),
    [prediction, selectedPatternIndex],
  );

  const boatReasons = useMemo(() => {
    if (!betData || !prediction.allPlayers) return [];
    return betData.courses.map((course) => ({
      topStats: findTopStats(course, prediction.allPlayers, prediction.racerStats),
      attack: findAttackHighlight(course, prediction.racerStats),
    }));
  }, [betData, prediction.allPlayers, prediction.racerStats]);

  const storyLine = betData
    ? t("flash.storyLine", {
        c1: betData.courses[0],
        c2: betData.courses[1],
        c3: betData.courses[2],
        tech: t(`techniques.${betData.technique}`, TECHNIQUE_NAMES[betData.technique] || betData.technique),
      })
    : null;

  if (!prediction?.turnPrediction || !prediction?.allPlayers) return null;
  if (!betData) return null;

  return (
    <div className="prediction-flash">
      <div className="flash-card-title">
        <span>{t("flash.title")}</span>
        {(selectedRace?.venue || selectedRace?.raceNumber || selectedModel) && (
          <span className="flash-card-meta">
            {selectedRace?.venue}
            {selectedRace?.raceNumber && ` ${selectedRace.raceNumber}R`}
            {selectedModel && MODEL_NAMES[selectedModel] && ` · ${t(`models.${MODEL_KEY_MAP[selectedModel] || selectedModel}`, MODEL_NAMES[selectedModel])}`}
          </span>
        )}
      </div>

      {/* 上段: 買い目 */}
      <div className="flash-bet-section">
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
                    {i === 0 ? t("result.rank1") : i === 1 ? t("result.rank2") : t("result.rank3")}
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

      <div className="flash-divider" />

      {/* 下段: 各艇の予想根拠（上位3因子ランキング） */}
      <div className="flash-reasons">
        {betData.courses.map((course, i) => {
          const { topStats, attack } = boatReasons[i] || {};
          const rankLabel = i === 0 ? t("result.rank1") : i === 1 ? t("result.rank2") : t("result.rank3");
          return (
            <div key={course} className="flash-reason-block">
              <div className="flash-reason-row">
                <span className="flash-reason-rank">{rankLabel}</span>
                <BoatBadge number={course} />
                <span className="flash-reason-name">{betData.names[i]}</span>
              </div>
              {topStats?.length > 0 && (
                <ol className="flash-factor-list">
                  {topStats.map((stat, j) => (
                    <li key={j} className="flash-factor-item">
                      <span className="flash-factor-label">{t(stat.labelKey, stat.labelParams)}</span>
                      <span className="flash-highlight">{stat.value}</span>
                      <span className="flash-reason-position">
                        {t("flash.rankPosition", { rank: stat.rank, total: stat.total })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {attack && (
                <div className="flash-attack-highlight">
                  <span className="flash-attack-icon">&#x26A1;</span>
                  {t("flash.attackRate", {
                    course: attack.course,
                    tech: t(`techniques.${attack.techKey}`, TECHNIQUE_NAMES[attack.techKey] || attack.techKey),
                  })}
                  <span className="flash-highlight">
                    {(attack.rate * 100).toFixed(0)}%
                  </span>
                  <span className="flash-reason-position">
                    {t("flash.winsCount", { wins: attack.wins, total: attack.total })}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 展開ストーリー */}
      {storyLine && (
        <>
          <div className="flash-divider" />
          <div className="flash-story">
            <span className="flash-story-label">{t("flash.storyLabel")}</span>
            <span className="flash-story-text">{storyLine}</span>
          </div>
        </>
      )}

    </div>
  );
}

export default PredictionFlash;
