/**
 * 過去レースのグレード情報バックフィル
 *
 * イン崩れ指数開始時点（2026-03-11）以降のレースについて、
 * ボートレース公式サイトからグレード情報（SG/G1/G2/G3）を取得し、
 * race_conditions テーブルに書き込む。
 *
 * 使用方法:
 *   node scripts/maintenance/backfill-race-grades.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--delay=MS]
 *
 * 例:
 *   node scripts/maintenance/backfill-race-grades.js --from=2026-03-11 --to=2026-04-11
 *   node scripts/maintenance/backfill-race-grades.js --from=2026-03-11 --to=2026-04-11 --dry-run
 */

import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { supabase, VENUE_NAMES } from "../lib/supabaseClient.js";

const USER_AGENT =
  "BoatraceAIBot/1.0 (+https://github.com/rhapsody0919/boatrace-ai-predictor)";
const FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
};

// デフォルト値
const DEFAULT_DELAY = 100;
const DEFAULT_VENUE_DELAY = 1500;

/**
 * グレード情報を scrapeRaceMeta ロジックで抽出
 */
function scrapeRaceGradeAndTitle($) {
  const el = $(".heading2_title");
  if (!el.length) return null;
  const cls = (el.attr("class") || "").toLowerCase();
  const raceGrade = cls.includes("is-sg")
    ? "SG"
    : cls.includes("is-g1")
      ? "G1"
      : cls.includes("is-g2")
        ? "G2"
        : cls.includes("is-g3")
          ? "G3"
          : "ippan";
  const raceTitle = $(".heading2_titleName").text().trim() || null;
  return { raceGrade, raceTitle };
}

/**
 * 指定レースのグレード情報を取得（リトライ対応）
 */
async function fetchRaceGrade(date, venueCode, raceNo, delay = DEFAULT_DELAY, retries = 3) {
  await new Promise((resolve) => setTimeout(resolve, delay));

  const ymd = date.replace(/-/g, "");
  const jcd = String(venueCode).padStart(2, "0");
  const url = `https://www.boatrace.jp/owpc/pc/race/racelist?rno=${raceNo}&jcd=${jcd}&hd=${ymd}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト（boatrace.jp の遅延対応）

      const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `  ⚠️ HTTP ${response.status}: ${VENUE_NAMES[venueCode]} ${raceNo}R`,
        );
        return null;
      }
      const html = await response.text();
      const $ = cheerio.load(html);
      return scrapeRaceGradeAndTitle($);
    } catch (error) {
      if (attempt < retries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.warn(`  ⚠️ リトライ ${attempt}/${retries - 1}: ${VENUE_NAMES[venueCode]} ${raceNo}R (${error.message}) → ${backoff}ms後に再試行`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        console.error(`  ❌ エラー（リトライ${retries}回失敗）: ${VENUE_NAMES[venueCode]} ${raceNo}R - ${error.message}`);
        return null;
      }
    }
  }
}

/**
 * 日付範囲内の全レースを取得（limit/offset対応）
 */
async function fetchRaceIds(fromDate, toDate, limit = 1000, offset = 0) {
  const { data, error } = await supabase
    .from("races")
    .select("race_id, race_date, venue_code, race_number")
    .gte("race_date", fromDate)
    .lte("race_date", toDate)
    .order("race_date")
    .order("venue_code")
    .order("race_number")
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("❌ Supabase クエリエラー:", error.message);
    return [];
  }
  return data || [];
}

/**
 * チェックポイント管理
 */
const CHECKPOINT_FILE = ".backfill-checkpoint.json";

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
    return data;
  }
  return null;
}

function deleteCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  let fromDate = null;
  let toDate = null;
  let dryRun = false;
  let delay = DEFAULT_DELAY;
  let venueDelay = DEFAULT_VENUE_DELAY;
  let verbose = false;
  let resumeCheckpoint = false;

  for (const arg of args) {
    if (arg.startsWith("--from=")) {
      fromDate = arg.slice(7);
    } else if (arg.startsWith("--to=")) {
      toDate = arg.slice(5);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--delay=")) {
      delay = parseInt(arg.slice(8), 10);
    } else if (arg.startsWith("--venue-delay=")) {
      venueDelay = parseInt(arg.slice(14), 10);
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--resume") {
      resumeCheckpoint = true;
    }
  }

  // チェックポイント復帰
  let checkpoint = null;
  if (resumeCheckpoint) {
    checkpoint = loadCheckpoint();
    if (checkpoint) {
      fromDate = checkpoint.fromDate;
      toDate = checkpoint.toDate;
      dryRun = checkpoint.dryRun;
      console.log("🔄 チェックポイントから復帰します");
    } else {
      console.error("❌ チェックポイントが見つかりません");
      process.exit(1);
    }
  }

  if (!fromDate || !toDate) {
    console.error(
      "❌ 使用方法: node backfill-race-grades.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--resume]",
    );
    process.exit(1);
  }

  console.log("=== レースグレード情報バックフィル ===");
  console.log(`期間: ${fromDate} 〜 ${toDate}`);
  console.log(`モード: ${dryRun ? "ドライラン" : "本番実行"}`);
  console.log(`レート: ${delay}ms/レース, 会場間: ${venueDelay}ms`);
  console.log();

  // 対象レース取得（limit/offset でバッチ処理）
  console.log("📥 対象レース取得中...");
  const races = [];
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const batch = await fetchRaceIds(fromDate, toDate, BATCH_SIZE, offset);
    if (batch.length === 0) break;

    races.push(...batch);
    console.log(
      `   ${races.length}件取得 (最終バッチ: ${batch.length}件)`,
    );

    if (batch.length < BATCH_SIZE) break; // 最後のバッチ
    offset += BATCH_SIZE;
  }

  if (races.length === 0) {
    console.log("❌ 対象レースなし");
    return;
  }

  console.log(`\n✅ 対象レース: ${races.length}件\n`);

  const updateRows = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // 会場別にグループ化
  const byVenue = new Map();
  for (const race of races) {
    if (!byVenue.has(race.venue_code)) byVenue.set(race.venue_code, []);
    byVenue.get(race.venue_code).push(race);
  }

  const venueEntries = [...byVenue.entries()];
  let startVenueIndex = 0;

  // チェックポイントから再開する場合
  if (checkpoint) {
    startVenueIndex = venueEntries.findIndex(
      ([code]) => code === checkpoint.lastVenueCode
    );
    if (startVenueIndex >= 0) {
      successCount = checkpoint.successCount;
      skipCount = checkpoint.skipCount;
      updateRows = checkpoint.updateRows;
      console.log(`   復帰: 成功${successCount}件 / スキップ${skipCount}件 / 更新${updateRows.length}件`);
      startVenueIndex++; // 前回処理した会場の次から開始
    } else {
      startVenueIndex = 0;
    }
  }

  for (let vi = startVenueIndex; vi < venueEntries.length; vi++) {
    const [venueCode, venueRaces] = venueEntries[vi];
    const venueName = VENUE_NAMES[venueCode] || `会場${venueCode}`;

    if (vi > startVenueIndex) {
      await new Promise((resolve) => setTimeout(resolve, venueDelay));
    }

    console.log(`📍 ${venueName} (${venueRaces.length}レース)`);

    for (const race of venueRaces) {
      const gradeInfo = await fetchRaceGrade(
        race.race_date,
        venueCode,
        race.race_number,
        delay,
      );

      if (gradeInfo) {
        updateRows.push({
          race_id: race.race_id,
          race_grade: gradeInfo.raceGrade,
          race_title: gradeInfo.raceTitle,
        });
        successCount++;
        if (verbose) {
          console.log(`    ✅ ${race.race_number}R: ${gradeInfo.raceGrade}`);
        }
      } else {
        skipCount++;
        if (verbose) {
          console.log(`    ⏭️ ${race.race_number}R: スキップ`);
        }
      }
    }

    // 各会場処理後にチェックポイント保存
    saveCheckpoint({
      fromDate,
      toDate,
      dryRun,
      lastVenueCode: venueCode,
      successCount,
      skipCount,
      updateRows,
      processedVenues: vi + 1,
      totalVenues: venueEntries.length
    });
  }

  // 完了時はチェックポイント削除
  deleteCheckpoint();

  console.log();
  console.log(`=== 結果 ===`);
  console.log(`成功: ${successCount}件`);
  console.log(`スキップ: ${skipCount}件`);

  if (dryRun) {
    console.log(`\n[ドライラン] 更新なし`);
    return;
  }

  // 本番実行: race_conditions へ upsert
  if (updateRows.length === 0) {
    console.log("\n更新データなし");
    return;
  }

  console.log("\n💾 race_conditions を更新中...");
  for (let i = 0; i < updateRows.length; i += 1000) {
    const batch = updateRows.slice(i, i + 1000);
    const { error } = await supabase
      .from("race_conditions")
      .upsert(batch, { onConflict: "race_id" });

    if (error) {
      console.error(
        `❌ Upsert エラー (${i}-${i + batch.length}):`,
        error.message,
      );
      errorCount++;
    } else {
      console.log(
        `  ✅ ${batch.length}件 (${i + batch.length}/${updateRows.length})`,
      );
    }
  }

  console.log(`\n🏁 完了`);
  if (errorCount > 0) {
    console.log(`⚠️ エラー: ${errorCount}件`);
  }
}

main().catch((err) => {
  console.error("❌ 予期しないエラー:", err);
  process.exit(1);
});
