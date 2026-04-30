/**
 * イン崩れ指数 — 会場別閾値・特徴量再設計
 *
 * 前提: 会場によって1コース飛び率のベースラインが異なるため、
 *       共通閾値55は不適切。会場ごとに最適閾値と有効特徴量を探索する。
 *
 * 出力:
 *   1. 会場別ベースライン一覧
 *   2. 会場別スコア閾値最適化（ベースライン差で評価）
 *   3. 会場別 特徴量有効性（全国勝率・avgST・σ・モーター2連率）
 *   4. 会場グルーピング提案（特性が似た会場をまとめる）
 *   5. 推奨: 会場別閾値テーブル
 */

import { supabase } from "../lib/supabaseClient.js";
import {
  VENUE_1COURSE_WIN_RATE,
  VENUE_1COURSE_AVG,
} from "../lib/venueParameters.js";

const DAYS = 180; // 会場別は90日だとサンプル不足になるため180日に拡張

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

function pct(rate, d = 1) {
  return `${(rate * 100).toFixed(d)}%`;
}
function pad(s, n) {
  return String(s).padStart(n);
}
function bar(val, scale = 30) {
  return "█".repeat(Math.max(0, Math.round(val * scale)));
}

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

function spearmanCorr(xs, ys) {
  const n = xs.length;
  if (n < 10) return null;
  const rankOf = (arr) => {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    sorted.forEach((s, rank) => {
      ranks[s.i] = rank + 1;
    });
    return ranks;
  };
  const rx = rankOf(xs);
  const ry = rankOf(ys);
  const d2sum = rx.reduce((s, r, i) => s + (r - ry[i]) ** 2, 0);
  return 1 - (6 * d2sum) / (n * (n * n - 1));
}

// 閾値ごとの飛び率と件数を返す
function calcThresholdStats(rows, baseline, thresholds) {
  return thresholds.map((thr) => {
    const g = rows.filter((r) => r.volatility_score >= thr);
    if (g.length < 15) return { thr, n: g.length, flipRate: null, lift: null };
    const flipRate =
      1 - g.filter((r) => r.winning_technique === "逃げ").length / g.length;
    return { thr, n: g.length, flipRate, lift: flipRate - baseline };
  });
}

// 各特徴量のスピアマン相関（イン崩れとの関係）
function featureCorrelations(rows) {
  const flip = (r) => (r.winning_technique !== "逃げ" ? 1 : 0);
  const features = [
    { key: "first_boat_win_rate", label: "全国勝率", inverse: true },
    { key: "first_boat_avg_st", label: "avgST", inverse: false },
    { key: "first_boat_motor_2rate", label: "モーター2連率", inverse: true },
    { key: "win_rate_stddev", label: "選手間σ", inverse: false },
  ];
  return features.map(({ key, label, inverse }) => {
    const g = rows.filter((r) => r[key] != null);
    if (g.length < 20) return { label, corr: null, n: g.length };
    const xs = g.map((r) => r[key]);
    const ys = g.map(flip);
    const raw = spearmanCorr(xs, ys);
    const corr = raw !== null ? raw * (inverse ? -1 : 1) : null;
    return { label, corr, n: g.length };
  });
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceStr = since.toISOString().split("T")[0];

  console.log(`\n🔬 イン崩れ指数 — 会場別閾値・特徴量再設計`);
  console.log(`📅 期間: 過去${DAYS}日 (${sinceStr} 〜)\n`);

  // データ取得
  const races = await fetchAll("races", (from, to) =>
    supabase
      .from("races")
      .select(
        `race_id, venue_code, volatility_score,
         first_boat_win_rate, first_boat_avg_st,
         first_boat_motor_2rate, win_rate_stddev`,
      )
      .not("volatility_score", "is", null)
      .gte("race_date", sinceStr)
      .range(from, to),
  );

  const results = await fetchAll("race_results", (from, to) =>
    supabase
      .from("race_results")
      .select(
        "race_id, rank1, payout_win, winning_technique, is_cancelled, is_no_race",
      )
      .gte("race_id", sinceStr)
      .eq("is_cancelled", false)
      .eq("is_no_race", false)
      .range(from, to),
  );

  const resultMap = new Map(results.map((r) => [r.race_id, r]));
  const joined = races
    .map((r) => ({ ...r, ...resultMap.get(r.race_id) }))
    .filter((r) => r.winning_technique);

  const globalBaseline =
    1 -
    joined.filter((r) => r.winning_technique === "逃げ").length / joined.length;

  console.log(`総レース数: ${joined.length.toLocaleString()} 件`);
  console.log(`全体ベースライン: ${pct(globalBaseline)}\n`);

  // 会場別データ分割
  const byVenue = {};
  for (const r of joined) {
    if (!byVenue[r.venue_code]) byVenue[r.venue_code] = [];
    byVenue[r.venue_code].push(r);
  }

  // ─────────────────────────────────────────
  // 1. 会場別ベースライン（フライト率の地図）
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【1】会場別ベースライン — 1コース飛び率（逃げ以外率）");
  console.log("=".repeat(72));

  const venueStats = Object.entries(byVenue)
    .map(([code, rows]) => {
      const baseline =
        1 -
        rows.filter((r) => r.winning_technique === "逃げ").length / rows.length;
      return {
        code,
        name: VENUE_NAMES[code] ?? code,
        baseline,
        n: rows.length,
      };
    })
    .sort((a, b) => b.baseline - a.baseline);

  for (const { code, name, baseline, n } of venueStats) {
    const diff = baseline - globalBaseline;
    const marker =
      baseline >= 0.55
        ? " [高飛び会場]"
        : baseline <= 0.42
          ? " [堅い会場]"
          : "";
    console.log(
      `  ${code}:${name.padEnd(4)} ${pct(baseline).padStart(6)} (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt, n=${pad(n, 4)})  ${bar(baseline, 25)}${marker}`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 2. 会場別 閾値最適化
  //    → ベースラインから+10pt以上を目安に、最も低い閾値を探す
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【2】会場別 閾値最適化");
  console.log("  目標: ベースライン差+10pt以上を達成できる最低スコア閾値");
  console.log("=".repeat(72));

  const THRESHOLDS = [45, 50, 55, 60, 65, 70, 75, 80];
  const TARGET_LIFT = 0.1; // +10pt
  const MIN_SAMPLES = 20;

  const recommendedThresholds = {};

  for (const { code, name, baseline, n } of venueStats) {
    if (n < 100) {
      console.log(`\n  [${code}:${name}] サンプル不足(n=${n}) — スキップ`);
      continue;
    }
    const rows = byVenue[code];
    const stats = calcThresholdStats(rows, baseline, THRESHOLDS);

    // +10pt以上かつサンプル20件以上で最初に達する閾値
    const hit = stats.find(
      (s) => s.lift !== null && s.lift >= TARGET_LIFT && s.n >= MIN_SAMPLES,
    );
    const best = stats.reduce((prev, cur) => {
      if (cur.lift === null || cur.n < MIN_SAMPLES) return prev;
      if (prev === null) return cur;
      return cur.lift > prev.lift ? cur : prev;
    }, null);

    recommendedThresholds[code] = hit?.thr ?? best?.thr ?? null;

    console.log(`\n  [${code}:${name}] baseline=${pct(baseline)} (n=${n})`);
    for (const { thr, n: gn, flipRate, lift } of stats) {
      if (gn < MIN_SAMPLES) continue;
      const liftStr =
        lift !== null
          ? `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}pt`
          : "---";
      const star = lift !== null && lift >= TARGET_LIFT ? " ✅" : "";
      const coverage = `${((gn / n) * 100).toFixed(0)}%`;
      console.log(
        `    score≥${pad(thr, 2)}: n=${pad(gn, 4)} (${coverage.padStart(4)}), 飛び率=${flipRate !== null ? pct(flipRate).padStart(6) : "   ---"}, lift=${liftStr.padStart(7)}${star}`,
      );
    }
    if (recommendedThresholds[code]) {
      console.log(`    → 推奨閾値: score≥${recommendedThresholds[code]}`);
    } else {
      console.log(`    → 推奨閾値: なし（有効なスコア帯なし）`);
    }
  }
  console.log();

  // ─────────────────────────────────────────
  // 3. 会場別 特徴量有効性
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【3】会場別 特徴量有効性（スピアマン相関）");
  console.log("  凡例: ρ≥0.20=強 / 0.10-0.20=中 / <0.10=弱");
  console.log("=".repeat(72));
  console.log(
    `  ${"会場".padEnd(8)} ${"全国勝率".padStart(8)} ${"avgST".padStart(7)} ${"モーター".padStart(8)} ${"選手間σ".padStart(8)}  最強特徴量`,
  );
  console.log("  " + "-".repeat(68));

  const featureSummary = [];
  for (const { code, name, n } of venueStats) {
    if (n < 100) continue;
    const rows = byVenue[code];
    const corrs = featureCorrelations(rows);
    const fmtCorr = (c) => {
      if (c === null) return "  ---";
      const str = c.toFixed(3);
      return c >= 0.2 ? `★${str}` : c >= 0.1 ? ` ${str}` : ` ${str}`;
    };
    const strongest = corrs
      .filter((f) => f.corr !== null)
      .sort((a, b) => b.corr - a.corr)[0];

    featureSummary.push({ code, name, corrs, strongest });

    console.log(
      `  ${code}:${name.padEnd(4)} ${corrs.map((f) => fmtCorr(f.corr).padStart(8)).join("")}  ${strongest?.label ?? "---"}(ρ=${strongest?.corr?.toFixed(3) ?? "?"})`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 4. 会場グルーピング（特性別）
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【4】会場グルーピング — 計算方法を変えるべき特性グループ");
  console.log("=".repeat(72));

  const groups = {
    "高飛び会場（baseline≥55%）": venueStats.filter((v) => v.baseline >= 0.55),
    "標準会場（42%≤baseline<55%）": venueStats.filter(
      (v) => v.baseline >= 0.42 && v.baseline < 0.55,
    ),
    "堅い会場（baseline<42%）": venueStats.filter((v) => v.baseline < 0.42),
  };

  for (const [groupName, venues] of Object.entries(groups)) {
    if (venues.length === 0) continue;
    console.log(`\n  [${groupName}]`);
    for (const { code, name, baseline } of venues) {
      const rec = recommendedThresholds[code];
      const fSummary = featureSummary.find((f) => f.code === code);
      const strongest = fSummary?.strongest?.label ?? "不明";
      console.log(
        `    ${code}:${name.padEnd(4)} base=${pct(baseline)}  推奨閾値=${rec ? `≥${rec}` : "なし"}  最強特徴量=${strongest}`,
      );
    }
    // グループの共通傾向
    const validRecs = venues
      .map((v) => recommendedThresholds[v.code])
      .filter((v) => v != null);
    if (validRecs.length > 0) {
      const avgRec = validRecs.reduce((a, b) => a + b, 0) / validRecs.length;
      console.log(`    → グループ平均推奨閾値: ${avgRec.toFixed(0)}点`);
    }
  }
  console.log();

  // ─────────────────────────────────────────
  // 5. 推奨: 会場別閾値テーブル（実装用）
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【5】実装用 — 会場別推奨閾値テーブル");
  console.log("=".repeat(72));
  console.log(`\n  const VENUE_VOLATILITY_THRESHOLD = {`);
  for (const { code } of venueStats) {
    const rec = recommendedThresholds[code];
    const name = VENUE_NAMES[code];
    if (rec) {
      console.log(`    "${code}": ${rec},  // ${name}`);
    } else {
      console.log(
        `    // "${code}": null,  // ${name}（有効な閾値なし → 非表示推奨）`,
      );
    }
  }
  console.log(`  };\n`);

  // ─────────────────────────────────────────
  // 6. 現行共通閾値55 vs 会場別閾値 — 精度比較
  // ─────────────────────────────────────────
  console.log("=".repeat(72));
  console.log("【6】共通閾値55 vs 会場別推奨閾値 — 精度比較");
  console.log("=".repeat(72));
  console.log(
    `  ${"会場".padEnd(8)} ${"base".padStart(6)} | ${"共通55".padStart(8)} ${"n".padStart(5)} | ${"会場別".padStart(8)} ${"n".padStart(5)} | ${"差".padStart(7)}`,
  );
  console.log("  " + "-".repeat(68));

  let totalCommon = 0,
    commonHit = 0,
    totalVenue = 0,
    venueHit = 0;

  for (const { code, name, baseline } of venueStats) {
    const rows = byVenue[code];
    if (!rows || rows.length < 100) continue;

    const rec = recommendedThresholds[code];

    const gCommon = rows.filter((r) => r.volatility_score >= 55);
    const commonFlip =
      gCommon.length >= MIN_SAMPLES
        ? 1 -
          gCommon.filter((r) => r.winning_technique === "逃げ").length /
            gCommon.length
        : null;

    const gVenue = rec ? rows.filter((r) => r.volatility_score >= rec) : [];
    const venueFlip =
      gVenue.length >= MIN_SAMPLES
        ? 1 -
          gVenue.filter((r) => r.winning_technique === "逃げ").length /
            gVenue.length
        : null;

    const diff =
      venueFlip !== null && commonFlip !== null ? venueFlip - commonFlip : null;
    const diffStr =
      diff !== null
        ? `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt`
        : "  ---";
    const improvement =
      diff !== null && diff >= 0.02
        ? " ⬆"
        : diff !== null && diff <= -0.02
          ? " ⬇"
          : "";

    if (commonFlip !== null) {
      totalCommon += gCommon.length;
      commonHit += gCommon.filter((r) => r.winning_technique !== "逃げ").length;
    }
    if (venueFlip !== null) {
      totalVenue += gVenue.length;
      venueHit += gVenue.filter((r) => r.winning_technique !== "逃げ").length;
    }

    console.log(
      `  ${code}:${name.padEnd(4)} ${pct(baseline).padStart(6)} | ${commonFlip !== null ? pct(commonFlip).padStart(8) : "     ---"} ${pad(gCommon.length, 5)} | ${venueFlip !== null ? pct(venueFlip).padStart(8) : "     ---"} ${pad(gVenue.length, 5)} | ${diffStr.padStart(7)}${improvement}`,
    );
  }

  const overallCommon = totalCommon > 0 ? commonHit / totalCommon : 0;
  const overallVenue = totalVenue > 0 ? venueHit / totalVenue : 0;
  console.log("  " + "-".repeat(68));
  console.log(
    `  ${"合計/平均".padEnd(8)} ${"".padStart(6)} | ${pct(overallCommon).padStart(8)} ${pad(totalCommon, 5)} | ${pct(overallVenue).padStart(8)} ${pad(totalVenue, 5)} | ${(overallVenue - overallCommon >= 0 ? "+" : "") + ((overallVenue - overallCommon) * 100).toFixed(1)}pt`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
