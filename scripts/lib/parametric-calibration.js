// パラメトリック確率校正: Platt scaling / Beta calibration
//
// Isotonic回帰（isotonic-regression.js）はサンプルが十分あれば最良だが、
// 数百件を下回ると階段状に過学習しやすい。パラメータ数が少ない
// パラメトリック校正はサンプルが薄い時に安定する。
//
// - PlattCalibrator: p = sigmoid(A*score + B)
//     入力は任意スケールの生スコア（AIスコア等）。パラメータ2つ。
// - BetaCalibrator: p = sigmoid(a*ln(q) - b*ln(1-q) + c)  (Kull et al. 2017)
//     入力は確率 q ∈ (0,1)。パラメータ3つ。Plattより柔軟だが確率入力専用。
//
// どちらも二値ロジスティック回帰のMLE（Newton-Raphson/IRLS）で学習する。
// isotonic-regression.js と同じ fit/predict/toJSON/fromJSON インターフェース。

const MAX_ITER = 100;
const TOL = 1e-8;
const RIDGE = 1e-6; // 完全分離対策の微小L2正則化

function sigmoid(z) {
  // オーバーフロー対策付きロジスティック関数
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

// 汎用ロジスティック回帰: features[i] = [x1, x2, ...]（バイアス項は内部で付加）
// Newton-Raphson で重みを推定して返す
function fitLogistic(features, outcomes) {
  const n = features.length;
  const d = features[0].length + 1; // +1 = バイアス項
  const X = features.map((f) => [...f, 1]);
  let w = new Array(d).fill(0);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // 勾配とヘッセ行列
    const grad = new Array(d).fill(0);
    const hess = Array.from({ length: d }, () => new Array(d).fill(0));

    for (let i = 0; i < n; i++) {
      const z = X[i].reduce((s, x, j) => s + x * w[j], 0);
      const p = sigmoid(z);
      const err = p - outcomes[i];
      const wgt = Math.max(p * (1 - p), 1e-12);
      for (let j = 0; j < d; j++) {
        grad[j] += err * X[i][j];
        for (let k = 0; k < d; k++) {
          hess[j][k] += wgt * X[i][j] * X[i][k];
        }
      }
    }
    for (let j = 0; j < d; j++) {
      grad[j] += RIDGE * w[j];
      hess[j][j] += RIDGE;
    }

    // ガウスの消去法で hess * delta = grad を解く
    const delta = solveLinear(hess, grad);
    if (!delta) break; // 特異行列: 打ち切り

    let maxStep = 0;
    for (let j = 0; j < d; j++) {
      w[j] -= delta[j];
      maxStep = Math.max(maxStep, Math.abs(delta[j]));
    }
    if (maxStep < TOL) break;
  }
  return w;
}

// ガウスの消去法（部分ピボット選択）
// 他スクリプト（条件付きロジット等）でも使うため export する
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

export class PlattCalibrator {
  constructor() {
    this._w = null; // [A, B]
    this._mean = 0;
    this._std = 1;
  }

  // scores: 生スコア配列（任意スケール）、outcomes: 0/1 配列
  fit(scores, outcomes) {
    if (scores.length !== outcomes.length || scores.length === 0) {
      throw new Error(
        "scores and outcomes must be non-empty arrays of equal length",
      );
    }
    // スコアを標準化して数値安定性を確保
    const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
    const variance =
      scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length;
    const std = Math.sqrt(variance) || 1;
    this._mean = mean;
    this._std = std;

    const features = scores.map((s) => [(s - mean) / std]);
    this._w = fitLogistic(features, outcomes);
  }

  predict(scores) {
    if (!this._w) throw new Error("Calibrator has not been fitted yet");
    const single = !Array.isArray(scores);
    const arr = single ? [scores] : scores;
    const result = arr.map((s) => {
      const z = ((s - this._mean) / this._std) * this._w[0] + this._w[1];
      return sigmoid(z);
    });
    return single ? result[0] : result;
  }

  toJSON() {
    return { type: "platt", w: this._w, mean: this._mean, std: this._std };
  }

  static fromJSON(obj) {
    const cal = new PlattCalibrator();
    cal._w = obj.w;
    cal._mean = obj.mean;
    cal._std = obj.std;
    return cal;
  }
}

export class BetaCalibrator {
  constructor() {
    this._w = null; // [a, b, c]
  }

  // probs: 確率配列 (0,1)、outcomes: 0/1 配列
  fit(probs, outcomes) {
    if (probs.length !== outcomes.length || probs.length === 0) {
      throw new Error(
        "probs and outcomes must be non-empty arrays of equal length",
      );
    }
    const features = probs.map((q) => {
      const qc = Math.min(Math.max(q, 1e-6), 1 - 1e-6);
      return [Math.log(qc), -Math.log(1 - qc)];
    });
    this._w = fitLogistic(features, outcomes);
  }

  predict(probs) {
    if (!this._w) throw new Error("Calibrator has not been fitted yet");
    const single = !Array.isArray(probs);
    const arr = single ? [probs] : probs;
    const result = arr.map((q) => {
      const qc = Math.min(Math.max(q, 1e-6), 1 - 1e-6);
      const z =
        this._w[0] * Math.log(qc) + this._w[1] * -Math.log(1 - qc) + this._w[2];
      return sigmoid(z);
    });
    return single ? result[0] : result;
  }

  toJSON() {
    return { type: "beta", w: this._w };
  }

  static fromJSON(obj) {
    const cal = new BetaCalibrator();
    cal._w = obj.w;
    return cal;
  }
}

export class OddsAwareCalibrator {
  // オッズ条件付き校正器: P(的中 | オッズ, スコア) を2特徴量ロジスティックで学習
  //   特徴量: [ln(1/odds) = 市場implied確率の対数, AIスコア]（内部で標準化）
  // スコア単独の校正は「どんなオッズの買い目か」を無視するため、
  // 大穴買い目に平均的中率を適用してEVを過大評価する。市場オッズを
  // 条件に含めることで確率がオッズに整合し、EVは「スコアが市場に
  // 上乗せする情報」がある場合にのみ 1.0 を超える（Benter 1994 と同構造）。
  constructor() {
    this._w = null;
    this._means = null;
    this._stds = null;
    this.needsOdds = true;
  }

  static _features(score, odds) {
    // implied確率の logit を使う（p = implied が厳密に表現できる形）
    const q = Math.min(Math.max(1 / Math.max(odds, 1.01), 1e-6), 1 - 1e-6);
    return [Math.log(q / (1 - q)), score];
  }

  fit(scores, oddsArr, outcomes) {
    if (
      scores.length !== outcomes.length ||
      oddsArr.length !== outcomes.length ||
      scores.length === 0
    ) {
      throw new Error(
        "scores, odds and outcomes must be non-empty arrays of equal length",
      );
    }
    const raw = scores.map((s, i) =>
      OddsAwareCalibrator._features(s, oddsArr[i]),
    );
    const d = raw[0].length;
    const means = new Array(d).fill(0);
    const stds = new Array(d).fill(0);
    for (let j = 0; j < d; j++) {
      means[j] = raw.reduce((s, f) => s + f[j], 0) / raw.length;
      const variance =
        raw.reduce((s, f) => s + (f[j] - means[j]) ** 2, 0) / raw.length;
      stds[j] = Math.sqrt(variance) || 1;
    }
    const features = raw.map((f) => f.map((x, j) => (x - means[j]) / stds[j]));
    this._means = means;
    this._stds = stds;
    this._w = fitLogistic(features, outcomes);
  }

  predict(score, odds) {
    if (!this._w) throw new Error("Calibrator has not been fitted yet");
    const f = OddsAwareCalibrator._features(score, odds).map(
      (x, j) => (x - this._means[j]) / this._stds[j],
    );
    const z = f.reduce((s, x, j) => s + x * this._w[j], this._w[f.length]);
    return sigmoid(z);
  }

  toJSON() {
    return {
      type: "odds-aware",
      w: this._w,
      means: this._means,
      stds: this._stds,
    };
  }

  static fromJSON(obj) {
    const cal = new OddsAwareCalibrator();
    cal._w = obj.w;
    cal._means = obj.means;
    cal._stds = obj.stds;
    return cal;
  }
}

// CLI self-test
if (process.argv[1] && process.argv[1].endsWith("parametric-calibration.js")) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
  };

  // 疑似データ: 真の的中確率 = sigmoid((score-50)/10) に従う二値結果
  // 乱数を使わず決定論的に生成（同じ確率で0/1を交互配置）
  const scores = [];
  const outcomes = [];
  for (let s = 10; s <= 90; s += 2) {
    const trueP = 1 / (1 + Math.exp(-(s - 50) / 10));
    // 各スコアにつき10サンプル、round(trueP*10)個を1にする
    const ones = Math.round(trueP * 10);
    for (let i = 0; i < 10; i++) {
      scores.push(s);
      outcomes.push(i < ones ? 1 : 0);
    }
  }

  const platt = new PlattCalibrator();
  platt.fit(scores, outcomes);

  // 単調性: スコアが高いほど確率が高い
  assert(platt.predict(80) > platt.predict(50), "platt monotone high");
  assert(platt.predict(50) > platt.predict(20), "platt monotone low");
  // 真値の近似: score=50 で約0.5
  const p50 = platt.predict(50);
  assert(Math.abs(p50 - 0.5) < 0.05, `platt p(50)≈0.5 (got ${p50})`);
  // 範囲
  assert(platt.predict(1000) <= 1 && platt.predict(-1000) >= 0, "platt bounds");
  // 直列化
  const restored = PlattCalibrator.fromJSON(platt.toJSON());
  assert(
    Math.abs(restored.predict(60) - platt.predict(60)) < 1e-12,
    "platt round-trip",
  );

  // BetaCalibrator: 過信気味の確率（true = q^2）を補正できるか
  const rawProbs = [];
  const betaOutcomes = [];
  for (let q = 0.05; q <= 0.95; q += 0.05) {
    const trueP = q * q; // 過信: 実際の的中率は q^2
    const ones = Math.round(trueP * 20);
    for (let i = 0; i < 20; i++) {
      rawProbs.push(q);
      betaOutcomes.push(i < ones ? 1 : 0);
    }
  }
  const beta = new BetaCalibrator();
  beta.fit(rawProbs, betaOutcomes);
  // 過信を下方修正しているか
  assert(
    beta.predict(0.5) < 0.35,
    `beta corrects overconfidence (got ${beta.predict(0.5)})`,
  );
  assert(beta.predict(0.9) > beta.predict(0.3), "beta monotone");
  const betaRestored = BetaCalibrator.fromJSON(beta.toJSON());
  assert(
    Math.abs(betaRestored.predict(0.5) - beta.predict(0.5)) < 1e-12,
    "beta round-trip",
  );

  // OddsAwareCalibrator: 真の的中率 = implied確率（=1/odds）で、スコアは無情報
  // → 校正後の確率は odds に追従し、EV = p*odds ≈ 1.0 に張り付くはず
  const oaScores = [];
  const oaOdds = [];
  const oaOutcomes = [];
  const oddsLevels = [1.5, 2, 3, 5, 10, 30, 100];
  for (const o of oddsLevels) {
    const trueP = 1 / o;
    const n = 200;
    const ones = Math.round(trueP * n);
    for (let i = 0; i < n; i++) {
      oaScores.push(50 + (i % 10)); // 無情報スコア
      oaOdds.push(o);
      oaOutcomes.push(i < ones ? 1 : 0);
    }
  }
  const oa = new OddsAwareCalibrator();
  oa.fit(oaScores, oaOdds, oaOutcomes);
  for (const o of [2, 10, 100]) {
    const ev = oa.predict(55, o) * o;
    assert(
      ev > 0.5 && ev < 1.6,
      `odds-aware EV stays near 1.0 for odds=${o} (got ${ev.toFixed(2)})`,
    );
  }
  // 低オッズほど高確率
  assert(
    oa.predict(55, 1.5) > oa.predict(55, 100),
    "odds-aware prob decreases with odds",
  );
  const oaRestored = OddsAwareCalibrator.fromJSON(oa.toJSON());
  assert(
    Math.abs(oaRestored.predict(55, 10) - oa.predict(55, 10)) < 1e-12,
    "odds-aware round-trip",
  );

  console.log("parametric-calibration: all assertions passed");
}
