/**
 * 1マーク展開予測ロジック v3（バックエンド用）
 *
 * v3: 選手力スコア・ST標準偏差・展示タイムを統合し、決まり手別の補正を分化
 *
 * 入力: 6艇の選手データ（枠番, 進入コース, 展示ST, 平均ST, 決まり手分布, 被攻撃分布, モーター性能, 選手基本データ）
 * 出力: 上位3パターン + 決まり手確率分布
 */

import {
  COURSE_DEFAULT_DISTRIBUTION,
  COURSE_DEFAULT_DEFENSE,
} from "./winningTechniques.js";
import { getPlacementBaseline } from "./placementDistribution.js";

const DEFAULT_ST = 0.15;

// コース別の基本勝率（全国平均）
const COURSE_BASE_WIN_RATE = {
  1: 0.55,
  2: 0.15,
  3: 0.12,
  4: 0.1,
  5: 0.06,
  6: 0.04,
};

// Phase 2A: 級別スコア
const GRADE_SCORE = { A1: 1.0, A2: 0.75, B1: 0.45, B2: 0.2 };

// Phase 5B: 決まり手別モーター補正ウェイト
const MOTOR_WEIGHT = {
  sashi: 0.015,
  makuri: 0.06,
  makurizashi: 0.045,
  nuki: 0.03,
  megumare: 0.01,
};

// Phase 5C: 決まり手別選手力補正ウェイト
const SKILL_WEIGHT = {
  sashi: 0.1,
  makuri: 0.03,
  makurizashi: 0.06,
  nuki: 0.05,
  megumare: 0.01,
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function average(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  const avg = average(arr);
  return Math.sqrt(
    arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length,
  );
}

// Phase 2B: 当地勝率のベイズ縮小
function blendLocalRate(localRate, globalRate, courseRaceCounts) {
  const totalRaces = Object.values(courseRaceCounts || {}).reduce(
    (s, c) => s + (c.total || 0),
    0,
  );
  const blend = Math.min(1, totalRaces / 30);
  return (localRate || globalRate) * blend + (globalRate || 5.0) * (1 - blend);
}

// Phase 2C: 選手力スコア算出
function calcPlayerSkill(p) {
  const gradeScore = GRADE_SCORE[p.grade] || 0.45;
  const winRateScore = Math.min(1, (p.globalWinRate || 5.0) / 8.0);
  const localRate = blendLocalRate(
    p.localWinRate,
    p.globalWinRate,
    p.courseRaceCounts,
  );
  const localScore = Math.min(1, localRate / 8.0);
  const rate2Score = Math.min(1, (p.global2Rate || 25) / 50);

  return (
    winRateScore * 0.35 +
    localScore * 0.25 +
    rate2Score * 0.25 +
    gradeScore * 0.15
  );
}

/**
 * 1マーク展開予測 v3
 */
export function predictFirstMarkV2(players) {
  if (!players || players.length < 6) {
    return getDefaultPrediction();
  }

  // コース順にソート（進入コース or 枠番）
  const sorted = players
    .map((p) => ({
      ...p,
      course: p.course || p.boatNumber,
    }))
    .sort((a, b) => a.course - b.course);

  // Step 1: 各コースのST予測
  const predictedST = sorted.map((p) => {
    const exST = p.exhibitionST;
    const avgST = p.avgST;

    if (exST != null && avgST != null) {
      return exST * 0.55 + avgST * 0.35 + DEFAULT_ST * 0.1;
    } else if (exST != null) {
      return exST * 0.8 + DEFAULT_ST * 0.2;
    } else if (avgST != null) {
      return avgST * 0.8 + DEFAULT_ST * 0.2;
    }
    return DEFAULT_ST;
  });

  // Phase 3: ST標準偏差による信頼度
  const stReliability = sorted.map((p) => {
    const sd = p.stStddev || 0.05;
    return Math.max(0.5, 1 - sd * 2);
  });

  // Step 2: ST優位性マトリクス（Phase 3: 信頼度で減衰）
  const stAdvantage = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) => {
      const raw = sigmoid((predictedST[j] - predictedST[i]) / 0.03);
      return 0.5 + (raw - 0.5) * stReliability[i];
    }),
  );

  // Phase 6: モーターZスコア（クリッピング付き）
  const motor2Rates = sorted.map((p) => p.motor2Rate || 30);
  const motorAvg = average(motor2Rates);
  const motorStdDev = Math.max(
    1,
    Math.sqrt(
      motor2Rates.reduce((s, v) => s + Math.pow(v - motorAvg, 2), 0) /
        motor2Rates.length,
    ),
  );
  const motorZ = motor2Rates.map((v) =>
    clamp((v - motorAvg) / motorStdDev, -2.0, 2.0),
  );

  // Phase 2D: 選手力Zスコア
  const playerSkills = sorted.map((p) => calcPlayerSkill(p));
  const skillAvg = average(playerSkills);
  const skillStdDev = Math.max(0.01, stddev(playerSkills));
  const playerSkillZ = playerSkills.map((v) =>
    clamp((v - skillAvg) / skillStdDev, -2, 2),
  );

  // Step 3: 1コースの逃げ確率
  const course1 = sorted[0];
  const c1Course = String(course1.course);
  const c1AttackDist = course1.attackDistribution || {};
  const c1CourseDist = c1AttackDist[c1Course] || COURSE_DEFAULT_DISTRIBUTION[1];
  const personalNigeRate = c1CourseDist.nige != null ? c1CourseDist.nige : 0.55;

  // ベイズ縮小: 出走数に応じて個人データの信頼度を調整
  const courseRaceCounts = course1.courseRaceCounts || {};
  const c1Races = courseRaceCounts[c1Course]?.total || 0;
  const blendWeight = Math.min(1, c1Races / 50);
  const defaultNige = COURSE_DEFAULT_DISTRIBUTION[1].nige || 0.954;
  const nigeBase =
    personalNigeRate * blendWeight + defaultNige * (1 - blendWeight);

  // Phase 4A: ST比較を全5コースに拡大
  const stFactor =
    stAdvantage[0][1] * 0.4 +
    stAdvantage[0][2] * 0.3 +
    stAdvantage[0][3] * 0.2 +
    stAdvantage[0][4] * 0.07 +
    stAdvantage[0][5] * 0.03;

  // モーター補正
  const motorFactor = 1 + motorZ[0] * 0.05;

  // Phase 4B: 選手力補正
  const playerFactor = 1 + playerSkillZ[0] * 0.08;

  // 逃げ確率算出
  let nigeProb =
    0.55 *
    (nigeBase / defaultNige) *
    (stFactor / 0.5) *
    motorFactor *
    playerFactor;
  nigeProb = clamp(nigeProb, 0.1, 0.9);

  // Step 4: 2-6コースの各攻撃パターン確率
  const patterns = [
    { technique: "nige", winnerCourse: sorted[0].course, rawProb: nigeProb },
  ];

  // 1コースの被攻撃分布
  const c1DefenseDist = course1.defenseDistribution || {};
  const c1DefenseForCourse =
    c1DefenseDist[c1Course] || COURSE_DEFAULT_DEFENSE[1];

  const techniques = ["sashi", "makuri", "makurizashi", "nuki", "megumare"];

  for (let cIdx = 1; cIdx < 6; cIdx++) {
    const player = sorted[cIdx];
    const courseNum = String(player.course);
    const courseInt = player.course;
    const playerAttackDist = player.attackDistribution || {};
    const playerCourseDist =
      playerAttackDist[courseNum] ||
      COURSE_DEFAULT_DISTRIBUTION[courseInt] ||
      {};

    // コース別基本勝率（絶対確率へのスケーリング用）
    const courseWinRate = COURSE_BASE_WIN_RATE[courseInt] || 0.05;

    // ベイズ縮小用: このコースの出走数
    const playerCourseRaces = player.courseRaceCounts?.[courseNum]?.total || 0;
    const playerBlend = Math.min(1, playerCourseRaces / 50);

    for (const t of techniques) {
      // 攻撃率・被攻撃率をベイズ縮小で算出
      const personalAttackRate = playerCourseDist[t] || 0;
      const defaultAttackRate =
        (COURSE_DEFAULT_DISTRIBUTION[courseInt] || {})[t] || 0;
      const attackRate =
        personalAttackRate * playerBlend +
        defaultAttackRate * (1 - playerBlend);

      const defenseRate = c1DefenseForCourse[t] || 0;

      if (attackRate <= 0 && defenseRate <= 0) continue;

      // 攻守の幾何平均 x コース勝率で絶対確率にスケーリング
      let rawProb =
        Math.sqrt(Math.max(attackRate, 0.001) * Math.max(defenseRate, 0.001)) *
        courseWinRate;

      // Phase 5A: まくり系ST補正の緩和（フロア30%保証）
      if (t === "makuri" || t === "makurizashi") {
        rawProb *= 0.3 + 0.7 * stAdvantage[cIdx][0];
      } else if (t === "sashi") {
        rawProb *= 0.7 + 0.3 * stAdvantage[cIdx][0];
      }

      // Phase 5B: 決まり手別モーター補正
      rawProb *= 1 + motorZ[cIdx] * (MOTOR_WEIGHT[t] || 0.03);

      // Phase 5C: 決まり手別選手力補正
      rawProb *= 1 + playerSkillZ[cIdx] * (SKILL_WEIGHT[t] || 0.05);

      // megumare のフロア値
      if (t === "megumare") {
        rawProb = Math.max(rawProb, 0.005);
      }

      if (rawProb > 0.001) {
        patterns.push({
          technique: t,
          winnerCourse: courseInt,
          rawProb,
        });
      }
    }
  }

  // Step 5: 正規化 & 上位3パターン選出
  const totalRaw = patterns.reduce((s, p) => s + p.rawProb, 0);
  for (const p of patterns) {
    p.probability = Math.round((p.rawProb / totalRaw) * 100) / 100;
  }

  patterns.sort((a, b) => b.probability - a.probability);

  const top3 = patterns
    .slice(0, 3)
    .map(({ technique, winnerCourse, probability }) => ({
      technique,
      winnerCourse,
      probability,
    }));

  // Phase 7: 2着3着予測（playerSkillZで置換、上限1.5に緩和）
  for (const pattern of top3) {
    const baseline = getPlacementBaseline(
      pattern.technique,
      pattern.winnerCourse,
    );

    const secondPlace = {};
    const thirdPlace = {};

    for (let c = 1; c <= 6; c++) {
      if (c === pattern.winnerCourse) continue;

      const cIdx = sorted.findIndex((p) => p.course === c);
      if (cIdx < 0) continue;

      // 他コース（勝者・自分除く）との平均ST優位性
      const otherIndices = [];
      for (let j = 0; j < 6; j++) {
        if (j !== cIdx && sorted[j].course !== pattern.winnerCourse) {
          otherIndices.push(j);
        }
      }
      const avgStAdv =
        otherIndices.length > 0
          ? otherIndices.reduce((s, j) => s + stAdvantage[cIdx][j], 0) /
            otherIndices.length
          : 0.5;

      // Phase 7A/7B: playerSkillZで置換、上限1.5
      const multiplier = Math.min(
        1.5,
        (1 + 0.12 * (avgStAdv - 0.5) * 2) *
          (1 + 0.08 * motorZ[cIdx]) *
          (1 + 0.06 * playerSkillZ[cIdx]),
      );

      secondPlace[c] = (baseline.second[c] || 0) * Math.max(0.1, multiplier);
      thirdPlace[c] = (baseline.third[c] || 0) * Math.max(0.1, multiplier);
    }

    // 正規化（勝者コース除外、残り5コースで合計1.0）
    const sumS = Object.values(secondPlace).reduce((a, b) => a + b, 0);
    const sumT = Object.values(thirdPlace).reduce((a, b) => a + b, 0);

    for (const c of Object.keys(secondPlace)) {
      secondPlace[c] =
        sumS > 0 ? Math.round((secondPlace[c] / sumS) * 100) / 100 : 0;
    }
    for (const c of Object.keys(thirdPlace)) {
      thirdPlace[c] =
        sumT > 0 ? Math.round((thirdPlace[c] / sumT) * 100) / 100 : 0;
    }

    pattern.secondPlace = secondPlace;
    pattern.thirdPlace = thirdPlace;
  }

  // 全体の分布（決まり手ごとに合算）
  const distribution = {};
  for (const p of patterns) {
    distribution[p.technique] =
      (distribution[p.technique] || 0) + p.probability;
  }
  for (const key of Object.keys(distribution)) {
    distribution[key] = Math.round(distribution[key] * 100) / 100;
  }

  // Phase 8: boatStrengths 再設計（展示タイム・選手力を含む4要素）
  const exTimes = sorted.map((p) => p.exhibitionTime || null);
  const validExTimes = exTimes.filter((t) => t != null);
  const hasExhibition = validExTimes.length >= 4;

  let exZ = Array(6).fill(0);
  if (hasExhibition) {
    const exAvg = average(validExTimes);
    const exStd = Math.max(0.01, stddev(validExTimes));
    exZ = exTimes.map((t) =>
      t != null ? clamp(-(t - exAvg) / exStd, -2, 2) : 0,
    );
  }

  const boatStrengths = sorted.map((_, i) => {
    const avgStAdv =
      [0, 1, 2, 3, 4, 5]
        .filter((j) => j !== i)
        .reduce((s, j) => s + stAdvantage[i][j], 0) / 5;
    const motorScore = clamp(motorZ[i] * 0.1 + 0.5, 0, 1);
    const playerScore = clamp(playerSkillZ[i] * 0.1 + 0.5, 0, 1);
    const exScore = clamp(exZ[i] * 0.1 + 0.5, 0, 1);

    if (hasExhibition) {
      return (
        avgStAdv * 0.35 + motorScore * 0.2 + playerScore * 0.25 + exScore * 0.2
      );
    }
    return avgStAdv * 0.45 + motorScore * 0.3 + playerScore * 0.25;
  });

  return {
    patterns: top3,
    technique: top3[0].technique,
    probability: top3[0].probability,
    winnerCourse: top3[0].winnerCourse,
    distribution,
    boatStrengths,
  };
}

// 旧API互換のラッパー
export function predictFirstMark(players) {
  return predictFirstMarkV2(players);
}

/**
 * データ不足時のデフォルト予測
 */
function getDefaultPrediction() {
  return {
    patterns: [
      {
        technique: "nige",
        winnerCourse: 1,
        probability: 0.55,
        secondPlace: { 2: 0.33, 3: 0.29, 4: 0.19, 5: 0.12, 6: 0.07 },
        thirdPlace: { 2: 0.22, 3: 0.24, 4: 0.22, 5: 0.17, 6: 0.15 },
      },
      {
        technique: "sashi",
        winnerCourse: 2,
        probability: 0.15,
        secondPlace: { 1: 0.62, 3: 0.17, 4: 0.1, 5: 0.06, 6: 0.05 },
        thirdPlace: { 1: 0.19, 3: 0.26, 4: 0.23, 5: 0.17, 6: 0.15 },
      },
      {
        technique: "makuri",
        winnerCourse: 3,
        probability: 0.13,
        secondPlace: { 1: 0.19, 2: 0.24, 4: 0.26, 5: 0.21, 6: 0.1 },
        thirdPlace: { 1: 0.17, 2: 0.22, 4: 0.21, 5: 0.21, 6: 0.19 },
      },
    ],
    technique: "nige",
    probability: 0.55,
    winnerCourse: 1,
    distribution: {
      nige: 0.55,
      sashi: 0.15,
      makuri: 0.13,
      makurizashi: 0.1,
      nuki: 0.05,
      megumare: 0.02,
    },
    boatStrengths: [0.55, 0.52, 0.5, 0.48, 0.46, 0.44],
  };
}
