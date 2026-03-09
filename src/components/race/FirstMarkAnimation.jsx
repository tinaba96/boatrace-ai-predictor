import { useState, useCallback, useEffect, useRef } from "react";
import { BOAT_COLORS } from "../../utils/colors";
import { TECHNIQUE_NAMES } from "../../utils/turnPrediction";
import "./FirstMarkAnimation.css";

// framer-motion を1回だけ動的importし、state で保持
function useMotion() {
  const [motion, setMotion] = useState(null);
  useEffect(() => {
    import("framer-motion").then((mod) => setMotion(mod));
  }, []);
  return motion;
}

// ボートアイコン（進行方向を示す舟形）
function BoatIcon({ color, textColor, number, x, y, rotation = 0, glow }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`}>
      {glow && (
        <ellipse
          rx={20}
          ry={12}
          fill="none"
          stroke={color}
          strokeWidth={2}
          opacity={0.5}
          filter="url(#glow)"
        />
      )}
      <ellipse
        rx={15}
        ry={8}
        fill={color}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
      />
      <polygon points="15,0 11,-4 11,4" fill={color} />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="700"
        fill={textColor}
      >
        {number}
      </text>
    </g>
  );
}

// 静止画ボートアイコン（motion ロード前用）
function StaticBoatIcon({ color, textColor, number, x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse
        rx={15}
        ry={8}
        fill={color}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
      />
      <polygon points="15,0 11,-4 11,4" fill={color} />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="9"
        fontWeight="700"
        fill={textColor}
      >
        {number}
      </text>
    </g>
  );
}

// 各コースの初期位置（スタート前、右側から左へ向かう配置）
const START_POSITIONS = [
  { x: 340, y: 220 }, // 1コース（最内）
  { x: 340, y: 195 }, // 2コース
  { x: 340, y: 170 }, // 3コース
  { x: 340, y: 145 }, // 4コース
  { x: 340, y: 120 }, // 5コース
  { x: 340, y: 95 }, // 6コース
];

// 1マーク位置
const TURN_MARK = { x: 120, y: 160 };

// 2点間の角度を計算（度）
function angleBetween(x1, y1, x2, y2) {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

// キーフレームからフレーム間の回転角度を算出
function computeRotations(xValues, yValues) {
  const rotations = [];
  for (let i = 0; i < xValues.length; i++) {
    if (i < xValues.length - 1) {
      rotations.push(
        angleBetween(xValues[i], yValues[i], xValues[i + 1], yValues[i + 1]),
      );
    } else {
      rotations.push(rotations[rotations.length - 1]);
    }
  }
  return rotations;
}

// 7点のパスを13点に補間してターン周辺を滑らかな弧にする
function interpolatePath(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    result.push(points[i]);
    result.push({
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

// 13点に対応するtimes（7点を補間して13点）
const INTERP_TIMES = [0, 0.08, 0.16, 0.24, 0.33, 0.41, 0.5, 0.58, 0.67, 0.75, 0.83, 0.91, 1];

// ゴール位置を順位順に割り当て（1着が最先頭、2着が次、…）
// rankMap: コースindex → 順位(0=1着, 1=2着, 2=3着, 3以降=その他)
function getExitPosition(rankOrder, M) {
  // rankOrder: 0が最先頭(1着)、値が大きいほど後方
  // 1着: 最も右上（先頭）、以降は順に後方
  const exitPositions = [
    { x: M.x + 60, y: M.y - 65 },  // 1着: 最先頭
    { x: M.x + 35, y: M.y - 50 },  // 2着
    { x: M.x + 15, y: M.y - 38 },  // 3着
    { x: M.x - 5, y: M.y - 25 },   // 4着
    { x: M.x - 20, y: M.y - 15 },  // 5着
    { x: M.x - 30, y: M.y - 5 },   // 6着
  ];
  return exitPositions[Math.min(rankOrder, 5)];
}

// 決まり手ごとのアニメーションパスを生成（7点: 接近→旋回弧→離脱）
// ボートは右から左へ水平に進み、1マーク(120,160)の下を通過し、
// マーク左側を反時計回りに旋回して上方へ抜ける（L字→U字カーブ）
function getAnimationPaths(technique, winnerCourse, secondCourse, thirdCourse, boatStrengths) {
  const winIdx = winnerCourse - 1;
  const secIdx = secondCourse ? secondCourse - 1 : -1;
  const thdIdx = thirdCourse ? thirdCourse - 1 : -1;
  const M = TURN_MARK; // (120, 160)

  // 残り3艇を強さ順にソート（事前計算）
  const remaining = [];
  for (let c = 0; c < 6; c++) {
    if (c === winIdx || c === secIdx || c === thdIdx) continue;
    remaining.push(c);
  }
  if (boatStrengths && boatStrengths.length === 6) {
    remaining.sort((a, b) => boatStrengths[b] - boatStrengths[a]);
  }

  // コースindex → 順位順序（0=1着, 1=2着, ...）
  function getRankOrder(i) {
    if (i === winIdx) return 0;
    if (i === secIdx) return 1;
    if (i === thdIdx) return 2;
    return 3 + remaining.indexOf(i);
  }

  // 汎用: 通常旋回パス。rankOrderでゴール位置を決定
  function standardTurnPath(i, r) {
    const offset = i * 10;
    const R = r + offset;
    const exit = getExitPosition(getRankOrder(i), M);
    return [
      { x: 250 - i * 5, y: START_POSITIONS[i].y },
      { x: M.x + 70, y: M.y + R * 0.5 },
      { x: M.x, y: M.y + R * 0.7 },
      { x: M.x - R * 0.5, y: M.y + R * 0.3 },
      { x: M.x - R * 0.6, y: M.y - R * 0.3 },
      { x: M.x - R * 0.4, y: M.y - R * 0.7 },
      exit,
    ];
  }

  switch (technique) {
    case "nige": {
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 250, y: 220 },
            { x: M.x + 60, y: M.y + 30 },
            { x: M.x, y: M.y + 25 },
            { x: M.x - 18, y: M.y + 10 },
            { x: M.x - 22, y: M.y - 15 },
            { x: M.x - 15, y: M.y - 35 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 25);
      });
    }

    case "sashi": {
      const exit1st = getExitPosition(0, M);
      const exitInner = getExitPosition(getRankOrder(0), M); // 1コースの順位
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 250, y: 220 },
            { x: M.x + 60, y: M.y + 30 },
            { x: M.x, y: M.y + 28 },
            { x: M.x - 30, y: M.y + 15 },
            { x: M.x - 45, y: M.y - 10 },
            { x: M.x - 35, y: M.y - 30 },
            exitInner,
          ];
        }
        if (i === winIdx) {
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: M.x + 55, y: M.y + 40 },
            { x: M.x - 5, y: M.y + 30 },
            { x: M.x - 15, y: M.y + 5 },
            { x: M.x - 18, y: M.y - 20 },
            { x: M.x - 10, y: M.y - 40 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 30);
      });
    }

    case "makuri": {
      const makuriIdx = winIdx;
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === makuriIdx) {
          return [
            { x: 265, y: START_POSITIONS[i].y },
            { x: M.x + 80, y: M.y + 5 },
            { x: M.x + 10, y: M.y + 10 },
            { x: M.x - 25, y: M.y - 5 },
            { x: M.x - 30, y: M.y - 30 },
            { x: M.x - 15, y: M.y - 50 },
            exit1st,
          ];
        }
        if (i < makuriIdx) {
          const R = 30 + i * 10;
          const exit = getExitPosition(getRankOrder(i), M);
          return [
            { x: 245, y: START_POSITIONS[i].y },
            { x: M.x + 55, y: M.y + R + 10 },
            { x: M.x - 5, y: M.y + R + 15 },
            { x: M.x - R * 0.5, y: M.y + R * 0.5 },
            { x: M.x - R * 0.6, y: M.y - R * 0.1 },
            { x: M.x - R * 0.4, y: M.y - R * 0.4 },
            exit,
          ];
        }
        return standardTurnPath(i, 25);
      });
    }

    case "makurizashi": {
      const sasuIdx = winIdx;
      const makuriTargetIdx = Math.max(0, sasuIdx - 1);
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === sasuIdx) {
          return [
            { x: 255, y: START_POSITIONS[i].y },
            { x: M.x + 70, y: M.y + 5 },
            { x: M.x + 10, y: M.y + 20 },
            { x: M.x - 10, y: M.y + 15 },
            { x: M.x - 20, y: M.y - 15 },
            { x: M.x - 12, y: M.y - 40 },
            exit1st,
          ];
        }
        if (i === makuriTargetIdx) {
          const exit = getExitPosition(getRankOrder(i), M);
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: M.x + 60, y: M.y + 20 },
            { x: M.x, y: M.y + 20 },
            { x: M.x - 30, y: M.y + 5 },
            { x: M.x - 38, y: M.y - 20 },
            { x: M.x - 28, y: M.y - 40 },
            exit,
          ];
        }
        if (i < sasuIdx) {
          return standardTurnPath(i, 30);
        }
        return standardTurnPath(i, 25);
      });
    }

    case "nuki": {
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === winIdx) {
          const R = 25 + i * 8;
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: M.x + 65, y: M.y + R },
            { x: M.x, y: M.y + R + 5 },
            { x: M.x - R * 0.5, y: M.y + R * 0.3 },
            { x: M.x - R * 0.6, y: M.y - R * 0.3 },
            { x: M.x - R * 0.3, y: M.y - R * 0.7 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 30);
      });
    }

    case "megumare":
    default: {
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          const exit = getExitPosition(getRankOrder(0), M);
          return [
            { x: 250, y: 220 },
            { x: M.x + 55, y: M.y + 35 },
            { x: M.x, y: M.y + 40 },
            { x: M.x - 20, y: M.y + 40 },
            { x: M.x - 25, y: M.y + 35 },
            { x: M.x - 15, y: M.y + 25 },
            exit,
          ];
        }
        if (i === winIdx) {
          return [
            ...standardTurnPath(i, 22).slice(0, 6),
            exit1st,
          ];
        }
        return standardTurnPath(i, 30);
      });
    }
  }
}

// 航跡のSVGパスを生成
function buildWakePath(xValues, yValues) {
  if (xValues.length < 2) return "";
  let d = `M ${xValues[0]} ${yValues[0]}`;
  for (let i = 1; i < xValues.length; i++) {
    d += ` L ${xValues[i]} ${yValues[i]}`;
  }
  return d;
}

// 最有力コースを取得（excludeCoursesで除外可能）
function getTopCourse(placeObj, excludeCourses = []) {
  if (!placeObj) return null;
  let maxCourse = null;
  let maxProb = 0;
  for (const [c, p] of Object.entries(placeObj)) {
    if (excludeCourses.includes(Number(c))) continue;
    if (p > maxProb) {
      maxProb = p;
      maxCourse = Number(c);
    }
  }
  return maxCourse ? { course: maxCourse, prob: maxProb } : null;
}

// 順位メダルカラー
const RANK_COLORS = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
};

// SVG内の順位バッジ
function ResultBadge({ rank, course, x, y, delay, label }) {
  if (!course) return null;
  const colors = BOAT_COLORS[course] || BOAT_COLORS[1];
  const rankColor = RANK_COLORS[rank];

  return (
    <g className="result-badge" style={{ animationDelay: `${delay}s` }}>
      {/* ボートカラーの丸 */}
      <circle
        cx={x}
        cy={y}
        r={14}
        fill={colors.bg}
        stroke={rankColor}
        strokeWidth={2.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="700"
        fill={colors.text}
      >
        {course}
      </text>
      {/* 順位ラベル */}
      <text
        x={x + 20}
        y={y + 1}
        textAnchor="start"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="700"
        fill={rankColor}
      >
        {rank}着
      </text>
      {/* 決まり手 or 確率 */}
      {label && (
        <text
          x={x + 48}
          y={y + 1}
          textAnchor="start"
          dominantBaseline="central"
          fontSize="9"
          fill="rgba(255,255,255,0.7)"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function FirstMarkAnimationInner({ patterns, distribution, players, boatStrengths }) {
  const [animKey, setAnimKey] = useState(0);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [phase, setPhase] = useState("");
  const [animationDone, setAnimationDone] = useState(false);
  const phaseTimers = useRef([]);
  const motionMod = useMotion();

  const handleReplay = useCallback(() => {
    setAnimKey((prev) => prev + 1);
  }, []);

  const handleTabChange = useCallback((index) => {
    setSelectedPatternIndex(index);
    setAnimKey((prev) => prev + 1);
  }, []);

  // 現在選択中のパターン
  const currentPattern = patterns[selectedPatternIndex] || patterns[0];
  const technique = currentPattern.technique;
  const winnerCourse = currentPattern.winnerCourse;
  const probability = currentPattern.probability;

  // 2着・3着を取得（1着・2着と重複しないように除外）
  const secondResult = getTopCourse(currentPattern.secondPlace, [winnerCourse]);
  const secondCourse = secondResult?.course;
  const secondProb = secondResult?.prob;
  const thirdResult = getTopCourse(currentPattern.thirdPlace, [winnerCourse, secondCourse].filter(Boolean));
  const thirdCourse = thirdResult?.course;
  const thirdProb = thirdResult?.prob;

  // アニメーション完了検知
  useEffect(() => {
    setAnimationDone(false);
    const timer = setTimeout(() => setAnimationDone(true), 3500);
    return () => clearTimeout(timer);
  }, [animKey]);

  // フェーズラベルをタイマーで制御
  useEffect(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];

    const duration = 3500;
    const techniqueName = TECHNIQUE_NAMES[technique] || technique;

    // スタート表示
    const startShow = setTimeout(() => setPhase("スタート"), 0);
    const startHide = setTimeout(
      () => setPhase((prev) => (prev === "スタート" ? "" : prev)),
      0.2 * duration,
    );
    phaseTimers.current.push(startShow, startHide);

    // 1マーク旋回
    const turnShow = setTimeout(() => setPhase("1マーク旋回"), 0.3 * duration);
    const turnHide = setTimeout(
      () => setPhase((prev) => (prev === "1マーク旋回" ? "" : prev)),
      0.5 * duration,
    );
    phaseTimers.current.push(turnShow, turnHide);

    // 決まり手名（大きく表示）
    const techShowTimer = setTimeout(
      () => setPhase(`${techniqueName}!`),
      0.55 * duration,
    );
    const techHideTimer = setTimeout(
      () => setPhase((prev) => (prev === `${techniqueName}!` ? "" : prev)),
      0.85 * duration,
    );
    phaseTimers.current.push(techShowTimer, techHideTimer);

    return () => {
      phaseTimers.current.forEach(clearTimeout);
      phaseTimers.current = [];
    };
  }, [animKey, technique, winnerCourse]);

  const paths = getAnimationPaths(technique, winnerCourse, secondCourse, thirdCourse, boatStrengths);
  // playersをboat number順にソート（コースとインデックスを一致させる）
  const sortedPlayers = players
    ? [...players].sort((a, b) => a.number - b.number)
    : null;
  const boatNumbers = sortedPlayers?.map((p) => p.number) || [1, 2, 3, 4, 5, 6];
  const winIdx = winnerCourse - 1;

  // 確率分布をソート
  const sortedDistribution = distribution
    ? Object.entries(distribution).sort(([, a], [, b]) => b - a)
    : [];

  const topTechnique = sortedDistribution[0]?.[0];

  // 決まり手ラベルの表示判定
  const isTechniquePhase = phase && phase.endsWith("!");

  // SVG共通部分（水面・マーク・スタートライン）
  const svgBackground = (
    <>
      <defs>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1b33" />
          <stop offset="100%" stopColor="#1a3050" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="400" height="280" fill="url(#waterGrad)" />

      {/* 波紋（装飾） */}
      {[80, 200, 320].map((wx) =>
        [100, 180, 240].map((wy) => (
          <circle
            key={`wave-${wx}-${wy}`}
            cx={wx}
            cy={wy}
            r={3}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
          />
        )),
      )}

      {/* コース区分線 */}
      {[1, 2, 3, 4, 5].map((i) => (
        <line
          key={`lane-${i}`}
          x1={300}
          y1={START_POSITIONS[i].y - 12}
          x2={380}
          y2={START_POSITIONS[i].y - 12}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
          strokeDasharray="4,4"
        />
      ))}

      {/* ターンマーク（ブイ） */}
      <circle
        cx={TURN_MARK.x}
        cy={TURN_MARK.y}
        r={8}
        fill="#ff6b35"
        opacity={0.9}
      />
      <circle
        cx={TURN_MARK.x}
        cy={TURN_MARK.y}
        r={12}
        fill="none"
        stroke="#ff6b35"
        strokeWidth={1}
        opacity={0.4}
      />
      <text
        x={TURN_MARK.x}
        y={TURN_MARK.y - 18}
        textAnchor="middle"
        fontSize="8"
        fill="rgba(255,255,255,0.5)"
      >
        1マーク
      </text>

      {/* スタートライン */}
      <line
        x1={320}
        y1={85}
        x2={320}
        y2={230}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="6,4"
      />
      <text x={325} y={80} fontSize="7" fill="rgba(255,255,255,0.35)">
        S
      </text>
    </>
  );

  // パターンタブバー
  const patternTabs =
    patterns.length > 1 ? (
      <div className="pattern-tabs">
        {patterns.map((p, idx) => (
          <button
            key={idx}
            className={`pattern-tab ${idx === selectedPatternIndex ? "pattern-tab--active" : ""}`}
            onClick={() => handleTabChange(idx)}
          >
            <span className="pattern-tab__label">展開{idx + 1}</span>
            <span className="pattern-tab__tech">
              {TECHNIQUE_NAMES[p.technique] || p.technique}
            </span>
            <span className="pattern-tab__info">
              {p.winnerCourse}コース {Math.round(p.probability * 100)}%
            </span>
          </button>
        ))}
      </div>
    ) : null;

  // motion がまだロードされていない場合は静止画を表示
  if (!motionMod) {
    return (
      <div className="first-mark-animation">
        <div className="first-mark-animation__title">1マーク展開予測</div>
        {patternTabs}
        <div className="first-mark-animation__svg-container">
          <svg
            viewBox="0 0 400 280"
            width="100%"
            height="100%"
            style={{
              background: "linear-gradient(180deg, #0a1628 0%, #152238 100%)",
              borderRadius: "8px",
            }}
          >
            {svgBackground}
            {boatNumbers.map((num, i) => {
              const colors = BOAT_COLORS[num] || BOAT_COLORS[1];
              return (
                <StaticBoatIcon
                  key={`static-boat-${num}`}
                  color={colors.bg}
                  textColor={colors.text}
                  number={num}
                  x={START_POSITIONS[i].x}
                  y={START_POSITIONS[i].y}
                />
              );
            })}
          </svg>
        </div>

        {/* 順位カード（静止画でも表示） */}
        <ResultCards
          winnerCourse={winnerCourse}
          technique={technique}
          secondCourse={secondCourse}
          secondProb={secondProb}
          thirdCourse={thirdCourse}
          thirdProb={thirdProb}
        />

        {sortedDistribution.length > 0 && (
          <DistributionBars
            sortedDistribution={sortedDistribution}
            topTechnique={topTechnique}
            patterns={patterns}
          />
        )}
      </div>
    );
  }

  const { motion } = motionMod;

  // 勝者ボートのゴール付近位置を取得（決まり手ラベル表示用）
  const winnerPath = paths[winIdx];
  const winnerLabelPos = winnerPath
    ? { x: winnerPath[3].x - 5, y: winnerPath[3].y - 18 }
    : { x: 100, y: 100 };

  return (
    <div className="first-mark-animation">
      <div className="first-mark-animation__title">1マーク展開予測</div>

      {patternTabs}

      <div className="first-mark-animation__svg-container">
        <svg
          viewBox="0 0 400 280"
          width="100%"
          height="100%"
          style={{
            background: "linear-gradient(180deg, #0a1628 0%, #152238 100%)",
            borderRadius: "8px",
          }}
        >
          {svgBackground}

          {/* 航跡（ウェイク） */}
          {boatNumbers.map((num, i) => {
            const path = paths[i];
            const startPos = START_POSITIONS[i];
            const interpPath = interpolatePath(path);
            const xVals = [startPos.x, ...interpPath.map((p) => p.x)];
            const yVals = [startPos.y, ...interpPath.map((p) => p.y)];
            const wakePath = buildWakePath(xVals, yVals);
            const isWinner = i === winIdx;
            const colors = BOAT_COLORS[num] || BOAT_COLORS[1];

            return (
              <motion.path
                key={`wake-${num}-${animKey}`}
                d={wakePath}
                fill="none"
                stroke={isWinner ? colors.bg : "rgba(255,255,255,0.1)"}
                strokeWidth={isWinner ? 3.5 : 1}
                strokeDasharray={isWinner ? "none" : "3,3"}
                opacity={isWinner ? 0.8 : 0.15}
                filter={isWinner ? "url(#glow)" : undefined}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 3.5,
                  ease: "easeInOut",
                }}
              />
            );
          })}

          {/* 6艇のボート */}
          {boatNumbers.map((num, i) => {
            const path = paths[i];
            const colors = BOAT_COLORS[num] || BOAT_COLORS[1];
            const startPos = START_POSITIONS[i];
            const isWinner = i === winIdx;

            const interpPath = interpolatePath(path);
            const xValues = [startPos.x, ...interpPath.map((p) => p.x)];
            const yValues = [startPos.y, ...interpPath.map((p) => p.y)];

            // 相対座標に変換
            const xRel = xValues.map((v) => v - startPos.x);
            const yRel = yValues.map((v) => v - startPos.y);

            // 回転角度を算出
            const rotations = computeRotations(xValues, yValues);

            // times配列: startPos + 9点 = 10点
            const times = [0, ...INTERP_TIMES.map((t) => t)];

            return (
              <motion.g
                key={`boat-${num}-${animKey}`}
                initial={{ x: 0, y: 0, rotate: rotations[0] }}
                animate={{
                  x: xRel,
                  y: yRel,
                  rotate: rotations,
                }}
                transition={{
                  duration: 3.5,
                  ease: "easeInOut",
                  times,
                }}
              >
                <BoatIcon
                  color={colors.bg}
                  textColor={colors.text}
                  number={num}
                  x={startPos.x}
                  y={startPos.y}
                  glow={isWinner}
                />
              </motion.g>
            );
          })}

          {/* 決まり手ラベル（勝者ボート付近に表示） */}
          {isTechniquePhase && (
            <g className="technique-popup">
              <text
                x={winnerLabelPos.x}
                y={winnerLabelPos.y}
                textAnchor="middle"
                fontSize="16"
                fontWeight="800"
                fill="#ffd700"
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {phase}
              </text>
            </g>
          )}

          {/* フェーズラベル（決まり手以外） */}
          {phase && !isTechniquePhase && (
            <text
              x={200}
              y={30}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#38bdf8"
              className="phase-label"
            >
              {phase}
            </text>
          )}

          {/* アニメーション完了後: SVG内順位バッジ */}
          {animationDone && (
            <g className="result-overlay">
              <ResultBadge
                rank={1}
                course={winnerCourse}
                x={55}
                y={35}
                delay={0}
                label={TECHNIQUE_NAMES[technique]}
              />
              {secondCourse && (
                <ResultBadge
                  rank={2}
                  course={secondCourse}
                  x={55}
                  y={65}
                  delay={0.3}
                  label={`${Math.round(secondProb * 100)}%`}
                />
              )}
              {thirdCourse && (
                <ResultBadge
                  rank={3}
                  course={thirdCourse}
                  x={55}
                  y={95}
                  delay={0.6}
                  label={`${Math.round(thirdProb * 100)}%`}
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* 順位カード（SVG下） */}
      {animationDone && (
        <ResultCards
          winnerCourse={winnerCourse}
          technique={technique}
          secondCourse={secondCourse}
          secondProb={secondProb}
          thirdCourse={thirdCourse}
          thirdProb={thirdProb}
        />
      )}

      {/* 確率分布 */}
      {sortedDistribution.length > 0 && (
        <DistributionBars
          sortedDistribution={sortedDistribution}
          topTechnique={topTechnique}
          patterns={patterns}
        />
      )}

      {/* リプレイボタン */}
      <div className="first-mark-animation__replay">
        <button
          className="first-mark-animation__replay-btn"
          onClick={handleReplay}
        >
          再生
        </button>
      </div>
    </div>
  );
}

// 順位カードコンポーネント
function ResultCards({
  winnerCourse,
  technique,
  secondCourse,
  secondProb,
  thirdCourse,
  thirdProb,
}) {
  const techniqueName = TECHNIQUE_NAMES[technique] || technique;
  const winnerColors = BOAT_COLORS[winnerCourse] || BOAT_COLORS[1];

  return (
    <div className="result-cards">
      <div className="result-card result-card--1st">
        <span className="result-rank">1着</span>
        <span
          className="result-course"
          style={{ backgroundColor: winnerColors.bg, color: winnerColors.text }}
        >
          {winnerCourse}
        </span>
        <span className="result-technique">{techniqueName}</span>
      </div>
      {secondCourse && (
        <div className="result-card result-card--2nd">
          <span className="result-rank">2着</span>
          <span
            className="result-course"
            style={{
              backgroundColor: (BOAT_COLORS[secondCourse] || BOAT_COLORS[1]).bg,
              color: (BOAT_COLORS[secondCourse] || BOAT_COLORS[1]).text,
            }}
          >
            {secondCourse}
          </span>
          <span className="result-prob">{Math.round(secondProb * 100)}%</span>
        </div>
      )}
      {thirdCourse && (
        <div className="result-card result-card--3rd">
          <span className="result-rank">3着</span>
          <span
            className="result-course"
            style={{
              backgroundColor: (BOAT_COLORS[thirdCourse] || BOAT_COLORS[1]).bg,
              color: (BOAT_COLORS[thirdCourse] || BOAT_COLORS[1]).text,
            }}
          >
            {thirdCourse}
          </span>
          <span className="result-prob">{Math.round(thirdProb * 100)}%</span>
        </div>
      )}
    </div>
  );
}

// 確率分布バーコンポーネント
function DistributionBars({ sortedDistribution, topTechnique, patterns }) {
  return (
    <div className="technique-distribution">
      <div className="technique-distribution__header">展開確率分布</div>
      {sortedDistribution.map(([tech, prob]) => {
        const matchingPattern = patterns.find((p) => p.technique === tech);
        return (
          <div key={tech} className="technique-bar">
            <span className="technique-bar__label">
              {TECHNIQUE_NAMES[tech] || tech}
            </span>
            <span className="technique-bar__course">
              {matchingPattern ? `${matchingPattern.winnerCourse}コース` : ""}
            </span>
            <div className="technique-bar__track">
              <div
                className={`technique-bar__fill ${tech === topTechnique ? "technique-bar__fill--top" : ""}`}
                style={{ width: `${Math.max(prob * 100, 1)}%` }}
              />
            </div>
            <span className="technique-bar__prob">
              {Math.round(prob * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function FirstMarkAnimation(props) {
  // patterns配列がある場合はそちらを使用、なければ旧形式から変換
  const patterns =
    props.patterns ||
    (props.technique
      ? [
          {
            technique: props.technique,
            winnerCourse: props.winnerCourse,
            probability: props.probability,
          },
        ]
      : null);

  if (!patterns || patterns.length === 0 || !props.distribution) {
    return null;
  }

  return (
    <FirstMarkAnimationInner
      patterns={patterns}
      distribution={props.distribution}
      players={props.players}
      boatStrengths={props.boatStrengths}
    />
  );
}
