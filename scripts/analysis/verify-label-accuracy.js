/**
 * ラベル精度検証：予測ラベルと実際の結果の相関
 * 新しい動的閾値を過去データに適用し、
 * 各ラベル（low/medium/high）での1コース着順率を計測
 *
 * 実行: node scripts/analysis/verify-label-accuracy.js [VENUE_CODE] [DAYS]
 * 例:   node scripts/analysis/verify-label-accuracy.js 05 90
 */
import { supabase } from "../lib/supabaseClient.js";
import {
  VENUE_1COURSE_WIN_RATE,
  VENUE_1COURSE_AVG,
  VENUE_VOLATILITY_THRESHOLD,
  getVolatilityThreshold,
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

function getVolatilityLevelOld(score, venueCode) {
  const highThr = VENUE_VOLATILITY_THRESHOLD[venueCode] ?? 65;
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

function getVolatilityLevelNew(score, venueCode) {
  const highThr = getVolatilityThreshold(venueCode);
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

async function verifyLabelAccuracy(venueCode, daysBack = 90) {
  try {
    console.log(`\n${"=".repeat(100)}`);
    console.log(`🎯 ラベル精度検証: ${VENUE_NAMES[venueCode]} (${venueCode})`);
    console.log(`分析期間: 過去${daysBack}日\n`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const formattedDate = startDate.toISOString().split("T")[0];

    const { data: races, error } = await supabase
      .from("races")
      .select(
        `
        race_id, race_date, venue_code, volatility_score,
        race_results(rank1)
      `,
      )
      .eq("venue_code", parseInt(venueCode, 10))
      .gte("race_date", formattedDate)
      .not("volatility_score", "is", null)
      .order("race_date", { ascending: false });

    if (error) throw error;
    if (!races || races.length === 0) {
      console.log(`❌ データなし`);
      return;
    }

    console.log(`📊 対象レース: ${races.length}件\n`);

    // 結果データがあるレースのみを集計（完了レース）
    const completedRaces = races.filter(
      (r) => r.race_results && r.race_results.length > 0,
    );

    if (completedRaces.length === 0) {
      console.log(`❌ 完了レースがありません（結果データなし）`);
      return;
    }

    console.log(`✅ 完了済みレース: ${completedRaces.length}件\n`);

    const oldResults = {
      low: { count: 0, wins: 0 },
      medium: { count: 0, wins: 0 },
      high: { count: 0, wins: 0 },
    };
    const newResults = {
      low: { count: 0, wins: 0 },
      medium: { count: 0, wins: 0 },
      high: { count: 0, wins: 0 },
    };

    for (const race of completedRaces) {
      const score = race.volatility_score;
      const result = race.race_results[0];
      const isWin = result.rank1 === 1; // 1コースが1着

      // 旧計算
      const oldLabel = getVolatilityLevelOld(score, venueCode);
      oldResults[oldLabel].count++;
      if (isWin) oldResults[oldLabel].wins++;

      // 新計算
      const newLabel = getVolatilityLevelNew(score, venueCode);
      newResults[newLabel].count++;
      if (isWin) newResults[newLabel].wins++;
    }

    const oldThr = VENUE_VOLATILITY_THRESHOLD[venueCode] ?? 65;
    const newThr = getVolatilityThreshold(venueCode);

    console.log(`⚙️  閾値設定:\n`);
    console.log(`  旧: low上限=${Math.max(30, oldThr - 15)}, high=${oldThr}`);
    console.log(`  新: low上限=${Math.max(30, newThr - 15)}, high=${newThr}\n`);

    console.log(`📊 1コース着順率（旧計算）:\n`);
    console.log(`| ラベル | レース数 | 1コース着順 | 着順率 |`);
    console.log(`|--------|---------|-----------|--------|`);
    ["low", "medium", "high"].forEach((label) => {
      const data = oldResults[label];
      const rate =
        data.count > 0 ? ((data.wins / data.count) * 100).toFixed(1) : "-";
      console.log(`| ${label} | ${data.count} | ${data.wins} | ${rate}% |`);
    });

    const oldTotal = completedRaces.length;
    const oldTotalWins = Object.values(oldResults).reduce(
      (sum, d) => sum + d.wins,
      0,
    );
    console.log(
      `| 合計 | ${oldTotal} | ${oldTotalWins} | ${((oldTotalWins / oldTotal) * 100).toFixed(1)}% |`,
    );

    console.log(`\n📊 1コース着順率（新計算）:\n`);
    console.log(`| ラベル | レース数 | 1コース着順 | 着順率 |`);
    console.log(`|--------|---------|-----------|--------|`);
    ["low", "medium", "high"].forEach((label) => {
      const data = newResults[label];
      const rate =
        data.count > 0 ? ((data.wins / data.count) * 100).toFixed(1) : "-";
      console.log(`| ${label} | ${data.count} | ${data.wins} | ${rate}% |`);
    });

    const newTotal = completedRaces.length;
    const newTotalWins = Object.values(newResults).reduce(
      (sum, d) => sum + d.wins,
      0,
    );
    console.log(
      `| 合計 | ${newTotal} | ${newTotalWins} | ${((newTotalWins / newTotal) * 100).toFixed(1)}% |`,
    );

    console.log(`\n💡 分析:\n`);

    // 各ラベルの着順率が理想的か判定
    const oldLowRate =
      oldResults.low.count > 0 ? oldResults.low.wins / oldResults.low.count : 0;
    const oldMediumRate =
      oldResults.medium.count > 0
        ? oldResults.medium.wins / oldResults.medium.count
        : 0;
    const oldHighRate =
      oldResults.high.count > 0
        ? oldResults.high.wins / oldResults.high.count
        : 0;

    const newLowRate =
      newResults.low.count > 0 ? newResults.low.wins / newResults.low.count : 0;
    const newMediumRate =
      newResults.medium.count > 0
        ? newResults.medium.wins / newResults.medium.count
        : 0;
    const newHighRate =
      newResults.high.count > 0
        ? newResults.high.wins / newResults.high.count
        : 0;

    console.log(`旧計算：`);
    if (oldLowRate > oldMediumRate && oldMediumRate > oldHighRate) {
      console.log(`  ✅ Low > Medium > High の正しい傾向`);
    } else {
      console.log(
        `  ⚠️  順序が逆: ${oldLowRate.toFixed(2)} > ${oldMediumRate.toFixed(2)} > ${oldHighRate.toFixed(2)}`,
      );
    }
    console.log(
      `  - Low（本命有利）の着順率: ${(oldLowRate * 100).toFixed(1)}%`,
    );
    console.log(
      `  - 1コース勝率目安（${VENUE_1COURSE_WIN_RATE[venueCode].toFixed(2)}）との比較: ${oldLowRate > VENUE_1COURSE_WIN_RATE[venueCode] ? "高い ✅" : "低い ⚠️"}`,
    );

    console.log(`\n新計算：`);
    if (newLowRate > newMediumRate && newMediumRate > newHighRate) {
      console.log(`  ✅ Low > Medium > High の正しい傾向`);
    } else {
      console.log(
        `  ⚠️  順序が逆: ${newLowRate.toFixed(2)} > ${newMediumRate.toFixed(2)} > ${newHighRate.toFixed(2)}`,
      );
    }
    console.log(
      `  - Low（本命有利）の着順率: ${(newLowRate * 100).toFixed(1)}%`,
    );
    console.log(
      `  - 1コース勝率目安（${VENUE_1COURSE_WIN_RATE[venueCode].toFixed(2)}）との比較: ${newLowRate > VENUE_1COURSE_WIN_RATE[venueCode] ? "高い ✅" : "低い ⚠️"}`,
    );

    console.log(`\n${"=".repeat(100)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

const venueCode = (process.argv[2] || "").padStart(2, "0");
const daysBack = parseInt(process.argv[3], 10) || 90;

if (!venueCode || venueCode === "00") {
  console.log(
    "使用方法: node scripts/analysis/verify-label-accuracy.js [VENUE_CODE] [DAYS]",
  );
  console.log("例: node scripts/analysis/verify-label-accuracy.js 05 90");
  process.exit(1);
}

await verifyLabelAccuracy(venueCode, daysBack);
