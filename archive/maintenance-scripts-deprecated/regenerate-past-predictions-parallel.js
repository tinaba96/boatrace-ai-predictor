/**
 * 過去期間のレースグレード情報を race_conditions から races に反映（並列更新版）
 *
 * 複数の更新リクエストを並列実行することで高速化
 *
 * 使用方法:
 *   node scripts/maintenance/regenerate-past-predictions-parallel.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--concurrency=10]
 *
 * 例:
 *   node scripts/maintenance/regenerate-past-predictions-parallel.js --from=2026-02-03 --to=2026-05-02
 */

import { supabase } from "../lib/supabaseClient.js";

async function main() {
  const args = process.argv.slice(2);
  let fromDate = null;
  let toDate = null;
  let dryRun = false;
  let concurrency = 10;

  for (const arg of args) {
    if (arg.startsWith("--from=")) {
      fromDate = arg.slice(7);
    } else if (arg.startsWith("--to=")) {
      toDate = arg.slice(5);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--concurrency=")) {
      concurrency = parseInt(arg.slice(14), 10);
    }
  }

  if (!fromDate || !toDate) {
    console.error(
      "❌ 使用方法: node regenerate-past-predictions-parallel.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--concurrency=10]",
    );
    process.exit(1);
  }

  console.log("=== レースグレード情報 反映（並列版） ===");
  console.log(`期間: ${fromDate} 〜 ${toDate}`);
  console.log(`モード: ${dryRun ? "ドライラン" : "本番実行"}`);
  console.log(`並列数: ${concurrency}`);
  console.log();

  // 対象レース ID を取得（ページネーション対応）
  console.log("📥 対象レース ID 取得中...");
  const targetRaceIds = [];
  const RACES_BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data: batch, error: raceError } = await supabase
      .from("races")
      .select("race_id")
      .gte("race_date", fromDate)
      .lte("race_date", toDate)
      .range(offset, offset + RACES_BATCH_SIZE - 1);

    if (raceError) {
      console.error("❌ races テーブル読み込みエラー:", raceError.message);
      process.exit(1);
    }

    if (!batch || batch.length === 0) break;

    targetRaceIds.push(...batch.map((r) => r.race_id));
    console.log(
      `   ${targetRaceIds.length}件取得 (最終バッチ: ${batch.length}件)`,
    );

    if (batch.length < RACES_BATCH_SIZE) break;
    offset += RACES_BATCH_SIZE;
  }

  console.log(`✅ 対象レース: ${targetRaceIds.length}件\n`);

  if (targetRaceIds.length === 0) {
    console.log("❌ 対象レースなし");
    return;
  }

  // race_conditions から race_grade を取得（分割クエリで IN 句サイズ制限を回避）
  console.log("📥 race_conditions から race_grade を取得中...");
  const conditions = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < targetRaceIds.length; i += BATCH_SIZE) {
    const batch = targetRaceIds.slice(i, i + BATCH_SIZE);
    const { data: batchData, error: condError } = await supabase
      .from("race_conditions")
      .select("race_id, race_grade")
      .in("race_id", batch);

    if (condError) {
      console.error("❌ race_conditions 読み込みエラー:", condError.message);
      process.exit(1);
    }

    if (batchData) conditions.push(...batchData);
    console.log(
      `   ${Math.min(i + BATCH_SIZE, targetRaceIds.length)}/${targetRaceIds.length} 件取得`,
    );
  }

  console.log(`✅ 取得件数: ${conditions?.length || 0}件`);

  if (!conditions || conditions.length === 0) {
    console.log("❌ データなし");
    return;
  }

  // race_grade が null でない件数をカウント
  const withGrade = conditions.filter((c) => c.race_grade !== null);
  console.log(`   グレード情報あり: ${withGrade.length}件\n`);

  if (dryRun) {
    console.log("[ドライラン] 更新なし");
    return;
  }

  // 並列で更新を実行
  console.log("💾 races テーブルを更新中...");
  let updateCount = 0;
  let errorCount = 0;
  let startTime = Date.now();

  // 更新タスクキューを作成
  const updateTasks = withGrade.map((cond) => async () => {
    const { error } = await supabase
      .from("races")
      .update({ race_grade: cond.race_grade })
      .eq("race_id", cond.race_id);

    if (error) {
      console.error(`  ❌ race_id ${cond.race_id}: ${error.message}`);
      errorCount++;
    } else {
      updateCount++;
    }
  });

  // 並列実行（concurrency を制限）
  for (let i = 0; i < updateTasks.length; i += concurrency) {
    const batch = updateTasks.slice(i, i + concurrency);
    await Promise.all(batch.map((task) => task()));

    const completed = Math.min(i + concurrency, updateTasks.length);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const remaining = updateTasks.length - completed;
    const eta = remaining / rate;

    console.log(
      `  進捗: ${completed}/${updateTasks.length} (${((completed / updateTasks.length) * 100).toFixed(1)}%) - ETA: ${Math.ceil(eta)}秒`,
    );
  }

  console.log();
  console.log("=== 結果 ===");
  console.log(`✅ 更新成功: ${updateCount}件`);
  if (errorCount > 0) {
    console.log(`❌ エラー: ${errorCount}件`);
  }
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`⏱️  実行時間: ${totalTime.toFixed(1)}秒`);
  console.log("🏁 完了");
}

main().catch((err) => {
  console.error("❌ 予期しないエラー:", err);
  process.exit(1);
});
