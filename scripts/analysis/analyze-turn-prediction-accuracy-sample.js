/**
 * 展開予測の的中率分析（簡略版・直近2週間）
 *
 * turnPrediction.patterns の上位3つが実際の展開と一致したかを測定
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function analyzeTurnPredictionAccuracy() {
  console.log("🚀 展開予測の的中率分析を開始します（直近14日）\n");

  try {
    // 直近90日（ただしturnPredictionは2026-03-08以降のみ）
    const endDate = new Date();
    let startDate = addDays(endDate, -90);

    // 2026-03-08 より前なら 2026-03-08 に設定
    const minDate = new Date("2026-03-08");
    if (startDate < minDate) {
      startDate = minDate;
    }

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    console.log(`📅 分析期間: ${startDateStr} ～ ${endDateStr}\n`);

    // 1. 分析期間内の結果が存在するレース ID を取得
    // race_id は "YYYY-MM-DD-venue-race" 形式なので、日付で範囲フィルタ可能
    const { data: resultRaceIds } = await supabase
      .from("race_results")
      .select("race_id")
      .gte("race_id", startDateStr)
      .lte("race_id", endDateStr + "-99-99"); // race_id の範囲フィルタ

    const targetRaceIds = resultRaceIds?.map((r) => r.race_id) || [];
    console.log(`✅ 分析期間内の結果が存在するレース: ${targetRaceIds.length}\n`);

    // 3. predictions を取得（standard モデルのみ、対象レースのみ）
    // ページネーションで取得
    const batchSize = 100;
    let predictions = [];

    for (let i = 0; i < targetRaceIds.length; i += batchSize) {
      const batch = targetRaceIds.slice(i, i + batchSize);

      const { data: batchPreds, error: batchError } = await supabase
        .from("predictions")
        .select("prediction_id, race_id, model_id, feature_contributions")
        .in("race_id", batch)
        .eq("model_id", "standard");

      if (batchError) {
        throw new Error(
          `Failed to fetch predictions: ${batchError.message}`,
        );
      }

      predictions = predictions.concat(batchPreds || []);
    }

    console.log(`✅ predictions 件数: ${predictions?.length || 0}\n`);

    if (!predictions || predictions.length === 0) {
      console.log("⚠️  分析対象のデータがありません");
      return;
    }

    // turnPrediction がある予測をフィルタ
    const withTurnPred = predictions
      .map((p) => ({
        ...p,
        turnPrediction: p.feature_contributions?.turnPrediction,
      }))
      .filter((p) => p.turnPrediction && p.turnPrediction.patterns);

    console.log(`✅ turnPrediction がある予測: ${withTurnPred.length}\n`);

    if (withTurnPred.length === 0) {
      console.log("⚠️  turnPrediction がありません");
      return;
    }

    // 各レースのデータを取得
    const raceIds = [...new Set(withTurnPred.map((p) => p.race_id))];
    console.log(`📋 対象レース数: ${raceIds.length}\n`);

    // races を取得
    const { data: races, error: racesError } = await supabase
      .from("races")
      .select("race_id, venue_code, race_number, race_date")
      .in("race_id", raceIds);

    if (racesError) console.log("❌ races error:", racesError.message);
    console.log(`✅ races 取得: ${races?.length || 0}`);

    // race_results を取得（rank1 と course_1～6）
    const { data: raceResults, error: resultsError } = await supabase
      .from("race_results")
      .select("race_id, rank1, course_1, course_2, course_3, course_4, course_5, course_6")
      .in("race_id", raceIds);

    if (resultsError) console.log("❌ race_results error:", resultsError.message);
    console.log(`✅ race_results 取得: ${raceResults?.length || 0}\n`);

    // オブジェクト化
    const racesById = {};
    for (const r of races || []) {
      racesById[r.race_id] = r;
    }

    const resultsByRaceId = {};
    for (const r of raceResults || []) {
      resultsByRaceId[r.race_id] = r;
    }

    // 的中判定
    const results = [];
    const patternResults = [[], [], []]; // patterns[0], [1], [2]
    const venueResults = {};

    for (const pred of withTurnPred) {
      const raceResult = resultsByRaceId[pred.race_id];
      const raceInfo = racesById[pred.race_id];

      if (!raceResult || !raceInfo) continue;

      // rank1 から1着艇番を取得、そのコースを取得
      const firstBoat = raceResult.rank1; // 1着艇番（1-6）
      if (!firstBoat) continue;

      // course_X カラムから1着艇のコースを取得
      const courseKey = `course_${firstBoat}`;
      const firstBoatCourse = raceResult[courseKey];

      if (!firstBoatCourse) continue;

      // patterns ごと
      const patterns = pred.turnPrediction.patterns || [];
      for (let i = 0; i < Math.min(3, patterns.length); i++) {
        const pattern = patterns[i];
        if (!pattern) continue;

        // winnerCourse を抽出
        const courses = Array.isArray(pattern.winnerCourse)
          ? pattern.winnerCourse.slice(0, 3)
          : [pattern.winnerCourse];

        const isHit = courses.includes(firstBoatCourse);

        const resultEntry = {
          race_id: pred.race_id,
          race_date: raceInfo.race_date,
          venue_code: raceInfo.venue_code,
          race_number: raceInfo.race_number,
          pattern_index: i,
          predicted_courses: courses,
          actual_course: firstBoatCourse,
          hit: isHit,
        };

        results.push(resultEntry);
        patternResults[i].push(resultEntry);

        if (!venueResults[raceInfo.venue_code]) {
          venueResults[raceInfo.venue_code] = [];
        }
        venueResults[raceInfo.venue_code].push(resultEntry);
      }
    }

    // 集計・表示
    console.log("📊 === 的中率分析結果 ===\n");

    const totalHits = results.filter((r) => r.hit).length;
    const totalRate = ((totalHits / results.length) * 100).toFixed(2);
    console.log(
      `全体\n  対象数: ${results.length}\n  的中: ${totalHits}\n  的中率: ${totalRate}%\n`,
    );

    const modelNames = [
      "safeBet（本命狙い）",
      "standard（スタンダード）",
      "upsetFocus（穴狙い）",
    ];
    console.log("📈 === パターン別的中率 ===\n");

    for (let i = 0; i < 3; i++) {
      const data = patternResults[i];
      if (data.length === 0) continue;

      const hits = data.filter((r) => r.hit).length;
      const rate = ((hits / data.length) * 100).toFixed(2);
      console.log(
        `patterns[${i}] ${modelNames[i]}\n  対象数: ${data.length}\n  的中: ${hits}\n  的中率: ${rate}%\n`,
      );
    }

    // 会場別
    console.log("🏟️  === 会場別的中率 ===\n");
    const VENUE_NAMES = {
      1: "桐生",
      2: "戸田",
      3: "江戸川",
      4: "平和島",
      5: "多摩川",
      6: "浜名湖",
      7: "蒲郡",
      8: "常滑",
      9: "津",
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

    const venues = Object.entries(venueResults)
      .map(([code, data]) => {
        const hits = data.filter((r) => r.hit).length;
        const rate = ((hits / data.length) * 100).toFixed(2);
        return {
          code,
          name: VENUE_NAMES[String(code)] || `会場${code}`,
          total: data.length,
          hits,
          rate: parseFloat(rate),
        };
      })
      .sort((a, b) => b.rate - a.rate);

    for (const v of venues) {
      console.log(
        `${v.code}:${v.name}\n  対象: ${v.total}  的中: ${v.hits}  的中率: ${v.rate.toFixed(2)}%`,
      );
    }

    // JSON 出力
    const summary = {
      analysis_date: formatDate(new Date()),
      period: { start: startDateStr, end: endDateStr },
      total_races: results.length,
      total_hits: totalHits,
      total_accuracy_rate: parseFloat(totalRate),
      by_model: [
        {
          model: "safeBet",
          total: patternResults[0].length,
          hits: patternResults[0].filter((r) => r.hit).length,
          accuracy_rate:
            patternResults[0].length > 0
              ? (
                  (patternResults[0].filter((r) => r.hit).length /
                    patternResults[0].length) *
                  100
                ).toFixed(2)
              : null,
        },
        {
          model: "standard",
          total: patternResults[1].length,
          hits: patternResults[1].filter((r) => r.hit).length,
          accuracy_rate:
            patternResults[1].length > 0
              ? (
                  (patternResults[1].filter((r) => r.hit).length /
                    patternResults[1].length) *
                  100
                ).toFixed(2)
              : null,
        },
        {
          model: "upsetFocus",
          total: patternResults[2].length,
          hits: patternResults[2].filter((r) => r.hit).length,
          accuracy_rate:
            patternResults[2].length > 0
              ? (
                  (patternResults[2].filter((r) => r.hit).length /
                    patternResults[2].length) *
                  100
                ).toFixed(2)
              : null,
        },
      ],
      by_venue: venues,
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "turn-prediction-accuracy.json");
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

analyzeTurnPredictionAccuracy();
