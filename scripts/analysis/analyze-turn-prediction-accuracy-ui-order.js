/**
 * 展開予測の的中率分析（UI表示順）
 *
 * distribution（技術別確率）で上位3つを取得し、その順序で的中判定
 * UIに表示される順序と同じ判定を行う
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
  console.log("🚀 展開予測の的中率分析を開始します（UI表示順）\n");

  try {
    // 直近90日（turnPredictionは2026-03-08以降のみ）
    const endDate = new Date();
    let startDate = addDays(endDate, -90);

    const minDate = new Date("2026-03-10");
    if (startDate < minDate) {
      startDate = minDate;
    }

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    console.log(`📅 分析期間: ${startDateStr} ～ ${endDateStr}\n`);

    // 1. 分析期間内の結果が存在するレース ID を取得
    const { data: resultRaceIds } = await supabase
      .from("race_results")
      .select("race_id")
      .gte("race_id", startDateStr + "-00-00")
      .lte("race_id", endDateStr + "-99-99");

    const targetRaceIds = resultRaceIds?.map((r) => r.race_id) || [];
    console.log(
      `✅ 分析期間内の結果が存在するレース: ${targetRaceIds.length}\n`,
    );

    if (targetRaceIds.length === 0) {
      console.log("⚠️  結果データがありません");
      return;
    }

    // 2. predictions を取得（standard モデルのみ、対象レースのみ）
    const batchSize = 100;
    let predictions = [];

    for (let i = 0; i < targetRaceIds.length; i += batchSize) {
      const batch = targetRaceIds.slice(i, i + batchSize);

      const { data: batchPreds } = await supabase
        .from("predictions")
        .select("prediction_id, race_id, model_id, feature_contributions")
        .in("race_id", batch)
        .eq("model_id", "standard");

      predictions = predictions.concat(batchPreds || []);
    }

    console.log(`✅ predictions 件数: ${predictions?.length || 0}\n`);

    // 3. turnPrediction がある予測をフィルタ
    const withTurnPred = predictions
      .map((p) => ({
        ...p,
        turnPrediction: p.feature_contributions?.turnPrediction,
      }))
      .filter((p) => p.turnPrediction && p.turnPrediction.distribution);

    console.log(`✅ turnPrediction がある予測: ${withTurnPred.length}\n`);

    if (withTurnPred.length === 0) {
      console.log("⚠️  turnPrediction がありません");
      return;
    }

    // 4. 各レースのデータを取得
    const raceIds = [...new Set(withTurnPred.map((p) => p.race_id))];

    const { data: races } = await supabase
      .from("races")
      .select("race_id, venue_code, race_number, race_date")
      .in("race_id", raceIds);

    const { data: raceResults } = await supabase
      .from("race_results")
      .select(
        "race_id, rank1, course_1, course_2, course_3, course_4, course_5, course_6",
      )
      .in("race_id", raceIds);

    // オブジェクト化
    const racesById = {};
    for (const r of races || []) {
      racesById[r.race_id] = r;
    }

    const resultsByRaceId = {};
    for (const r of raceResults || []) {
      resultsByRaceId[r.race_id] = r;
    }

    // 5. 的中判定（UI表示順の上位3つのいずれかに含まれるか）
    const results = [];
    const venueResults = {};

    const TECHNIQUE_NAMES = {
      nige: "逃げ",
      sashi: "差し",
      makuri: "まくり",
      nuki: "抜き",
      megumare: "めぐまれ",
      makurizashi: "まくり差し",
    };

    for (const pred of withTurnPred) {
      const raceResult = resultsByRaceId[pred.race_id];
      const raceInfo = racesById[pred.race_id];

      if (!raceResult || !raceInfo) continue;

      // 実際の1着艇のコースを取得
      const firstBoat = raceResult.rank1;
      if (!firstBoat) continue;

      const courseKey = `course_${firstBoat}`;
      const firstBoatCourse = raceResult[courseKey];

      if (!firstBoatCourse) continue;

      const turnPred = pred.turnPrediction;
      const distribution = turnPred.distribution;
      const patterns = turnPred.patterns || [];

      // distribution を確率でソート（UI表示順）
      const sortedTechs = Object.entries(distribution)
        .sort(([, probA], [, probB]) => probB - probA)
        .slice(0, 3); // 上位3つ

      // 各技術に対応する winnerCourse を取得
      const topTechs = sortedTechs.map(([tech, prob]) => {
        const pattern = patterns.find((p) => p.technique === tech);
        return {
          technique: tech,
          probability: prob,
          winnerCourse: pattern?.winnerCourse || null,
        };
      });

      // UI表示の上位3つの中に実際の1着コースが含まれたか判定
      const topCourses = topTechs
        .filter((t) => t.winnerCourse)
        .map((t) => t.winnerCourse)
        .slice(0, 3);

      const isHit = topCourses.includes(firstBoatCourse);

      // レース単位で1回だけ記録（上位3つのいずれかに的中したかで判定）
      const resultEntry = {
        race_id: pred.race_id,
        race_date: raceInfo.race_date,
        venue_code: raceInfo.venue_code,
        race_number: raceInfo.race_number,
        predicted_courses: topCourses,
        predicted_techniques: topTechs.slice(0, 3).map((t) => t.technique),
        actual_course: firstBoatCourse,
        hit: isHit,
      };

      results.push(resultEntry);

      if (!venueResults[raceInfo.venue_code]) {
        venueResults[raceInfo.venue_code] = [];
      }
      venueResults[raceInfo.venue_code].push(resultEntry);
    }

    // 6. 集計・表示
    console.log("📊 === 的中率分析結果（UI表示順の上位3つのいずれかで判定） ===\n");

    const totalHits = results.filter((r) => r.hit).length;
    const totalRate = ((totalHits / results.length) * 100).toFixed(2);
    console.log(
      `全体\n  対象レース数: ${results.length}\n  的中: ${totalHits}\n  的中率: ${totalRate}%\n`,
    );

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

    // 7. JSON 出力
    const summary = {
      analysis_date: formatDate(new Date()),
      period: { start: startDateStr, end: endDateStr },
      total_races: results.length,
      total_hits: totalHits,
      total_accuracy_rate: parseFloat(totalRate),
      note: "UI表示順の上位3つのいずれかのコースが実績と一致すれば的中",
      by_venue: venues,
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      "turn-prediction-accuracy-ui-order.json",
    );
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

analyzeTurnPredictionAccuracy();
