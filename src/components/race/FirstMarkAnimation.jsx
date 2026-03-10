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
        <>
          <ellipse
            rx={20}
            ry={12}
            fill="none"
            stroke={color}
            strokeWidth={2}
            opacity={0.6}
            filter="url(#glow)"
          />
          {/* 水しぶきエフェクト（勝者のみ） */}
          <circle cx={-12} cy={-5} r={1.5} fill="rgba(255,255,255,0.6)" className="spray spray--1" />
          <circle cx={-14} cy={3} r={1.2} fill="rgba(255,255,255,0.4)" className="spray spray--2" />
          <circle cx={-10} cy={6} r={1} fill="rgba(255,255,255,0.5)" className="spray spray--3" />
        </>
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

// === アニメーション定数 ===
const ANIM_DURATION = 3.5;
const ANIM_DURATION_MS = 3500;
const PHASE_TIMING = {
  START_SHOW: 0,
  START_HIDE: 0.2,
  TURN_SHOW: 0.3,
  TURN_HIDE: 0.5,
  TECH_SHOW: 0.55,
  TECH_HIDE: 0.85,
};
const PLAYER_NAME_HIDE = 0.2; // 選手名が消えるタイミング

// ボートごとのアニメーション速度（順位による差）
function getBoatDuration(rankOrder) {
  if (rankOrder === 0) return ANIM_DURATION - 0.3; // 勝者: 速い
  if (rankOrder <= 2) return ANIM_DURATION;         // 2-3着: 標準
  return ANIM_DURATION + 0.2;                       // 4-6着: やや遅い
}

// 各コースの初期位置（左側スタート、右へ向かって進む）
// 1コースが最内（下）、6コースが最外（上）= 実際のボートレースと同じ配置
const START_POSITIONS = [
  { x: 60, y: 220 }, // 1コース（最内・下）
  { x: 60, y: 195 }, // 2コース
  { x: 60, y: 170 }, // 3コース
  { x: 60, y: 145 }, // 4コース
  { x: 60, y: 120 }, // 5コース
  { x: 60, y: 95 },  // 6コース（最外・上）
];

// 1マーク位置（右側）
const TURN_MARK = { x: 280, y: 160 };

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

// Catmull-Romスプラインで7点→25点の滑らかな曲線に補間
function catmullRomSubdivide(points, segments = 3, tension = 0.5) {
  const result = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    for (let s = 1; s <= segments; s++) {
      const t = s / (segments + 1);
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        tension * ((-t3 + 2 * t2 - t) * p0.x + (3 * t3 - 5 * t2 + 2) * p1.x +
        (-3 * t3 + 4 * t2 + t) * p2.x + (t3 - t2) * p3.x) / 2 +
        (1 - tension) * (p1.x + t * (p2.x - p1.x));
      const y =
        tension * ((-t3 + 2 * t2 - t) * p0.y + (3 * t3 - 5 * t2 + 2) * p1.y +
        (-3 * t3 + 4 * t2 + t) * p2.y + (t3 - t2) * p3.y) / 2 +
        (1 - tension) * (p1.y + t * (p2.y - p1.y));
      result.push({ x, y });
    }
    result.push(p2);
  }
  return result;
}

// SVG Cubic Bezier で滑らかな航跡パスを生成
function buildSmoothWakePath(xValues, yValues) {
  if (xValues.length < 2) return "";
  let d = `M ${xValues[0]} ${yValues[0]}`;
  if (xValues.length === 2) {
    d += ` L ${xValues[1]} ${yValues[1]}`;
    return d;
  }
  for (let i = 1; i < xValues.length - 1; i++) {
    const prevX = xValues[i - 1], prevY = yValues[i - 1];
    const curX = xValues[i], curY = yValues[i];
    const nextX = xValues[i + 1], nextY = yValues[i + 1];
    const next2X = xValues[Math.min(i + 2, xValues.length - 1)];
    const next2Y = yValues[Math.min(i + 2, yValues.length - 1)];
    const cp1x = curX + (nextX - prevX) / 6;
    const cp1y = curY + (nextY - prevY) / 6;
    const cp2x = nextX - (next2X - curX) / 6;
    const cp2y = nextY - (next2Y - curY) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nextX} ${nextY}`;
  }
  return d;
}

// ゴール位置を順位順に割り当て（1着が最先頭、2着が次、…）
// 反時計回り: マーク上方を左旋回後、バックストレッチ（左上）方向へ抜ける
function getExitPosition(rankOrder, M) {
  const exitPositions = [
    { x: M.x - 80, y: M.y - 70 },  // 1着: 最先頭（バックストレッチ方向）
    { x: M.x - 55, y: M.y - 55 },  // 2着
    { x: M.x - 35, y: M.y - 42 },  // 3着
    { x: M.x - 15, y: M.y - 30 },  // 4着
    { x: M.x + 5, y: M.y - 20 },   // 5着
    { x: M.x + 20, y: M.y - 10 },  // 6着
  ];
  return exitPositions[Math.min(rankOrder, 5)];
}

// 決まり手ごとのアニメーションパスを生成（7点: 接近→旋回弧→離脱）
// ボートは左から右へ進み、1マーク(280,160)で反時計回り（左旋回）。
// 旋回後はマーク上方を通ってバックストレッチ（左上）方向へ抜ける。
function getAnimationPaths(technique, winnerCourse, secondCourse, thirdCourse, boatStrengths) {
  const winIdx = winnerCourse - 1;
  const secIdx = secondCourse ? secondCourse - 1 : -1;
  const thdIdx = thirdCourse ? thirdCourse - 1 : -1;
  const M = TURN_MARK; // (280, 160)

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

  // 汎用: 反時計回り旋回パス（左から右へ進み、マーク上方を左旋回）
  function standardTurnPath(i, r) {
    const offset = i * 10;
    const R = r + offset;
    const exit = getExitPosition(getRankOrder(i), M);
    return [
      { x: 150 + i * 5, y: START_POSITIONS[i].y },
      { x: M.x - 60, y: M.y - R * 0.3 },
      { x: M.x - 5, y: M.y - R * 0.7 },
      { x: M.x + R * 0.35, y: M.y - R * 0.8 },
      { x: M.x + R * 0.3, y: M.y - R * 0.6 },
      { x: M.x - 10, y: M.y - R * 0.85 },
      exit,
    ];
  }

  switch (technique) {
    case "nige": {
      // 逃げ: 1号艇が最内を素早く反時計回りで旋回、先頭でバックストレッチへ
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          return [
            { x: 150, y: 220 },
            { x: M.x - 55, y: M.y - 10 },
            { x: M.x, y: M.y - 22 },
            { x: M.x + 15, y: M.y - 28 },
            { x: M.x + 10, y: M.y - 35 },
            { x: M.x - 25, y: M.y - 50 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 25);
      });
    }

    case "sashi": {
      // 差し: 勝者が内側を差して1号艇の内を抜く
      const exit1st = getExitPosition(0, M);
      const exitInner = getExitPosition(getRankOrder(0), M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          // 1号艇: 旋回が膨らむ（外に流れる）
          return [
            { x: 150, y: 220 },
            { x: M.x - 55, y: M.y - 8 },
            { x: M.x, y: M.y - 20 },
            { x: M.x + 25, y: M.y - 35 },
            { x: M.x + 30, y: M.y - 50 },
            { x: M.x + 10, y: M.y - 60 },
            exitInner,
          ];
        }
        if (i === winIdx) {
          // 差す側: 内側を鋭く旋回
          return [
            { x: 150, y: START_POSITIONS[i].y },
            { x: M.x - 50, y: M.y - 5 },
            { x: M.x, y: M.y - 18 },
            { x: M.x + 12, y: M.y - 25 },
            { x: M.x + 8, y: M.y - 35 },
            { x: M.x - 20, y: M.y - 48 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 30);
      });
    }

    case "makuri": {
      // まくり: 外枠艇がスピードで外から捲る
      const makuriIdx = winIdx;
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === makuriIdx) {
          // まくる側: 大外から一気に先頭へ
          return [
            { x: 135, y: START_POSITIONS[i].y },
            { x: M.x - 75, y: M.y - 20 },
            { x: M.x - 10, y: M.y - 45 },
            { x: M.x + 20, y: M.y - 55 },
            { x: M.x + 10, y: M.y - 65 },
            { x: M.x - 25, y: M.y - 70 },
            exit1st,
          ];
        }
        if (i < makuriIdx) {
          // 内側の艇: まくられて後退
          const R = 30 + i * 10;
          const exit = getExitPosition(getRankOrder(i), M);
          return [
            { x: 155, y: START_POSITIONS[i].y },
            { x: M.x - 55, y: M.y - R * 0.2 },
            { x: M.x, y: M.y - R * 0.5 },
            { x: M.x + R * 0.3, y: M.y - R * 0.6 },
            { x: M.x + R * 0.25, y: M.y - R * 0.5 },
            { x: M.x - 5, y: M.y - R * 0.7 },
            exit,
          ];
        }
        return standardTurnPath(i, 25);
      });
    }

    case "makurizashi": {
      // まくり差し: 外枠艇がまくりつつ内を差す
      const sasuIdx = winIdx;
      const makuriTargetIdx = Math.max(0, sasuIdx - 1);
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === sasuIdx) {
          // まくり差す側: 外から加速し内に切り込む
          return [
            { x: 145, y: START_POSITIONS[i].y },
            { x: M.x - 65, y: M.y - 15 },
            { x: M.x - 5, y: M.y - 25 },
            { x: M.x + 10, y: M.y - 30 },
            { x: M.x + 5, y: M.y - 42 },
            { x: M.x - 25, y: M.y - 55 },
            exit1st,
          ];
        }
        if (i === makuriTargetIdx) {
          // まくられる側: 旋回が膨らむ
          const exit = getExitPosition(getRankOrder(i), M);
          return [
            { x: 150, y: START_POSITIONS[i].y },
            { x: M.x - 55, y: M.y - 10 },
            { x: M.x, y: M.y - 22 },
            { x: M.x + 22, y: M.y - 38 },
            { x: M.x + 18, y: M.y - 52 },
            { x: M.x - 5, y: M.y - 58 },
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
      // 抜き: ターン後に追い抜く
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === winIdx) {
          const R = 25 + i * 8;
          return [
            { x: 150, y: START_POSITIONS[i].y },
            { x: M.x - 60, y: M.y - R * 0.3 },
            { x: M.x - 5, y: M.y - R * 0.6 },
            { x: M.x + R * 0.3, y: M.y - R * 0.7 },
            { x: M.x + R * 0.2, y: M.y - R * 0.8 },
            { x: M.x - 15, y: M.y - R * 0.9 },
            exit1st,
          ];
        }
        return standardTurnPath(i, 30);
      });
    }

    case "megumare":
    default: {
      // 恵まれ: 1号艇がターンで膨らみ、他艇が漁夫の利
      const exit1st = getExitPosition(0, M);
      return Array.from({ length: 6 }, (_, i) => {
        if (i === 0) {
          // 1号艇: ターンが大きく膨らむ（失敗）
          const exit = getExitPosition(getRankOrder(0), M);
          return [
            { x: 150, y: 220 },
            { x: M.x - 50, y: M.y - 10 },
            { x: M.x + 5, y: M.y - 25 },
            { x: M.x + 30, y: M.y - 50 },
            { x: M.x + 35, y: M.y - 65 },
            { x: M.x + 20, y: M.y - 70 },
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
        x={x - 20}
        y={y + 1}
        textAnchor="end"
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
          x={x - 48}
          y={y + 1}
          textAnchor="end"
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

function FirstMarkAnimationInner({ patterns, distribution, players, boatStrengths, selectedPatternIndex = 0 }) {
  const [animKey, setAnimKey] = useState(0);
  const [phase, setPhase] = useState("");
  const [animationDone, setAnimationDone] = useState(false);
  const phaseTimers = useRef([]);
  const motionMod = useMotion();
  const prevPatternIndex = useRef(selectedPatternIndex);

  const handleReplay = useCallback(() => {
    setAnimKey((prev) => prev + 1);
  }, []);

  // 外部からのパターン変更時にアニメーションをリセット
  useEffect(() => {
    if (prevPatternIndex.current !== selectedPatternIndex) {
      prevPatternIndex.current = selectedPatternIndex;
      setAnimKey((prev) => prev + 1);
    }
  }, [selectedPatternIndex]);

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

  // アニメーション完了検知（最長ボートに合わせる）
  useEffect(() => {
    setAnimationDone(false);
    const maxDuration = (ANIM_DURATION + 0.2) * 1000; // 4-6着の最長
    const timer = setTimeout(() => setAnimationDone(true), maxDuration);
    return () => clearTimeout(timer);
  }, [animKey]);

  // フェーズラベルをタイマーで制御
  useEffect(() => {
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];

    const techniqueName = TECHNIQUE_NAMES[technique] || technique;

    // スタート表示
    const startShow = setTimeout(() => setPhase("スタート"), PHASE_TIMING.START_SHOW * ANIM_DURATION_MS);
    const startHide = setTimeout(
      () => setPhase((prev) => (prev === "スタート" ? "" : prev)),
      PHASE_TIMING.START_HIDE * ANIM_DURATION_MS,
    );
    phaseTimers.current.push(startShow, startHide);

    // 1マーク旋回
    const turnShow = setTimeout(() => setPhase("1マーク旋回"), PHASE_TIMING.TURN_SHOW * ANIM_DURATION_MS);
    const turnHide = setTimeout(
      () => setPhase((prev) => (prev === "1マーク旋回" ? "" : prev)),
      PHASE_TIMING.TURN_HIDE * ANIM_DURATION_MS,
    );
    phaseTimers.current.push(turnShow, turnHide);

    // 決まり手名（大きく表示）
    const techShowTimer = setTimeout(
      () => setPhase(`${techniqueName}!`),
      PHASE_TIMING.TECH_SHOW * ANIM_DURATION_MS,
    );
    const techHideTimer = setTimeout(
      () => setPhase((prev) => (prev === `${techniqueName}!` ? "" : prev)),
      PHASE_TIMING.TECH_HIDE * ANIM_DURATION_MS,
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

  // 選手名表示タイマー（Hooksは条件分岐前に配置）
  const [showNames, setShowNames] = useState(true);
  useEffect(() => {
    setShowNames(true);
    const timer = setTimeout(() => setShowNames(false), PLAYER_NAME_HIDE * ANIM_DURATION_MS);
    return () => clearTimeout(timer);
  }, [animKey]);

  // SVG共通部分（水面・マーク・スタートライン）
  const svgBackground = (
    <>
      <defs>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1b33" />
          <stop offset="100%" stopColor="#1a3050" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur1" />
          <feGaussianBlur stdDeviation="8" result="blur2" in="SourceGraphic" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="400" height="280" fill="url(#waterGrad)" />

      {/* ターンマーク周辺の波紋パルス */}
      {[0, 1, 2].map((i) => (
        <circle
          key={`ripple-${i}`}
          cx={TURN_MARK.x}
          cy={TURN_MARK.y}
          r={15}
          fill="none"
          stroke="rgba(255, 107, 53, 0.3)"
          strokeWidth={1}
          className="turn-mark-ripple"
          style={{ animationDelay: `${i * 0.8}s` }}
        />
      ))}

      {/* コース区分線 */}
      {[1, 2, 3, 4, 5].map((i) => (
        <line
          key={`lane-${i}`}
          x1={20}
          y1={START_POSITIONS[i].y - 12}
          x2={100}
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
        x1={80}
        y1={85}
        x2={80}
        y2={230}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="6,4"
      />
      <text x={83} y={80} fontSize="7" fill="rgba(255,255,255,0.35)">
        S
      </text>
    </>
  );

  // motion がまだロードされていない場合は静止画を表示
  if (!motionMod) {
    return (
      <div className="first-mark-animation">
        <div className="first-mark-animation__title">1マーク展開予測</div>

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

  // パスの事前計算（航跡・ボート共通）
  const precomputedPaths = boatNumbers.map((_, i) => {
    const interpPath = catmullRomSubdivide(paths[i]);
    const xValues = [START_POSITIONS[i].x, ...interpPath.map((p) => p.x)];
    const yValues = [START_POSITIONS[i].y, ...interpPath.map((p) => p.y)];
    return { xValues, yValues };
  });

  // コース順位マッピング（タイミング差用）
  function getRankForTiming(i) {
    if (i === winIdx) return 0;
    if (i === (secondCourse ? secondCourse - 1 : -1)) return 1;
    if (i === (thirdCourse ? thirdCourse - 1 : -1)) return 2;
    return 3;
  }

  // 勝者ボートの旋回頂点付近を取得（決まり手ラベル表示用）
  const winnerPath = paths[winIdx];
  const winnerLabelPos = winnerPath
    ? { x: winnerPath[4].x + 10, y: winnerPath[4].y - 15 }
    : { x: 100, y: 100 };

  return (
    <div className="first-mark-animation">
      <div className="first-mark-animation__title">1マーク展開予測</div>

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

          {/* 航跡（ウェイク） — スムーズ曲線 */}
          {boatNumbers.map((num, i) => {
            const { xValues, yValues } = precomputedPaths[i];
            const wakePath = buildSmoothWakePath(xValues, yValues);
            const isWinner = i === winIdx;
            const colors = BOAT_COLORS[num] || BOAT_COLORS[1];
            const duration = getBoatDuration(getRankForTiming(i));

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
                  duration,
                  ease: "easeInOut",
                }}
              />
            );
          })}

          {/* 6艇のボート */}
          {boatNumbers.map((num, i) => {
            const colors = BOAT_COLORS[num] || BOAT_COLORS[1];
            const startPos = START_POSITIONS[i];
            const isWinner = i === winIdx;
            const { xValues, yValues } = precomputedPaths[i];

            // 相対座標に変換
            const xRel = xValues.map((v) => v - startPos.x);
            const yRel = yValues.map((v) => v - startPos.y);

            // 回転角度を算出
            const rotations = computeRotations(xValues, yValues);

            // times配列を動的生成
            const n = xValues.length;
            const times = Array.from({ length: n }, (_, j) => j / (n - 1));
            const duration = getBoatDuration(getRankForTiming(i));

            // 選手名（先頭2文字）
            const playerName = sortedPlayers?.[i]?.name?.slice(0, 2) || "";

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
                  duration,
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
                {/* 選手名（スタート時のみ表示） */}
                {showNames && playerName && (
                  <text
                    x={startPos.x}
                    y={startPos.y + 16}
                    textAnchor="middle"
                    fontSize="7"
                    fill="rgba(255,255,255,0.5)"
                  >
                    {playerName}
                  </text>
                )}
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
                x={345}
                y={35}
                delay={0}
                label={TECHNIQUE_NAMES[technique]}
              />
              {secondCourse && (
                <ResultBadge
                  rank={2}
                  course={secondCourse}
                  x={345}
                  y={65}
                  delay={0.3}
                  label={`${Math.round(secondProb * 100)}%`}
                />
              )}
              {thirdCourse && (
                <ResultBadge
                  rank={3}
                  course={thirdCourse}
                  x={345}
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
          ▶ 再生
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
      selectedPatternIndex={props.selectedPatternIndex || 0}
    />
  );
}
