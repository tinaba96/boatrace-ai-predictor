/**
 * 展開予測の正確性分析（決まり手+1着コース両方の一致判定）
 *
 * 3つのいずれかではなく、正確な展開予測の精度を会場別に計測
 * patterns[0]（最有力予測）の technique と winnerCourse が両方一致したかで判定
 *
 * 期間: 2026-03-10 ～ 2026-05-17
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  console.log(
    "🚀 展開予測の正確性分析を開始します（決まり手+1着コース両方判定）\n",
  );
  console.log("📅 分析期間: 2026-03-10 ～ 2026-05-17\n");

  try {
    const startDate = "2026-03-10";
    const endDate = "2026-05-17";

    // 1. race_results から該当レースを取得
    console.log("📊 データ取得中...\n");

    const { data: raceResults } = await supabase
      .from("race_results")
      .select(
        "race_id, rank1, course_1, course_2, course_3, course_4, course_5, course_6, winning_technique",
      )
      .gte("race_id", startDate + "-00-00")
      .lte("race_id", endDate + "-99-99");

    console.log(`✅ race_results: ${raceResults?.length || 0}\n`);

    if (!raceResults || raceResults.length === 0) {
      console.log("⚠️  データがありません");
      return;
    }

    const raceIds = raceResults.map((r) => r.race_id);

    // 2. predictions を取得（standard モデルのみ、patterns[0]を使用）
    let allPredictions = [];
    for (let i = 0; i < raceIds.length; i += 100) {
      const batch = raceIds.slice(i, i + 100);
      const { data: preds } = await supabase
        .from("predictions")
        .select("race_id, feature_contributions")
        .in("race_id", batch)
        .eq("model_id", "standard");

      allPredictions = allPredictions.concat(preds || []);
    }

    console.log(`✅ predictions: ${allPredictions.length}\n`);

    // 3. races テーブルから venue_code を取得
    let racesInfo = [];
    for (let i = 0; i < raceIds.length; i += 100) {
      const batch = raceIds.slice(i, i + 100);
      const { data: races } = await supabase
        .from("races")
        .select("race_id, venue_code, race_number")
        .in("race_id", batch);

      racesInfo = racesInfo.concat(races || []);
    }

    console.log(`✅ races: ${racesInfo.length}\n`);

    // 4. データを結合して判定
    const racesById = {};
    for (const r of racesInfo) {
      racesById[r.race_id] = r;
    }

    const resultsById = {};
    for (const r of raceResults) {
      resultsById[r.race_id] = r;
    }

    const results = [];
    const venueResults = {};

    // 技術名マッピング（ローマ字 → 日本語）
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

    for (const pred of allPredictions) {
      const raceId = pred.race_id;
      const raceInfo = racesById[raceId];
      const raceResult = resultsById[raceId];

      if (!raceInfo || !raceResult) continue;

      const turnPrediction = pred.feature_contributions?.turnPrediction;
      if (
        !turnPrediction ||
        !turnPrediction.patterns ||
        turnPrediction.patterns.length === 0
      )
        continue;

      // patterns[0]（最有力予測）を取得
      const pattern0 = turnPrediction.patterns[0];
      const predictedTechniqueRomaji = pattern0.technique;
      const predictedCourse = pattern0.winnerCourse;

      if (!predictedTechniqueRomaji || !predictedCourse) continue;

      // ローマ字を日本語に変換
      const predictedTechnique = techniqueNameMap[predictedTechniqueRomaji] || predictedTechniqueRomaji;

      // 実際の1着コース
      const firstBoat = raceResult.rank1;
      if (!firstBoat) continue;

      const courseKey = `course_${firstBoat}`;
      const actualCourse = raceResult[courseKey];
      if (!actualCourse) continue;

      // 実際の決まり手
      const actualTechnique = raceResult.winning_technique;
      if (!actualTechnique) continue;

      // 判定: 技術と1着コース両方が一致したか
      const techniqueMatch = predictedTechnique === actualTechnique;
      const courseMatch = predictedCourse === actualCourse;
      const bothMatch = techniqueMatch && courseMatch;

      const resultEntry = {
        race_id: raceId,
        venue_code: raceInfo.venue_code,
        race_number: raceInfo.race_number,
        predicted_technique: predictedTechnique,
        predicted_course: predictedCourse,
        actual_technique: actualTechnique,
        actual_course: actualCourse,
        technique_match: techniqueMatch,
        course_match: courseMatch,
        both_match: bothMatch,
      };

      results.push(resultEntry);

      if (!venueResults[raceInfo.venue_code]) {
        venueResults[raceInfo.venue_code] = [];
      }
      venueResults[raceInfo.venue_code].push(resultEntry);
    }

    // 5. 集計・表示
    console.log(
      "📊 === 正確な展開予測分析結果（決まり手+1着コース両方判定） ===\n",
    );

    const totalBothMatch = results.filter((r) => r.both_match).length;
    const totalTechniqueMatch = results.filter((r) => r.technique_match).length;
    const totalCourseMatch = results.filter((r) => r.course_match).length;
    const bothMatchRate = ((totalBothMatch / results.length) * 100).toFixed(2);
    const techniqueMatchRate = (
      (totalTechniqueMatch / results.length) *
      100
    ).toFixed(2);
    const courseMatchRate = ((totalCourseMatch / results.length) * 100).toFixed(
      2,
    );

    console.log(`全体（${results.length}レース）\n`);
    console.log(
      `  決まり手+1着コース両方的中: ${totalBothMatch} (${bothMatchRate}%)`,
    );
    console.log(
      `  決まり手のみ的中: ${totalTechniqueMatch} (${techniqueMatchRate}%)`,
    );
    console.log(
      `  1着コースのみ的中: ${totalCourseMatch} (${courseMatchRate}%)`,
    );
    console.log(
      `  両方外れ: ${results.length - totalBothMatch - (totalTechniqueMatch - totalBothMatch) - (totalCourseMatch - totalBothMatch)} `,
    );
    console.log();

    // 会場別
    console.log("🏟️  === 会場別：正確な展開予測精度 ===\n");

    const venues = Object.entries(venueResults)
      .map(([code, data]) => {
        const bothMatch = data.filter((r) => r.both_match).length;
        const techniqueMatch = data.filter((r) => r.technique_match).length;
        const courseMatch = data.filter((r) => r.course_match).length;
        const both = ((bothMatch / data.length) * 100).toFixed(2);
        const tech = ((techniqueMatch / data.length) * 100).toFixed(2);
        const course = ((courseMatch / data.length) * 100).toFixed(2);

        return {
          code,
          name: VENUE_NAMES[code] || `会場${code}`,
          total: data.length,
          both_match: bothMatch,
          both_rate: parseFloat(both),
          technique_match: techniqueMatch,
          technique_rate: parseFloat(tech),
          course_match: courseMatch,
          course_rate: parseFloat(course),
        };
      })
      .sort((a, b) => b.both_rate - a.both_rate);

    for (const v of venues) {
      console.log(`${v.code}:${v.name}`);
      console.log(
        `  対象: ${v.total}  両方的中: ${v.both_match}(${v.both_rate.toFixed(2)}%)  決まり手のみ: ${v.technique_match}(${v.technique_rate.toFixed(2)}%)  コースのみ: ${v.course_match}(${v.course_rate.toFixed(2)}%)`,
      );
    }

    // 6. JSON 保存
    const summary = {
      analysis_date: new Date().toISOString().split("T")[0],
      period: { start: startDate, end: endDate },
      analysis_type: "patterns[0]（最有力予測）の決まり手+1着コース両方判定",
      total_races: results.length,
      overall: {
        total: results.length,
        both_match: totalBothMatch,
        both_match_rate: parseFloat(bothMatchRate),
        technique_match: totalTechniqueMatch,
        technique_match_rate: parseFloat(techniqueMatchRate),
        course_match: totalCourseMatch,
        course_match_rate: parseFloat(courseMatchRate),
        both_miss: results.length - totalBothMatch,
        both_miss_rate: (100 - parseFloat(bothMatchRate)).toFixed(2),
      },
      by_venue: venues,
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      "turn-prediction-exact-accuracy-by-venue.json",
    );
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

main();
