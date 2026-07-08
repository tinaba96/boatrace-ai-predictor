/**
 * 条件付きロジット + オッズ結合モデル（Benter流二段階モデル）の学習・評価
 *
 * レースを「6艇からの離散選択問題」としてモデル化する:
 *   P(勝者=i) = exp(x_i・w) / Σ_j exp(x_j・w)
 *
 * 3モデルを walk-forward（月単位）で比較評価する:
 *   1. fund     : 基礎特徴量（展示タイム・モーター・勝率・コース等）のみ
 *   2. odds     : 公衆オッズの implied 確率のみ
 *   3. combined : P ∝ exp(α・ln f_i + β・ln q_i)（Benter 1994 の二段階結合）
 *
 * 評価指標:
 *   - log-loss / top-1的中率 / McFadden擬似R²
 *   - ΔR² = R²(combined) − R²(odds)
 *     → 正なら「自前モデルが市場に対して上乗せ情報を持つ」ことを意味する
 *   - EV閾値別の単勝回収率シミュレーション
 *
 * 使い方:
 *   node scripts/analysis/train-conditional-logit.js
 *   node scripts/analysis/train-conditional-logit.js --from=2026-01-01 --to=2026-06-30
 *   node scripts/analysis/train-conditional-logit.js --save
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { fetchAll, isSupabaseEnabled } from "../lib/supabaseClient.js";
import { solveLinear } from "../lib/parametric-calibration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ODDS_HAIRCUT = 0.95; // 単勝オッズの締切変動ヘアカット
const EV_THRESHOLDS = [1.0, 1.1, 1.2, 1.3];
const RIDGE = 1e-4;
const MAX_ITER = 50;
const TOL = 1e-8;

const GRADE_SCORE = { A1: 3, A2: 2, B1: 1, B2: 0 };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv = process.argv.slice(2)) {
  const get = (name) => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=")[1] : null;
  };
  return {
    from: get("from"),
    to: get("to"),
    save: argv.includes("--save"),
  };
}

// ---------------------------------------------------------------------------
// データ取得・結合
// ---------------------------------------------------------------------------

async function loadDataset({ from, to }) {
  const rangeFilter = (col) => (q) => {
    if (from) q = q.gte(col, from);
    if (to) q = q.lte(col, `${to}~`); // race_id は日付プレフィックスで辞書順
    return q;
  };

  console.log("データ取得中...");
  const [entries, exhibitions, results, oddsRows] = await Promise.all([
    fetchAll(
      "race_entries",
      "race_id, boat_number, grade, win_rate, local_win_rate, motor_2rate, boat_2rate",
      rangeFilter("race_id"),
    ),
    fetchAll(
      "exhibition_data",
      "race_id, boat_number, exhibition_time, start_timing",
      rangeFilter("race_id"),
    ),
    fetchAll(
      "race_results",
      "race_id, rank1, payout_win, is_cancelled, is_no_race",
      (q) => {
        q = q.not("rank1", "is", null);
        return rangeFilter("race_id")(q);
      },
    ),
    fetchAll(
      "race_odds",
      "race_id, captured_at, odds_win_1, odds_win_2, odds_win_3, odds_win_4, odds_win_5, odds_win_6",
      rangeFilter("race_id"),
    ),
  ]);
  console.log(
    `  entries=${entries.length}, exhibitions=${exhibitions.length}, results=${results.length}, odds_snapshots=${oddsRows.length}`,
  );

  // 最終スナップショット（締切に最も近いオッズ）を race_id ごとに選ぶ
  const latestOdds = {};
  for (const row of oddsRows) {
    const cur = latestOdds[row.race_id];
    if (!cur || row.captured_at > cur.captured_at)
      latestOdds[row.race_id] = row;
  }

  const exhibitionByRace = {};
  for (const ex of exhibitions) {
    (exhibitionByRace[ex.race_id] ??= {})[ex.boat_number] = ex;
  }

  const resultByRace = {};
  for (const r of results) {
    if (r.is_cancelled || r.is_no_race) continue;
    resultByRace[r.race_id] = r;
  }

  const entriesByRace = {};
  for (const e of entries) {
    (entriesByRace[e.race_id] ??= []).push(e);
  }

  // レース単位に組み立て（6艇そろい・結果あり・オッズありのレースのみ）
  const races = [];
  let noEntries = 0;
  let noResult = 0;
  let noOdds = 0;

  for (const [raceId, raceEntries] of Object.entries(entriesByRace)) {
    if (raceEntries.length !== 6) {
      noEntries++;
      continue;
    }
    const result = resultByRace[raceId];
    if (!result) {
      noResult++;
      continue;
    }
    const oddsRow = latestOdds[raceId];
    const odds = oddsRow
      ? [1, 2, 3, 4, 5, 6].map((b) => oddsRow[`odds_win_${b}`] ?? null)
      : null;
    if (!odds || odds.some((o) => !(o > 1))) {
      noOdds++;
      continue;
    }

    races.push({
      raceId,
      month: raceId.slice(0, 7),
      entries: raceEntries.sort((a, b) => a.boat_number - b.boat_number),
      exhibition: exhibitionByRace[raceId] ?? {},
      winner: result.rank1, // 艇番 1-6
      payoutWin: result.payout_win ?? 0, // 100円あたり払戻（勝者に対する）
      odds,
    });
  }

  races.sort((a, b) => (a.raceId < b.raceId ? -1 : 1));
  console.log(
    `  対象レース=${races.length}（除外: 6艇未満=${noEntries}, 結果なし=${noResult}, オッズ欠損=${noOdds}）`,
  );
  return races;
}

// ---------------------------------------------------------------------------
// 特徴量（レース内で相対化 = 偏差）
// ---------------------------------------------------------------------------

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
];

function mean(arr) {
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
 */
export function buildFeatures(race) {
  const { entries, exhibition } = race;

  const winRates = entries.map((e) => e.win_rate);
  const localRates = entries.map((e) => e.local_win_rate);
  const motor2 = entries.map((e) => e.motor_2rate);
  const boat2 = entries.map((e) => e.boat_2rate);
  const grades = entries.map((e) => GRADE_SCORE[e.grade] ?? 1);
  const exTimes = entries.map(
    (e) => exhibition[e.boat_number]?.exhibition_time ?? null,
  );
  const sts = entries.map(
    (e) => exhibition[e.boat_number]?.start_timing ?? null,
  );

  const mWin = mean(winRates);
  const mLocal = mean(localRates);
  const mMotor = mean(motor2);
  const mBoat = mean(boat2);
  const mGrade = mean(grades);
  const mEx = mean(exTimes);
  const mSt = mean(sts);

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
  ]);
}

// ---------------------------------------------------------------------------
// 条件付きロジット（Newton-Raphson MLE）
// ---------------------------------------------------------------------------

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((s, x) => s + x, 0);
  return exps.map((x) => x / sum);
}

/**
 * 条件付きロジットのMLE学習
 * @param {number[][][]} X - [レース][艇][特徴量]
 * @param {number[]} y - 勝者のインデックス（0-5）
 * @returns {number[]} 重みベクトル
 */
export function fitConditionalLogit(X, y) {
  const d = X[0][0].length;
  let w = new Array(d).fill(0);

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const grad = new Array(d).fill(0);
    const hess = Array.from({ length: d }, () => new Array(d).fill(0));

    for (let r = 0; r < X.length; r++) {
      const feats = X[r];
      const probs = softmax(
        feats.map((f) => f.reduce((s, x, j) => s + x * w[j], 0)),
      );

      const mu = new Array(d).fill(0);
      for (let i = 0; i < feats.length; i++) {
        for (let j = 0; j < d; j++) mu[j] += probs[i] * feats[i][j];
      }
      for (let j = 0; j < d; j++) grad[j] += mu[j] - feats[y[r]][j];

      for (let i = 0; i < feats.length; i++) {
        for (let j = 0; j < d; j++) {
          const pj = probs[i] * feats[i][j];
          for (let k = j; k < d; k++) hess[j][k] += pj * feats[i][k];
        }
      }
      for (let j = 0; j < d; j++) {
        for (let k = j; k < d; k++) hess[j][k] -= mu[j] * mu[k];
      }
    }

    // 対称化 + ridge
    for (let j = 0; j < d; j++) {
      grad[j] += RIDGE * w[j];
      hess[j][j] += RIDGE;
      for (let k = 0; k < j; k++) hess[j][k] = hess[k][j];
    }

    const delta = solveLinear(hess, grad);
    if (!delta) break;
    let maxStep = 0;
    for (let j = 0; j < d; j++) {
      w[j] -= delta[j];
      maxStep = Math.max(maxStep, Math.abs(delta[j]));
    }
    if (maxStep < TOL) break;
  }
  return w;
}

export function predictConditionalLogit(feats, w) {
  return softmax(feats.map((f) => f.reduce((s, x, j) => s + x * w[j], 0)));
}

// オッズ → implied 確率（マージン除去）
function impliedProbs(odds) {
  const inv = odds.map((o) => 1 / o);
  const sum = inv.reduce((s, x) => s + x, 0);
  return inv.map((x) => x / sum);
}

const clampP = (p) => Math.min(Math.max(p, 1e-6), 1 - 1e-6);

// ---------------------------------------------------------------------------
// 評価
// ---------------------------------------------------------------------------

function evaluate(probsList, winners) {
  let logLoss = 0;
  let hits = 0;
  for (let r = 0; r < probsList.length; r++) {
    logLoss += -Math.log(clampP(probsList[r][winners[r]]));
    const pick = probsList[r].indexOf(Math.max(...probsList[r]));
    if (pick === winners[r]) hits++;
  }
  const n = probsList.length;
  const llPerRace = logLoss / n;
  const llUniform = Math.log(6);
  return {
    n,
    logLoss: llPerRace,
    accuracy: hits / n,
    mcFaddenR2: 1 - llPerRace / llUniform,
  };
}

// ---------------------------------------------------------------------------
// メイン: walk-forward 評価
// ---------------------------------------------------------------------------

async function main() {
  if (!isSupabaseEnabled()) {
    console.error("Supabase not configured.");
    process.exit(1);
  }
  const args = parseArgs();
  const races = await loadDataset(args);
  if (races.length < 1000) {
    console.error(`レース数が不足しています (${races.length})`);
    process.exit(1);
  }

  const months = [...new Set(races.map((r) => r.month))].sort();
  console.log(`\n対象月: ${months.join(", ")}`);

  // 前計算
  for (const race of races) {
    race.features = buildFeatures(race);
    race.winnerIdx = race.entries.findIndex(
      (e) => e.boat_number === race.winner,
    );
    race.implied = impliedProbs(race.odds);
  }
  const valid = races.filter((r) => r.winnerIdx >= 0);

  const byMonth = {};
  for (const r of valid) (byMonth[r.month] ??= []).push(r);

  const foldResults = [];
  const roi = {};
  for (const th of EV_THRESHOLDS)
    roi[th] = { bets: 0, hits: 0, invested: 0, returned: 0 };
  let lastWeights = null;
  let lastCombiner = null;

  // walk-forward: 学習 = 月[0..m-2), 結合係数fit = 月[m-1], テスト = 月[m]
  for (let m = 2; m < months.length; m++) {
    const trainRaces = months
      .slice(0, m - 1)
      .flatMap((mo) => byMonth[mo] ?? []);
    const combRaces = byMonth[months[m - 1]] ?? [];
    const testRaces = byMonth[months[m]] ?? [];
    if (
      trainRaces.length < 500 ||
      combRaces.length < 100 ||
      testRaces.length < 100
    )
      continue;

    // 1. 基礎モデル学習
    const w = fitConditionalLogit(
      trainRaces.map((r) => r.features),
      trainRaces.map((r) => r.winnerIdx),
    );
    lastWeights = w;

    // 2. 結合係数 (α, β) を直近月で学習（fund は out-of-sample 予測）
    const combX = combRaces.map((r) => {
      const f = predictConditionalLogit(r.features, w);
      return r.entries.map((_, i) => [
        Math.log(clampP(f[i])),
        Math.log(clampP(r.implied[i])),
      ]);
    });
    const combW = fitConditionalLogit(
      combX,
      combRaces.map((r) => r.winnerIdx),
    );
    lastCombiner = combW;

    // 3. テスト月で3モデルを評価
    const fundProbs = [];
    const oddsProbs = [];
    const combProbs = [];
    for (const r of testRaces) {
      const f = predictConditionalLogit(r.features, w);
      const q = r.implied;
      const x = r.entries.map((_, i) => [
        Math.log(clampP(f[i])),
        Math.log(clampP(q[i])),
      ]);
      fundProbs.push(f);
      oddsProbs.push(q);
      combProbs.push(predictConditionalLogit(x, combW));
    }
    const winners = testRaces.map((r) => r.winnerIdx);

    const fund = evaluate(fundProbs, winners);
    const odds = evaluate(oddsProbs, winners);
    const comb = evaluate(combProbs, winners);

    foldResults.push({
      testMonth: months[m],
      nTrain: trainRaces.length,
      nTest: testRaces.length,
      alpha: combW[0],
      beta: combW[1],
      fund,
      odds,
      combined: comb,
      deltaR2: comb.mcFaddenR2 - odds.mcFaddenR2,
    });

    // 4. 回収率シミュレーション（combined の確率 × スナップショットオッズ）
    for (let t = 0; t < testRaces.length; t++) {
      const r = testRaces[t];
      const p = combProbs[t];
      let bestEv = 0;
      let bestBoat = -1;
      for (let i = 0; i < 6; i++) {
        const ev = p[i] * r.odds[i] * ODDS_HAIRCUT;
        if (ev > bestEv) {
          bestEv = ev;
          bestBoat = i;
        }
      }
      for (const th of EV_THRESHOLDS) {
        if (bestEv >= th && bestBoat >= 0) {
          roi[th].bets++;
          roi[th].invested += 100;
          if (bestBoat === r.winnerIdx) {
            roi[th].hits++;
            roi[th].returned += r.payoutWin; // 実際の最終払戻（100円あたり）
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // レポート出力
  // ---------------------------------------------------------------------------

  console.log("\n===== walk-forward 評価（月次フォールド）=====");
  console.log(
    "month      | n     | logloss fund/odds/comb | acc fund/odds/comb | R² fund/odds/comb | ΔR²    | α/β",
  );
  for (const f of foldResults) {
    console.log(
      `${f.testMonth}    | ${String(f.nTest).padStart(5)} | ` +
        `${f.fund.logLoss.toFixed(4)} / ${f.odds.logLoss.toFixed(4)} / ${f.combined.logLoss.toFixed(4)} | ` +
        `${(f.fund.accuracy * 100).toFixed(1)}% / ${(f.odds.accuracy * 100).toFixed(1)}% / ${(f.combined.accuracy * 100).toFixed(1)}% | ` +
        `${f.fund.mcFaddenR2.toFixed(4)} / ${f.odds.mcFaddenR2.toFixed(4)} / ${f.combined.mcFaddenR2.toFixed(4)} | ` +
        `${f.deltaR2 >= 0 ? "+" : ""}${f.deltaR2.toFixed(4)} | ` +
        `${f.alpha.toFixed(2)}/${f.beta.toFixed(2)}`,
    );
  }

  const agg = (key, metric) => {
    const tot = foldResults.reduce((s, f) => s + f[key][metric] * f[key].n, 0);
    const n = foldResults.reduce((s, f) => s + f[key].n, 0);
    return tot / n;
  };
  console.log("\n===== 集計（テスト全期間・レース数加重平均）=====");
  for (const key of ["fund", "odds", "combined"]) {
    console.log(
      `${key.padEnd(9)}: logloss=${agg(key, "logLoss").toFixed(4)}, acc=${(agg(key, "accuracy") * 100).toFixed(1)}%, R²=${agg(key, "mcFaddenR2").toFixed(4)}`,
    );
  }
  const totalDeltaR2 =
    agg("combined", "mcFaddenR2") - agg("odds", "mcFaddenR2");
  console.log(
    `ΔR² (combined − odds) = ${totalDeltaR2 >= 0 ? "+" : ""}${totalDeltaR2.toFixed(4)}  ${totalDeltaR2 > 0 ? "→ 市場への上乗せ情報あり" : "→ 市場に対する優位なし"}`,
  );

  console.log("\n===== EV閾値別 単勝回収率シミュレーション（combined）=====");
  console.log(
    "threshold | bets  | hits | hit%  | invested | returned | recovery",
  );
  for (const th of EV_THRESHOLDS) {
    const x = roi[th];
    const rec = x.invested > 0 ? x.returned / x.invested : 0;
    console.log(
      `EV>=${th.toFixed(1)}   | ${String(x.bets).padStart(5)} | ${String(x.hits).padStart(4)} | ${x.bets > 0 ? ((x.hits / x.bets) * 100).toFixed(1) : "0.0"}% | ${String(x.invested).padStart(8)} | ${String(x.returned).padStart(8)} | ${(rec * 100).toFixed(1)}%`,
    );
  }

  if (lastWeights) {
    console.log("\n===== 基礎モデル係数（最終フォールド）=====");
    FEATURE_NAMES.forEach((name, j) =>
      console.log(`  ${name.padEnd(16)}: ${lastWeights[j].toFixed(4)}`),
    );
    if (lastCombiner)
      console.log(
        `  結合係数: α(fund)=${lastCombiner[0].toFixed(3)}, β(odds)=${lastCombiner[1].toFixed(3)}`,
      );
  }

  if (args.save) {
    const outDir = path.join(
      __dirname,
      "../../data/analysis/model-experiments",
    );
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, "conditional-logit-eval.json");
    await fs.writeFile(
      outPath,
      JSON.stringify(
        {
          evaluated_at: new Date().toISOString(),
          range: { from: args.from, to: args.to },
          folds: foldResults,
          roi,
          feature_names: FEATURE_NAMES,
          last_weights: lastWeights,
          last_combiner: lastCombiner,
        },
        null,
        2,
      ),
      "utf-8",
    );
    console.log(`\n結果を保存: ${outPath}`);
  }
}

const isCli =
  process.argv[1] && process.argv[1].endsWith("train-conditional-logit.js");
if (isCli) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
