/**
 * 分析用データの概要を確認するスクリプト
 */

import { supabase, isSupabaseEnabled, VENUE_NAMES } from '../lib/supabaseClient.js';

async function main() {
  if (!isSupabaseEnabled()) {
    console.error('❌ Supabase環境変数が未設定です');
    process.exit(1);
  }

  console.log('📊 データ概要を確認中...\n');

  // 1. 全体のデータ件数
  const { count: totalPredictions } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true });

  const { count: totalResults } = await supabase
    .from('race_results')
    .select('*', { count: 'exact', head: true });

  console.log(`予測データ: ${totalPredictions?.toLocaleString()} 件`);
  console.log(`結果データ: ${totalResults?.toLocaleString()} 件\n`);

  // 2. 日付範囲
  const { data: dateRange } = await supabase
    .from('races')
    .select('race_date')
    .order('race_date', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('races')
    .select('race_date')
    .order('race_date', { ascending: false })
    .limit(1);

  if (dateRange?.[0] && latestDate?.[0]) {
    console.log(`期間: ${dateRange[0].race_date} 〜 ${latestDate[0].race_date}\n`);
  }

  // 3. 会場別のデータ件数
  console.log('--- 会場別データ件数 ---');

  const { data: venueStats } = await supabase
    .from('races')
    .select('venue_code');

  const venueCounts = {};
  venueStats?.forEach(r => {
    venueCounts[r.venue_code] = (venueCounts[r.venue_code] || 0) + 1;
  });

  // ソートして表示
  const sorted = Object.entries(venueCounts)
    .sort((a, b) => b[1] - a[1]);

  for (const [code, count] of sorted) {
    const name = VENUE_NAMES[code] || `不明(${code})`;
    console.log(`${name.padEnd(6, '　')}: ${count.toLocaleString().padStart(6)} レース`);
  }
}

main().catch(console.error);
