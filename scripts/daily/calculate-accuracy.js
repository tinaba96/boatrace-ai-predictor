// Accuracy Calculation Script
// Supabaseから予測結果を集計し、models統計を更新する（3モデル×4券種対応）

import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";

// Calculate statistics for a model (4券種: win/place/trifecta/trio)
async function calculateModelStats(modelId) {
  let allPredictions = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: page, error } = await supabase
      .from("predictions")
      .select(
        "race_id, is_hit_win, is_hit_place, is_hit_trifecta, is_hit_trio, payout_win, payout_place, payout_trifecta, payout_trio",
      )
      .eq("model_id", modelId)
      .not("is_hit_win", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`  ${modelId} predictions error:`, error.message);
      return null;
    }
    if (!page || page.length === 0) break;
    allPredictions = allPredictions.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  if (allPredictions.length === 0) {
    return {
      totalPredictions: 0,
      hitRateWin: 0,
      hitRatePlace: 0,
      hitRateTrifecta: 0,
      hitRateTrio: 0,
      recoveryRateWin: 0,
      recoveryRatePlace: 0,
      recoveryRateTrifecta: 0,
      recoveryRateTrio: 0,
    };
  }

  const total = allPredictions.length;
  const investment = total * 100;

  const hitsWin = allPredictions.filter((p) => p.is_hit_win).length;
  const hitsPlace = allPredictions.filter((p) => p.is_hit_place).length;
  const hitsTrifecta = allPredictions.filter((p) => p.is_hit_trifecta).length;
  const hitsTrio = allPredictions.filter((p) => p.is_hit_trio).length;

  const payoutWin = allPredictions.reduce((s, p) => s + (p.payout_win || 0), 0);
  const payoutPlace = allPredictions.reduce(
    (s, p) => s + (p.payout_place || 0),
    0,
  );
  const payoutTrifecta = allPredictions.reduce(
    (s, p) => s + (p.payout_trifecta || 0),
    0,
  );
  const payoutTrio = allPredictions.reduce(
    (s, p) => s + (p.payout_trio || 0),
    0,
  );

  return {
    totalPredictions: total,
    hitRateWin: hitsWin / total,
    hitRatePlace: hitsPlace / total,
    hitRateTrifecta: hitsTrifecta / total,
    hitRateTrio: hitsTrio / total,
    recoveryRateWin: payoutWin / investment,
    recoveryRatePlace: payoutPlace / investment,
    recoveryRateTrifecta: payoutTrifecta / investment,
    recoveryRateTrio: payoutTrio / investment,
  };
}

// Main function
async function calculateAccuracy() {
  if (!isSupabaseEnabled()) {
    console.error("❌ Supabaseが設定されていません");
    process.exit(1);
  }

  console.log("Starting accuracy calculation from Supabase...\n");

  const models = ["standard", "safeBet", "upsetFocus"];
  const modelStats = {};

  for (const modelId of models) {
    console.log(`Calculating ${modelId}...`);
    const stats = await calculateModelStats(modelId);

    if (stats) {
      modelStats[modelId] = stats;
      console.log(`  Total: ${stats.totalPredictions}`);
      console.log(
        `    単勝  的中=${(stats.hitRateWin * 100).toFixed(1)}%, 回収=${(stats.recoveryRateWin * 100).toFixed(1)}%`,
      );
      console.log(
        `    複勝  的中=${(stats.hitRatePlace * 100).toFixed(1)}%, 回収=${(stats.recoveryRatePlace * 100).toFixed(1)}%`,
      );
      console.log(
        `    3連複 的中=${(stats.hitRateTrifecta * 100).toFixed(1)}%, 回収=${(stats.recoveryRateTrifecta * 100).toFixed(1)}%`,
      );
      console.log(
        `    3連単 的中=${(stats.hitRateTrio * 100).toFixed(1)}%, 回収=${(stats.recoveryRateTrio * 100).toFixed(1)}%`,
      );
    }
  }

  // Supabaseのmodelsテーブルを更新
  console.log("\n📤 Supabaseのmodels統計を更新中...");

  for (const [modelId, stats] of Object.entries(modelStats)) {
    const { error } = await supabase
      .from("models")
      .update({
        total_predictions: stats.totalPredictions,
        hit_rate_win: stats.hitRateWin,
        hit_rate_place: stats.hitRatePlace,
        hit_rate_trifecta: stats.hitRateTrifecta,
        hit_rate_trio: stats.hitRateTrio,
        recovery_rate_win: stats.recoveryRateWin,
        recovery_rate_place: stats.recoveryRatePlace,
        recovery_rate_trifecta: stats.recoveryRateTrifecta,
        recovery_rate_trio: stats.recoveryRateTrio,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("model_id", modelId);

    if (error) {
      console.error(`  ❌ ${modelId}更新エラー:`, error.message);
    } else {
      console.log(`  ✅ ${modelId} 更新完了`);
    }
  }

  console.log("\n✅ 統計更新完了");
}

// Execute script
calculateAccuracy();
