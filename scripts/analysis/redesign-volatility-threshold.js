/**
 * イン崩れ指数 — 閾値再設計・特徴量有効性検証
 *
 * 目的:
 *   1. 各閾値での精度（飛び率）とカバレッジ（件数）のトレードオフを明示
 *   2. 個別特徴量の予測力を偏相関的に検証 → 不要特徴量を特定
 *   3. 「ユーザーが確信を持ってインを捨てられる」閾値を提案
 */

import { supabase } from "../lib/supabaseClient.js";
import {
  VENUE_1COURSE_WIN_RATE,
  VENUE_1COURSE_AVG,
} from "../lib/venueParameters.js";

const DAYS = 90;

function pct(rate, d = 1) {
  return `${(rate * 100).toFixed(d)}%`;
}
function pad(s, n) {
  return String(s).padStart(n);
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

// スピアマン順位相関係数（単調な関係の強さ）
function spearmanCorr(xs, ys) {
  const n = xs.length;
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

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceStr = since.toISOString().split("T")[0];
  console.log(`\n🔬 イン崩れ指数 — 閾値再設計・特徴量検証`);
  console.log(`📅 期間: 過去${DAYS}日 (${sinceStr} 〜)\n`);

  // データ取得
  const races = await fetchAll("races", (from, to) =>
    supabase
      .from("races")
      .select(
        `race_id, venue_code, volatility_score,
         first_boat_win_rate, first_boat_avg_st, first_boat_motor_2rate,
         win_rate_stddev`,
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
    .map((r) => ({
      ...r,
      ...resultMap.get(r.race_id),
      venue_win_rate_1: VENUE_1COURSE_WIN_RATE[r.venue_code] ?? VENUE_1COURSE_AVG,
    }))
    .filter((r) => r.winning_technique);

  const baseline =
    1 -
    joined.filter((r) => r.winning_technique === "逃げ").length / joined.length;
  console.log(`総レース数: ${joined.length.toLocaleString()} 件`);
  console.log(`ベースライン（1コース飛び率）: ${pct(baseline)}\n`);

  // ─────────────────────────────────────────
  // 1. 閾値別: 精度・カバレッジ・期待値
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【1】閾値別パフォーマンス — 精度とカバレッジのトレードオフ");
  console.log("=".repeat(70));
  console.log(
    `${"閾値".padEnd(6)} ${"件数".padStart(6)} ${"割合".padStart(6)} ${"飛び率".padStart(7)} ${"ベース差".padStart(8)} ${"逃げ時配当avg".padStart(12)}`,
  );
  console.log("-".repeat(70));

  for (const thr of [45, 50, 55, 60, 65, 70, 75, 80]) {
    const g = joined.filter((r) => r.volatility_score >= thr);
    if (g.length < 30) continue;
    const flipRate =
      1 - g.filter((r) => r.winning_technique === "逃げ").length / g.length;
    const diff = flipRate - baseline;
    const upseted = g.filter(
      (r) => r.winning_technique !== "逃げ" && r.payout_win,
    );
    const avgPayout =
      upseted.length > 0
        ? upseted.reduce((s, r) => s + r.payout_win, 0) / upseted.length
        : 0;
    const coverage = g.length / joined.length;
    const marker =
      diff >= 0.12 ? " ★★★" : diff >= 0.1 ? " ★★" : diff >= 0.08 ? " ★" : "";
    console.log(
      `score≥${pad(thr, 2)} ${pad(g.length, 6)}件 ${pct(coverage).padStart(6)} ${pct(flipRate).padStart(7)} ${(diff >= 0 ? "+" : "") + (diff * 100).toFixed(1).padStart(5)}pt  ¥${Math.round(avgPayout).toLocaleString().padStart(7)}${marker}`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 2. スコア帯別（5点刻み）飛び率 — 境界を精緻に確認
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【2】スコア帯別（5点刻み）— 閾値境界の精緻な確認");
  console.log("=".repeat(70));

  for (let lo = 40; lo < 100; lo += 5) {
    const g = joined.filter(
      (r) => r.volatility_score >= lo && r.volatility_score < lo + 5,
    );
    if (g.length < 10) continue;
    const flip =
      1 - g.filter((r) => r.winning_technique === "逃げ").length / g.length;
    const diff = flip - baseline;
    const bar = "█".repeat(Math.round(flip * 20));
    const diffStr = (diff >= 0 ? "+" : "") + (diff * 100).toFixed(1) + "pt";
    console.log(
      `  ${pad(lo, 2)}-${lo + 4}点 (n=${pad(g.length, 4)}): ${pct(flip).padStart(6)} ${diffStr.padStart(8)}  ${bar}`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 3. 特徴量の個別予測力
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【3】特徴量の個別予測力（スピアマン相関 + 四分位分析）");
  console.log("  ※ 相関が高いほど単独でイン崩れを予測できる");
  console.log("=".repeat(70));

  const features = [
    { key: "first_boat_win_rate", label: "1号艇全国勝率", inverse: true },
    { key: "first_boat_avg_st", label: "1号艇avgST", inverse: false },
    {
      key: "first_boat_motor_2rate",
      label: "1号艇モーター2連率",
      inverse: true,
    },
    { key: "win_rate_stddev", label: "選手間勝率σ", inverse: false },
    { key: "venue_win_rate_1", label: "会場1コース勝率", inverse: true },
    { key: "volatility_score", label: "イン崩れスコア(合計)", inverse: false },
  ];

  const flip = (r) => (r.winning_technique !== "逃げ" ? 1 : 0);

  for (const { key, label, inverse } of features) {
    const g = joined.filter((r) => r[key] != null);
    if (g.length < 100) {
      console.log(`\n  [${label}]: データ不足(n=${g.length})`);
      continue;
    }

    // スピアマン相関
    const xs = g.map((r) => r[key]);
    const ys = g.map(flip);
    const corr = spearmanCorr(xs, ys) * (inverse ? -1 : 1);

    // 四分位別飛び率
    const sorted = [...g].sort((a, b) => a[key] - b[key]);
    const q = Math.floor(sorted.length / 4);
    const quartiles = [0, 1, 2, 3].map((i) =>
      i < 3 ? sorted.slice(i * q, (i + 1) * q) : sorted.slice(i * q),
    );
    const qFlips = quartiles.map(
      (qg) =>
        1 - qg.filter((r) => r.winning_technique === "逃げ").length / qg.length,
    );
    const qRange = quartiles.map((qg) => [qg[0][key], qg[qg.length - 1][key]]);
    const lift = qFlips[3] - qFlips[0]; // Q4-Q1（高スコア側の方向で統一）
    const effectiveLift = inverse
      ? qFlips[0] - qFlips[3]
      : qFlips[3] - qFlips[0];

    console.log(`\n  [${label}]`);
    console.log(
      `    スピアマン相関: ρ=${corr.toFixed(3)}  Q1→Q4リフト: ${(effectiveLift * 100).toFixed(1)}pt`,
    );
    for (let i = 0; i < 4; i++) {
      const qg = quartiles[i];
      const r0 =
        typeof qRange[i][0] === "number" ? qRange[i][0].toFixed(2) : "?";
      const r1 =
        typeof qRange[i][1] === "number" ? qRange[i][1].toFixed(2) : "?";
      const diff = qFlips[i] - baseline;
      console.log(
        `    Q${i + 1}(${r0}〜${r1}, n=${pad(qg.length, 4)}): 飛び率=${pct(qFlips[i])} (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt)`,
      );
    }
  }
  console.log();

  // ─────────────────────────────────────────
  // 4. モーター2連率「除外」シミュレーション
  //    全国勝率だけで閾値を作った場合との比較
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【4】特徴量除外シミュレーション");
  console.log("  全国勝率 単独 vs 現スコア: どちらが高精度か");
  console.log("=".repeat(70));

  const withWR = joined.filter((r) => r.first_boat_win_rate != null);
  // 全国勝率が低いほどイン崩れ → パーセンタイル上位 = 低勝率
  const sortedWR = [...withWR].sort(
    (a, b) => a.first_boat_win_rate - b.first_boat_win_rate,
  );
  for (const pctTop of [10, 15, 20, 25, 30]) {
    const cutoff = Math.floor(sortedWR.length * (pctTop / 100));
    const g = sortedWR.slice(0, cutoff); // 勝率が低い上位X%
    if (g.length < 30) continue;
    const flipR =
      1 - g.filter((r) => r.winning_technique === "逃げ").length / g.length;
    const diff = flipR - baseline;
    const maxWR = g[g.length - 1].first_boat_win_rate.toFixed(2);
    console.log(
      `  全国勝率 下位${pad(pctTop, 2)}% (≤${maxWR}, n=${pad(g.length, 4)}): 飛び率=${pct(flipR)} (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt)`,
    );
  }
  console.log();

  // 現スコア高スコアとの比較（同件数帯）
  console.log("  現スコア高スコア帯との比較（同じ件数帯）:");
  for (const thr of [65, 70, 75]) {
    const g = joined.filter((r) => r.volatility_score >= thr);
    if (g.length < 30) continue;
    const flipR =
      1 - g.filter((r) => r.winning_technique === "逃げ").length / g.length;
    const diff = flipR - baseline;
    const coverage = ((g.length / joined.length) * 100).toFixed(1);
    console.log(
      `  score≥${thr} (n=${pad(g.length, 4)}, ${coverage}%): 飛び率=${pct(flipR)} (${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pt)`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 5. 会場別: highラベル時の飛び率
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【5】会場別 — score≥70 での飛び率（サンプル20件以上）");
  console.log("=".repeat(70));

  const venueMap = {};
  for (const r of joined) {
    if (!venueMap[r.venue_code]) venueMap[r.venue_code] = { all: [], high: [] };
    venueMap[r.venue_code].all.push(r);
    if (r.volatility_score >= 70) venueMap[r.venue_code].high.push(r);
  }

  const venueNames = {
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

  const rows = [];
  for (const [code, { all, high }] of Object.entries(venueMap)) {
    if (high.length < 20) continue;
    const baseFlip =
      1 - all.filter((r) => r.winning_technique === "逃げ").length / all.length;
    const highFlip =
      1 -
      high.filter((r) => r.winning_technique === "逃げ").length / high.length;
    rows.push({
      code,
      name: venueNames[code] ?? code,
      baseFlip,
      highFlip,
      diff: highFlip - baseFlip,
      n: high.length,
    });
  }
  rows.sort((a, b) => b.diff - a.diff);

  for (const { code, name, baseFlip, highFlip, diff, n } of rows) {
    const bar = "█".repeat(Math.max(0, Math.round(diff * 30)));
    console.log(
      `  ${code}:${(name ?? "").padEnd(4)} base=${pct(baseFlip)} → high=${pct(highFlip)} +${(diff * 100).toFixed(1)}pt (n=${n}) ${bar}`,
    );
  }
  console.log();

  // ─────────────────────────────────────────
  // 6. 提案サマリー
  // ─────────────────────────────────────────
  console.log("=".repeat(70));
  console.log("【提案】閾値・特徴量の再設計案");
  console.log("=".repeat(70));

  const g70 = joined.filter((r) => r.volatility_score >= 70);
  const g70flip =
    g70.length > 0
      ? 1 -
        g70.filter((r) => r.winning_technique === "逃げ").length / g70.length
      : 0;
  const g55 = joined.filter((r) => r.volatility_score >= 55);
  const g55flip =
    g55.length > 0
      ? 1 -
        g55.filter((r) => r.winning_technique === "逃げ").length / g55.length
      : 0;

  console.log(
    `\n  現行 high(score≥55): ${g55.length}件, 飛び率${pct(g55flip)} (+${((g55flip - baseline) * 100).toFixed(1)}pt)`,
  );
  console.log(
    `  変更案 high(score≥70): ${g70.length}件, 飛び率${pct(g70flip)} (+${((g70flip - baseline) * 100).toFixed(1)}pt)`,
  );
  console.log(
    `\n  → 件数は ${g55.length - g70.length}件減少（${(((g55.length - g70.length) / g55.length) * 100).toFixed(0)}%削減）`,
  );
  console.log(`  → 精度は +${((g70flip - g55flip) * 100).toFixed(1)}pt 向上`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
