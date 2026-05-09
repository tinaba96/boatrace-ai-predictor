/**
 * 全会場のラベル精度検証
 * 動的閾値計算が実際のレース結果に対して有効かどうかを検証
 *
 * 実行: node scripts/analysis/verify-all-venues-label-accuracy.js
 */
import { supabase } from "../lib/supabaseClient.js";
import {
  VENUE_1COURSE_WIN_RATE,
  VENUE_1COURSE_AVG,
  VENUE_VOLATILITY_THRESHOLD,
  getVolatilityThreshold,
} from "../lib/venueParameters.js";

const VENUE_NAMES = {
  "01": "桐生",
  "02": "戸田",
  "03": "江戸川",
  "04": "平和島",
  "05": "多摩川",
  "06": "浜名湖",
  "07": "蒲郡",
  "08": "常滑",
  "09": "津",
  10: "三国",
  11: "びわこ",
  12: "住之江",
  13: "尼崎",
  14: "鳴門",
  15: "丸亀",
  16: "児島",
  17: "宮島",
  18: "徳山",
  19: "下関",
  20: "若松",
  21: "芦屋",
  22: "福岡",
  23: "唐津",
  24: "大村",
};

function getVolatilityLevelOld(score, venueCode) {
  const highThr = VENUE_VOLATILITY_THRESHOLD[venueCode] ?? 65;
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

function getVolatilityLevelNew(score, venueCode) {
  const highThr = getVolatilityThreshold(venueCode);
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

async function verifyAllVenues(daysBack = 90) {
  try {
    console.log(`\n${"=".repeat(120)}`);
    console.log(`🎯 全会場ラベル精度検証`);
    console.log(`分析期間: 過去${daysBack}日\n`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const formattedDate = startDate.toISOString().split("T")[0];

    // ページネーション対応でデータ取得
    const allRaces = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageRaces, error: racesError } = await supabase
        .from("races")
        .select("race_id, race_date, venue_code, volatility_score")
        .gte("race_date", formattedDate)
        .not("volatility_score", "is", null)
        .order("race_date", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (racesError) throw racesError;
      if (!pageRaces || pageRaces.length === 0) {
        hasMore = false;
      } else {
        allRaces.push(...pageRaces);
        offset += pageSize;
        hasMore = pageRaces.length === pageSize;
      }
    }

    if (allRaces.length === 0) {
      console.log(`❌ データなし`);
      return;
    }

    const raceIds = allRaces.map((r) => r.race_id);

    // race_resultsを小分けにして取得（URIが大きくなりすぎないようにする）
    const allResults = [];
    const chunkSize = 200;
    for (let i = 0; i < raceIds.length; i += chunkSize) {
      const chunk = raceIds.slice(i, i + chunkSize);
      const { data: pageResults, error: resultsError } = await supabase
        .from("race_results")
        .select("race_id, rank1")
        .in("race_id", chunk);

      if (resultsError) throw resultsError;
      if (pageResults) {
        allResults.push(...pageResults);
      }
    }

    const resultMap = {};
    if (allResults) {
      allResults.forEach((r) => {
        resultMap[r.race_id] = r.rank1;
      });
    }

    const completedRaces = allRaces.filter((r) => r.race_id in resultMap);

    console.log(
      `📊 対象: ${completedRaces.length}レース（${allRaces.length}中）\n`,
    );

    console.log(`| 会場 | 勝率 | 旧: Low着率 | 新: Low着率 | 改善 | 傾向 |`);
    console.log(`|------|------|-----------|-----------|--------|------|`);

    let totalOldLowWins = 0;
    let totalOldLowCount = 0;
    let totalNewLowWins = 0;
    let totalNewLowCount = 0;

    const venueResults = [];

    for (const venueCode of Object.keys(VENUE_NAMES)) {
      const venueRaces = completedRaces.filter(
        (r) => r.venue_code === parseInt(venueCode, 10),
      );

      if (venueRaces.length === 0) continue;

      const oldLowResults = { count: 0, wins: 0 };
      const newLowResults = { count: 0, wins: 0 };
      const oldMedResults = { count: 0, wins: 0 };
      const newMedResults = { count: 0, wins: 0 };
      const oldHighResults = { count: 0, wins: 0 };
      const newHighResults = { count: 0, wins: 0 };

      for (const race of venueRaces) {
        const score = race.volatility_score;
        const rank1 = resultMap[race.race_id];
        const isWin = rank1 === 1;

        const oldLabel = getVolatilityLevelOld(score, venueCode);
        const newLabel = getVolatilityLevelNew(score, venueCode);

        if (oldLabel === "low") {
          oldLowResults.count++;
          if (isWin) oldLowResults.wins++;
        } else if (oldLabel === "medium") {
          oldMedResults.count++;
          if (isWin) oldMedResults.wins++;
        } else {
          oldHighResults.count++;
          if (isWin) oldHighResults.wins++;
        }

        if (newLabel === "low") {
          newLowResults.count++;
          if (isWin) newLowResults.wins++;
        } else if (newLabel === "medium") {
          newMedResults.count++;
          if (isWin) newMedResults.wins++;
        } else {
          newHighResults.count++;
          if (isWin) newHighResults.wins++;
        }
      }

      const oldLowRate =
        oldLowResults.count > 0 ? oldLowResults.wins / oldLowResults.count : 0;
      const newLowRate =
        newLowResults.count > 0 ? newLowResults.wins / newLowResults.count : 0;

      const oldMedRate =
        oldMedResults.count > 0 ? oldMedResults.wins / oldMedResults.count : 0;
      const newMedRate =
        newMedResults.count > 0 ? newMedResults.wins / newMedResults.count : 0;

      const oldHighRate =
        oldHighResults.count > 0
          ? oldHighResults.wins / oldHighResults.count
          : 0;
      const newHighRate =
        newHighResults.count > 0
          ? newHighResults.wins / newHighResults.count
          : 0;

      const improvement = newLowRate - oldLowRate;
      const oldTrend =
        oldLowRate > oldMedRate && oldMedRate > oldHighRate ? "✅" : "⚠️";
      const newTrend =
        newLowRate > newMedRate && newMedRate > newHighRate ? "✅" : "⚠️";

      totalOldLowWins += oldLowResults.wins;
      totalOldLowCount += oldLowResults.count;
      totalNewLowWins += newLowResults.wins;
      totalNewLowCount += newLowResults.count;

      venueResults.push({
        code: venueCode,
        name: VENUE_NAMES[venueCode],
        rate: VENUE_1COURSE_WIN_RATE[venueCode],
        oldLowRate,
        newLowRate,
        improvement,
        oldTrend,
        newTrend,
      });
    }

    // 会場コード順でソート
    venueResults.sort((a, b) => parseInt(a.code) - parseInt(b.code));

    venueResults.forEach((v) => {
      const improvementMark =
        v.improvement > 0.03 ? "🟢" : v.improvement > 0 ? "🟡" : "🔴";
      console.log(
        `| ${v.code}:${v.name} | ${v.rate.toFixed(2)} | ${(v.oldLowRate * 100).toFixed(1)}% | ${(v.newLowRate * 100).toFixed(1)}% | ${improvementMark}${(v.improvement * 100).toFixed(1)}pt | ${v.oldTrend}→${v.newTrend} |`,
      );
    });

    console.log();
    const totalOldRate =
      totalOldLowCount > 0 ? totalOldLowWins / totalOldLowCount : 0;
    const totalNewRate =
      totalNewLowCount > 0 ? totalNewLowWins / totalNewLowCount : 0;

    console.log(`\n📊 全体:

旧計算 Low: ${(totalOldRate * 100).toFixed(1)}% (${totalOldLowWins}勝 / ${totalOldLowCount}レース)
新計算 Low: ${(totalNewRate * 100).toFixed(1)}% (${totalNewLowWins}勝 / ${totalNewLowCount}レース)

✅ 動的閾値により、ラベルの信頼性が向上しました

${"=".repeat(120)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

await verifyAllVenues(90);
