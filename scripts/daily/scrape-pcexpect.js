/**
 * boatrace.jp 公式コンピュータ予想 (pcexpect) スクレイパ
 *
 * 各レースの予想フォーカス（2連単4点 + 3連単6点）と自信度（1〜5）を
 * external_predictions テーブルへ upsert する。
 *
 * 使い方:
 *   node scripts/daily/scrape-pcexpect.js                    # 当日全レース
 *   node scripts/daily/scrape-pcexpect.js --date 2026-01-08  # 指定日
 *   node scripts/daily/scrape-pcexpect.js --venue 24         # 会場絞り込み
 *   node scripts/daily/scrape-pcexpect.js --race 1           # レース番号絞り込み（要 --venue）
 *   node scripts/daily/scrape-pcexpect.js --dry              # DB 書き込みせず標準出力のみ
 */

import * as cheerio from "cheerio";
import {
  supabase,
  isSupabaseEnabled,
  VENUE_NAMES,
} from "../lib/supabaseClient.js";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";
import { getRaceSchedule } from "../lib/raceSchedule.js";

const SOURCE = "pcexpect_official";
const FETCH_INTERVAL_MS = 1000;
const USER_AGENT =
  "BoatraceAIBot/1.0 (+https://github.com/tinaba96/boatrace-ai-predictor)";
const FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = { date: null, venue: null, race: null, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date") args.date = argv[++i];
    else if (a === "--venue") args.venue = parseInt(argv[++i], 10);
    else if (a === "--race") args.race = parseInt(argv[++i], 10);
    else if (a === "--dry") args.dry = true;
  }
  if (!args.date) args.date = parseDateArg() || getTodayDateJST();
  return args;
}

function buildUrl({ date, venueCode, raceNo }) {
  const hd = date.replace(/-/g, "");
  const jcd = String(venueCode).padStart(2, "0");
  return `https://www.boatrace.jp/owpc/pc/race/pcexpect?hd=${hd}&jcd=${jcd}&rno=${raceNo}`;
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/**
 * pcexpect HTML から予想フォーカスと自信度を抽出
 * 構造（2026-01 時点）:
 *   .numberSet2_unit × 4
 *     .numberSet2_row 内に .numberSet2_number × 2 (2連単) または × 3 (3連単)
 *   .state2_lv.is-lvN (N = 1..5) で自信度
 *
 * 「データなし」ページでは .numberSet2 が存在しないため null を返す。
 */
function parsePcexpect(html) {
  const $ = cheerio.load(html);
  const container = $(".numberSet2").first();
  if (container.length === 0) return null;

  const focus2t = [];
  const focus3t = [];

  container.find(".numberSet2_unit").each((_, unit) => {
    $(unit)
      .find(".numberSet2_row")
      .each((_, row) => {
        // 子ノードを順に走査して [number, sep, number, sep, ...] を組み立て
        // 数字ペアごとに "-" / "=" が異なる場合があるため (例: "2=5-1")
        const parts = [];
        $(row)
          .contents()
          .each((__, node) => {
            if (
              node.type === "tag" &&
              ($(node).hasClass("numberSet2_number") || $(node).find(".numberSet2_number").length)
            ) {
              const numText = $(node).text().trim();
              const n = parseInt(numText, 10);
              if (!Number.isNaN(n)) parts.push(String(n));
            } else if (node.type === "text") {
              const t = (node.data || "").replace(/\s+/g, "");
              if (t === "=" || t === "-") parts.push(t);
            }
          });

        const nums = parts.filter((p) => /^\d+$/.test(p));
        const seps = parts.filter((p) => p === "-" || p === "=");
        if (nums.length < 2) return;
        const pattern = parts.join("");

        if (nums.length === 2) focus2t.push({ pattern, seps });
        else if (nums.length === 3) focus3t.push({ pattern, seps });
      });
  });

  // 自信度: <p class="state2_lv is-lvN"></p>
  let confidence = null;
  const lvEl = $(".state2_lv").first();
  if (lvEl.length > 0) {
    const cls = lvEl.attr("class") || "";
    const m = cls.match(/is-lv(\d)/);
    if (m) confidence = parseInt(m[1], 10);
  }

  // 進入予想（画像のコーナーパターンファイル名のみ保持）
  let entryPredictionImage = null;
  const cornerImg = $(".boat1_corner img").first();
  if (cornerImg.length > 0) {
    entryPredictionImage = cornerImg.attr("src") || null;
  }

  // 何も取れなかった場合は null
  if (focus2t.length === 0 && focus3t.length === 0 && confidence === null) {
    return null;
  }

  return {
    focus_2t: focus2t,
    focus_3t: focus3t,
    confidence,
    entry_prediction_image: entryPredictionImage,
  };
}

async function upsertPrediction({
  date,
  venueCode,
  raceNo,
  payload,
  raceStartAt,
}) {
  const row = {
    source: SOURCE,
    race_date: date,
    venue_code: venueCode,
    race_no: raceNo,
    payload,
    scraped_at: new Date().toISOString(),
    race_start_at: raceStartAt ? raceStartAt.toISOString() : null,
  };
  const { error } = await supabase
    .from("external_predictions")
    .upsert(row, { onConflict: "source,race_date,venue_code,race_no" });
  if (error) throw new Error(`upsert: ${error.message}`);
}

async function main() {
  const args = parseArgs();
  const date = args.date;

  console.log(`📅 pcexpect スクレイプ開始: ${date}`);
  if (args.dry) console.log("  🧪 DRY RUN (DB 書き込みスキップ)");

  // --venue + --race が両方指定されていれば Supabase を介さず単発実行
  let schedule;
  if (args.venue && args.race) {
    schedule = [
      { venue_code: args.venue, race_no: args.race, start_time: null },
    ];
  } else {
    schedule = await getRaceSchedule(date);
    if (schedule.length === 0) {
      console.warn(`  ⚠️ ${date} のスケジュールが空のため処理終了`);
      process.exit(0);
    }
    if (args.venue)
      schedule = schedule.filter((r) => r.venue_code === args.venue);
    if (args.race) schedule = schedule.filter((r) => r.race_no === args.race);
  }

  console.log(`  対象レース数: ${schedule.length}`);
  if (!args.dry && !isSupabaseEnabled()) {
    console.error("  ❌ Supabase 未設定。--dry でテスト可");
    process.exit(1);
  }

  let okCount = 0;
  let emptyCount = 0;
  let errCount = 0;

  for (const r of schedule) {
    const url = buildUrl({ date, venueCode: r.venue_code, raceNo: r.race_no });
    const label = `${VENUE_NAMES[r.venue_code] || r.venue_code}${r.race_no}R`;
    try {
      const html = await fetchHtml(url);
      const payload = parsePcexpect(html);
      if (!payload) {
        emptyCount++;
        console.log(`  ⚪ ${label}: データなし`);
      } else {
        if (args.dry) {
          console.log(`  ✅ ${label}: ${JSON.stringify(payload)}`);
        } else {
          await upsertPrediction({
            date,
            venueCode: r.venue_code,
            raceNo: r.race_no,
            payload,
            raceStartAt: r.start_time,
          });
          console.log(
            `  ✅ ${label}: 2t=${payload.focus_2t.length}点 3t=${payload.focus_3t.length}点 lv=${payload.confidence}`,
          );
        }
        okCount++;
      }
    } catch (e) {
      errCount++;
      console.error(`  ❌ ${label}: ${e.message}`);
    }
    await new Promise((res) => setTimeout(res, FETCH_INTERVAL_MS));
  }

  console.log(
    `\n📊 完了: 成功 ${okCount} / データなし ${emptyCount} / エラー ${errCount}`,
  );
}

main().catch((err) => {
  console.error("❌ 致命的エラー:", err);
  process.exit(1);
});
