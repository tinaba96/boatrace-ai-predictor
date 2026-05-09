/**
 * 閾値設定ロジックの検証
 * 仮説: 1コース勝率が低い会場ほど、threshold が低い（本命有利が起きやすい）か？
 *
 * ユーザーのアイディア：
 * threshold = base_threshold + (全国平均 - 会場勝率) × weight
 *
 * 実行: node scripts/analysis/verify-threshold-logic.js
 */
import {
  VENUE_1COURSE_WIN_RATE,
  VENUE_1COURSE_AVG,
  VENUE_VOLATILITY_THRESHOLD,
} from "../lib/venueParameters.js";

const VENUE_NAMES = {
  "01": "桐生",
  "02": "戸田",
  "03": "江戸川",
  "04": "平和島",
  "05": "多摩川",
  "06": "浜名湖",
  "07": "蒲郡",
  "08": "常滑",
  "09": "津",
  10: "三国",
  11: "びわこ",
  12: "住之江",
  13: "尼崎",
  14: "鳴門",
  15: "丸亀",
  16: "児島",
  17: "宮島",
  18: "徳山",
  19: "下関",
  20: "若松",
  21: "芦屋",
  22: "福岡",
  23: "唐津",
  24: "大村",
};

console.log("\n" + "=".repeat(100));
console.log("🔍 閾値設定ロジック検証");
console.log("=".repeat(100) + "\n");

console.log("📊 全国平均 1コース勝率:", VENUE_1COURSE_AVG, "\n");

// 全会場の差分を計算
const venues = [];
for (const code in VENUE_1COURSE_WIN_RATE) {
  const rate = VENUE_1COURSE_WIN_RATE[code];
  const diff = VENUE_1COURSE_AVG - rate;
  const threshold = VENUE_VOLATILITY_THRESHOLD[code];

  venues.push({
    code,
    name: VENUE_NAMES[code],
    rate,
    diff,
    threshold,
  });
}

// 勝率で昇順ソート
venues.sort((a, b) => a.rate - b.rate);

console.log("📋 会場別 1コース勝率 vs 閾値\n");
console.log("| 順位 | 会場 | 勝率 | 差分（平均-会場） | 現在の threshold |");
console.log("|------|------|------|----------|----------|");

venues.forEach((v, idx) => {
  const symbol = v.diff > 0 ? "↑" : v.diff < 0 ? "↓" : "→";
  console.log(
    `| ${String(idx + 1).padStart(2)} | ${v.name}(${v.code}) | ${v.rate.toFixed(2)} | ${symbol}${Math.abs(v.diff).toFixed(3)} | ${v.threshold} |`,
  );
});

// 相関分析
console.log("\n\n📈 相関分析\n");

const winRates = venues.map((v) => v.rate);
const thresholds = venues.map((v) => v.threshold);
const diffs = venues.map((v) => v.diff);

// ピアソン相関係数
function correlation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b) / n;
  const meanY = y.reduce((a, b) => a + b) / n;

  const numerator = x.reduce(
    (sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY),
    0,
  );
  const denomX = Math.sqrt(
    x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0),
  );
  const denomY = Math.sqrt(
    y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0),
  );

  return numerator / (denomX * denomY);
}

const corrWinRateVsThreshold = correlation(winRates, thresholds);
const corrDiffVsThreshold = correlation(diffs, thresholds);

console.log(`1コース勝率 vs 現在の閾値:`);
console.log(`  相関係数: ${corrWinRateVsThreshold.toFixed(3)}`);
if (corrWinRateVsThreshold < -0.5) {
  console.log(
    `  ✅ 強い負の相関: 勝率が低い会場ほど threshold が低い（仮説と合致）`,
  );
} else if (corrWinRateVsThreshold < 0) {
  console.log(`  🟡 弱い負の相関: 関係はあるが弱い`);
} else {
  console.log(`  ❌ 正の相関 or 相関なし: 仮説と矛盾`);
}

console.log(`\n勝率差分（平均-会場） vs 現在の閾値:`);
console.log(`  相関係数: ${corrDiffVsThreshold.toFixed(3)}`);
if (corrDiffVsThreshold > 0.5) {
  console.log(
    `  ✅ 強い正の相関: 差分が大きい（弱い会場）ほど threshold が高い（仮説と合致）`,
  );
} else if (corrDiffVsThreshold > 0) {
  console.log(`  🟡 弱い正の相関: 関係はあるが弱い`);
} else {
  console.log(`  ❌ 負の相関 or 相関なし: 仮説と矛盾`);
}

// 提案: 差分ベースの閾値調整
console.log("\n\n💡 ユーザーのアイディア検証\n");
console.log("提案: threshold = base + (差分) × weight\n");

// 現在の threshold を差分で説明できるか試す
// 回帰分析: threshold ≈ a × 差分 + b
const n = venues.length;
const sumX = diffs.reduce((a, b) => a + b, 0);
const sumY = thresholds.reduce((a, b) => a + b, 0);
const sumXX = diffs.reduce((a, d) => a + d * d, 0);
const sumXY = diffs.reduce((sum, d, i) => sum + d * thresholds[i], 0);

const weight = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
const base = (sumY - weight * sumX) / n;

console.log(
  `当てはめ: threshold ≈ ${base.toFixed(1)} ${weight > 0 ? "+" : ""} ${weight.toFixed(1)} × 差分\n`,
);

console.log("| 会場 | 勝率 | 差分 | 提案値 | 現在の値 | 乖離 |");
console.log("|------|------|------|--------|---------|------|");

let totalError = 0;
venues.forEach((v) => {
  const proposed = base + weight * v.diff;
  const error = Math.abs(proposed - v.threshold);
  totalError += error;
  console.log(
    `| ${v.name}(${v.code}) | ${v.rate.toFixed(2)} | ${v.diff.toFixed(3)} | ${proposed.toFixed(0)} | ${v.threshold} | ${error.toFixed(1)} |`,
  );
});

const avgError = totalError / venues.length;

console.log(`\n平均乖離: ${avgError.toFixed(1)} pt`);

if (avgError < 5) {
  console.log(`\n✅ 非常に合致: ユーザーのアイディアは正確です`);
  console.log(
    `   現在の閾値は、1コース勝率の差分ベースで適切に調整されています`,
  );
} else if (avgError < 10) {
  console.log(
    `\n🟡 ある程度合致: アイディアの方向性は正しいが、個別調整がある`,
  );
} else {
  console.log(`\n❌ 合致しない: アイディア以外の要因がある`);
}

console.log("\n" + "=".repeat(100) + "\n");
