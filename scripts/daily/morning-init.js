/**
 * 朝の初期化スクリプト
 *
 * races テーブルに当日データがなければ scrape-to-json.js + generate-predictions.js を実行する。
 * 初期化済みの場合は何もしない（冪等）。
 *
 * scrape-scheduled.yml から5分毎に呼ばれるが、実際の処理は1日1回のみ。
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..", "..");

async function main() {
  console.log("🌅 朝の初期化チェック");
  console.log(`⏰ ${new Date().toISOString()}`);

  if (!isSupabaseEnabled()) {
    console.error("❌ Supabase環境変数が未設定です。");
    process.exit(1);
  }

  const date = parseDateArg() || getTodayDateJST();
  console.log(`📅 対象日: ${date}`);

  // 当日の races テーブルを確認
  const { count, error } = await supabase
    .from("races")
    .select("*", { count: "exact", head: true })
    .like("race_id", `${date}%`);

  if (error) {
    console.error("❌ races テーブル確認エラー:", error.message);
    process.exit(1);
  }

  if ((count || 0) > 0) {
    console.log(`✅ 初期化済み（${count}レース）。スキップ。`);
    return;
  }

  console.log("📋 未初期化のため朝の初期化を開始します...");

  // Step 1: scrape-to-json.js でレースデータを取得し races.json を生成
  console.log("\n📡 Step 1: scrape-to-json.js 実行中...");
  execSync(`node ${path.join(ROOT, "scripts", "scrape-to-json.js")}`, {
    stdio: "inherit",
    env: { ...process.env },
  });

  // Step 2: generate-predictions.js（フルモード）で初期予測を生成
  console.log("\n🤖 Step 2: generate-predictions.js 実行中...");
  execSync(
    `node ${path.join(ROOT, "scripts", "daily", "generate-predictions.js")}`,
    {
      stdio: "inherit",
      env: { ...process.env },
    },
  );

  console.log("\n✅ 朝の初期化完了");

  // Vercel Deploy Hook をトリガー（フロントエンドの CDN キャッシュをリセット）
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) {
    try {
      await fetch(deployHook, { method: "POST" });
      console.log("🚀 Vercel Deploy Hook トリガー済み");
    } catch (e) {
      console.warn("⚠️ Vercel Deploy Hook 失敗:", e.message);
    }
  }
}

main().catch((error) => {
  console.error("❌ エラー:", error);
  process.exit(1);
});
