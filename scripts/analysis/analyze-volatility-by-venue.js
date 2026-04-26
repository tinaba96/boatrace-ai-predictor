/**
 * 会場別イン崩れ因子分析
 *
 * 各会場で「どの因子が1コース飛びを最もよく予測できるか」を分析し、
 * calculateVolatilityScore() の会場別重みチューニングに活かす。
 *
 * 出力:
 * - 会場ごとのベースライン飛び率
 * - 各因子（全国勝率 / avgST / モーター2連率 / σ）の Q1-Q4 飛び率差
 * - 最も予測力が高い因子
 * - 推奨重み調整の方向性
 */

import { supabase } from "../lib/supabaseClient.js";

const DAYS = 90;
const MIN_SAMPLES = 80; // この件数以下の会場はスキップ

const VENUE_NAMES = {
  1: "桐生",
  2: "戸田",
  3: "江戸川",
  4: "平和島",
  5: "多摩川",
  6: "浜名湖",
  7: "蒲郡",
  8: "常滑",
  9: "津",
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

function pct(rate, n = 1) {
  return `${(rate * 100).toFixed(n)}%`;
}

function pad(s, n) {
  return String(s).padStart(n);
}

// ページネーションつき全件取得
async function fetchAll(table, query) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// Q1-Q4 飛び率差を計算（値が「低いほど飛びやすい」因子用）
function analyzeFactorLowBad(entries, fieldFn, baseUpsetRate) {
  const withData = entries.filter((r) => fieldFn(r) != null);
  if (withData.length < 40) return null;

  const sorted = [...withData].sort((a, b) => fieldFn(a) - fieldFn(b));
  const q = Math.floor(sorted.length / 4);
  const q1 = sorted.slice(0, q);
  const q4 = sorted.slice(q * 3);

  const upsetQ1 =
    1 - q1.filter((r) => r.winning_technique === "逃げ").length / q1.length;
  const upsetQ4 =
    1 - q4.filter((r) => r.winning_technique === "逃げ").length / q4.length;
  const lift = upsetQ1 - upsetQ4; // 低い方が飛びやすいなら正

  return {
    q1Rate: upsetQ1,
    q4Rate: upsetQ4,
    lift,
    q1Min: fieldFn(q1[0]),
    q1Max: fieldFn(q1[q1.length - 1]),
    q4Min: fieldFn(q4[0]),
    q4Max: fieldFn(q4[q4.length - 1]),
    n: withData.length,
  };
}

// Q1-Q4 飛び率差を計算（値が「高いほど飛びやすい」因子用）
function analyzeFactorHighBad(entries, fieldFn, baseUpsetRate) {
  const result = analyzeFactorLowBad(entries, fieldFn, baseUpsetRate);
  if (!result) return null;
  // Q1とQ4を反転（高い方が飛びやすいので Q4 の飛び率 > Q1 になるはず）
  return {
    ...result,
    lift: result.q4Rate - result.q1Rate, // 高い方が飛びやすいなら正
  };
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceStr = since.toISOString().split("T")[0];

  console.log("🏁 会場別イン崩れ因子分析\n");
  console.log(`📅 期間: 過去${DAYS}日 (${sinceStr} 〜)\n`);

  // races（volatility + 特徴量付き）
  const races = await fetchAll("races", (from, to) =>
    supabase
      .from("races")
      .select(
        "race_id, venue_code, volatility_score, volatility_level, first_boat_win_rate, first_boat_avg_st, first_boat_motor_2rate, win_rate_stddev",
      )
      .not("volatility_level", "is", null)
      .gte("race_date", sinceStr)
      .range(from, to),
  );

  // race_results
  const results = await fetchAll("race_results", (from, to) =>
    supabase
      .from("race_results")
      .select("race_id, rank1, payout_win, winning_technique")
      .gte("race_id", sinceStr)
      .eq("is_cancelled", false)
      .eq("is_no_race", false)
      .range(from, to),
  );

  // JOIN
  const resultMap = new Map(results.map((r) => [r.race_id, r]));
  const joined = [];
  for (const race of races) {
    const res = resultMap.get(race.race_id);
    if (!res || !res.winning_technique) continue;
    joined.push({ ...race, ...res });
  }

  console.log(`全データ: ${joined.length.toLocaleString()} 件\n`);

  const globalBase =
    1 -
    joined.filter((r) => r.winning_technique === "逃げ").length / joined.length;
  console.log(`全体ベースライン飛び率: ${pct(globalBase)}\n`);

  // 会場ごとにグループ化
  const byVenue = new Map();
  for (const r of joined) {
    if (!byVenue.has(r.venue_code)) byVenue.set(r.venue_code, []);
    byVenue.get(r.venue_code).push(r);
  }

  // 会場別サマリー（飛び率順にソート）
  const venueSummaries = [];

  for (const [venueCode, entries] of byVenue) {
    if (entries.length < MIN_SAMPLES) continue;

    const base =
      1 -
      entries.filter((r) => r.winning_technique === "逃げ").length /
        entries.length;

    // 各因子の予測力を計算
    const winRateLift = analyzeFactorLowBad(
      entries,
      (r) => r.first_boat_win_rate,
      base,
    );
    const avgSTLift = analyzeFactorLowBad(
      entries,
      (r) => r.first_boat_avg_st,
      base,
    );
    const motorLift = analyzeFactorLowBad(
      entries,
      (r) => r.first_boat_motor_2rate,
      base,
    );
    const stddevLift = analyzeFactorHighBad(
      entries,
      (r) => r.win_rate_stddev,
      base,
    );

    // high/low 別飛び率
    const highEntries = entries.filter((r) => r.volatility_level === "high");
    const lowEntries = entries.filter((r) => r.volatility_level === "low");
    const highRate =
      highEntries.length >= 20
        ? 1 -
          highEntries.filter((r) => r.winning_technique === "逃げ").length /
            highEntries.length
        : null;
    const lowRate =
      lowEntries.length >= 20
        ? 1 -
          lowEntries.filter((r) => r.winning_technique === "逃げ").length /
            lowEntries.length
        : null;

    venueSummaries.push({
      venueCode,
      name: VENUE_NAMES[venueCode] || `会場${venueCode}`,
      n: entries.length,
      base,
      highRate,
      lowRate,
      winRateLift,
      avgSTLift,
      motorLift,
      stddevLift,
    });
  }

  // 飛び率の高い会場から表示
  venueSummaries.sort((a, b) => b.base - a.base);

  console.log("=".repeat(70));
  console.log("【会場別 ベースライン飛び率ランキング】");
  console.log("=".repeat(70));
  console.log(
    `  ${"会場".padEnd(6)} ${"n".padStart(5)} ${"飛び率".padStart(7)} ${"low時".padStart(7)} ${"high時".padStart(7)} ${"リフト".padStart(7)}`,
  );
  console.log("  " + "-".repeat(45));
  for (const v of venueSummaries) {
    const lift =
      v.highRate != null && v.lowRate != null
        ? `${((v.highRate - v.lowRate) * 100).toFixed(1)}pt`
        : "  -  ";
    console.log(
      `  ${v.name.padEnd(6)} ${pad(v.n, 5)} ${pct(v.base).padStart(7)} ${v.lowRate != null ? pct(v.lowRate).padStart(7) : "    -  "} ${v.highRate != null ? pct(v.highRate).padStart(7) : "    -  "} ${lift.padStart(7)}`,
    );
  }
  console.log();

  // 会場別詳細
  console.log("=".repeat(70));
  console.log("【会場別 因子予測力詳細】");
  console.log(
    "  ※ lift = Q1（因子が低い/高い）vs Q4 の飛び率差。高いほど予測力あり",
  );
  console.log("=".repeat(70));

  // 因子ごとの最大liftを記録（重み調整推奨のため）
  const weightRecommendations = [];

  for (const v of venueSummaries) {
    console.log(
      `\n  ▶ ${v.name}（n=${v.n}, ベースライン飛び率: ${pct(v.base)}）`,
    );

    const factors = [
      {
        name: "1号艇全国勝率",
        result: v.winRateLift,
        direction: "低い→飛びやすい",
      },
      {
        name: "1号艇avgST",
        result: v.avgSTLift,
        direction: "遅い→飛びやすい",
      },
      {
        name: "1号艇モーター2連率",
        result: v.motorLift,
        direction: "低い→飛びやすい",
      },
      {
        name: "選手間σ",
        result: v.stddevLift,
        direction: "高い→飛びやすい",
      },
    ].filter((f) => f.result != null);

    if (factors.length === 0) {
      console.log("    データ不足のためスキップ");
      continue;
    }

    factors.sort((a, b) => b.result.lift - a.result.lift);

    for (const f of factors) {
      const r = f.result;
      const liftStr =
        r.lift >= 0
          ? `+${(r.lift * 100).toFixed(1)}pt`
          : `${(r.lift * 100).toFixed(1)}pt`;
      const bar =
        r.lift > 0
          ? "▓".repeat(Math.min(20, Math.round(r.lift * 100)))
          : "░".repeat(Math.min(10, Math.round(Math.abs(r.lift) * 100)));
      console.log(
        `    ${f.name.padEnd(14)} lift=${liftStr.padStart(8)}  Q1: ${pct(r.q1Rate)} / Q4: ${pct(r.q4Rate)}  ${bar}`,
      );
    }

    // 最強因子と現行重みの比較
    const strongest = factors[0];
    const weakest = factors[factors.length - 1];

    if (strongest.result.lift > 0.05) {
      const rec = {
        venue: v.name,
        venueCode: v.venueCode,
        base: v.base,
        strongestFactor: strongest.name,
        strongestLift: strongest.result.lift,
        weakestFactor: weakest.name,
        weakestLift: weakest.result.lift,
      };
      weightRecommendations.push(rec);
    }
  }

  // 会場グループ別まとめ
  console.log("\n");
  console.log("=".repeat(70));
  console.log("【因子別 — 全会場を通じて最も効く会場 TOP5】");
  console.log("=".repeat(70));

  const factorKeys = [
    { name: "1号艇全国勝率", key: "winRateLift" },
    { name: "1号艇avgST", key: "avgSTLift" },
    { name: "1号艇モーター2連率", key: "motorLift" },
    { name: "選手間σ", key: "stddevLift" },
  ];

  for (const { name, key } of factorKeys) {
    const ranked = venueSummaries
      .filter((v) => v[key] != null)
      .sort((a, b) => b[key].lift - a[key].lift)
      .slice(0, 5);

    console.log(
      `\n  ${name}（${key === "stddevLift" ? "高い→飛びやすい" : "低い→飛びやすい"}）:`,
    );
    for (const v of ranked) {
      const r = v[key];
      const liftStr = `+${(r.lift * 100).toFixed(1)}pt`;
      console.log(
        `    ${v.name.padEnd(6)} lift=${liftStr.padStart(8)}  (Q1: ${pct(r.q1Rate)} / Q4: ${pct(r.q4Rate)}, n=${r.n})`,
      );
    }
  }

  // 重み調整推奨まとめ
  console.log("\n");
  console.log("=".repeat(70));
  console.log("【重み調整推奨サマリー】");
  console.log(
    "  ※ 現行重み: 全国勝率36% / avgST28% / AI逃げ11% / σ11% / 会場8% / モーター6%",
  );
  console.log("=".repeat(70));

  if (weightRecommendations.length === 0) {
    console.log("  推奨なし（全会場でデータ不足または差異が小さい）");
  } else {
    // 最強因子が全国勝率以外の会場を特に注目
    const notable = weightRecommendations.filter(
      (r) => r.strongestFactor !== "1号艇全国勝率" && r.strongestLift > 0.08,
    );
    if (notable.length > 0) {
      console.log(
        "\n  ■ 全国勝率以外が最強因子の会場（会場別チューニング候補）:",
      );
      for (const r of notable) {
        console.log(
          `    ${r.venue}: 最強=${r.strongestFactor}（+${(r.strongestLift * 100).toFixed(1)}pt）`,
        );
      }
    }

    // 全国勝率のliftが全体平均より低い会場
    const globalWinRateLift =
      venueSummaries
        .filter((v) => v.winRateLift != null)
        .reduce((s, v) => s + v.winRateLift.lift, 0) /
      venueSummaries.filter((v) => v.winRateLift != null).length;

    console.log(
      `\n  全会場平均: 全国勝率lift=${(globalWinRateLift * 100).toFixed(1)}pt`,
    );
    const lowWinRateVenues = venueSummaries.filter(
      (v) =>
        v.winRateLift != null && v.winRateLift.lift < globalWinRateLift * 0.7,
    );
    if (lowWinRateVenues.length > 0) {
      console.log(
        "  ■ 全国勝率の予測力が平均より低い会場（他因子の比重を上げる候補）:",
      );
      for (const v of lowWinRateVenues) {
        console.log(
          `    ${v.name}: 全国勝率lift=+${(v.winRateLift.lift * 100).toFixed(1)}pt（平均の70%以下）`,
        );
      }
    }
  }

  console.log("\n✅ 分析完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
