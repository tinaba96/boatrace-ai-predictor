/**
 * 展開予測（turnPrediction）の的中・不的中パターン比較分析
 *
 * turn-prediction-accuracy-final.js と同じ的中判定（UI表示順の上位3技術の
 * winnerCourse のいずれかが実際の1着コースと一致）を再現したうえで、
 * 的中レースと不的中レースの特徴を比較する。
 *
 * 比較軸:
 *  - 実際の決まり手（winning_technique）別の的中率
 *  - 予測トップ技術（最有力 technique）別の的中率
 *  - 1号艇のグレード（A1/A2/B1/B2）別の的中率
 *  - 実際の1着コース別の的中率
 *  - 予測トップ技術の確率帯別の的中率（予測の自信度）
 *  - 予測トップ技術 と 実際の決まり手 のズレ
 *
 * 出力: data/analysis/turn-prediction-pattern-comparison.json
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

// 決まり手の日本語 → 技術キー対応（turnPrediction の technique と突き合わせるため）
const TECHNIQUE_JP_TO_KEY = {
  逃げ: "nige",
  差し: "sashi",
  まくり: "makuri",
  まくり差し: "makurizashi",
  抜き: "nuki",
  恵まれ: "megumare",
};

const TECHNIQUE_NAMES = {
  nige: "逃げ",
  sashi: "差し",
  makuri: "まくり",
  makurizashi: "まくり差し",
  nuki: "抜き",
  megumare: "恵まれ",
};

const MIN_SAMPLE = 30;

function rate(hits, total) {
  return total > 0 ? parseFloat(((hits / total) * 100).toFixed(2)) : null;
}

async function main() {
  console.log("🚀 展開予測の的中・不的中パターン比較分析を開始\n");

  const endDate = new Date();
  let startDate = addDays(endDate, -90);
  const minDate = new Date("2026-03-10");
  if (startDate < minDate) startDate = minDate;

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  console.log(`📅 分析期間: ${startDateStr} ～ ${endDateStr}\n`);

  // 1. 対象期間の結果が存在するレース ID
  const { data: resultRaceIds, error: rrErr } = await supabase
    .from("race_results")
    .select("race_id")
    .gte("race_id", startDateStr + "-00-00")
    .lte("race_id", endDateStr + "-99-99");
  if (rrErr) throw new Error(`race_results 取得失敗: ${rrErr.message}`);

  const targetRaceIds = resultRaceIds?.map((r) => r.race_id) || [];
  console.log(`✅ 対象レース（結果あり）: ${targetRaceIds.length}\n`);

  // 2. predictions（standard モデル）
  const batchSize = 100;
  let predictions = [];
  for (let i = 0; i < targetRaceIds.length; i += batchSize) {
    const batch = targetRaceIds.slice(i, i + batchSize);
    const { data: batchPreds, error } = await supabase
      .from("predictions")
      .select("prediction_id, race_id, model_id, feature_contributions")
      .in("race_id", batch)
      .eq("model_id", "standard");
    if (error) throw new Error(`predictions 取得失敗: ${error.message}`);
    predictions = predictions.concat(batchPreds || []);
  }
  console.log(`✅ predictions（standard）: ${predictions.length}\n`);

  // 3. turnPrediction + distribution があるものに絞る
  const withTurnPred = predictions
    .map((p) => ({
      race_id: p.race_id,
      turnPrediction: p.feature_contributions?.turnPrediction,
    }))
    .filter((p) => p.turnPrediction && p.turnPrediction.distribution);
  console.log(`✅ turnPrediction あり: ${withTurnPred.length}\n`);

  const raceIds = [...new Set(withTurnPred.map((p) => p.race_id))];

  // 4. races / race_results / race_entries をバッチ取得
  let races = [];
  let raceResults = [];
  let raceEntries = [];
  for (let i = 0; i < raceIds.length; i += batchSize) {
    const batch = raceIds.slice(i, i + batchSize);

    const { data: r1 } = await supabase
      .from("races")
      .select("race_id, venue_code, race_number, race_date")
      .in("race_id", batch);
    races = races.concat(r1 || []);

    const { data: r2 } = await supabase
      .from("race_results")
      .select(
        "race_id, rank1, winning_technique, course_1, course_2, course_3, course_4, course_5, course_6, is_cancelled, is_no_race",
      )
      .in("race_id", batch);
    raceResults = raceResults.concat(r2 || []);

    const { data: r3 } = await supabase
      .from("race_entries")
      .select("race_id, boat_number, grade")
      .in("race_id", batch);
    raceEntries = raceEntries.concat(r3 || []);
  }

  const racesById = {};
  for (const r of races) racesById[r.race_id] = r;

  const resultsByRaceId = {};
  for (const r of raceResults) resultsByRaceId[r.race_id] = r;

  // race_entries: race_id -> { boat_number -> grade }
  const gradesByRaceId = {};
  for (const e of raceEntries) {
    if (!gradesByRaceId[e.race_id]) gradesByRaceId[e.race_id] = {};
    gradesByRaceId[e.race_id][e.boat_number] = e.grade;
  }

  // 5. 的中判定（UI表示順の上位3技術）
  const records = [];
  for (const pred of withTurnPred) {
    const raceResult = resultsByRaceId[pred.race_id];
    const raceInfo = racesById[pred.race_id];
    if (!raceResult || !raceInfo) continue;
    if (raceResult.is_cancelled || raceResult.is_no_race) continue;

    const firstBoat = raceResult.rank1;
    if (!firstBoat) continue;
    const firstBoatCourse = raceResult[`course_${firstBoat}`];
    if (!firstBoatCourse) continue;

    const tp = pred.turnPrediction;
    const distribution = tp.distribution;
    const patterns = tp.patterns || [];

    // distribution を確率降順でソート → 上位3技術
    const sortedTechs = Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const topTechKey = sortedTechs[0]?.[0] || null;
    const topTechProb = sortedTechs[0]?.[1] ?? null;

    // 上位3技術に対応する winnerCourse
    const topCourses = sortedTechs
      .map(([tech]) => patterns.find((p) => p.technique === tech)?.winnerCourse)
      .filter((c) => c != null)
      .slice(0, 3);

    const isHit = topCourses.includes(firstBoatCourse);

    // 実際の決まり手
    const actualTechJp = raceResult.winning_technique || null;
    const actualTechKey = actualTechJp
      ? TECHNIQUE_JP_TO_KEY[actualTechJp] || "other"
      : null;

    // 1号艇のグレード（race_entries の boat_number=1）
    const firstCourseGrade = gradesByRaceId[pred.race_id]?.[1] || null;

    records.push({
      race_id: pred.race_id,
      venue_code: raceInfo.venue_code,
      hit: isHit,
      predicted_top_technique: topTechKey,
      predicted_top_probability: topTechProb,
      predicted_courses: topCourses,
      actual_course: firstBoatCourse,
      actual_technique_jp: actualTechJp,
      actual_technique_key: actualTechKey,
      first_lane_grade: firstCourseGrade,
    });
  }

  const totalHits = records.filter((r) => r.hit).length;
  const totalMiss = records.length - totalHits;
  console.log(
    `📊 判定対象: ${records.length}  的中: ${totalHits}  不的中: ${totalMiss}  的中率: ${rate(totalHits, records.length)}%\n`,
  );

  // ===== 集計ヘルパー =====
  function aggregateBy(keyFn) {
    const buckets = {};
    for (const r of records) {
      const key = keyFn(r);
      if (key == null) continue;
      if (!buckets[key]) buckets[key] = { total: 0, hits: 0 };
      buckets[key].total++;
      if (r.hit) buckets[key].hits++;
    }
    const out = {};
    for (const [key, v] of Object.entries(buckets)) {
      out[key] = {
        total: v.total,
        hits: v.hits,
        miss: v.total - v.hits,
        hit_rate: rate(v.hits, v.total),
        miss_rate: rate(v.total - v.hits, v.total),
      };
    }
    return out;
  }

  // 6. 各軸で集計
  // 6-1. 実際の決まり手別
  const byActualTechnique = aggregateBy((r) =>
    r.actual_technique_jp ? r.actual_technique_jp : null,
  );

  // 6-2. 予測トップ技術別
  const byPredictedTechnique = aggregateBy((r) =>
    r.predicted_top_technique
      ? TECHNIQUE_NAMES[r.predicted_top_technique] || r.predicted_top_technique
      : null,
  );

  // 6-3. 1号艇グレード別
  const byFirstLaneGrade = aggregateBy((r) => r.first_lane_grade);

  // 6-4. 実際の1着コース別
  const byActualCourse = aggregateBy((r) =>
    r.actual_course ? `course_${r.actual_course}` : null,
  );

  // 6-5. 予測トップ技術の確率帯別
  const byProbabilityBand = aggregateBy((r) => {
    const p = r.predicted_top_probability;
    if (p == null) return null;
    if (p < 0.3) return "0.0-0.3 (低確信)";
    if (p < 0.4) return "0.3-0.4";
    if (p < 0.5) return "0.4-0.5";
    return "0.5+ (高確信)";
  });

  // 7. 不的中パターンの抽出（決まり手 × 外れやすさ）
  // 「実際にその決まり手で決まったレースのうち、何%を予測が外したか」
  const missPatterns = Object.entries(byActualTechnique)
    .filter(([, v]) => v.total >= MIN_SAMPLE)
    .map(([techJp, v]) => ({
      pattern: `決まり手「${techJp}」で決着したレース`,
      miss_count: v.miss,
      miss_rate: v.miss_rate,
      hit_rate: v.hit_rate,
      sample_size: v.total,
    }))
    .sort((a, b) => b.miss_rate - a.miss_rate);

  // 8. 予測トップ技術 vs 実際の決まり手のズレ（混同行列）
  const confusion = {};
  for (const r of records) {
    if (!r.predicted_top_technique || !r.actual_technique_key) continue;
    const pred = r.predicted_top_technique;
    const actual = r.actual_technique_key;
    if (!confusion[pred]) confusion[pred] = {};
    confusion[pred][actual] = (confusion[pred][actual] || 0) + 1;
  }
  // 予測トップ技術が実際と一致した割合
  const techniqueMatch = {};
  for (const [pred, actuals] of Object.entries(confusion)) {
    const total = Object.values(actuals).reduce((a, b) => a + b, 0);
    const matched = actuals[pred] || 0;
    techniqueMatch[TECHNIQUE_NAMES[pred] || pred] = {
      total,
      technique_matched: matched,
      technique_match_rate: rate(matched, total),
      actual_breakdown: Object.fromEntries(
        Object.entries(actuals).map(([k, v]) => [TECHNIQUE_NAMES[k] || k, v]),
      ),
    };
  }

  // 9. 的中レース vs 不的中レースのプロファイル比較
  function profile(subset) {
    const n = subset.length;
    if (n === 0) return null;
    const avgProb =
      subset.reduce((s, r) => s + (r.predicted_top_probability || 0), 0) / n;
    // 実際の1着コース分布
    const courseDist = {};
    for (const r of subset) {
      const k = `course_${r.actual_course}`;
      courseDist[k] = (courseDist[k] || 0) + 1;
    }
    // 実際の決まり手分布
    const techDist = {};
    for (const r of subset) {
      const k = r.actual_technique_jp || "不明";
      techDist[k] = (techDist[k] || 0) + 1;
    }
    return {
      count: n,
      avg_predicted_top_probability: parseFloat(avgProb.toFixed(4)),
      actual_course_distribution: courseDist,
      actual_technique_distribution: techDist,
    };
  }

  const hitProfile = profile(records.filter((r) => r.hit));
  const missProfile = profile(records.filter((r) => !r.hit));

  // 10. 出力
  const summary = {
    analysis_date: formatDate(new Date()),
    period: { start: startDateStr, end: endDateStr },
    method:
      "UI表示順（distribution確率の上位3技術）の winnerCourse のいずれかが実際の1着コースと一致すれば的中",
    min_sample_size: MIN_SAMPLE,
    total: {
      races: records.length,
      hits: totalHits,
      miss: totalMiss,
      hit_rate: rate(totalHits, records.length),
      miss_rate: rate(totalMiss, records.length),
    },
    miss_patterns: missPatterns,
    hit_rate_by_factor: {
      actual_technique: byActualTechnique,
      predicted_technique: byPredictedTechnique,
      first_lane_grade: byFirstLaneGrade,
      actual_course: byActualCourse,
      predicted_probability_band: byProbabilityBand,
    },
    predicted_vs_actual_technique: techniqueMatch,
    hit_profile: hitProfile,
    miss_profile: missProfile,
  };

  const outputPath = path.join(
    "data/analysis",
    "turn-prediction-pattern-comparison.json",
  );
  await fs.mkdir("data/analysis", { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

  // コンソールサマリ
  console.log("📈 === 不的中パターン（決まり手別、サンプル30以上） ===\n");
  for (const m of missPatterns) {
    console.log(
      `  ${m.pattern}\n    外れ率: ${m.miss_rate}%  外れ数: ${m.miss_count}/${m.sample_size}`,
    );
  }

  console.log("\n📈 === 1号艇グレード別 的中率 ===\n");
  for (const [grade, v] of Object.entries(byFirstLaneGrade).sort()) {
    const flag = v.total >= MIN_SAMPLE ? "" : "  (サンプル不足)";
    console.log(
      `  ${grade}: 的中率 ${v.hit_rate}%  (${v.hits}/${v.total})${flag}`,
    );
  }

  console.log("\n📈 === 実際の1着コース別 的中率 ===\n");
  for (const [c, v] of Object.entries(byActualCourse).sort()) {
    console.log(`  ${c}: 的中率 ${v.hit_rate}%  (${v.hits}/${v.total})`);
  }

  console.log("\n📈 === 予測トップ技術の確信度帯別 的中率 ===\n");
  for (const [band, v] of Object.entries(byProbabilityBand).sort()) {
    console.log(`  ${band}: 的中率 ${v.hit_rate}%  (${v.hits}/${v.total})`);
  }

  console.log("\n📈 === 予測トップ技術 vs 実際の決まり手 一致率 ===\n");
  for (const [tech, v] of Object.entries(techniqueMatch)) {
    console.log(
      `  予測「${tech}」: 決まり手一致率 ${v.technique_match_rate}%  (${v.technique_matched}/${v.total})`,
    );
  }

  console.log(`\n💾 結果を保存: ${outputPath}`);
}

main().catch((err) => {
  console.error("❌ エラー:", err);
  process.exit(1);
});
