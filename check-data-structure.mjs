import { supabase } from './scripts/lib/supabaseClient.js';

// 最新のデータを1件確認
const { data } = await supabase
  .from('predictions')
  .select(`race_id, feature_contributions`)
  .eq('model_id', 'standard')
  .not('feature_contributions', 'is', null)
  .order('predicted_at', { ascending: false })
  .limit(1);

if (data && data[0]) {
  const turnPred = data[0].feature_contributions?.turnPrediction;
  console.log('race_id:', data[0].race_id);
  console.log('\nturnPrediction structure:');
  console.log(JSON.stringify(turnPred, null, 2).slice(0, 2000));
}
