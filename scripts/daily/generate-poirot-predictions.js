/**
 * ポアロ予想（BOA-104）日次バッチ
 *
 * V1(ランダムフォレスト) / V2(LightGBM) の学習済みモデルで当日レースを予測し、
 * poirot_predictions テーブルに upsert する。/poirot ページが読み取る。
 *
 * 前提:
 *   - scripts/ml/.venv がセットアップ済み（requirements.txt）
 *   - scripts/ml/models/*.pkl が学習済み（train_rf.py / train_v2.py）
 *   - data/ml/dataset.csv 等の履歴（export-training-data.js。週次更新推奨）
 *
 * 使い方:
 *   node scripts/daily/generate-poirot-predictions.js            # 今日（JST）
 *   node scripts/daily/generate-poirot-predictions.js --date=YYYY-MM-DD
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabaseClient.js";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
// ローカルは venv、CI は setup-python のシステム Python。
// POIROT_PYTHON で明示上書きも可能。
const VENV_PYTHON = path.join(ROOT, "scripts/ml/.venv/bin/python");
const PYTHON =
  process.env.POIROT_PYTHON ||
  (existsSync(VENV_PYTHON) ? VENV_PYTHON : "python3");

async function main() {
  if (!supabase) {
    console.error("❌ Supabase 環境変数が未設定です");
    process.exit(1);
  }
  const date = parseDateArg() || getTodayDateJST();
  console.log(`🕵️ ポアロ予想生成: ${date}`);

  // 1. 当日レースの特徴量ソースを輸出
  const exp = await execFileAsync(
    "node",
    [path.join(ROOT, "scripts/ml/export-inference-data.js"), `--date=${date}`],
    { cwd: ROOT },
  );
  process.stdout.write(exp.stdout);

  // 2. Python 推論（V1/V2 両モデル）
  const pred = await execFileAsync(
    PYTHON,
    [path.join(ROOT, "scripts/ml/predict.py")],
    {
      cwd: path.join(ROOT, "scripts/ml"),
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  process.stdout.write(pred.stdout);

  // 3. 結果を upsert
  const json = await fs.readFile(
    path.join(ROOT, "data/ml/poirot-predictions.json"),
    "utf-8",
  );
  const rows = JSON.parse(json).map((r) => ({
    ...r,
    predicted_at: new Date().toISOString(),
  }));
  if (rows.length === 0) {
    console.log("📭 書き込みデータなし");
    return;
  }

  const { error } = await supabase
    .from("poirot_predictions")
    .upsert(rows, { onConflict: "race_id,model_version" });
  if (error) {
    console.error("❌ poirot_predictions 書き込みエラー:", error.message);
    process.exit(1);
  }
  console.log(`✅ poirot_predictions: ${rows.length}件 upsert 完了`);
}

main().catch((err) => {
  console.error("❌ エラー:", err.stderr || err.message || err);
  process.exit(1);
});
