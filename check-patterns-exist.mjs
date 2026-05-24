import { supabase } from './scripts/lib/supabaseClient.js';

console.log('最新のpredictions データを確認中...\n');

// 最新100件を取得
const { data } = await supabase
  .from('predictions')
  .select(`race_id, feature_contributions->turnPrediction`, { count: 'exact' })
  .eq('model_id', 'standard')
  .order('predicted_at', { ascending: false })
  .limit(100);

if (data) {
  console.log(`取得件数: ${data.length}`);
  
  let withPatterns = 0;
  let withoutPatterns = 0;
  
  data.forEach((item) => {
    const turnPred = item.turnPrediction;
    if (turnPred?.patterns) {
      withPatterns++;
      if (withPatterns <= 3) {
        console.log(`\n[Sample ${withPatterns}] ${item.race_id}`);
        console.log(`  patterns数: ${turnPred.patterns.length}`);
        console.log(`  keys: ${Object.keys(turnPred).sort().join(', ')}`);
      }
    } else {
      withoutPatterns++;
    }
  });
  
  console.log(`\n統計:`);
  console.log(`  patterns あり: ${withPatterns}/${data.length}`);
  console.log(`  patterns なし: ${withoutPatterns}/${data.length}`);
}
