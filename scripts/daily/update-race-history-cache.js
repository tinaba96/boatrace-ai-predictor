// Race History Cache Update Script
// predictions テーブルから過去90日の日別・モデル別統計を集計し、race_history_cache に保存

import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";

// JST 日付文字列を生成
function jstDateStr(date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
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

// race_history_cache を構築・更新
async function updateRaceHistoryCache() {
  const now = new Date();

  // 過去90日
  const ninetyDaysAgoStr = jstDateStr(
    new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
  );

  console.log("\n📊 レース履歴キャッシュ用データ取得中...");

  // predictions を取得（ページネーション付き）
  const allPredictions = await fetchPredictionsRange(ninetyDaysAgoStr, null);
  console.log(`  取得した予測: ${allPredictions.length}件`);

  if (allPredictions.length === 0) {
    console.log("  ⚠️  予測データが見つかりません");
    return false;
  }

  // race_id ごとの レース情報を取得（total/finished を計数）
  const raceIds = [...new Set(allPredictions.map((p) => p.race_id))];
  console.log(`  対象レース: ${raceIds.length}件`);

  let allRaces = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error } = await supabase
      .from("races")
      .select("race_id")
      .gte("race_id", ninetyDaysAgoStr)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("  races テーブル取得エラー:", error.message);
      break;
    }
    if (!page || page.length === 0) break;
    allRaces = allRaces.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  const raceSet = new Set(allRaces.map((r) => r.race_id));

  // 日付別・モデル別に集計
  const dayMap = new Map(); // date -> { totalRaces, finishedRaces, models: Map<modelId, stats> }

  // ステップ 1: 全レース数を日付別に集計
  for (const race of allRaces) {
    const date = race.race_id.substring(0, 10);
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        totalRaces: 0,
        finishedRaces: 0,
        models: new Map(),
      });
    }
    dayMap.get(date).totalRaces++;
  }

  // ステップ 2: 予測データを日付別・モデル別に集計
  for (const pred of allPredictions) {
    const date = pred.race_id.substring(0, 10);

    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        totalRaces: 0,
        finishedRaces: 0,
        models: new Map(),
      });
    }

    const dayData = dayMap.get(date);

    // 初回訪問時のみ finishedRaces をインクリメント（race_id 単位）
    // （複数モデルの予測があっても1レース1回のみカウント）
    if (!dayData._processedRaces) dayData._processedRaces = new Set();
    if (!dayData._processedRaces.has(pred.race_id)) {
      dayData.finishedRaces++;
      dayData._processedRaces.add(pred.race_id);
    }

    // モデル別の統計を初期化
    const modelId = pred.model_id;
    if (!dayData.models.has(modelId)) {
      dayData.models.set(modelId, {
        modelId,
        finishedRaces: 0,
        winHits: 0,
        winPayouts: 0,
        placeHits: 0,
        placePayouts: 0,
        trifectaHits: 0,
        trifectaPayouts: 0,
        trioHits: 0,
        trioPayouts: 0,
      });
    }

    const modelStats = dayData.models.get(modelId);

    // 各モデルの race 単位でのカウント
    // （複数のカテゴリの予測があっても1レース1回のみ）
    if (!modelStats._processedRaces) modelStats._processedRaces = new Set();
    if (!modelStats._processedRaces.has(pred.race_id)) {
      modelStats.finishedRaces++;
      modelStats._processedRaces.add(pred.race_id);
    }

    // ヒット数・配当合計
    if (pred.is_hit_win) modelStats.winHits++;
    modelStats.winPayouts += pred.payout_win || 0;

    if (pred.is_hit_place) modelStats.placeHits++;
    modelStats.placePayouts += pred.payout_place || 0;

    if (pred.is_hit_trifecta) modelStats.trifectaHits++;
    modelStats.trifectaPayouts += pred.payout_trifecta || 0;

    if (pred.is_hit_trio) modelStats.trioHits++;
    modelStats.trioPayouts += pred.payout_trio || 0;
  }

  // ステップ 3: dayMap を days 配列に変換
  const days = Array.from(dayMap.values())
    .map((day) => {
      // _processedRaces は不要（内部用）
      delete day._processedRaces;

      // models を配列に変換
      const models = Array.from(day.models.values()).map((m) => {
        delete m._processedRaces;
        return m;
      });

      return {
        date: day.date,
        totalRaces: day.totalRaces,
        finishedRaces: day.finishedRaces,
        models,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`  日別集計: ${days.length}日分`);

  // ステップ 4: race_history_cache に upsert
  const cacheData = { days };

  const { error: upsertError } = await supabase
    .from("race_history_cache")
    .upsert({
      key: "race_history_summary_90",
      data: cacheData,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error(
      "  ❌ race_history_cache UPSERT エラー:",
      upsertError.message,
    );
    return false;
  }

  console.log("  ✅ race_history_cache 更新完了（90日分）");
  return true;
}

// Main
async function main() {
  if (!isSupabaseEnabled()) {
    console.error("❌ Supabaseが設定されていません");
    process.exit(1);
  }

  console.log("🚀 レース履歴キャッシュ更新を開始します");

  const success = await updateRaceHistoryCache();

  if (success) {
    console.log("\n✅ 更新完了");
    process.exit(0);
  } else {
    console.error("\n❌ 更新失敗");
    process.exit(1);
  }
}

main();
