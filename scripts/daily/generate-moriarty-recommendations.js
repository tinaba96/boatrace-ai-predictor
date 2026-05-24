// Generate bet recommendations for the Moriarty meta-model.
// Loads calibrators from data/moriarty/calibrators.json,
// fetches today's predictions and latest race odds,
// computes EV and Kelly fraction, then bulk-inserts into bet_recommendations.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";
import { IsotonicCalibrator } from "../lib/isotonic-regression.js";
import { halfKelly } from "../lib/kelly-criterion.js";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_ID = "moriarty";
const BASE_MODELS = ["standard", "safeBet", "upsetFocus"];
const EV_THRESHOLD = 1.05;
const EV_STRONG_THRESHOLD = 1.2;

function loadCalibrators(calibratorsJson) {
  const result = {};
  for (const [modelId, betTypes] of Object.entries(calibratorsJson.models)) {
    result[modelId] = {};
    for (const [betType, json] of Object.entries(betTypes)) {
      result[modelId][betType] = json
        ? IsotonicCalibrator.fromJSON(json)
        : null;
    }
  }
  return result;
}

async function fetchTodayPredictions(date) {
  const { data, error } = await supabase
    .from("predictions")
    .select("race_id, model_id, scores, top_pick")
    .in("model_id", BASE_MODELS)
    .eq("is_shadow", false)
    .gte("predicted_at", `${date}T00:00:00+09:00`)
    .lt("predicted_at", `${date}T23:59:59+09:00`);

  if (error) throw new Error(`predictions fetch error: ${error.message}`);
  return data || [];
}

async function fetchLatestOdds(raceIds) {
  // Get the most recent odds snapshot per race
  const { data, error } = await supabase
    .from("race_odds")
    .select(
      "race_id, captured_at, odds_win_1, odds_win_2, odds_win_3, odds_win_4, odds_win_5, odds_win_6",
    )
    .in("race_id", raceIds)
    .order("captured_at", { ascending: false });

  if (error) throw new Error(`race_odds fetch error: ${error.message}`);

  // Keep only the latest snapshot per race
  const latestByRace = {};
  for (const row of data || []) {
    if (!latestByRace[row.race_id]) {
      latestByRace[row.race_id] = row;
    }
  }
  return latestByRace;
}

function getOddsForBoat(oddsRow, boatNumber) {
  return oddsRow[`odds_win_${boatNumber}`] ?? null;
}

function getTopScore(scoresObj) {
  if (!scoresObj || typeof scoresObj !== "object") return null;
  const vals = Object.values(scoresObj).filter((v) => typeof v === "number");
  return vals.length > 0 ? Math.max(...vals) : null;
}

function getBoatScore(scoresObj, boatNumber) {
  if (!scoresObj || typeof scoresObj !== "object") return null;
  return scoresObj[String(boatNumber)] ?? scoresObj[boatNumber] ?? null;
}

async function main() {
  if (!isSupabaseEnabled()) {
    console.error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
    );
    process.exit(1);
  }

  const date = parseDateArg(process.argv[2]) || getTodayDateJST();
  console.log(`Generating Moriarty recommendations for ${date}`);

  const calibratorsPath = path.join(
    __dirname,
    "../../data/moriarty/calibrators.json",
  );
  let calibratorsJson;
  try {
    calibratorsJson = JSON.parse(await fs.readFile(calibratorsPath, "utf-8"));
  } catch {
    console.error(
      `calibrators.json not found at ${calibratorsPath}. Run train-moriarty-calibration.js first.`,
    );
    process.exit(1);
  }

  const calibrators = loadCalibrators(calibratorsJson);

  const predictions = await fetchTodayPredictions(date);
  if (predictions.length === 0) {
    console.log("No predictions found for today.");
    return;
  }

  const raceIds = [...new Set(predictions.map((p) => p.race_id))];
  console.log(
    `  Races: ${raceIds.length}, prediction rows: ${predictions.length}`,
  );

  const oddsMap = await fetchLatestOdds(raceIds);

  // Group predictions by race
  const byRace = {};
  for (const p of predictions) {
    if (!byRace[p.race_id]) byRace[p.race_id] = [];
    byRace[p.race_id].push(p);
  }

  const recommendations = [];

  for (const raceId of raceIds) {
    const racePreds = byRace[raceId];
    const oddsRow = oddsMap[raceId];

    // Collect best EV candidate across all base models and bet types
    let bestEv = 0;
    let bestReason = null;

    for (const p of racePreds) {
      const modelId = p.model_id;
      const boatNumber = p.top_pick;

      // win bet type: use boat-level score vs win odds
      const winCal = calibrators[modelId]?.win;
      const boatScore = getBoatScore(p.scores, boatNumber);

      if (winCal && boatScore != null && oddsRow) {
        const odds = getOddsForBoat(oddsRow, boatNumber);
        if (odds != null && odds > 1) {
          const prob = winCal.predict(boatScore);
          const ev = prob * odds;
          if (ev > bestEv) {
            bestEv = ev;
            bestReason = {
              bet_type: "win",
              boat_number: boatNumber,
              calibrated_probability: prob,
              odds,
              based_on_model: modelId,
            };
          }
        }
      }

      // place bet type: use top score vs implied place odds (odds / 4 as rough proxy when no place odds column)
      const placeCal = calibrators[modelId]?.place;
      const topScore = getTopScore(p.scores);
      if (placeCal && topScore != null && oddsRow) {
        const winOdds = getOddsForBoat(oddsRow, boatNumber);
        if (winOdds != null && winOdds > 1) {
          const placeOdds = winOdds / 3; // rough proxy; actual place odds not stored per-boat
          if (placeOdds > 1) {
            const prob = placeCal.predict(topScore);
            const ev = prob * placeOdds;
            if (ev > bestEv) {
              bestEv = ev;
              bestReason = {
                bet_type: "place",
                boat_number: boatNumber,
                calibrated_probability: prob,
                odds: placeOdds,
                based_on_model: modelId,
              };
            }
          }
        }
      }
    }

    let recommendation;
    let betFraction = null;

    if (bestReason && bestEv >= EV_STRONG_THRESHOLD) {
      recommendation = "strong_bet";
      betFraction = halfKelly(
        bestReason.calibrated_probability,
        bestReason.odds,
      );
    } else if (bestReason && bestEv >= EV_THRESHOLD) {
      recommendation = "bet";
      betFraction = halfKelly(
        bestReason.calibrated_probability,
        bestReason.odds,
      );
    } else {
      recommendation = "skip";
    }

    recommendations.push({
      race_id: raceId,
      model_id: MODEL_ID,
      recommendation,
      reasons: bestReason ?? null,
      expected_value: bestEv > 0 ? Math.round(bestEv * 100) / 100 : null,
      bet_fraction:
        betFraction != null ? Math.round(betFraction * 10000) / 10000 : null,
    });
  }

  const betCount = recommendations.filter(
    (r) => r.recommendation !== "skip",
  ).length;
  console.log(
    `  Recommendations: ${betCount} bet / ${recommendations.length - betCount} skip`,
  );

  // Bulk upsert into bet_recommendations
  const { error: upsertError } = await supabase
    .from("bet_recommendations")
    .upsert(recommendations, { onConflict: "race_id,model_id" });

  if (upsertError) {
    console.error("bet_recommendations upsert error:", upsertError.message);
    process.exit(1);
  }

  console.log(
    `Inserted/updated ${recommendations.length} rows in bet_recommendations.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
