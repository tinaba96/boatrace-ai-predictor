/**
 * シャーロック予想 共有モデルロジック（純粋関数のみ）
 *
 * 条件付きロジット + オッズ結合（Benter 1994 の二段階モデル）:
 *   第1段: P_fund(勝者=i) = softmax(x_i・w)     … 基礎特徴量モデル
 *   第2段: P(勝者=i) = softmax(α・ln f_i + β・ln q_i) … 市場オッズと結合
 *
 * このファイルは学習スクリプト（scripts/analysis/train-conditional-logit.js）
 * とフロントエンド（sherlockService.js）の両方から import される。
 * 特徴量の定義を1箇所に保つことで、学習時と推論時の乖離を防ぐ。
 * Node/ブラウザ両対応のため、外部依存・副作用は持たない。
 */

export const GRADE_SCORE = { A1: 3, A2: 2, B1: 1, B2: 0 };

export const FEATURE_NAMES = [
  "lane1",
  "lane2",
  "lane3",
  "lane4",
  "lane5",
  "winRateDev",
  "localWinRateDev",
  "motor2Dev",
  "boat2Dev",
  "gradeDev",
  "exTimeAdv",
  "stAdv",
  "venueIn1Adv", // 会場ごとの1コース優位度（学習データからtarget encoding）× lane1
];

export function mean(arr) {
  const valid = arr.filter((x) => typeof x === "number" && !isNaN(x));
  if (valid.length === 0) return null;
  return valid.reduce((s, x) => s + x, 0) / valid.length;
}

// dev = 自艇 − レース平均（欠損は 0 = 平均並みとして扱う）
function devOf(value, raceMean) {
  if (raceMean == null || typeof value !== "number" || isNaN(value)) return 0;
  return value - raceMean;
}

/**
 * 1レース分の特徴量行列（6艇 × FEATURE_NAMES.length）を構築
 * @param {Object} race
 * @param {Array}  race.entries    - race_entries 6行（boat_number昇順）
 * @param {Object} race.exhibition - boat_number → {exhibition_time, start_timing}
 * @param {number} race.venueCode  - 会場コード 1-24
 * @param {Object} venueIn1Adv     - 会場コード → 1コース優位度（学習時に推定）
 */
export function buildFeatures(race, venueIn1Adv = {}) {
  const { entries, exhibition } = race;

  const winRates = entries.map((e) => e.win_rate);
  const localRates = entries.map((e) => e.local_win_rate);
  const motor2 = entries.map((e) => e.motor_2rate);
  const boat2 = entries.map((e) => e.boat_2rate);
  const grades = entries.map((e) => GRADE_SCORE[e.grade] ?? 1);
  const exTimes = entries.map(
    (e) => exhibition?.[e.boat_number]?.exhibition_time ?? null,
  );
  const sts = entries.map(
    (e) => exhibition?.[e.boat_number]?.start_timing ?? null,
  );

  const mWin = mean(winRates);
  const mLocal = mean(localRates);
  const mMotor = mean(motor2);
  const mBoat = mean(boat2);
  const mGrade = mean(grades);
  const mEx = mean(exTimes);
  const mSt = mean(sts);

  const vAdv = venueIn1Adv?.[race.venueCode] ?? 0;

  return entries.map((e, i) => [
    e.boat_number === 1 ? 1 : 0,
    e.boat_number === 2 ? 1 : 0,
    e.boat_number === 3 ? 1 : 0,
    e.boat_number === 4 ? 1 : 0,
    e.boat_number === 5 ? 1 : 0,
    devOf(winRates[i], mWin),
    devOf(localRates[i], mLocal),
    devOf(motor2[i], mMotor) / 10, // %スケールを縮めて数値安定化
    devOf(boat2[i], mBoat) / 10,
    devOf(grades[i], mGrade),
    // 展示タイム・STは小さいほど良い → 平均 − 自艇（正=有利）
    mEx != null && exTimes[i] != null ? (mEx - exTimes[i]) * 10 : 0,
    mSt != null && sts[i] != null ? (mSt - sts[i]) * 10 : 0,
    e.boat_number === 1 ? vAdv : 0,
  ]);
}

export function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((s, x) => s + x, 0);
  return exps.map((x) => x / sum);
}

/** 条件付きロジットの予測: feats [6艇][d] × 重み w → 勝率6要素 */
export function predictConditionalLogit(feats, w) {
  return softmax(feats.map((f) => f.reduce((s, x, j) => s + x * w[j], 0)));
}

export const clampP = (p) => Math.min(Math.max(p, 1e-6), 1 - 1e-6);

/** 単勝オッズ6要素 → implied 確率（マージン除去・正規化） */
export function impliedProbs(odds) {
  const inv = odds.map((o) => (typeof o === "number" && o > 1 ? 1 / o : 0));
  const sum = inv.reduce((s, x) => s + x, 0);
  if (sum <= 0) return null;
  return inv.map((x) => x / sum);
}

/**
 * 二段階結合: P ∝ exp(α・ln f + β・ln q)
 * @param {number[]} fundProbs - 基礎モデルの勝率（6要素）
 * @param {number[]} implied   - オッズの implied 確率（6要素）
 * @param {number[]} combW     - [α, β]
 */
export function combineProbs(fundProbs, implied, combW) {
  const feats = fundProbs.map((f, i) => [
    Math.log(clampP(f)),
    Math.log(clampP(implied[i])),
  ]);
  return predictConditionalLogit(feats, combW);
}

/**
 * モデルJSON（data/sherlock/model.json）から当該レースの予測一式を計算
 * @returns {{ fund: number[], implied: number[]|null, combined: number[]|null }}
 */
export function predictRace(model, race, odds) {
  const feats = buildFeatures(race, model.venue_in1_adv);
  const fund = predictConditionalLogit(feats, model.weights);
  const implied = odds ? impliedProbs(odds) : null;
  const combined =
    implied && model.combiner
      ? combineProbs(fund, implied, model.combiner)
      : null;
  return { fund, implied, combined };
}
