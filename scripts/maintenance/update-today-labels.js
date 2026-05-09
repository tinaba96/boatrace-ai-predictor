/**
 * 本日のレースのvolatility_levelを新しい動的閾値で再計算・更新
 * 実行: node scripts/maintenance/update-today-labels.js
 */
import { supabase } from "../lib/supabaseClient.js";
import { getTodayDateJST } from "../lib/dateUtils.js";
import { getVolatilityThreshold } from "../lib/venueParameters.js";

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

function getVolatilityLevel(score, venueCode) {
  const highThr = getVolatilityThreshold(venueCode);
  const lowThr = Math.max(30, highThr - 15);
  if (score < lowThr) return "low";
  if (score < highThr) return "medium";
  return "high";
}

async function updateTodayLabels() {
  try {
    const today = getTodayDateJST();
    console.log(`\n${"=".repeat(100)}`);
    console.log(`🔄 本日のラベル再計算・更新: ${today}`);
    console.log(`新しい動的閾値を適用します\n`);

    // 本日のレースを取得
    const { data: races, error } = await supabase
      .from("races")
      .select("race_id, venue_code, volatility_score, volatility_level")
      .eq("race_date", today)
      .not("volatility_score", "is", null)
      .order("race_id");

    if (error) throw error;

    if (!races || races.length === 0) {
      console.log(`ℹ️  本日のレースはありません`);
      console.log(`${"=".repeat(100)}\n`);
      return;
    }

    console.log(`📊 対象レース: ${races.length}件\n`);

    // ラベルの変更を追跡
    const updates = [];
    const changes = { low: 0, medium: 0, high: 0 };
    let changedCount = 0;

    for (const race of races) {
      const newLabel = getVolatilityLevel(
        race.volatility_score,
        race.venue_code,
      );

      if (newLabel !== race.volatility_level) {
        changedCount++;
        updates.push({
          race_id: race.race_id,
          oldLabel: race.volatility_level,
          newLabel,
          score: race.volatility_score,
          venue: race.venue_code,
        });
        changes[newLabel]++;
      }
    }

    if (changedCount === 0) {
      console.log(`✅ ラベル変更なし（既に正しく計算されています）\n`);
      console.log(`${"=".repeat(100)}\n`);
      return;
    }

    console.log(`⚡ 変更されるラベル: ${changedCount}件\n`);

    // 変更内容を表示
    console.log(`| 会場 | レース | 旧 | 新 | スコア |`);
    console.log(`|------|--------|-----|-----|--------|`);
    updates.forEach((u) => {
      console.log(
        `| ${VENUE_NAMES[u.venue]}(${u.venue}) | ${u.race_id.split("-").slice(0, 3).join("-")} | ${u.oldLabel} | ${u.newLabel} | ${u.score} |`,
      );
    });

    console.log();

    // DBを更新
    console.log(`🔄 DBを更新中...\n`);

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("races")
        .update({ volatility_level: update.newLabel })
        .eq("race_id", update.race_id);

      if (updateError) {
        console.error(`❌ 更新失敗 ${update.race_id}:`, updateError.message);
        throw updateError;
      }
    }

    console.log(`✅ DB更新完了: ${changedCount}件のラベルを更新しました\n`);

    console.log(`📊 ラベル別変更数:`);
    console.log(`  → Low: ${changes.low}件`);
    console.log(`  → Medium: ${changes.medium}件`);
    console.log(`  → High: ${changes.high}件\n`);

    console.log(`${"=".repeat(100)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

await updateTodayLabels();
