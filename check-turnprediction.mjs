import { supabase } from './scripts/lib/supabaseClient.js';

// Get most recent predictions
const { data, error } = await supabase
  .from('predictions')
  .select('race_id, feature_contributions')
  .limit(5)
  .order('predicted_at', { ascending: false });

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

if (data && data.length > 0) {
  data.forEach((row, i) => {
    const turnPred = row.feature_contributions?.turnPrediction;
    console.log(`\n[${i}] Race: ${row.race_id}`);
    console.log('turnPrediction keys:', Object.keys(turnPred || {}).sort());
    if (turnPred?.patterns) {
      console.log(`patterns count: ${turnPred.patterns.length}`);
      if (turnPred.patterns[0]) {
        console.log('First pattern keys:', Object.keys(turnPred.patterns[0]).sort());
      }
    }
  });
} else {
  console.log('No predictions found');
}
