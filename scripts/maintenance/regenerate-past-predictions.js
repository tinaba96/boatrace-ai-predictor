/**
 * 過去期間の predictions を再生成
 *
 * race_conditions が更新された後、それを反映して races テーブルに race_grade を書き込み直す
 *
 * 使用方法:
 *   node scripts/maintenance/regenerate-past-predictions.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]
 *
 * 例:
 *   node scripts/maintenance/regenerate-past-predictions.js --from=2026-02-03 --to=2026-05-02
 */

import { supabase } from "../lib/supabaseClient.js";

async function main() {
  const args = process.argv.slice(2);
  let fromDate = null;
  let toDate = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith("--from=")) {
      fromDate = arg.slice(7);
    } else if (arg.startsWith("--to=")) {
      toDate = arg.slice(5);
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!fromDate || !toDate) {
    console.error(
      "❌ 使用方法: node regenerate-past-predictions.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run]",
    );
    process.exit(1);
  }

  console.log("=== 過去期間の predictions 再生成 ===");
  console.log(`期間: ${fromDate} 〜 ${toDate}`);
  console.log(`モード: ${dryRun ? "ドライラン" : "本番実行"}`);
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

    targetRaceIds.push(...batch.map(r => r.race_id));
    console.log(`   ${targetRaceIds.length}件取得 (最終バッチ: ${batch.length}件)`);

    if (batch.length < RACES_BATCH_SIZE) break;
    offset += RACES_BATCH_SIZE;
  }

  console.log(`✅ 対象レース: ${targetRaceIds.length}件`);

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
    console.log(`   ${Math.min(i + BATCH_SIZE, targetRaceIds.length)}/${targetRaceIds.length} 件取得`);
  }

  console.log(`✅ 取得件数: ${conditions?.length || 0}件`);

  if (!conditions || conditions.length === 0) {
    console.log("❌ データなし");
    return;
  }

  // race_grade が null でない件数をカウント
  const withGrade = conditions.filter((c) => c.race_grade !== null);
  console.log(`   グレード情報あり: ${withGrade.length}件`);
  console.log();

  if (dryRun) {
    console.log("[ドライラン] 更新なし");
    return;
  }

  // races テーブルの race_grade を更新（一件ずつ）
  console.log("💾 races テーブルを更新中...");
  let updateCount = 0;
  let errorCount = 0;

  for (let i = 0; i < withGrade.length; i++) {
    const cond = withGrade[i];
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

    if ((i + 1) % 500 === 0) {
      console.log(`  進捗: ${i + 1}/${withGrade.length}`);
    }
  }

  console.log();
  console.log("=== 結果 ===");
  console.log(`✅ 更新成功: ${updateCount}件`);
  if (errorCount > 0) {
    console.log(`❌ エラー: ${errorCount}件`);
  }
  console.log("🏁 完了");
}

main().catch((err) => {
  console.error("❌ 予期しないエラー:", err);
  process.exit(1);
});
