import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  // 1月の各日付の結果有無を確認
  const dates = ['2026-01-11', '2026-01-10', '2026-01-09', '2026-01-08', '2026-01-07', '2026-01-06', '2026-01-05'];

  for (const date of dates) {
    const { data: predictions, count } = await supabase
      .from('predictions')
      .select('race_id, is_hit_win', { count: 'exact' })
      .like('race_id', `${date}%`);

    const withResults = predictions ? predictions.filter(p => p.is_hit_win !== null).length : 0;
    console.log(`${date}: 予測 ${count}件, 結果あり ${withResults}件`);
  }
}

check();
