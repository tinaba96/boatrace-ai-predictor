/**
 * 高精度会場の成功パターン分析
 *
 * 会場: 下関(86.36%), 宮島(66.67%), 大村(64.58%)
 * 何が上手くいっているのかを調べる
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  console.log("🚀 高精度会場の成功要因分析を開始します\n");

  try {
    const startDate = "2026-03-10";
    const endDate = "2026-05-17";
    const highAccuracyVenues = ["19", "17", "24"]; // 下関, 宮島, 大村

    // 技術名マッピング
    const techniqueNameMap = {
      nige: "逃げ",
      sashi: "差し",
      makuri: "まくり",
      makurizashi: "まくり差し",
      nuki: "抜き",
      megumare: "恵まれ",
    };

    const VENUE_NAMES = {
      19: "下関",
      17: "宮島",
      24: "大村",
    };

    // 1. race_results を取得
    const { data: raceResults } = await supabase
      .from("race_results")
      .select(
        "race_id, rank1, course_1, course_2, course_3, course_4, course_5, course_6, winning_technique",
      )
      .gte("race_id", startDate + "-00-00")
      .lte("race_id", endDate + "-99-99");

    // 2. races テーブルから venue_code でフィルタ
    const { data: racesInfo } = await supabase
      .from("races")
      .select("race_id, venue_code, race_number")
      .gte("race_id", startDate + "-00-00")
      .lte("race_id", endDate + "-99-99")
      .in("venue_code", highAccuracyVenues);

    const targetRaceIds = racesInfo.map((r) => r.race_id);
    console.log(`📊 対象レース（高精度3会場）: ${targetRaceIds.length}\n`);

    // 3. predictions を取得
    let allPredictions = [];
    for (let i = 0; i < targetRaceIds.length; i += 100) {
      const batch = targetRaceIds.slice(i, i + 100);
      const { data: preds } = await supabase
        .from("predictions")
        .select("race_id, feature_contributions")
        .in("race_id", batch)
        .eq("model_id", "standard");

      allPredictions = allPredictions.concat(preds || []);
    }

    // データオブジェクト化
    const racesById = {};
    for (const r of racesInfo) {
      racesById[r.race_id] = r;
    }

    const resultsById = {};
    for (const r of raceResults || []) {
      resultsById[r.race_id] = r;
    }

    // 4. 分析
    const venueAnalysis = {};
    for (const venue of highAccuracyVenues) {
      venueAnalysis[venue] = {
        venue_name: VENUE_NAMES[venue],
        total: 0,
        correct: { count: 0, races: [], by_technique: {} },
        technique_only: { count: 0, races: [] },
        course_only: { count: 0, races: [] },
        both_miss: { count: 0, races: [] },
      };
    }

    for (const pred of allPredictions) {
      const raceId = pred.race_id;
      const raceInfo = racesById[raceId];
      const raceResult = resultsById[raceId];

      if (!raceInfo || !raceResult) continue;

      const venueCode = String(raceInfo.venue_code);
      if (!venueAnalysis[venueCode]) continue;

      const turnPrediction = pred.feature_contributions?.turnPrediction;
      if (
        !turnPrediction ||
        !turnPrediction.patterns ||
        turnPrediction.patterns.length === 0
      )
        continue;

      const pattern0 = turnPrediction.patterns[0];
      const predictedTechniqueRomaji = pattern0.technique;
      const predictedCourse = pattern0.winnerCourse;

      if (!predictedTechniqueRomaji || !predictedCourse) continue;

      const predictedTechnique =
        techniqueNameMap[predictedTechniqueRomaji] || predictedTechniqueRomaji;

      const firstBoat = raceResult.rank1;
      if (!firstBoat) continue;

      const courseKey = `course_${firstBoat}`;
      const actualCourse = raceResult[courseKey];
      if (!actualCourse) continue;

      const actualTechnique = raceResult.winning_technique;
      if (!actualTechnique) continue;

      const techniqueMatch = predictedTechnique === actualTechnique;
      const courseMatch = predictedCourse === actualCourse;

      venueAnalysis[venueCode].total++;

      const resultEntry = {
        race_id: raceId,
        race_number: raceInfo.race_number,
        predicted_technique: predictedTechnique,
        predicted_course: predictedCourse,
        actual_technique: actualTechnique,
        actual_course: actualCourse,
      };

      if (techniqueMatch && courseMatch) {
        venueAnalysis[venueCode].correct.count++;
        venueAnalysis[venueCode].correct.races.push(resultEntry);

        // 技術別の正確予測数を集計
        if (!venueAnalysis[venueCode].correct.by_technique[actualTechnique]) {
          venueAnalysis[venueCode].correct.by_technique[actualTechnique] = 0;
        }
        venueAnalysis[venueCode].correct.by_technique[actualTechnique]++;
      } else if (techniqueMatch && !courseMatch) {
        venueAnalysis[venueCode].technique_only.count++;
        venueAnalysis[venueCode].technique_only.races.push(resultEntry);
      } else if (!techniqueMatch && courseMatch) {
        venueAnalysis[venueCode].course_only.count++;
        venueAnalysis[venueCode].course_only.races.push(resultEntry);
      } else {
        venueAnalysis[venueCode].both_miss.count++;
        venueAnalysis[venueCode].both_miss.races.push(resultEntry);
      }
    }

    // 5. 表示・分析
    console.log("📋 === 高精度3会場の成功要因分析 ===\n");

    for (const venue of highAccuracyVenues) {
      const analysis = venueAnalysis[venue];
      if (analysis.total === 0) continue;

      const correctRate = (
        (analysis.correct.count / analysis.total) *
        100
      ).toFixed(2);

      console.log(`\n🏟️ ${analysis.venue_name} (${analysis.total}レース)`);
      console.log(
        `   正確な展開予測: ${analysis.correct.count} (${correctRate}%)\n`,
      );

      // 技術別の成功率
      console.log(`   ✅ 成功要因（技術別）:`);
      const techniqueStats = Object.entries(analysis.correct.by_technique)
        .sort((a, b) => b[1] - a[1])
        .map(([tech, count]) => {
          // 全レースの中でこの技術が何件あるか計数
          const totalWithTech = analysis.correct.races.length; // 簡略版
          return { tech, count };
        });

      for (const { tech, count } of techniqueStats) {
        console.log(`       - ${tech}: ${count}件が正確に予測された`);
      }

      if (analysis.technique_only.count > 0) {
        const rate = (
          (analysis.technique_only.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(
          `\n   📍 決まり手は当たったが1着コース外れ: ${analysis.technique_only.count} (${rate}%)`,
        );
      }

      if (analysis.course_only.count > 0) {
        const rate = (
          (analysis.course_only.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(
          `   📍 1着コースは当たったが決まり手外れ: ${analysis.course_only.count} (${rate}%)`,
        );
      }

      if (analysis.both_miss.count > 0) {
        const rate = (
          (analysis.both_miss.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(`\n   ❌ 両方外れ: ${analysis.both_miss.count} (${rate}%)`);
      }
    }

    // 6. 3会場の共通特性を分析
    console.log("\n\n🔍 === 高精度3会場の共通特性 ===\n");

    // 各会場での「逃げ」の的中率を計算
    for (const venue of highAccuracyVenues) {
      const analysis = venueAnalysis[venue];
      const nigeCorrect = analysis.correct.by_technique["逃げ"] || 0;
      const totalCorrect = analysis.correct.count;

      console.log(
        `${analysis.venue_name}: 正確予測${totalCorrect}件のうち、逃げが${nigeCorrect}件（${((nigeCorrect / totalCorrect) * 100).toFixed(1)}%）`,
      );
    }

    // 7. JSON 保存
    const summary = {
      analysis_date: new Date().toISOString().split("T")[0],
      period: { start: startDate, end: endDate },
      target_venues: highAccuracyVenues.map((v) => ({
        code: v,
        name: VENUE_NAMES[v],
      })),
      by_venue: Object.entries(venueAnalysis)
        .filter(([, data]) => data.total > 0)
        .map(([code, data]) => ({
          code,
          name: data.venue_name,
          total: data.total,
          correct_count: data.correct.count,
          correct_rate: ((data.correct.count / data.total) * 100).toFixed(2),
          correct_by_technique: data.correct.by_technique,
          technique_only_count: data.technique_only.count,
          technique_only_rate: (
            (data.technique_only.count / data.total) *
            100
          ).toFixed(2),
          course_only_count: data.course_only.count,
          course_only_rate: (
            (data.course_only.count / data.total) *
            100
          ).toFixed(2),
          both_miss_count: data.both_miss.count,
          both_miss_rate: ((data.both_miss.count / data.total) * 100).toFixed(
            2,
          ),
        })),
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      "high-accuracy-venues-success-factors.json",
    );
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 詳細結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

main();
