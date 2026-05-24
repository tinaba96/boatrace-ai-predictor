// Train isotonic calibrators for the Moriarty meta-model.
// Reads 180 days of predictions + race_results from Supabase,
// fits one IsotonicCalibrator per (base_model x bet_type),
// and writes data/moriarty/calibrators.json.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  supabase,
  isSupabaseEnabled,
  fetchAll,
} from "../lib/supabaseClient.js";
import { IsotonicCalibrator } from "../lib/isotonic-regression.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_MODELS = ["standard", "safeBet", "upsetFocus"];
const BET_TYPES = ["win", "place", "trifecta"];

// Brier score: lower is better, 0 = perfect, 0.25 = uninformative
function brierScore(probs, outcomes) {
  if (probs.length === 0) return null;
  const sum = probs.reduce((s, p, i) => s + (p - outcomes[i]) ** 2, 0);
  return sum / probs.length;
}

async function fetchTrainingData(fromDate) {
  const predictions = await fetchAll(
    "predictions",
    "race_id, model_id, scores, is_hit_win, is_hit_place, is_hit_trifecta",
    (q) =>
      q
        .in("model_id", BASE_MODELS)
        .not("is_hit_win", "is", null)
        .gte("predicted_at", fromDate)
        .eq("is_shadow", false),
  );
  return predictions;
}

function extractSamples(predictions, modelId, betType) {
  const isHitKey = `is_hit_${betType}`;
  const scores = [];
  const outcomes = [];

  for (const p of predictions) {
    if (p.model_id !== modelId) continue;
    if (p[isHitKey] == null) continue;

    // scores JSONB: { "1": 80, "2": 60, ... } keyed by boat_number
    // Use the top_pick score as the representative score for this prediction.
    // If scores object exists, sum all values as a composite confidence proxy.
    let score = null;
    if (p.scores && typeof p.scores === "object") {
      const vals = Object.values(p.scores).filter((v) => typeof v === "number");
      if (vals.length > 0) {
        score = Math.max(...vals); // highest-scoring boat's score
      }
    }
    if (score == null) continue;

    scores.push(score);
    outcomes.push(p[isHitKey] ? 1 : 0);
  }

  return { scores, outcomes };
}

async function main() {
  if (!isSupabaseEnabled()) {
    console.error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
    );
    process.exit(1);
  }

  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - 180);
  const fromDateStr = fromDate.toISOString().slice(0, 10);
  const toDateStr = toDate.toISOString().slice(0, 10);

  console.log(`Fetching predictions from ${fromDateStr} to ${toDateStr}...`);
  const predictions = await fetchTrainingData(fromDate.toISOString());
  console.log(`  Total prediction rows: ${predictions.length}`);

  const calibrators = {};

  for (const modelId of BASE_MODELS) {
    calibrators[modelId] = {};
    for (const betType of BET_TYPES) {
      const { scores, outcomes } = extractSamples(
        predictions,
        modelId,
        betType,
      );

      if (scores.length < 10) {
        console.log(
          `  ${modelId}/${betType}: insufficient samples (${scores.length}), skipping`,
        );
        calibrators[modelId][betType] = null;
        continue;
      }

      const cal = new IsotonicCalibrator();
      cal.fit(scores, outcomes);

      const calibratedProbs = cal.predict(scores);
      const bs = brierScore(calibratedProbs, outcomes);
      const hitRate = outcomes.filter((o) => o === 1).length / outcomes.length;

      console.log(
        `  ${modelId}/${betType}: n=${scores.length}, hit_rate=${(hitRate * 100).toFixed(1)}%, brier=${bs != null ? bs.toFixed(4) : "n/a"}`,
      );

      calibrators[modelId][betType] = cal.toJSON();
    }
  }

  const output = {
    trained_at: toDate.toISOString(),
    training_data_from: fromDateStr,
    training_data_to: toDateStr,
    models: calibrators,
  };

  const outPath = path.join(__dirname, "../../data/moriarty/calibrators.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Calibrators written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
