// Accuracy Calculation Script
// Supabaseから予測結果を集計し、models統計を更新する

import { supabase, isSupabaseEnabled } from './lib/supabaseClient.js';

// Get today's date in JST (YYYY-MM-DD format)
function getTodayDateJST() {
    const now = new Date();
    const jstOffset = 9 * 60;
    const jstDate = new Date(now.getTime() + jstOffset * 60 * 1000);
    return jstDate.toISOString().split('T')[0];
}

// Calculate statistics for a model
async function calculateModelStats(modelId) {
    // predictionsテーブルから結果がある予測を取得（ページネーション対応）
    let allPredictions = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
        const { data: page, error: predError } = await supabase
            .from('predictions')
            .select('race_id, is_hit_win')
            .eq('model_id', modelId)
            .not('is_hit_win', 'is', null)
            .range(from, from + pageSize - 1);

        if (predError) {
            console.error(`  ${modelId} predictions error:`, predError.message);
            return null;
        }

        if (!page || page.length === 0) break;

        allPredictions = allPredictions.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
    }

    const predictions = allPredictions;

    if (!predictions || predictions.length === 0) {
        return {
            totalPredictions: 0,
            hitRateWin: 0,
            recoveryRateWin: 0
        };
    }

    const totalPredictions = predictions.length;
    const hits = predictions.filter(p => p.is_hit_win).length;
    const hitRateWin = hits / totalPredictions;

    // 的中した予測のrace_idを取得
    const hitRaceIds = predictions.filter(p => p.is_hit_win).map(p => p.race_id);

    // 回収率計算（単勝100円賭けと仮定）
    let totalInvestment = totalPredictions * 100;
    let totalPayout = 0;

    if (hitRaceIds.length > 0) {
        // race_resultsから配当を取得（バッチ処理）
        const batchSize = 100;
        for (let i = 0; i < hitRaceIds.length; i += batchSize) {
            const batch = hitRaceIds.slice(i, i + batchSize);
            const { data: results, error: resultsError } = await supabase
                .from('race_results')
                .select('race_id, payout_win')
                .in('race_id', batch);

            if (!resultsError && results) {
                for (const result of results) {
                    if (result.payout_win) {
                        totalPayout += result.payout_win;
                    }
                }
            }
        }
    }

    const recoveryRateWin = totalInvestment > 0 ? totalPayout / totalInvestment : 0;

    return {
        totalPredictions,
        hitRateWin,
        recoveryRateWin
    };
}

// Main function
async function calculateAccuracy() {
    if (!isSupabaseEnabled()) {
        console.error('❌ Supabaseが設定されていません');
        process.exit(1);
    }

    console.log('Starting accuracy calculation from Supabase...\n');

    const models = ['standard', 'safeBet', 'upsetFocus'];
    const modelStats = {};

    for (const modelId of models) {
        console.log(`Calculating ${modelId}...`);
        const stats = await calculateModelStats(modelId);

        if (stats) {
            modelStats[modelId] = stats;
            console.log(`  Total: ${stats.totalPredictions}, Hit: ${(stats.hitRateWin * 100).toFixed(1)}%, Recovery: ${(stats.recoveryRateWin * 100).toFixed(1)}%`);
        }
    }

    // Supabaseのmodelsテーブルを更新
    console.log('\n📤 Supabaseのmodels統計を更新中...');

    for (const [modelId, stats] of Object.entries(modelStats)) {
        const { error } = await supabase
            .from('models')
            .update({
                total_predictions: stats.totalPredictions,
                hit_rate_win: stats.hitRateWin,
                recovery_rate_win: stats.recoveryRateWin,
                last_evaluated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('model_id', modelId);

        if (error) {
            console.error(`  ❌ ${modelId}更新エラー:`, error.message);
        } else {
            console.log(`  ✅ ${modelId}: hit=${(stats.hitRateWin * 100).toFixed(1)}%, recovery=${(stats.recoveryRateWin * 100).toFixed(1)}%`);
        }
    }

    console.log('\n✅ 統計更新完了');
}

// Execute script
calculateAccuracy();
