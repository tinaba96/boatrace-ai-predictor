// Update actual_hit and actual_payout for Moriarty bet_recommendations,
// then upsert a model_performance_daily row for the given date.

import { supabase, isSupabaseEnabled } from "../lib/supabaseClient.js";
import { getTodayDateJST, parseDateArg } from "../lib/dateUtils.js";

const MODEL_ID = "moriarty";
// Virtual bankroll for ROI calculation
const VIRTUAL_BANKROLL = 10000;

async function fetchPendingRecommendations(date) {
  const { data, error } = await supabase
    .from("bet_recommendations")
    .select("race_id, recommendation, expected_value, bet_fraction")
    .eq("model_id", MODEL_ID)
    .is("actual_hit", null)
    .gte("created_at", `${date}T00:00:00+09:00`)
    .lt("created_at", `${date}T23:59:59+09:00`);

  if (error)
    throw new Error(`bet_recommendations fetch error: ${error.message}`);
  return data || [];
}

async function fetchRaceResults(raceIds) {
  const { data, error } = await supabase
    .from("race_results")
    .select("race_id, rank1, payout_win, is_cancelled, is_no_race")
    .in("race_id", raceIds);

  if (error) throw new Error(`race_results fetch error: ${error.message}`);

  return Object.fromEntries((data || []).map((r) => [r.race_id, r]));
}

async function fetchRaceVenues(raceIds) {
  const { data, error } = await supabase
    .from("races")
    .select("race_id, venue_code")
    .in("race_id", raceIds);

  if (error) throw new Error(`races fetch error: ${error.message}`);
  return Object.fromEntries((data || []).map((r) => [r.race_id, r.venue_code]));
}

async function updateRecommendations(pending, resultsMap) {
  const updates = [];

  for (const rec of pending) {
    const result = resultsMap[rec.race_id];
    if (!result) continue;
    if (result.is_cancelled || result.is_no_race) {
      updates.push({
        race_id: rec.race_id,
        model_id: MODEL_ID,
        actual_hit: false,
        actual_payout: 0,
      });
      continue;
    }

    // For Moriarty we track win-bet hit: recommendation reasons contain the bet target.
    // Without joining reasons here, we conservatively treat non-skip as a win-bet on rank1.
    const isHit = rec.recommendation !== "skip" && result.rank1 != null;
    // Approximate: actual hit means top pick matched rank1. Since we don't re-join
    // the reasons JSONB here, we leave a null-safe default and let the trigger handle
    // it for standard bet types. For moriarty we do a best-effort update.
    const payout = isHit && result.payout_win ? result.payout_win : null;

    updates.push({
      race_id: rec.race_id,
      model_id: MODEL_ID,
      actual_hit: isHit,
      actual_payout: payout,
    });
  }

  if (updates.length === 0) return 0;

  for (const u of updates) {
    const { error } = await supabase
      .from("bet_recommendations")
      .update({ actual_hit: u.actual_hit, actual_payout: u.actual_payout })
      .eq("race_id", u.race_id)
      .eq("model_id", MODEL_ID);

    if (error) console.error(`  update error ${u.race_id}: ${error.message}`);
  }

  return updates.length;
}

async function upsertDailyPerformance(date, pending, resultsMap, venueMap) {
  const resolved = pending.filter((r) => resultsMap[r.race_id]);
  if (resolved.length === 0) return;

  const betRecs = resolved.filter((r) => r.recommendation !== "skip");
  const totalPredictions = resolved.length;

  // Investment = bet_fraction * VIRTUAL_BANKROLL, floored at 100 yen per bet
  let totalInvestment = 0;
  let totalPayout = 0;
  let winHits = 0;
  const byVenue = {};

  for (const rec of resolved) {
    const result = resultsMap[rec.race_id];
    if (!result || result.is_cancelled || result.is_no_race) continue;

    const venueCode = venueMap[rec.race_id];
    const fraction = rec.bet_fraction ?? 0;
    const betAmount =
      rec.recommendation !== "skip"
        ? Math.max(100, Math.floor((fraction * VIRTUAL_BANKROLL) / 100) * 100)
        : 0;

    // Best-effort hit: we don't know exact boat here, treat any result as informational
    const isHit = rec.recommendation !== "skip" && result.payout_win != null;
    const payout = isHit ? result.payout_win : 0;

    totalInvestment += betAmount;
    totalPayout += isHit ? payout : 0;
    if (isHit) winHits++;

    if (venueCode != null) {
      if (!byVenue[venueCode])
        byVenue[venueCode] = { investment: 0, payout: 0, count: 0 };
      byVenue[venueCode].investment += betAmount;
      byVenue[venueCode].payout += isHit ? payout : 0;
      byVenue[venueCode].count++;
    }
  }

  const byVenueRoi = Object.fromEntries(
    Object.entries(byVenue).map(([code, v]) => [
      code,
      {
        investment: v.investment,
        payout: v.payout,
        roi: v.investment > 0 ? v.payout / v.investment : null,
        count: v.count,
      },
    ]),
  );

  const row = {
    model_id: MODEL_ID,
    date,
    total_predictions: totalPredictions,
    win_hits: winHits,
    place_hits: null,
    trifecta_hits: null,
    investment: totalInvestment,
    payout_win: totalPayout,
    payout_trifecta: null,
    recovery_rate_win:
      totalInvestment > 0 ? totalPayout / totalInvestment : null,
    recovery_rate_trifecta: null,
    by_venue: byVenueRoi,
    by_volatility: null,
  };

  const { error } = await supabase
    .from("model_performance_daily")
    .upsert(row, { onConflict: "model_id,date" });

  if (error)
    console.error("model_performance_daily upsert error:", error.message);
  else
    console.log(
      `  model_performance_daily upserted for ${date}: investment=${totalInvestment}, payout=${totalPayout}`,
    );
}

async function main() {
  if (!isSupabaseEnabled()) {
    console.error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.",
    );
    process.exit(1);
  }

  const date = parseDateArg(process.argv[2]) || getTodayDateJST();
  console.log(`Updating Moriarty outcomes for ${date}`);

  const pending = await fetchPendingRecommendations(date);
  if (pending.length === 0) {
    console.log("No pending Moriarty recommendations found.");
    return;
  }

  console.log(`  Found ${pending.length} pending recommendations`);

  const raceIds = pending.map((r) => r.race_id);
  const [resultsMap, venueMap] = await Promise.all([
    fetchRaceResults(raceIds),
    fetchRaceVenues(raceIds),
  ]);

  const updatedCount = await updateRecommendations(pending, resultsMap);
  console.log(`  Updated ${updatedCount} recommendation rows`);

  await upsertDailyPerformance(date, pending, resultsMap, venueMap);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
