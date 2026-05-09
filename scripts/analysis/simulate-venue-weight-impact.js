/**
 * 会場別重み適用時のシミュレーション
 * 過去データで新しい重みを使ってスコアを再計算し、効果を測定
 *
 * 実行: node scripts/analysis/simulate-venue-weight-impact.js [VENUE_CODE]
 * 例:   node scripts/analysis/simulate-venue-weight-impact.js 05
 */
import { supabase } from "../lib/supabaseClient.js";

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

// デフォルト重み
const DEFAULT_WEIGHTS = {
  winRate: 0.42,
  avgST: 0.38,
  sigma: 0.05,
  venue: 0.03,
};

// 既存の会場別重み（新規追加前）
const CURRENT_WEIGHTS = {
  "03": { avgST: 0.46, winRate: 0.34 },
  "09": { avgST: 0.44, winRate: 0.36 },
};

// 新しい会場別重み（提案値）
const NEW_WEIGHTS = {
  ...CURRENT_WEIGHTS,
  "05": { avgST: 0.44, winRate: 0.36 },
  12: { avgST: 0.44, winRate: 0.36 },
};

function getVolatilityLevel(score, venueCode) {
  const VENUE_VOLATILITY_THRESHOLD = {
    "01": 60,
    "02": 55,
    "03": 70,
    "04": 70,
    "05": 75,
    "06": 50,
    "07": 60,
    "08": 60,
    "09": 45,
    10: 60,
    11: 65,
    12: 70,
    13: 55,
    14: 55,
    15: 60,
    16: 55,
    17: 65,
    18: 60,
    19: 60,
    20: 50,
    21: 60,
    22: 65,
    23: 50,
    24: 65,
  };
  const highThr = VENUE_VOLATILITY_THRESHOLD[venueCode] ?? 65;
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

function calculateScore(boat1WinRate, boat1ST, winRateStddev, weightOverride) {
  const W = {
    winRate: weightOverride?.winRate ?? DEFAULT_WEIGHTS.winRate,
    avgST: weightOverride?.avgST ?? DEFAULT_WEIGHTS.avgST,
    sigma: DEFAULT_WEIGHTS.sigma,
    venue: DEFAULT_WEIGHTS.venue,
  };

  // A. 1号艇の全国勝率 (0-8.5を正規化)
  const normWinRate = 1 - Math.min(1, Math.max(0, boat1WinRate / 8.5));

  // B. 1号艇の今節avgST (0.07-0.34を正規化)
  const normST = Math.min(1, Math.max(0, (boat1ST - 0.07) / (0.34 - 0.07)));

  // D. 選手間の勝率σ (0.06-2.75を正規化)
  const normSigma = Math.min(
    1,
    Math.max(0, (winRateStddev - 0.06) / (2.75 - 0.06)),
  );

  // E. 会場の1コース勝率（簡略：中立値）
  const normVenue = 0.5;

  const totalWeight = W.winRate + W.avgST + W.sigma + W.venue;
  const composite =
    (normWinRate * W.winRate +
      normST * W.avgST +
      normSigma * W.sigma +
      normVenue * W.venue) /
    totalWeight;

  const finalScore = Math.round(30 + composite * 40);
  return finalScore;
}

async function simulateVenueImpact(venueCode, daysBack = 90) {
  try {
    console.log(`\n${"=".repeat(80)}`);
    console.log(
      `🔬 会場別重み適用シミュレーション: ${VENUE_NAMES[venueCode]} (${venueCode})`,
    );
    console.log(`分析期間: 過去${daysBack}日\n`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const formattedDate = startDate.toISOString().split("T")[0];

    const { data: races, error } = await supabase
      .from("races")
      .select(
        "race_id, race_date, volatility_score, volatility_level, first_boat_win_rate, first_boat_avg_st, win_rate_stddev",
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

    console.log(`📊 対象データ: ${races.length}レース\n`);

    const results = [];
    const currentWeightData = CURRENT_WEIGHTS[venueCode];
    const newWeightData = NEW_WEIGHTS[venueCode];

    for (const race of races) {
      if (
        race.first_boat_win_rate == null ||
        race.first_boat_avg_st == null ||
        race.win_rate_stddev == null
      ) {
        continue;
      }

      const scoreWithCurrent = calculateScore(
        race.first_boat_win_rate,
        race.first_boat_avg_st,
        race.win_rate_stddev,
        currentWeightData,
      );

      const scoreWithNew = calculateScore(
        race.first_boat_win_rate,
        race.first_boat_avg_st,
        race.win_rate_stddev,
        newWeightData,
      );

      const levelCurrent = getVolatilityLevel(scoreWithCurrent, venueCode);
      const levelNew = getVolatilityLevel(scoreWithNew, venueCode);

      results.push({
        scoreCurrent: scoreWithCurrent,
        scoreNew: scoreWithNew,
        scoreDiff: scoreWithNew - scoreWithCurrent,
        levelCurrent,
        levelNew,
        levelChanged: levelCurrent !== levelNew,
      });
    }

    if (results.length === 0) {
      console.log(`❌ シミュレーション対象データなし`);
      return;
    }

    const currentScores = results.map((r) => r.scoreCurrent);
    const newScores = results.map((r) => r.scoreNew);
    const diffs = results.map((r) => r.scoreDiff);

    const currentLevels = { low: 0, medium: 0, high: 0 };
    const newLevels = { low: 0, medium: 0, high: 0 };
    const changed = results.filter((r) => r.levelChanged).length;

    results.forEach((r) => {
      currentLevels[r.levelCurrent]++;
      newLevels[r.levelNew]++;
    });

    const total = results.length;

    console.log(`📈 スコア分布の変化:\n`);
    console.log(`  現在（デフォルト重み）:`);
    console.log(
      `    最小: ${Math.min(...currentScores)}, 最大: ${Math.max(...currentScores)}, 平均: ${(currentScores.reduce((a, b) => a + b) / currentScores.length).toFixed(2)}`,
    );
    console.log(
      `    Low: ${currentLevels.low} (${((currentLevels.low / total) * 100).toFixed(1)}%), Medium: ${currentLevels.medium} (${((currentLevels.medium / total) * 100).toFixed(1)}%), High: ${currentLevels.high} (${((currentLevels.high / total) * 100).toFixed(1)}%)\n`,
    );

    console.log(`  新規（会場別重み）:`);
    console.log(
      `    最小: ${Math.min(...newScores)}, 最大: ${Math.max(...newScores)}, 平均: ${(newScores.reduce((a, b) => a + b) / newScores.length).toFixed(2)}`,
    );
    console.log(
      `    Low: ${newLevels.low} (${((newLevels.low / total) * 100).toFixed(1)}%), Medium: ${newLevels.medium} (${((newLevels.medium / total) * 100).toFixed(1)}%), High: ${newLevels.high} (${((newLevels.high / total) * 100).toFixed(1)}%)\n`,
    );

    console.log(`⚡ スコア変化:\n`);
    console.log(
      `  平均差分: ${(diffs.reduce((a, b) => a + b) / diffs.length).toFixed(2)}`,
    );
    console.log(
      `  最大上昇: +${Math.max(...diffs)}, 最大低下: ${Math.min(...diffs)}`,
    );
    console.log(
      `  分類が変わったレース: ${changed} / ${total} (${((changed / total) * 100).toFixed(1)}%)\n`,
    );

    if (changed > 0) {
      const changes = results.filter((r) => r.levelChanged);
      const changeTypes = {};
      changes.forEach((c) => {
        const key = `${c.levelCurrent}→${c.levelNew}`;
        changeTypes[key] = (changeTypes[key] || 0) + 1;
      });

      console.log(`🔄 分類変化の詳細:\n`);
      Object.entries(changeTypes).forEach(([key, count]) => {
        console.log(
          `  ${key}: ${count}件 (${((count / total) * 100).toFixed(1)}%)`,
        );
      });
    }

    console.log(`\n💡 結論:`);
    if (newLevels.low < currentLevels.low) {
      const reduction = currentLevels.low - newLevels.low;
      const pctReduction = ((reduction / currentLevels.low) * 100).toFixed(1);
      console.log(
        `  ✅ Low分類が減少: ${currentLevels.low} → ${newLevels.low} (${pctReduction}%削減)`,
      );
      console.log(`  ✅ 期待通りの改善が見込まれます\n`);
    } else {
      console.log(`  ⚠️  Low分類は変わらず: ${currentLevels.low} のまま`);
      console.log(`  ⚠️  重みの調整が不足している可能性\n`);
    }

    console.log(`${"=".repeat(80)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

const venueCode = (process.argv[2] || "").padStart(2, "0");

if (!venueCode || venueCode === "00") {
  console.log(
    "使用方法: node scripts/analysis/simulate-venue-weight-impact.js [VENUE_CODE]",
  );
  console.log("例: node scripts/analysis/simulate-venue-weight-impact.js 05");
  process.exit(1);
}

await simulateVenueImpact(venueCode, 90);
