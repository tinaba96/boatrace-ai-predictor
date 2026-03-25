/**
 * PredictionFlash - AI予想根拠フラッシュ + 買い目表示アニメーション
 *
 * 予測の根拠データをテンポよくフラッシュ表示し、推奨買い目を提示する。
 * 約3.5秒のDOMアニメーション。将来Remotion移植でMP4化する設計書を兼ねる。
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BOAT_COLORS } from "../../utils/colors";
import { TECHNIQUE_NAMES } from "../../utils/turnPrediction";
import "./PredictionFlash.css";

// アニメーション定数
const FLASH_INTERVAL = 300; // 各項目の表示間隔(ms)
const FLASH_DURATION = 250; // 各項目のアニメーション時間(ms)
const BET_DELAY = 2000; // 買い目表示までの遅延(ms)
const BET_DISPLAY_DURATION = 1500; // 買い目表示時間(ms)
const TOTAL_DURATION = BET_DELAY + BET_DISPLAY_DURATION; // 3500ms

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
 * ボート番号バッジ
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
 * 根拠フラッシュのデータ項目を生成
 */
function buildFlashItems(prediction, selectedRace) {
  const items = [];
  const { turnPrediction, racerStats, allPlayers } = prediction;

  // 1. 会場・レース番号
  items.push({
    key: "venue",
    content: (
      <span className="flash-venue">
        {selectedRace?.venue || "不明"} {selectedRace?.raceNumber || "?"}R
      </span>
    ),
  });

  // 2. 展示ST トップ2
  if (racerStats?.length) {
    const stSorted = racerStats
      .filter((r) => r.avgST != null && r.avgST > 0)
      .sort((a, b) => a.avgST - b.avgST)
      .slice(0, 2);
    if (stSorted.length >= 2) {
      items.push({
        key: "st",
        content: (
          <>
            <span className="flash-label">展示ST</span>
            <span className="flash-value">
              <BoatBadge number={stSorted[0].boatNumber} />
              <span className="flash-highlight">
                {stSorted[0].avgST.toFixed(2)}
              </span>{" "}
              <BoatBadge number={stSorted[1].boatNumber} />
              {stSorted[1].avgST.toFixed(2)}
            </span>
          </>
        ),
      });
    }
  }

  // 3. モーター2連率 トップ2
  if (allPlayers?.length) {
    const motorSorted = [...allPlayers]
      .filter((p) => p.motor2Rate != null)
      .sort((a, b) => parseFloat(b.motor2Rate) - parseFloat(a.motor2Rate))
      .slice(0, 2);
    if (motorSorted.length >= 2) {
      items.push({
        key: "motor",
        content: (
          <>
            <span className="flash-label">モーター</span>
            <span className="flash-value">
              <BoatBadge number={motorSorted[0].number} />
              <span className="flash-highlight">
                {parseFloat(motorSorted[0].motor2Rate).toFixed(1)}%
              </span>{" "}
              <BoatBadge number={motorSorted[1].number} />
              {parseFloat(motorSorted[1].motor2Rate).toFixed(1)}%
            </span>
          </>
        ),
      });
    }
  }

  // 4. 全国勝率 トップ2
  if (allPlayers?.length) {
    const winSorted = [...allPlayers]
      .filter((p) => p.winRate != null)
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
      .slice(0, 2);
    if (winSorted.length >= 2) {
      items.push({
        key: "winrate",
        content: (
          <>
            <span className="flash-label">勝率</span>
            <span className="flash-value">
              <BoatBadge number={winSorted[0].number} />
              <span className="flash-highlight">
                {parseFloat(winSorted[0].winRate).toFixed(2)}
              </span>{" "}
              <BoatBadge number={winSorted[1].number} />
              {parseFloat(winSorted[1].winRate).toFixed(2)}
            </span>
          </>
        ),
      });
    }
  }

  // 5. 攻撃ハイライト（最も高い攻撃率を持つ選手）
  if (racerStats?.length) {
    let bestAttack = null;
    for (const racer of racerStats) {
      const dist = racer.attackDistribution;
      if (!dist) continue;
      const course = String(racer.course || racer.boatNumber);
      const courseDist = dist[course];
      if (!courseDist) continue;
      for (const [tech, rate] of Object.entries(courseDist)) {
        if (tech === "nige" || tech === "megumare") continue;
        if (!bestAttack || rate > bestAttack.rate) {
          bestAttack = {
            boatNumber: racer.boatNumber,
            tech,
            rate,
          };
        }
      }
    }
    if (bestAttack && bestAttack.rate > 0.1) {
      items.push({
        key: "attack",
        content: (
          <>
            <span className="flash-label">攻撃実績</span>
            <span className="flash-value">
              <BoatBadge number={bestAttack.boatNumber} />
              <span className="flash-highlight">
                {TECHNIQUE_NAMES[bestAttack.tech] || bestAttack.tech}率{" "}
                {(bestAttack.rate * 100).toFixed(0)}%
              </span>
            </span>
          </>
        ),
      });
    }
  }

  // 6. 展開予測確率
  if (turnPrediction?.technique && turnPrediction?.probability) {
    const techName =
      TECHNIQUE_NAMES[turnPrediction.technique] || turnPrediction.technique;
    const prob = (turnPrediction.probability * 100).toFixed(0);
    items.push({
      key: "prediction",
      content: (
        <>
          <span className="flash-label">展開予測</span>
          <span className="flash-value">
            <span className="flash-highlight">
              {techName}確率 {prob}%
            </span>
            {" → "}
            {turnPrediction.winnerCourse}コース有利
          </span>
        </>
      ),
    });
  }

  return items;
}

/**
 * 買い目データを生成
 */
function buildBetCourses(turnPrediction) {
  if (!turnPrediction?.patterns?.length) return null;
  const pattern = turnPrediction.patterns[0];
  const c1 = pattern.winnerCourse;
  const c2 = getTopCourse(pattern.secondPlace, [c1]);
  const c3 = getTopCourse(pattern.thirdPlace, [c1, c2].filter(Boolean));
  if (!c1 || !c2 || !c3) return null;
  return [c1, c2, c3];
}

/**
 * フラッシュ項目アニメーションvariant
 */
const flashVariants = {
  initial: { opacity: 0, x: 30 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: FLASH_DURATION / 1000, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.15 },
  },
};

const betVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

function PredictionFlash({ prediction, selectedRace }) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showBet, setShowBet] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const flashItems = useMemo(
    () => buildFlashItems(prediction, selectedRace),
    [prediction, selectedRace],
  );

  const betCourses = useMemo(
    () => buildBetCourses(prediction.turnPrediction),
    [prediction.turnPrediction],
  );

  // アニメーション実行
  useEffect(() => {
    setCurrentIndex(-1);
    setShowBet(false);
    setIsComplete(false);

    const timers = [];

    // 各フラッシュ項目を順次表示
    flashItems.forEach((_, i) => {
      timers.push(setTimeout(() => setCurrentIndex(i), i * FLASH_INTERVAL));
    });

    // 買い目表示
    timers.push(
      setTimeout(() => {
        setCurrentIndex(-1);
        setShowBet(true);
      }, BET_DELAY),
    );

    // 完了
    timers.push(setTimeout(() => setIsComplete(true), TOTAL_DURATION));

    return () => timers.forEach(clearTimeout);
  }, [flashItems.length, playKey]);

  const handleReplay = useCallback(() => {
    setPlayKey((k) => k + 1);
  }, []);

  // データ不足時は非表示
  if (!prediction?.turnPrediction || !prediction?.allPlayers) return null;

  return (
    <div className="prediction-flash">
      {/* Scene 1: 根拠フラッシュ */}
      {!showBet && (
        <AnimatePresence mode="wait">
          {currentIndex >= 0 && currentIndex < flashItems.length && (
            <motion.div
              key={`flash-${flashItems[currentIndex].key}-${playKey}`}
              className="flash-item"
              variants={flashVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {flashItems[currentIndex].content}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Scene 2: 買い目表示 */}
      {showBet && betCourses && (
        <motion.div
          key={`bet-${playKey}`}
          className="flash-bet-section"
          variants={betVariants}
          initial="initial"
          animate="animate"
        >
          <span className="flash-bet-title">AI推奨買い目</span>
          <div className="flash-bet-courses">
            {betCourses.map((course, i) => {
              const colors = BOAT_COLORS[course] || BOAT_COLORS[1];
              return (
                <div key={i} style={{ display: "contents" }}>
                  {i > 0 && <span className="flash-bet-separator">→</span>}
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
          <span className="flash-logo">BoatAI</span>
        </motion.div>
      )}

      {/* リプレイボタン */}
      {isComplete && (
        <button className="flash-replay" onClick={handleReplay}>
          もう一度再生
        </button>
      )}
    </div>
  );
}

export default PredictionFlash;
