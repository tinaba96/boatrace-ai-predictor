/**
 * 展示データ専用軽量スクレイピングスクリプト
 *
 * beforeinfo ページから展示タイム・展示STのみを取得し、
 * Supabase exhibition_data テーブルに直接 upsert する。
 * data/races.json には一切触れない。
 *
 * 実行時間: 約3-4分（取得済みレースはスキップ）
 */

import * as cheerio from "cheerio";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";
import {
  supabase,
  isSupabaseEnabled,
  VENUE_NAMES,
} from "../lib/supabaseClient.js";

const USER_AGENT =
  "BoatraceAIBot/1.0 (+https://github.com/rhapsody0919/boatrace-ai-predictor)";
const FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
};

/**
 * race_id を生成 (YYYY-MM-DD-VV-RR 形式)
 */
function makeRaceId(date, venueCode, raceNo) {
  const vv = String(venueCode).padStart(2, "0");
  const rr = String(raceNo).padStart(2, "0");
  return `${date}-${vv}-${rr}`;
}

/**
 * 本日開催中のレース場リストを取得
 */
async function getTodayVenues() {
  const url = "https://www.boatrace.jp/owpc/pc/race/index";
  const response = await fetch(url, { headers: FETCH_HEADERS });

  if (!response.ok) {
    console.error(`HTTP ${response.status}: ${url}`);
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const venues = new Set();

  $('a[href*="raceindex"]').each((i, elem) => {
    const href = $(elem).attr("href");
    if (href) {
      const match = href.match(/jcd=(\d+)/);
      if (match) venues.add(parseInt(match[1]));
    }
  });

  const venuesList = Array.from(venues).sort((a, b) => a - b);
  console.log(
    `📍 本日の開催会場: ${venuesList.length}場 (${venuesList.map((v) => VENUE_NAMES[v]).join(", ")})`,
  );
  return venuesList;
}

/**
 * Supabase から取得済みの展示データがある race_id セットを取得
 */
async function getExistingExhibitionRaceIds(date) {
  if (!isSupabaseEnabled()) return new Set();

  const { data, error } = await supabase
    .from("exhibition_data")
    .select("race_id")
    .like("race_id", `${date}%`);

  if (error) {
    console.error("⚠️ 取得済みデータの確認に失敗:", error.message);
    return new Set();
  }

  return new Set(data.map((r) => r.race_id));
}

/**
 * races テーブルに存在する race_id セットを取得
 * （exhibition_data は races への FK 制約があるため、存在しない race_id には書き込めない）
 */
async function getExistingRaceIds(date) {
  if (!isSupabaseEnabled()) return new Set();

  const { data, error } = await supabase
    .from("races")
    .select("race_id")
    .like("race_id", `${date}%`);

  if (error) {
    console.error("⚠️ races テーブルの確認に失敗:", error.message);
    return new Set();
  }

  return new Set(data.map((r) => r.race_id));
}

/**
 * beforeinfo ページから展示データをスクレイピング
 */
function scrapeExhibitionData($) {
  const exhibitionData = [];
  const tables = $(".table1");
  if (tables.length < 2) return null;

  // 展示タイム（table[1]の各tbody）
  const exTable = tables.eq(1);
  const tbodies = exTable.find("tbody");

  tbodies.each((i, tbody) => {
    if (i >= 6) return;
    const rows = $(tbody).find("tr");
    if (rows.length < 1) return;

    const mainCells = rows.eq(0).find("td");
    const boatNumber = parseInt(mainCells.eq(0).text().trim());
    const exhibitionTime = parseFloat(mainCells.eq(4).text().trim());

    if (boatNumber >= 1 && boatNumber <= 6) {
      exhibitionData.push({
        boatNumber,
        exhibitionTime:
          !isNaN(exhibitionTime) && exhibitionTime > 0 ? exhibitionTime : null,
        startTiming: null,
      });
    }
  });

  // 展示ST（table[2]）
  if (tables.length >= 3) {
    const startTable = tables.eq(2);
    startTable.find(".table1_boatImage1").each((i, el) => {
      const boatText =
        $(el).find(".table1_boatImage1Number").text().trim() ||
        $(el).text().trim().split("\n")[0].trim();
      const boatNum = parseInt(boatText);

      const stText = $(el).find(".table1_boatImage1Time").text().trim();
      const isFlying = stText.includes("F");
      const numMatch = stText.match(/[FL]?\.(\d+)/);
      const stValue = numMatch ? parseFloat("0." + numMatch[1]) : null;

      if (boatNum >= 1 && boatNum <= 6 && stValue !== null) {
        const entry = exhibitionData.find((e) => e.boatNumber === boatNum);
        if (entry) {
          entry.startTiming = stValue;
          entry.isFlying = isFlying;
        }
      }
    });
  }

  const hasData = exhibitionData.some(
    (e) => e.exhibitionTime !== null || e.startTiming !== null,
  );
  return hasData ? exhibitionData : null;
}

/**
 * 1レースの展示データを取得
 */
async function fetchExhibitionForRace(date, venueCode, raceNo) {
  const ymd = date.replace(/-/g, "");
  const jcd = String(venueCode).padStart(2, "0");
  const url = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${jcd}&hd=${ymd}`;

  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    return scrapeExhibitionData($);
  } catch (error) {
    console.error(
      `  ❌ ${VENUE_NAMES[venueCode]} ${raceNo}R: ${error.message}`,
    );
    return null;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log("🚀 展示データ専用スクレイピング開始");
  console.log(`⏰ ${new Date().toISOString()}`);

  if (!isSupabaseEnabled()) {
    console.error("❌ Supabase環境変数が未設定です。");
    process.exit(1);
  }

  const date = parseDateArg() || getTodayDateJST();
  console.log(`📅 対象日: ${date}`);

  // 本日の開催会場を取得
  const venues = await getTodayVenues();
  if (venues.length === 0) {
    console.log("本日の開催はありません。");
    return;
  }

  // races テーブルに存在する race_id（FK 制約のため、これがないと書き込めない）
  const racesInDb = await getExistingRaceIds(date);
  console.log(`📊 races テーブル: ${racesInDb.size}件`);

  // 展示データ取得済みの race_id（スキップ判定用）
  const existingExhibitionIds = await getExistingExhibitionRaceIds(date);
  console.log(`📊 取得済み展示データ: ${existingExhibitionIds.size}件`);

  let totalFetched = 0;
  let totalSkipped = 0;
  let totalNoRaceRecord = 0;
  const allRows = [];

  for (const venueCode of venues) {
    const venueName = VENUE_NAMES[venueCode];
    let venueFetched = 0;
    let venueSkipped = 0;

    for (let raceNo = 1; raceNo <= 12; raceNo++) {
      const raceId = makeRaceId(date, venueCode, raceNo);

      // 取得済みならスキップ
      if (existingExhibitionIds.has(raceId)) {
        venueSkipped++;
        continue;
      }

      // races テーブルに未登録ならスキップ（FK 制約）
      if (!racesInDb.has(raceId)) {
        totalNoRaceRecord++;
        continue;
      }

      const exhibitionData = await fetchExhibitionForRace(
        date,
        venueCode,
        raceNo,
      );

      if (exhibitionData) {
        for (const ex of exhibitionData) {
          if (ex.exhibitionTime != null || ex.startTiming != null) {
            allRows.push({
              race_id: raceId,
              boat_number: ex.boatNumber,
              exhibition_time: ex.exhibitionTime,
              start_timing: ex.startTiming,
            });
          }
        }
        venueFetched++;
      }
    }

    totalFetched += venueFetched;
    totalSkipped += venueSkipped;

    if (venueFetched > 0 || venueSkipped > 0) {
      console.log(
        `  ${venueName}: 取得${venueFetched}R / スキップ${venueSkipped}R`,
      );
    }

    // 会場間1秒待機（サーバー負荷配慮）
    if (venueCode !== venues[venues.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Supabase に upsert
  if (allRows.length > 0) {
    console.log(`\n💾 Supabase に ${allRows.length} 件を書き込み中...`);

    for (let i = 0; i < allRows.length; i += 1000) {
      const batch = allRows.slice(i, i + 1000);
      const { error } = await supabase
        .from("exhibition_data")
        .upsert(batch, { onConflict: "race_id,boat_number" });

      if (error) {
        console.error(`❌ exhibition_data 書き込みエラー:`, error.message);
      }
    }

    console.log(`✅ 書き込み完了`);
  } else {
    console.log("\n📭 新規データなし");
  }

  if (totalNoRaceRecord > 0) {
    console.log(
      `⚠️ races未登録のためスキップ: ${totalNoRaceRecord}R（scrape.yml の実行後に再取得されます）`,
    );
  }
  console.log(
    `\n📊 結果: 取得${totalFetched}R / スキップ${totalSkipped}R / データ${allRows.length}件`,
  );
  console.log("🏁 完了");
}

main().catch((error) => {
  console.error("❌ エラー:", error);
  process.exit(1);
});
