import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const { data: predictions } = await supabase
    .from('predictions')
    .select('race_id, is_hit_win')
    .like('race_id', '2026-01-10%');

  console.log('予測データ件数:', predictions ? predictions.length : 0);

  const withResults = predictions ? predictions.filter(p => p.is_hit_win != null) : [];
  console.log('結果あり件数:', withResults.length);

  const { data: results } = await supabase
    .from('results')
    .select('race_id')
    .like('race_id', '2026-01-10%');

  console.log('結果件数:', results ? results.length : 0);

  // 日別の的中率を計算するテーブルを確認
  const { data: dailyAccuracy } = await supabase
    .from('daily_accuracy')
    .select('*')
    .eq('date', '2026-01-10');

  console.log('\ndaily_accuracy テーブル:', dailyAccuracy ? dailyAccuracy.length : 0, '件');
  if (dailyAccuracy && dailyAccuracy.length > 0) {
    console.log(dailyAccuracy[0]);
  }
}

check();
