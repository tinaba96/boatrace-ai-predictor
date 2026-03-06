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
function BoatIcon({ color, textColor, number, x, y, rotation = 0 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation})`}>
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

// 5点のパスを8〜10点に補間してターン付近を滑らかにする
function interpolatePath(points) {
  const result = [];
  result.push(points[0]);
  result.push({
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  });
  result.push(points[1]);
  result.push({
    x: points[1].x * 0.6 + points[2].x * 0.4,
    y: points[1].y * 0.6 + points[2].y * 0.4,
  });
  result.push(points[2]);
  result.push({
    x: points[2].x * 0.5 + points[3].x * 0.5,
    y: points[2].y * 0.5 + points[3].y * 0.5,
  });
  result.push(points[3]);
  result.push({
    x: (points[3].x + points[4].x) / 2,
    y: (points[3].y + points[4].y) / 2,
  });
  result.push(points[4]);
  return result;
}

// 9点に対応するtimes
const INTERP_TIMES = [0, 0.12, 0.25, 0.37, 0.5, 0.6, 0.72, 0.85, 1];

// 場面テキストのフェーズ
const PHASE_LABELS = [
  { start: 0, end: 0.2, text: "スタート" },
  { start: 0.3, end: 0.55, text: "1マーク旋回" },
];

// 決まり手ごとのアニメーションパスを生成
function getAnimationPaths(technique, winnerCourse) {
  const winIdx = winnerCourse - 1;

  switch (technique) {
    case "nige": {
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 250, y: 220 },
            { x: TURN_MARK.x + 20, y: TURN_MARK.y + 50 },
            { x: TURN_MARK.x - 10, y: TURN_MARK.y + 20 },
            { x: TURN_MARK.x - 20, y: TURN_MARK.y - 30 },
            { x: 60, y: 80 },
          ];
        }
        return [
          { x: 250 - i * 5, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 30 + i * 10, y: TURN_MARK.y + 40 + i * 10 },
          { x: TURN_MARK.x + 10 + i * 8, y: TURN_MARK.y + i * 12 },
          { x: TURN_MARK.x - 10 + i * 5, y: TURN_MARK.y - 20 + i * 10 },
          { x: 80 + i * 15, y: 90 + i * 15 },
        ];
      });
    }

    case "sashi": {
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 250, y: 220 },
            { x: TURN_MARK.x + 30, y: TURN_MARK.y + 50 },
            { x: TURN_MARK.x - 20, y: TURN_MARK.y + 30 },
            { x: TURN_MARK.x - 40, y: TURN_MARK.y - 10 },
            { x: 80, y: 100 },
          ];
        }
        if (i === winIdx) {
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 15, y: TURN_MARK.y + 40 },
            { x: TURN_MARK.x - 5, y: TURN_MARK.y + 10 },
            { x: TURN_MARK.x - 25, y: TURN_MARK.y - 35 },
            { x: 55, y: 75 },
          ];
        }
        return [
          { x: 250 - i * 5, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 30 + i * 10, y: TURN_MARK.y + 40 + i * 8 },
          { x: TURN_MARK.x + 10 + i * 8, y: TURN_MARK.y + i * 12 },
          { x: TURN_MARK.x - 5 + i * 8, y: TURN_MARK.y - 15 + i * 12 },
          { x: 85 + i * 18, y: 95 + i * 15 },
        ];
      });
    }

    case "makuri": {
      const makuriIdx = winIdx;
      return Array.from({ length: 6 }, (_, i) => {
        if (i === makuriIdx) {
          return [
            { x: 260, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 40, y: TURN_MARK.y + 10 },
            { x: TURN_MARK.x, y: TURN_MARK.y - 10 },
            { x: TURN_MARK.x - 30, y: TURN_MARK.y - 40 },
            { x: 50, y: 70 },
          ];
        }
        if (i < makuriIdx) {
          return [
            { x: 245, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 20, y: TURN_MARK.y + 50 + i * 5 },
            { x: TURN_MARK.x - 5, y: TURN_MARK.y + 30 + i * 5 },
            { x: TURN_MARK.x - 20, y: TURN_MARK.y + 10 + i * 10 },
            { x: 90 + i * 10, y: 110 + i * 15 },
          ];
        }
        return [
          { x: 240 - i * 3, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 35 + i * 8, y: TURN_MARK.y + 20 + i * 5 },
          { x: TURN_MARK.x + 15 + i * 8, y: TURN_MARK.y + i * 10 },
          { x: TURN_MARK.x - 5 + i * 10, y: TURN_MARK.y - 20 + i * 12 },
          { x: 80 + i * 20, y: 95 + i * 18 },
        ];
      });
    }

    case "makurizashi": {
      const sasuIdx = winIdx;
      const makuriTargetIdx = Math.max(0, sasuIdx - 1);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === sasuIdx) {
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 25, y: TURN_MARK.y + 25 },
            { x: TURN_MARK.x - 5, y: TURN_MARK.y + 5 },
            { x: TURN_MARK.x - 30, y: TURN_MARK.y - 35 },
            { x: 55, y: 75 },
          ];
        }
        if (i === makuriTargetIdx) {
          return [
            { x: 255, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 35, y: TURN_MARK.y + 15 },
            { x: TURN_MARK.x + 5, y: TURN_MARK.y - 15 },
            { x: TURN_MARK.x - 25, y: TURN_MARK.y - 20 },
            { x: 70, y: 95 },
          ];
        }
        return [
          { x: 245 - i * 3, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 25 + i * 10, y: TURN_MARK.y + 45 + i * 5 },
          { x: TURN_MARK.x + 5 + i * 8, y: TURN_MARK.y + 20 + i * 10 },
          { x: TURN_MARK.x - 10 + i * 8, y: TURN_MARK.y + i * 12 },
          { x: 85 + i * 18, y: 100 + i * 15 },
        ];
      });
    }

    case "nuki": {
      return Array.from({ length: 6 }, (_, i) => {
        if (i === winIdx) {
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 25, y: TURN_MARK.y + 35 + i * 5 },
            { x: TURN_MARK.x - 5, y: TURN_MARK.y + 10 + i * 3 },
            { x: TURN_MARK.x - 30, y: TURN_MARK.y - 25 },
            { x: 50, y: 70 },
          ];
        }
        return [
          { x: 248 - i * 3, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 20 + i * 8, y: TURN_MARK.y + 40 + i * 8 },
          { x: TURN_MARK.x - 5 + i * 8, y: TURN_MARK.y + 15 + i * 10 },
          { x: TURN_MARK.x - 20 + i * 6, y: TURN_MARK.y - 10 + i * 12 },
          { x: 75 + i * 18, y: 85 + i * 18 },
        ];
      });
    }

    case "megumare":
    default: {
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 250, y: 220 },
            { x: TURN_MARK.x + 20, y: TURN_MARK.y + 50 },
            { x: TURN_MARK.x + 15, y: TURN_MARK.y + 55 },
            { x: TURN_MARK.x + 10, y: TURN_MARK.y + 45 },
            { x: 120, y: 200 },
          ];
        }
        if (i === winIdx) {
          return [
            { x: 250, y: START_POSITIONS[i].y },
            { x: TURN_MARK.x + 25, y: TURN_MARK.y + 30 },
            { x: TURN_MARK.x - 10, y: TURN_MARK.y + 10 },
            { x: TURN_MARK.x - 25, y: TURN_MARK.y - 30 },
            { x: 60, y: 80 },
          ];
        }
        return [
          { x: 245 - i * 3, y: START_POSITIONS[i].y },
          { x: TURN_MARK.x + 30 + i * 8, y: TURN_MARK.y + 40 + i * 8 },
          { x: TURN_MARK.x + 5 + i * 8, y: TURN_MARK.y + 15 + i * 10 },
          { x: TURN_MARK.x - 15 + i * 8, y: TURN_MARK.y - 5 + i * 12 },
          { x: 85 + i * 18, y: 95 + i * 15 },
        ];
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

function FirstMarkAnimationInner({ patterns, distribution, players }) {
  const [animKey, setAnimKey] = useState(0);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState(0);
  const [phase, setPhase] = useState("");
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

  // フェーズラベルをタイマーで制御
  useEffect(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];

    const duration = 3500;

    PHASE_LABELS.forEach(({ start, end, text }) => {
      const showTimer = setTimeout(() => setPhase(text), start * duration);
      const hideTimer = setTimeout(
        () => setPhase((prev) => (prev === text ? "" : prev)),
        end * duration,
      );
      phaseTimers.current.push(showTimer, hideTimer);
    });

    const techniqueName = TECHNIQUE_NAMES[technique] || technique;
    const techShowTimer = setTimeout(
      () => setPhase(`${techniqueName}!`),
      0.6 * duration,
    );
    const techHideTimer = setTimeout(
      () => setPhase((prev) => (prev === `${techniqueName}!` ? "" : prev)),
      0.82 * duration,
    );
    phaseTimers.current.push(techShowTimer, techHideTimer);

    const winShowTimer = setTimeout(
      () => setPhase(`${winnerCourse}コース先頭`),
      0.85 * duration,
    );
    const winHideTimer = setTimeout(() => setPhase(""), 1.05 * duration);
    phaseTimers.current.push(winShowTimer, winHideTimer);

    return () => {
      phaseTimers.current.forEach(clearTimeout);
      phaseTimers.current = [];
    };
  }, [animKey, technique, winnerCourse]);

  const paths = getAnimationPaths(technique, winnerCourse);
  const boatNumbers = players?.map((p) => p.number) || [1, 2, 3, 4, 5, 6];
  const winIdx = winnerCourse - 1;

  // 確率分布をソート
  const sortedDistribution = distribution
    ? Object.entries(distribution).sort(([, a], [, b]) => b - a)
    : [];

  const topTechnique = sortedDistribution[0]?.[0];

  // SVG共通部分（水面・マーク・スタートライン）
  const svgBackground = (
    <>
      <defs>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1b33" />
          <stop offset="100%" stopColor="#1a3050" />
        </linearGradient>
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

        <div className="first-mark-animation__technique-label">
          <span className="first-mark-animation__technique-name">
            {TECHNIQUE_NAMES[technique] || technique}
          </span>
          <span className="first-mark-animation__technique-prob">
            {Math.round(probability * 100)}%
          </span>
          <span className="first-mark-animation__winner">
            {winnerCourse}コース
          </span>
        </div>

        {sortedDistribution.length > 0 && (
          <div className="technique-distribution">
            <div className="technique-distribution__header">
              決まり手の予測確率
            </div>
            {sortedDistribution.map(([tech, prob]) => {
              const matchingPattern = patterns.find(
                (p) => p.technique === tech,
              );
              return (
                <div key={tech} className="technique-bar">
                  <span className="technique-bar__label">
                    {TECHNIQUE_NAMES[tech] || tech}
                  </span>
                  <span className="technique-bar__course">
                    {matchingPattern
                      ? `${matchingPattern.winnerCourse}コース`
                      : ""}
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
        )}
      </div>
    );
  }

  const { motion } = motionMod;

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
                stroke={isWinner ? colors.bg : "rgba(255,255,255,0.15)"}
                strokeWidth={isWinner ? 2.5 : 1}
                strokeDasharray={isWinner ? "none" : "3,3"}
                opacity={isWinner ? 0.6 : 0.25}
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
                />
              </motion.g>
            );
          })}

          {/* フェーズラベル */}
          {phase && (
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
        </svg>
      </div>

      {/* 予測結果ラベル */}
      <div className="first-mark-animation__technique-label">
        <span className="first-mark-animation__technique-name">
          {TECHNIQUE_NAMES[technique] || technique}
        </span>
        <span className="first-mark-animation__technique-prob">
          {Math.round(probability * 100)}%
        </span>
        <span className="first-mark-animation__winner">
          {winnerCourse}コース
        </span>
      </div>

      {/* 確率分布 */}
      {sortedDistribution.length > 0 && (
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
                  {matchingPattern
                    ? `${matchingPattern.winnerCourse}コース`
                    : ""}
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
    />
  );
}
