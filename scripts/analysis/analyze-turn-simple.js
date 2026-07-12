/**
 * 展開予測の的中率分析（シンプル版）
 * UI表示順の上位3つのいずれかが当たるか判定
 * 期間: 2026-03-10 ～ 2026-05-17
 */

import { supabase } from "../lib/supabaseClient.js";
import { promises as fs } from "fs";
import path from "path";

async function main() {
  console.log("🚀 展開予測の的中率分析を開始します\n");
  console.log("📅 分析期間: 2026-03-10 ～ 2026-05-17\n");

  try {
    const startDate = "2026-03-10";
    const endDate = "2026-05-17";

    // 1. race_results から該当レースを取得
    console.log("📊 データ取得中...\n");

    const { data: raceResults } = await supabase
      .from("race_results")
      .select(
        "race_id, rank1, course_1, course_2, course_3, course_4, course_5, course_6",
      )
      .gte("race_id", startDate + "-00-00")
      .lte("race_id", endDate + "-99-99");

    console.log(`✅ race_results: ${raceResults?.length || 0}\n`);

    if (!raceResults || raceResults.length === 0) {
      console.log("⚠️  データがありません");
      return;
    }

    const raceIds = raceResults.map((r) => r.race_id);

    // 2. predictions を取得（standard モデルのみ）
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
      if (!turnPrediction || !turnPrediction.distribution) continue;

      // 実際の1着コース
      const firstBoat = raceResult.rank1;
      if (!firstBoat) continue;

      const courseKey = `course_${firstBoat}`;
      const actualCourse = raceResult[courseKey];
      if (!actualCourse) continue;

      // UI表示順（distribution で上位3つ）
      const sortedTechs = Object.entries(turnPrediction.distribution)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      const patterns = turnPrediction.patterns || [];
      const topCourses = sortedTechs
        .map(([tech]) => {
          const p = patterns.find((pat) => pat.technique === tech);
          return p?.winnerCourse;
        })
        .filter((c) => c)
        .slice(0, 3);

      const isHit = topCourses.includes(actualCourse);

      results.push({
        race_id: raceId,
        venue_code: raceInfo.venue_code,
        race_number: raceInfo.race_number,
        predicted_courses: topCourses,
        actual_course: actualCourse,
        hit: isHit,
      });

      if (!venueResults[raceInfo.venue_code]) {
        venueResults[raceInfo.venue_code] = [];
      }
      venueResults[raceInfo.venue_code].push(isHit ? 1 : 0);
    }

    // 5. 集計
    console.log("📊 === 分析結果 ===\n");

    const hits = results.filter((r) => r.hit).length;
    const rate = ((hits / results.length) * 100).toFixed(2);

    console.log(
      `全体\n  対象レース: ${results.length}\n  的中: ${hits}\n  的中率: ${rate}%\n`,
    );

    console.log("🏟️  === 会場別的中率 ===\n");

    const venues = Object.entries(venueResults)
      .map(([code, hitsArray]) => {
        const hitCount = hitsArray.filter((h) => h).length;
        const venueRate = ((hitCount / hitsArray.length) * 100).toFixed(2);
        return {
          code,
          name: VENUE_NAMES[code] || `会場${code}`,
          total: hitsArray.length,
          hits: hitCount,
          rate: parseFloat(venueRate),
        };
      })
      .sort((a, b) => b.rate - a.rate);

    for (const v of venues) {
      console.log(`${v.code}:${v.name}`);
      console.log(
        `  対象: ${v.total}  的中: ${v.hits}  的中率: ${v.rate.toFixed(2)}%`,
      );
    }

    // 6. JSON 保存
    const summary = {
      analysis_date: new Date().toISOString().split("T")[0],
      period: { start: startDate, end: endDate },
      total_races: results.length,
      total_hits: hits,
      total_accuracy_rate: parseFloat(rate),
      by_venue: venues,
    };

    const outputDir = "data/analysis";
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      "turn-prediction-accuracy-final.json",
    );
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

    console.log(`\n💾 結果を保存: ${outputPath}`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

main();
