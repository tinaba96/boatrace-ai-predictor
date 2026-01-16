import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function updateVenueStats() {
  // JOINして会場ごとの1号艇勝率を算出
  const { data, error } = await supabase
    .from('races')
    .select('venue_code, race_results(rank1)');

  if (error) {
    console.log('Error:', error.message);
    process.exit(1);
  }

  // 会場ごとの集計
  const venueStats = {};
  data.forEach(r => {
    const venueCode = r.venue_code;
    const result = r.race_results;
    // race_resultsは配列またはオブジェクトの可能性
    const rank1 = Array.isArray(result) ? result[0]?.rank1 : result?.rank1;
    if (rank1 === undefined) return;

    if (!venueStats[venueCode]) {
      venueStats[venueCode] = { total: 0, firstWins: 0, volatilitySum: 0 };
    }
    venueStats[venueCode].total++;
    if (rank1 === 1) venueStats[venueCode].firstWins++;
  });

  // ボラティリティも取得
  const { data: racesWithVolatility } = await supabase
    .from('races')
    .select('venue_code, volatility_score')
    .not('volatility_score', 'is', null);

  const volatilityStats = {};
  racesWithVolatility.forEach(r => {
    if (!volatilityStats[r.venue_code]) {
      volatilityStats[r.venue_code] = { sum: 0, count: 0 };
    }
    volatilityStats[r.venue_code].sum += r.volatility_score;
    volatilityStats[r.venue_code].count++;
  });

  // 更新
  for (const [venueCode, stats] of Object.entries(venueStats)) {
    const winRate = stats.total > 0 ? stats.firstWins / stats.total : null;
    const volStats = volatilityStats[venueCode];
    const avgVolatility = volStats && volStats.count > 0 ? volStats.sum / volStats.count : null;

    await supabase
      .from('venues')
      .update({
        avg_first_win_rate: winRate,
        avg_volatility_score: avgVolatility,
        updated_at: new Date().toISOString()
      })
      .eq('code', parseInt(venueCode));
  }

  // 結果表示
  const { data: venues } = await supabase
    .from('venues')
    .select('code, name, avg_first_win_rate, avg_volatility_score')
    .not('avg_first_win_rate', 'is', null)
    .order('avg_first_win_rate', { ascending: false });

  console.log('✓ venues統計更新完了');
  console.log('');
  console.log('会場別1号艇勝率:');
  venues.forEach((v, i) => {
    const winRate = v.avg_first_win_rate ? (v.avg_first_win_rate * 100).toFixed(1) + '%' : '-';
    const volatility = v.avg_volatility_score ? v.avg_volatility_score.toFixed(1) : '-';
    console.log(`  ${v.name}: 1号艇勝率=${winRate}, ボラティリティ=${volatility}`);
  });
}

updateVenueStats();
