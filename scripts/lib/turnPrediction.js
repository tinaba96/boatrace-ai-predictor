/**
 * 1マーク展開予測ロジック v2（バックエンド用）
 *
 * v2: 攻守両面のマッチアップ確率を算出し、上位3パターンを返す
 *
 * 入力: 6艇の選手データ（枠番, 進入コース, 展示ST, 平均ST, 決まり手分布, 被攻撃分布, モーター性能）
 * 出力: 上位3パターン + 決まり手確率分布
 */

import {
  COURSE_DEFAULT_DISTRIBUTION,
  COURSE_DEFAULT_DEFENSE,
} from "./winningTechniques.js";
import { getPlacementBaseline } from "./placementDistribution.js";

const DEFAULT_ST = 0.15;

// コース別の基本勝率（全国平均）
// attackDistribution は「勝った時の決まり手比率」（条件付き確率）なので、
// コース自体の勝率を乗じて絶対確率にスケールする必要がある
const COURSE_BASE_WIN_RATE = {
  1: 0.55,
  2: 0.15,
  3: 0.12,
  4: 0.1,
  5: 0.06,
  6: 0.04,
};

/**
 * シグモイド関数（ST差を0-1の優位性に変換）
 * 0.5 = 互角、0.7 = 大きな優位
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * 1マーク展開予測 v2
 * @param {Array} players - 6艇の選手データ配列
 *   各要素: {
 *     boatNumber: number (1-6),
 *     course: number (1-6, 進入コース。未設定時は枠番=コース),
 *     exhibitionST: number|null (展示ST),
 *     avgST: number|null (平均ST),
 *     stStddev: number|null (ST標準偏差),
 *     attackDistribution: Object|null (コース別攻撃分布),
 *     defenseDistribution: Object|null (コース別被攻撃分布),
 *     courseRaceCounts: Object|null (コース別出走数・勝数),
 *     exhibitionTime: number|null (展示タイム),
 *     motor2Rate: number|null (モーター2連率),
 *   }
 * @returns {Object} 展開予測結果
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

  // Step 2: ST優位性マトリクス
  // stAdvantage[i][j] = sigmoid((ST[j] - ST[i]) / 0.03)
  // > 0.5 means player i is faster
  const stAdvantage = Array.from({ length: 6 }, (_, i) =>
    Array.from({ length: 6 }, (_, j) =>
      sigmoid((predictedST[j] - predictedST[i]) / 0.03),
    ),
  );

  // モーターZスコア
  const motor2Rates = sorted.map((p) => p.motor2Rate || 30);
  const motorAvg = motor2Rates.reduce((s, v) => s + v, 0) / motor2Rates.length;
  const motorStdDev = Math.max(
    1,
    Math.sqrt(
      motor2Rates.reduce((s, v) => s + Math.pow(v - motorAvg, 2), 0) /
        motor2Rates.length,
    ),
  );
  const motorZ = motor2Rates.map((v) => (v - motorAvg) / motorStdDev);

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

  // ST補正（2,3コースとの比較）
  const stFactor = stAdvantage[0][1] * 0.6 + stAdvantage[0][2] * 0.4;

  // モーター補正
  const motorFactor = 1 + motorZ[0] * 0.05;

  // 逃げ確率算出（全国平均1着率55%をベースに）
  let nigeProb =
    0.55 * (nigeBase / defaultNige) * (stFactor / 0.5) * motorFactor;
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
      // 攻撃率・被攻撃率をベイズ縮小で算出（ST/モーター補正の前に）
      const personalAttackRate = playerCourseDist[t] || 0;
      const defaultAttackRate =
        (COURSE_DEFAULT_DISTRIBUTION[courseInt] || {})[t] || 0;
      const attackRate =
        personalAttackRate * playerBlend +
        defaultAttackRate * (1 - playerBlend);

      const defenseRate = c1DefenseForCourse[t] || 0;

      if (attackRate <= 0 && defenseRate <= 0) continue;

      // 攻守の幾何平均 x コース勝率で絶対確率にスケーリング
      // attackRate は「このコースで勝った時の決まり手比率」（条件付き確率）
      // courseWinRate を乗じて「このコースがこの決まり手で勝つ絶対確率」にする
      let rawProb =
        Math.sqrt(Math.max(attackRate, 0.001) * Math.max(defenseRate, 0.001)) *
        courseWinRate;

      // ST補正（まくり系はST優位が必要、差しは控えめ）
      if (t === "makuri" || t === "makurizashi") {
        rawProb *= stAdvantage[cIdx][0];
      } else if (t === "sashi") {
        rawProb *= 0.7 + 0.3 * stAdvantage[cIdx][0];
      }

      // モーター補正
      rawProb *= 1 + motorZ[cIdx] * 0.03;

      // megumare のフロア値（実際は1-2%程度存在する）
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

  // 確率降順でソート
  patterns.sort((a, b) => b.probability - a.probability);

  // 上位3パターン
  const top3 = patterns
    .slice(0, 3)
    .map(({ technique, winnerCourse, probability }) => ({
      technique,
      winnerCourse,
      probability,
    }));

  // Step 6: 各パターンの2着・3着確率分布
  // skillZ: motor2Rate を選手＋機材の総合力の代理変数として使用
  const skillRates = sorted.map((p) => p.motor2Rate || 30);
  const skillAvg = skillRates.reduce((s, v) => s + v, 0) / skillRates.length;
  const skillStdDev = Math.max(
    1,
    Math.sqrt(
      skillRates.reduce((s, v) => s + Math.pow(v - skillAvg, 2), 0) /
        skillRates.length,
    ),
  );
  const skillZ = skillRates.map((v) => (v - skillAvg) / skillStdDev);

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

      // 補正係数（上限2.0倍）
      const multiplier = Math.min(
        2.0,
        (1 + 0.15 * (avgStAdv - 0.5) * 2) *
          (1 + 0.1 * motorZ[cIdx]) *
          (1 + 0.05 * skillZ[cIdx]),
      );

      secondPlace[c] =
        (baseline.second[c] || 0) * Math.max(0.1, multiplier);
      thirdPlace[c] =
        (baseline.third[c] || 0) * Math.max(0.1, multiplier);
    }

    // 正規化（勝者コース除外、残り5コースで合計1.0）
    const sumS = Object.values(secondPlace).reduce((a, b) => a + b, 0);
    const sumT = Object.values(thirdPlace).reduce((a, b) => a + b, 0);

    for (const c of Object.keys(secondPlace)) {
      secondPlace[c] =
        sumS > 0
          ? Math.round((secondPlace[c] / sumS) * 100) / 100
          : 0;
    }
    for (const c of Object.keys(thirdPlace)) {
      thirdPlace[c] =
        sumT > 0
          ? Math.round((thirdPlace[c] / sumT) * 100) / 100
          : 0;
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
  // 丸め
  for (const key of Object.keys(distribution)) {
    distribution[key] = Math.round(distribution[key] * 100) / 100;
  }

  // 各コースの総合強さスコア（0-1、高いほど強い）
  const boatStrengths = sorted.map((_, i) => {
    // 他の5艇に対する平均ST優位性（sigmoid正規化済み、0.5=互角）
    const avgStAdv =
      [0, 1, 2, 3, 4, 5]
        .filter((j) => j !== i)
        .reduce((s, j) => s + stAdvantage[i][j], 0) / 5;
    // モーターZ-score を 0-1 にスケーリング（clamp付き）
    const motorScore = Math.max(0, Math.min(1, motorZ[i] * 0.1 + 0.5));
    return avgStAdv * 0.6 + motorScore * 0.4;
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
    boatStrengths: [0.55, 0.52, 0.50, 0.48, 0.46, 0.44],
  };
}
