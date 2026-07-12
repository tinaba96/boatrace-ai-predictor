/**
 * 展開予測の的中率分析
 *
 * turnPrediction.patterns（上位3つの展開パターン）が実際の展開と一致したかを測定
 * - パターン：winnerCourse（1着コース）の予測
 * - 実績：race_results から実際の1着艇 → race_entries からコース番号を抽出
 * - 判定：上位3パターンの中に実際の結果が含まれたか
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

// ===== 日付ユーティリティ =====
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

// ===== メイン分析 =====
async function analyzeTurnPredictionAccuracy() {
  console.log("🚀 展開予測の的中率分析を開始します\n");

  try {
    // 1. predictions を取得（turnPrediction.patterns がある直近90日分）
    const endDate = new Date();
    const startDate = addDays(endDate, -90);

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    console.log(`📅 分析期間: ${startDateStr} ～ ${endDateStr}\n`);

    // 2. predictions テーブルから過去データを取得
    // feature_contributions に turnPrediction が格納されている
    const { data: predictions, error: predictionsError } = await supabase
      .from("predictions")
      .select("prediction_id, race_id, predicted_at, model_id, feature_contributions")
      .gte("predicted_at", startDateStr)
      .lte("predicted_at", endDateStr)
      .eq("model_id", "standard") // standard モデルのみ（patterns がある）
      .order("predicted_at", { ascending: false })
      .limit(5000);

    if (predictionsError) {
      throw new Error(
        `Failed to fetch predictions: ${predictionsError.message}`,
      );
    }

    console.log(`✅ predictions 件数: ${predictions?.length || 0}\n`);

    if (!predictions || predictions.length === 0) {
      console.log("⚠️  分析対象のデータがありません");
      return;
    }

    // 3. race_ids から races と race_results を取得
    const raceIds = [...new Set(predictions.map((p) => p.race_id))];

    // ページネーションで取得（ネットワークエラー回避）
    const batchSize = 200;
    let races = [];
    let raceResults = [];

    for (let i = 0; i < raceIds.length; i += batchSize) {
      const batch = raceIds.slice(i, i + batchSize);

      const { data: racesBatch, error: racesError } = await supabase
        .from("races")
        .select("race_id, venue_code, race_number, race_date")
        .in("race_id", batch);

      if (racesError) {
        throw new Error(`Failed to fetch races: ${racesError.message}`);
      }

      races = races.concat(racesBatch || []);

      const { data: resultsBatch, error: resultsError } = await supabase
        .from("race_results")
        .select("race_id, first_boat")
        .in("race_id", batch);

      if (resultsError) {
        throw new Error(`Failed to fetch race_results: ${resultsError.message}`);
      }

      raceResults = raceResults.concat(resultsBatch || []);
    }

    // 4. オブジェクトに変換して join
    const racesById = {};
    for (const race of races || []) {
      racesById[race.race_id] = race;
    }

    const resultsByRaceId = {};
    for (const result of raceResults || []) {
      resultsByRaceId[result.race_id] = result;
    }

    // 5. turnPrediction を抽出して、結果が存在するレースのみを処理
    const resultsWithRaceInfo = predictions
      .filter((p) => {
        if (!resultsByRaceId[p.race_id] || !racesById[p.race_id]) return false;
        // feature_contributions から turnPrediction を抽出
        const featureContribs = p.feature_contributions;
        if (!featureContribs || !featureContribs.turnPrediction) return false;
        return true;
      })
      .map((p) => {
        const featureContribs = p.feature_contributions || {};
        return {
          ...p,
          turnPrediction: featureContribs.turnPrediction,
          race_results: resultsByRaceId[p.race_id],
          races: racesById[p.race_id],
        };
      });

    console.log(`✅ turnPrediction が存在するレース: ${resultsWithRaceInfo.length}\n`);

    if (resultsWithRaceInfo.length === 0) {
      console.log("⚠️  turnPrediction がありません（予測生成が 2026-03-08 以降である必要があります）");
      return;
    }

    // 6. 各レースの race_entries から1着艇のコース番号を取得

    const { data: raceEntries, error: entriesError } = await supabase
      .from("race_entries")
      .select("race_id, boat_number, course")
      .in("race_id", raceIds);

    if (entriesError) {
      throw new Error(`Failed to fetch race_entries: ${entriesError.message}`);
    }

    const entriesByRaceId = {};
    for (const entry of raceEntries || []) {
      if (!entriesByRaceId[entry.race_id]) {
        entriesByRaceId[entry.race_id] = {};
      }
      entriesByRaceId[entry.race_id][entry.boat_number] = entry.course;
    }

    // 5. 的中判定
    const results = [];
    const modelResults = { 0: [], 1: [], 2: [] }; // patterns[0], [1], [2] ごと
    const venueResults = {}; // 会場別

    for (const prediction of resultsWithRaceInfo) {
      const turnPrediction = prediction.turn_prediction;
      const raceResult = prediction.race_results[0];
      const raceInfo = prediction.races;

      // 実際の1着艇
      const firstBoat = raceResult.first_boat;
      const firstBoatCourse = entriesByRaceId[prediction.race_id]?.[firstBoat];

      if (!firstBoatCourse) {
        console.warn(
          `⚠️  コース情報が見つかりません: race_id=${prediction.race_id}, boat=${firstBoat}`,
        );
        continue;
      }

      // patterns ごとに判定
      if (turnPrediction && turnPrediction.patterns && Array.isArray(turnPrediction.patterns)) {
        for (let patternIdx = 0; patternIdx < Math.min(3, turnPrediction.patterns.length); patternIdx++) {
          const pattern = turnPrediction.patterns[patternIdx];

          if (!pattern) continue;

          // pattern.winnerCourse が単一値か配列か確認
          const winnerCourse = pattern.winnerCourse;
          const topCourses = Array.isArray(winnerCourse)
            ? winnerCourse.slice(0, 3)
            : [winnerCourse];

          // 実際の1着艇のコースが含まれたか
          const isHit = topCourses.includes(firstBoatCourse);

          const resultEntry = {
            race_id: prediction.race_id,
            race_date: raceInfo.race_date,
            venue_code: raceInfo.venue_code,
            race_number: raceInfo.race_number,
            pattern_index: patternIdx,
            predicted_courses: topCourses,
            actual_course: firstBoatCourse,
            actual_first_boat: firstBoat,
            predicted_probability: pattern.probability || null,
            predicted_technique: pattern.technique || null,
            hit: isHit,
          };

          results.push(resultEntry);
          modelResults[patternIdx].push(resultEntry);

          // 会場別集計
          if (!venueResults[raceInfo.venue_code]) {
            venueResults[raceInfo.venue_code] = [];
          }
          venueResults[raceInfo.venue_code].push(resultEntry);
        }
      }
    }

    // 6. 集計
    console.log("📊 === 的中率分析結果 ===\n");

    // 全体
    const totalHits = results.filter((r) => r.hit).length;
    const totalRate = ((totalHits / results.length) * 100).toFixed(2);
    console.log(
      `全体\n  対象数: ${results.length}\n  的中: ${totalHits}\n  的中率: ${totalRate}%\n`,
    );

    // パターンごと（モデル別）
    const modelNames = [
      "safeBet（本命狙い）",
      "standard（スタンダード）",
      "upsetFocus（穴狙い）",
    ];
    console.log("📈 === パターン別的中率 ===\n");

    for (let i = 0; i < 3; i++) {
      const modelData = modelResults[i];
      if (modelData.length === 0) continue;

      const hits = modelData.filter((r) => r.hit).length;
      const rate = ((hits / modelData.length) * 100).toFixed(2);
      console.log(`patterns[${i}] ${modelNames[i]}`);
      console.log(`  対象数: ${modelData.length}`);
      console.log(`  的中: ${hits}`);
      console.log(`  的中率: ${rate}%\n`);
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

    const venueArray = Object.entries(venueResults)
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

    for (const venue of venueArray) {
      console.log(`${venue.code}:${venue.name}`);
      console.log(
        `  対象数: ${venue.total}  的中: ${venue.hits}  的中率: ${venue.rate.toFixed(2)}%`,
      );
    }

    // 7. JSON 出力
    const summary = {
      analysis_date: formatDate(new Date()),
      period: { start: startDateStr, end: endDateStr },
      total_races: results.length,
      total_hits: totalHits,
      total_accuracy_rate: parseFloat(totalRate),
      by_model: [
        {
          model: "safeBet",
          total: modelResults[0].length,
          hits: modelResults[0].filter((r) => r.hit).length,
          accuracy_rate:
            modelResults[0].length > 0
              ? (
                  (modelResults[0].filter((r) => r.hit).length /
                    modelResults[0].length) *
                  100
                ).toFixed(2)
              : null,
        },
        {
          model: "standard",
          total: modelResults[1].length,
          hits: modelResults[1].filter((r) => r.hit).length,
          accuracy_rate:
            modelResults[1].length > 0
              ? (
                  (modelResults[1].filter((r) => r.hit).length /
                    modelResults[1].length) *
                  100
                ).toFixed(2)
              : null,
        },
        {
          model: "upsetFocus",
          total: modelResults[2].length,
          hits: modelResults[2].filter((r) => r.hit).length,
          accuracy_rate:
            modelResults[2].length > 0
              ? (
                  (modelResults[2].filter((r) => r.hit).length /
                    modelResults[2].length) *
                  100
                ).toFixed(2)
              : null,
        },
      ],
      by_venue: venueArray,
    };

    // ファイルに保存
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
