// Accuracy Calculation Script
// Supabaseから予測結果を集計し、models統計と accuracy_cache を更新する（3モデル×4券種対応）

import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";

// Calculate statistics for a model (4券種: win/place/trifecta/trio) — overall のみ
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

// 統計を計算するヘルパー（predictions 配列 → フロントが期待する形式）
function computeStats(predictions) {
  if (!predictions || predictions.length === 0) {
    return {
      totalRaces: 0,
      topPickHitRate: 0,
      topPickPlaceRate: 0,
      top3HitRate: 0,
      top3IncludedRate: 0,
      actualRecovery: {
        win: { recoveryRate: 0 },
        place: { recoveryRate: 0 },
        trifecta: { recoveryRate: 0 },
        trio: { recoveryRate: 0 },
      },
    };
  }

  const total = predictions.length;
  const winHits = predictions.filter((p) => p.is_hit_win).length;
  const placeHits = predictions.filter((p) => p.is_hit_place).length;
  const trifectaHits = predictions.filter((p) => p.is_hit_trifecta).length;
  const trioHits = predictions.filter((p) => p.is_hit_trio).length;

  const winPayout = predictions.reduce((s, p) => s + (p.payout_win || 0), 0);
  const placePayout = predictions.reduce(
    (s, p) => s + (p.payout_place || 0),
    0,
  );
  const trifectaPayout = predictions.reduce(
    (s, p) => s + (p.payout_trifecta || 0),
    0,
  );
  const trioPayout = predictions.reduce((s, p) => s + (p.payout_trio || 0), 0);

  return {
    totalRaces: total,
    topPickHitRate: winHits / total,
    topPickPlaceRate: placeHits / total,
    top3HitRate: trifectaHits / total,
    top3IncludedRate: trioHits / total,
    actualRecovery: {
      win: { recoveryRate: winPayout / (total * 100) },
      place: { recoveryRate: placePayout / (total * 100) },
      trifecta: { recoveryRate: trifectaPayout / (total * 100) },
      trio: { recoveryRate: trioPayout / (total * 100) },
    },
  };
}

// predictions テーブルから指定範囲を全件取得（ページネーション付き）
async function fetchPredictionsRange(startDate, endDate) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  const adjustedEnd = endDate ? `${endDate}-99-99` : null;

  while (true) {
    let query = supabase
      .from("predictions")
      .select(
        "race_id, model_id, is_hit_win, is_hit_place, is_hit_trifecta, is_hit_trio, payout_win, payout_place, payout_trifecta, payout_trio",
      )
      .gte("race_id", startDate)
      .not("is_hit_win", "is", null)
      .range(from, from + pageSize - 1);

    if (adjustedEnd) {
      query = query.lte("race_id", adjustedEnd);
    }

    const { data: page, error } = await query;
    if (error) {
      console.error("  fetchPredictionsRange error:", error.message);
      break;
    }
    if (!page || page.length === 0) break;
    allData = allData.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

// JST 日付文字列を生成するヘルパー
function jstDateStr(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// accuracy_cache テーブルに全統計を書き込む
async function buildAndStoreAccuracyCache() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const thisYear = jstNow.getUTCFullYear();
  const thisMonth = jstNow.getUTCMonth() + 1;
  const pad = (n) => String(n).padStart(2, "0");

  const thisMonthStart = `${thisYear}-${pad(thisMonth)}-01`;

  // 先月
  const lastMonthDate = addMonths(new Date(thisYear, thisMonth - 1, 1), -1);
  const lastYear = lastMonthDate.getFullYear();
  const lastMonth = lastMonthDate.getMonth() + 1;

  // 過去6ヶ月
  const monthsToFetch = [];
  for (let i = 1; i <= 6; i++) {
    const d = addMonths(new Date(thisYear, thisMonth - 1, 1), -i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    monthsToFetch.push({
      year: y,
      month: m,
      start: `${y}-${pad(m)}-01`,
      end: `${y}-${pad(m)}-31`,
    });
  }

  // 7日前 / 90日前
  const sevenDaysAgoStr = jstDateStr(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  );
  const ninetyDaysAgoStr = jstDateStr(
    new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
  );

  console.log("\n📊 accuracy_cache 用データ取得中...");

  // 取得バッチ（今月 / 先月 / 過去6ヶ月各月 / 過去7日 / 過去90日）
  // 過去90日を1回取得すれば 7日・今月・先月・6ヶ月分すべてカバーできる
  const [allRecentPredictions, thisMonthPredictions] = await Promise.all([
    fetchPredictionsRange(ninetyDaysAgoStr, null),
    fetchPredictionsRange(thisMonthStart, thisMonthEnd),
  ]);

  // 各月の predictions をメモリでフィルタ
  const getPredsByMonth = (year, month) => {
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-31`;
    return allRecentPredictions.filter(
      (p) => p.race_id >= start && p.race_id <= `${end}-99-99`,
    );
  };

  const lastMonthPredictions = getPredsByMonth(lastYear, lastMonth);

  // models テーブルから全モデルの overall 統計を取得
  const { data: modelsRows, error: modelsError } = await supabase
    .from("models")
    .select(
      "model_id, total_predictions, hit_rate_win, hit_rate_place, hit_rate_trifecta, hit_rate_trio, recovery_rate_win, recovery_rate_place, recovery_rate_trifecta, recovery_rate_trio",
    );

  if (modelsError) {
    console.error("  models テーブル取得エラー:", modelsError.message);
    return false;
  }

  const modelIds = ["standard", "safeBet", "upsetFocus"];
  const cacheModels = {};

  for (const modelId of modelIds) {
    const modelRow = modelsRows?.find((m) => m.model_id === modelId);

    // 今月統計
    const thisMonthPreds = thisMonthPredictions.filter(
      (p) => p.model_id === modelId,
    );
    // 先月統計
    const lastMonthPreds = lastMonthPredictions.filter(
      (p) => p.model_id === modelId,
    );

    // 月別履歴（過去6ヶ月）
    const monthlyHistory = monthsToFetch
      .map(({ year, month }) => {
        const preds = getPredsByMonth(year, month).filter(
          (p) => p.model_id === modelId,
        );
        const stats = computeStats(preds);
        if (stats.totalRaces === 0) return null;
        return { year, month, ...stats };
      })
      .filter(Boolean)
      .sort((a, b) =>
        b.year !== a.year ? b.year - a.year : b.month - a.month,
      );

    // 日別履歴（過去7日）
    const recentPreds = allRecentPredictions.filter(
      (p) => p.model_id === modelId && p.race_id >= sevenDaysAgoStr,
    );
    const dateMap = new Map();
    for (const pred of recentPreds) {
      const date = pred.race_id.substring(0, 10);
      if (!dateMap.has(date)) dateMap.set(date, []);
      dateMap.get(date).push(pred);
    }
    const dailyHistory = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, preds]) => ({ date, ...computeStats(preds) }));

    // 会場別統計（過去90日）
    const venueMap = new Map();
    for (const pred of allRecentPredictions.filter(
      (p) => p.model_id === modelId,
    )) {
      const venueCode = parseInt(pred.race_id.substring(11, 13), 10);
      if (!venueMap.has(venueCode)) venueMap.set(venueCode, []);
      venueMap.get(venueCode).push(pred);
    }
    const byVenue = {};
    for (const [venueCode, preds] of venueMap) {
      byVenue[venueCode] = { overall: computeStats(preds) };
    }

    cacheModels[modelId] = {
      overall: {
        totalRaces: modelRow?.total_predictions || 0,
        finishedRaces: modelRow?.total_predictions || 0,
        topPickHitRate: modelRow?.hit_rate_win || 0,
        topPickPlaceRate: modelRow?.hit_rate_place || 0,
        top3HitRate: modelRow?.hit_rate_trifecta || 0,
        top3ExactHitRate: modelRow?.hit_rate_trio || 0,
        actualRecovery: {
          win: { recoveryRate: modelRow?.recovery_rate_win || 0 },
          place: { recoveryRate: modelRow?.recovery_rate_place || 0 },
          trifecta: { recoveryRate: modelRow?.recovery_rate_trifecta || 0 },
          trio: { recoveryRate: modelRow?.recovery_rate_trio || 0 },
        },
      },
      thisMonth: {
        year: thisYear,
        month: thisMonth,
        ...computeStats(thisMonthPreds),
      },
      lastMonth: {
        year: lastYear,
        month: lastMonth,
        ...computeStats(lastMonthPreds),
      },
      monthlyHistory,
      dailyHistory,
      byVenue,
    };

    console.log(
      `  ${modelId}: 今月=${thisMonthPreds.length}件, 先月=${lastMonthPreds.length}件, 90日=${allRecentPredictions.filter((p) => p.model_id === modelId).length}件`,
    );
  }

  const cacheData = {
    lastUpdated: new Date().toISOString(),
    models: cacheModels,
  };

  const { error: upsertError } = await supabase
    .from("accuracy_cache")
    .upsert({
      key: "accuracy_summary",
      data: cacheData,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error("  ❌ accuracy_cache UPSERT エラー:", upsertError.message);
    return false;
  }

  console.log("  ✅ accuracy_cache 更新完了");
  return true;
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

  // accuracy_cache テーブルに全統計を保存（API のキャッシュミス時に高速参照するため）
  await buildAndStoreAccuracyCache();

  console.log("\n✅ 統計更新完了");
}

// Execute script
calculateAccuracy();
