/**
 * 本日のレースの recommended_model を新しい動的閾値で再計算・更新
 * 実行: node scripts/maintenance/update-today-recommended-models.js
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

function getRecommendedModel(level) {
  if (level === "low") return "safe-bet"; // 本命狙い
  if (level === "high") return "upset-focus"; // 穴狙い
  return "standard"; // スタンダード
}

async function updateTodayRecommendedModels() {
  try {
    const today = getTodayDateJST();
    console.log(`\n${"=".repeat(100)}`);
    console.log(`🔄 本日の推奨モデルを再計算・更新: ${today}`);
    console.log(`新しい動的閾値に基づいて recommended_model を更新します\n`);

    // 本日のレースを取得
    const { data: races, error: racesError } = await supabase
      .from("races")
      .select(
        "race_id, venue_code, volatility_score, volatility_level, recommended_model",
      )
      .eq("race_date", today)
      .not("volatility_score", "is", null)
      .order("race_id");

    if (racesError) throw racesError;

    if (!races || races.length === 0) {
      console.log(`ℹ️  本日のレースはありません`);
      console.log(`${"=".repeat(100)}\n`);
      return;
    }

    console.log(`📊 対象レース: ${races.length}件\n`);

    // 推奨モデルの更新情報を集計
    const updates = [];
    const changes = {};

    for (const race of races) {
      const newLevel = getVolatilityLevel(
        race.volatility_score,
        race.venue_code,
      );
      const newRecommendedModel = getRecommendedModel(newLevel);

      if (newRecommendedModel !== race.recommended_model) {
        updates.push({
          race_id: race.race_id,
          venue: race.venue_code,
          oldModel: race.recommended_model,
          newModel: newRecommendedModel,
          score: race.volatility_score,
        });

        const key = `${race.recommended_model} → ${newRecommendedModel}`;
        changes[key] = (changes[key] || 0) + 1;
      }
    }

    if (updates.length === 0) {
      console.log(`✅ 推奨モデルの変更なし（既に正しく計算されています）\n`);
      console.log(`${"=".repeat(100)}\n`);
      return;
    }

    console.log(`⚡ 変更される推奨モデル: ${updates.length}件\n`);

    // 変更内容を表示
    console.log(`| 会場 | レース | 旧モデル | 新モデル | スコア |`);
    console.log(`|------|--------|---------|---------|--------|`);
    updates.forEach((u) => {
      const venueName = VENUE_NAMES[u.venue] || `会場${u.venue}`;
      const raceNum = u.race_id.split("-")[3];
      console.log(
        `| ${venueName}(${String(u.venue).padStart(2, "0")}) | ${raceNum}R | ${u.oldModel} | ${u.newModel} | ${u.score} |`,
      );
    });

    console.log();

    // DBを更新
    console.log(`🔄 DBを更新中...\n`);

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("races")
        .update({ recommended_model: update.newModel })
        .eq("race_id", update.race_id);

      if (updateError) {
        console.error(`❌ 更新失敗 ${update.race_id}:`, updateError.message);
        throw updateError;
      }
    }

    console.log(
      `✅ DB更新完了: ${updates.length}件の推奨モデルを更新しました\n`,
    );

    console.log(`📊 モデル変更統計:`);
    Object.entries(changes).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}件`);
    });

    console.log(`\n${"=".repeat(100)}\n`);
  } catch (err) {
    console.error(`❌ エラー: ${err.message}`);
    process.exit(1);
  }
}

await updateTodayRecommendedModels();
