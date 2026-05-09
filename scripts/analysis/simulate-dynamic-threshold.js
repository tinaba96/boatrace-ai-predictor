/**
 * 動的閾値計算のシミュレーション
 * 過去データで新しい動的計算ロジックを適用し、効果を測定
 *
 * 実行: node scripts/analysis/simulate-dynamic-threshold.js [VENUE_CODE]
 * 例:   node scripts/analysis/simulate-dynamic-threshold.js 05
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

async function simulateDynamicThreshold(venueCode, daysBack = 90) {
  try {
    console.log(`\n${"=".repeat(90)}`);
    console.log(
      `🔬 動的閾値計算シミュレーション: ${VENUE_NAMES[venueCode]} (${venueCode})`,
    );
    console.log(`分析期間: 過去${daysBack}日\n`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const formattedDate = startDate.toISOString().split("T")[0];

    const { data: races, error } = await supabase
      .from("races")
      .select("race_id, volatility_score, volatility_level")
      .eq("venue_code", parseInt(venueCode, 10))
      .gte("race_date", formattedDate)
      .not("volatility_score", "is", null)
      .order("race_date", { ascending: false });

    if (error) throw error;
    if (!races || races.length === 0) {
      console.log(`❌ データなし`);
      return;
    }

    console.log(`📊 対象データ: ${races.length}レース\n`);

    const results = [];
    const oldThr = VENUE_VOLATILITY_THRESHOLD[venueCode] ?? 65;
    const newThr = getVolatilityThreshold(venueCode);

    for (const race of races) {
      const score = race.volatility_score;
      const levelOld = getVolatilityLevelOld(score, venueCode);
      const levelNew = getVolatilityLevelNew(score, venueCode);

      results.push({
        score,
        levelOld,
        levelNew,
        changed: levelOld !== levelNew,
      });
    }

    const scores = results.map((r) => r.score);
    const oldLevels = { low: 0, medium: 0, high: 0 };
    const newLevels = { low: 0, medium: 0, high: 0 };
    const changed = results.filter((r) => r.changed).length;

    results.forEach((r) => {
      oldLevels[r.levelOld]++;
      newLevels[r.levelNew]++;
    });

    const total = results.length;

    console.log(`📈 スコア分布:\n`);
    console.log(
      `  最小: ${Math.min(...scores)}, 最大: ${Math.max(...scores)}, 平均: ${(scores.reduce((a, b) => a + b) / scores.length).toFixed(2)}\n`,
    );

    console.log(`⚙️  閾値設定:\n`);
    console.log(
      `  旧計算（固定値）: low上限=${Math.max(30, oldThr - 15)}, high閾値=${oldThr}`,
    );
    console.log(
      `  新計算（動的）:   low上限=${Math.max(30, newThr - 15)}, high閾値=${newThr}`,
    );
    console.log(
      `  1コース勝率: ${VENUE_1COURSE_WIN_RATE[venueCode].toFixed(2)} (全国平均${VENUE_1COURSE_AVG.toFixed(2)})\n`,
    );

    console.log(`📊 分類結果の比較:\n`);
    console.log(`  旧計算（固定値）:`);
    console.log(
      `    Low:    ${oldLevels.low} (${((oldLevels.low / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `    Medium: ${oldLevels.medium} (${((oldLevels.medium / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `    High:   ${oldLevels.high} (${((oldLevels.high / total) * 100).toFixed(1)}%)\n`,
    );

    console.log(`  新計算（動的）:`);
    console.log(
      `    Low:    ${newLevels.low} (${((newLevels.low / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `    Medium: ${newLevels.medium} (${((newLevels.medium / total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `    High:   ${newLevels.high} (${((newLevels.high / total) * 100).toFixed(1)}%)\n`,
    );

    console.log(`⚡ 変化:\n`);
    console.log(
      `  分類が変わったレース: ${changed} / ${total} (${((changed / total) * 100).toFixed(1)}%)\n`,
    );

    if (changed > 0) {
      const changeMap = {};
      results
        .filter((r) => r.changed)
        .forEach((r) => {
          const key = `${r.levelOld}→${r.levelNew}`;
          changeMap[key] = (changeMap[key] || 0) + 1;
        });

      console.log(`🔄 分類変化:\n`);
      Object.entries(changeMap).forEach(([key, count]) => {
        console.log(
          `  ${key}: ${count}件 (${((count / total) * 100).toFixed(1)}%)`,
        );
      });
    }

    console.log(`\n💡 評価:\n`);

    if (oldLevels.low > newLevels.low) {
      const reduction = oldLevels.low - newLevels.low;
      const pctReduction = ((reduction / oldLevels.low) * 100).toFixed(1);
      console.log(
        `  ✅ Low分類が減少: ${oldLevels.low} → ${newLevels.low} (${pctReduction}%削減)`,
      );
      console.log(`  ✅ 期待通りの改善が確認されました\n`);
    } else if (oldLevels.low === newLevels.low) {
      console.log(`  ℹ️  Low分類は変わらず\n`);
    } else {
      console.log(`  ⚠️  Low分類が増加\n`);
    }

    console.log(`${"=".repeat(90)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

const venueCode = (process.argv[2] || "").padStart(2, "0");

if (!venueCode || venueCode === "00") {
  console.log(
    "使用方法: node scripts/analysis/simulate-dynamic-threshold.js [VENUE_CODE]",
  );
  console.log("例: node scripts/analysis/simulate-dynamic-threshold.js 05");
  process.exit(1);
}

await simulateDynamicThreshold(venueCode, 90);
