/**
 * 低精度会場の不正解パターン詳細分析
 *
 * 会場: 桐生(33.33%), 鳴門(35.42%), 戸田(36.11%), 平和島(43.33%)
 * 不正解を分類:
 * - 決まり手だけ当たった（1着コース外れ）
 * - 1着コースだけ当たった（決まり手外れ）
 * - 両方外れた
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  console.log("🚀 低精度会場の不正解パターン分析を開始します\n");

  try {
    const startDate = "2026-03-10";
    const endDate = "2026-05-17";
    const lowAccuracyVenues = ["1", "14", "2", "4"]; // 桐生, 鳴門, 戸田, 平和島

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
      1: "桐生",
      2: "戸田",
      4: "平和島",
      14: "鳴門",
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
      .in("venue_code", lowAccuracyVenues);

    const targetRaceIds = racesInfo.map((r) => r.race_id);
    console.log(`📊 対象レース（低精度4会場）: ${targetRaceIds.length}\n`);

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
    for (const venue of lowAccuracyVenues) {
      venueAnalysis[venue] = {
        venue_name: VENUE_NAMES[venue],
        total: 0,
        correct: { count: 0, races: [] },
        technique_only: { count: 0, races: [], patterns: {} },
        course_only: { count: 0, races: [], patterns: {} },
        both_miss: { count: 0, races: [], patterns: {} },
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
      } else if (techniqueMatch && !courseMatch) {
        venueAnalysis[venueCode].technique_only.count++;
        venueAnalysis[venueCode].technique_only.races.push(resultEntry);
        const patternKey = `${actualTechnique} 予測コース${predictedCourse}→実${actualCourse}`;
        venueAnalysis[venueCode].technique_only.patterns[patternKey] =
          (venueAnalysis[venueCode].technique_only.patterns[patternKey] || 0) +
          1;
      } else if (!techniqueMatch && courseMatch) {
        venueAnalysis[venueCode].course_only.count++;
        venueAnalysis[venueCode].course_only.races.push(resultEntry);
        const patternKey = `予測${predictedTechnique}→実${actualTechnique} (1着は${actualCourse}コース)`;
        venueAnalysis[venueCode].course_only.patterns[patternKey] =
          (venueAnalysis[venueCode].course_only.patterns[patternKey] || 0) + 1;
      } else {
        venueAnalysis[venueCode].both_miss.count++;
        venueAnalysis[venueCode].both_miss.races.push(resultEntry);
        const patternKey = `予測${predictedTechnique}→実${actualTechnique} 予測${predictedCourse}→実${actualCourse}`;
        venueAnalysis[venueCode].both_miss.patterns[patternKey] =
          (venueAnalysis[venueCode].both_miss.patterns[patternKey] || 0) + 1;
      }
    }

    // 5. 表示・分析
    console.log("📋 === 低精度4会場の不正解パターン分析 ===\n");

    for (const venue of lowAccuracyVenues) {
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

      if (analysis.technique_only.count > 0) {
        const rate = (
          (analysis.technique_only.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(
          `   ✓ 決まり手は当たったが、1着コース外れ: ${analysis.technique_only.count} (${rate}%)`,
        );
        console.log(`     最多パターン:`);
        const sortedTech = Object.entries(analysis.technique_only.patterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        for (const [pattern, count] of sortedTech) {
          console.log(`       - ${pattern}: ${count}件`);
        }
      }

      if (analysis.course_only.count > 0) {
        const rate = (
          (analysis.course_only.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(
          `   ✓ 1着コースは当たったが、決まり手外れ: ${analysis.course_only.count} (${rate}%)`,
        );
        console.log(`     最多パターン:`);
        const sortedCourse = Object.entries(analysis.course_only.patterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        for (const [pattern, count] of sortedCourse) {
          console.log(`       - ${pattern}: ${count}件`);
        }
      }

      if (analysis.both_miss.count > 0) {
        const rate = (
          (analysis.both_miss.count / analysis.total) *
          100
        ).toFixed(2);
        console.log(`   ✗ 両方外れ: ${analysis.both_miss.count} (${rate}%)`);
        console.log(`     最多パターン:`);
        const sortedMiss = Object.entries(analysis.both_miss.patterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        for (const [pattern, count] of sortedMiss) {
          console.log(`       - ${pattern}: ${count}件`);
        }
      }
    }

    // 6. JSON 保存
    const summary = {
      analysis_date: new Date().toISOString().split("T")[0],
      period: { start: startDate, end: endDate },
      target_venues: lowAccuracyVenues.map((v) => ({
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
          technique_only_count: data.technique_only.count,
          technique_only_rate: (
            (data.technique_only.count / data.total) *
            100
          ).toFixed(2),
          technique_only_patterns: Object.entries(data.technique_only.patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count })),
          course_only_count: data.course_only.count,
          course_only_rate: (
            (data.course_only.count / data.total) *
            100
          ).toFixed(2),
          course_only_patterns: Object.entries(data.course_only.patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count })),
          both_miss_count: data.both_miss.count,
          both_miss_rate: ((data.both_miss.count / data.total) * 100).toFixed(
            2,
          ),
          both_miss_patterns: Object.entries(data.both_miss.patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count })),
        })),
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      "low-accuracy-venues-error-patterns.json",
    );
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 詳細結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

main();
