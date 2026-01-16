# 日次バッチ処理仕様書

## 1. 概要

### 1.1 バッチ処理一覧

| バッチ名 | 実行タイミング | 所要時間目安 | 優先度 |
|---------|---------------|-------------|--------|
| データ取得バッチ | 毎日 8:00, 12:00, 16:00, 20:00 | 5-10分 | 必須 |
| 結果取得バッチ | 毎日 22:00 | 5分 | 必須 |
| 日次集計バッチ | 毎日 0:00 | 3分 | 必須 |
| 会場統計更新 | 毎週月曜 3:00 | 1分 | 推奨 |
| モデル評価バッチ | 毎週月曜 4:00 | 5分 | 推奨 |

### 1.2 実行環境

- **推奨**: Supabase Edge Functions または GitHub Actions
- **代替**: Vercel Cron Jobs, Railway, Render

---

## 2. データ取得バッチ

### 2.1 処理フロー

```
[08:00] 当日のレース情報取得
    ↓
[08:05] 予測生成 & DB登録
    ↓
[08:10] 賭け推奨判定 & 登録
    ↓
[12:00/16:00/20:00] 追加レース・変更の取得
```

### 2.2 実装

```javascript
// scripts/batch/fetch-daily-races.js

const { createClient } = require('@supabase/supabase-js')
const { fetchRacesFromSource } = require('../lib/race-fetcher')
const { generatePredictions } = require('../lib/predictor')
const { evaluateBetRecommendation } = require('../lib/bet-evaluator')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

async function fetchDailyRaces() {
    const today = new Date().toISOString().split('T')[0]
    console.log(`[${new Date().toISOString()}] Fetching races for ${today}`)

    // 1. レース情報取得（外部ソースから）
    const races = await fetchRacesFromSource(today)
    console.log(`Found ${races.length} races`)

    for (const race of races) {
        // 2. racesテーブルに登録
        const { error: raceError } = await supabase
            .from('races')
            .upsert({
                race_id: race.raceId,
                race_date: today,
                venue_code: race.venueCode,
                race_number: race.raceNumber,
                start_time: race.startTime,
                volatility_score: race.volatility?.score,
                volatility_level: race.volatility?.level,
                // ...
            }, { onConflict: 'race_id' })

        if (raceError) {
            console.error(`Error inserting race ${race.raceId}:`, raceError)
            continue
        }

        // 3. race_entriesに選手情報登録
        const entries = race.players.map(p => ({
            race_id: race.raceId,
            boat_number: p.number,
            player_name: p.name,
            grade: p.grade,
            win_rate: parseFloat(p.winRate),
            // ...
        }))

        await supabase
            .from('race_entries')
            .upsert(entries, { onConflict: 'race_id,boat_number' })

        // 4. 各モデルで予測生成
        const models = ['standard', 'safeBet', 'upsetFocus']
        for (const modelId of models) {
            const prediction = await generatePredictions(race, modelId)

            await supabase
                .from('predictions')
                .upsert({
                    race_id: race.raceId,
                    model_id: modelId,
                    top_pick: prediction.topPick,
                    top_2nd: prediction.top3[1],
                    top_3rd: prediction.top3[2],
                    confidence: prediction.confidence,
                    scores: prediction.scores,
                    is_shadow: false
                }, { onConflict: 'race_id,model_id' })

            // 5. 賭け推奨判定
            const recommendation = await evaluateBetRecommendation(race, prediction, modelId)

            await supabase
                .from('bet_recommendations')
                .upsert({
                    race_id: race.raceId,
                    model_id: modelId,
                    recommendation: recommendation.type,
                    reasons: recommendation.reasons,
                    expected_value: recommendation.expectedValue,
                    recommendation_score: recommendation.score
                }, { onConflict: 'race_id,model_id' })
        }
    }

    console.log(`[${new Date().toISOString()}] Completed`)
}

module.exports = { fetchDailyRaces }
```

### 2.3 賭け推奨判定ロジック

```javascript
// scripts/lib/bet-evaluator.js

async function evaluateBetRecommendation(race, prediction, modelId) {
    const reasons = []
    let score = 50 // ベーススコア

    // フィルタ条件を取得
    const { data: filter } = await supabase
        .from('bet_filters')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .single()

    if (!filter) {
        return { type: 'neutral', reasons: ['フィルタ未設定'], score: 50 }
    }

    const conditions = filter.conditions

    // 1. 会場チェック
    if (conditions.venue_whitelist?.includes(race.venueCode)) {
        score += 15
        reasons.push('推奨会場')
    } else if (conditions.venue_blacklist?.includes(race.venueCode)) {
        score -= 20
        reasons.push('非推奨会場')
    }

    // 2. ボラティリティチェック
    if (conditions.volatility_min && race.volatility?.score >= conditions.volatility_min) {
        score += 10
        reasons.push('高ボラティリティ')
    }
    if (conditions.volatility_max && race.volatility?.score > conditions.volatility_max) {
        score -= 10
    }

    // 3. 予測艇番チェック
    if (conditions.excluded_picks?.includes(prediction.topPick)) {
        score -= 25
        reasons.push(`${prediction.topPick}号艇は非推奨`)
    }

    // 4. レース番号チェック
    if (conditions.race_number_max && race.raceNumber > conditions.race_number_max) {
        score -= 10
        reasons.push('終盤レース')
    }

    // 5. 期待値計算（過去データから）
    const expectedValue = await calculateExpectedValue(race, prediction, modelId)
    if (expectedValue > 10) {
        score += 15
        reasons.push(`期待値+${Math.round(expectedValue)}円`)
    } else if (expectedValue < -20) {
        score -= 15
    }

    // 推奨レベル判定
    let type
    if (score >= 80) {
        type = 'strong_bet'
    } else if (score >= 60) {
        type = 'bet'
    } else if (score >= 40) {
        type = 'neutral'
    } else {
        type = 'skip'
    }

    return {
        type,
        reasons,
        score,
        expectedValue
    }
}

async function calculateExpectedValue(race, prediction, modelId) {
    // 同条件での過去実績を取得
    const { data: history } = await supabase
        .from('v_prediction_performance')
        .select('is_hit_win, payout_win')
        .eq('model_id', modelId)
        .eq('venue_code', race.venueCode)
        .eq('volatility_level', race.volatility?.level)
        .eq('top_pick', prediction.topPick)
        .not('is_hit_win', 'is', null)
        .limit(100)

    if (!history || history.length < 10) {
        return 0 // データ不足
    }

    const hitRate = history.filter(h => h.is_hit_win).length / history.length
    const avgPayout = history
        .filter(h => h.is_hit_win && h.payout_win)
        .reduce((sum, h) => sum + h.payout_win, 0) / history.filter(h => h.is_hit_win).length || 300

    return hitRate * avgPayout - 100
}

module.exports = { evaluateBetRecommendation }
```

---

## 3. 結果取得バッチ

### 3.1 処理フロー

```
[22:00] 当日の全レース結果を取得
    ↓
[22:05] race_resultsに登録
    ↓
[22:05] トリガーによりpredictions.is_hit_*が自動更新
    ↓
[22:10] bet_recommendations.actual_*が自動更新
```

### 3.2 実装

```javascript
// scripts/batch/fetch-results.js

async function fetchDailyResults() {
    const today = new Date().toISOString().split('T')[0]
    console.log(`[${new Date().toISOString()}] Fetching results for ${today}`)

    // 結果未取得のレースを取得
    const { data: races } = await supabase
        .from('races')
        .select('race_id, venue_code, race_number')
        .eq('race_date', today)
        .not('race_id', 'in', (
            supabase.from('race_results').select('race_id')
        ))

    console.log(`Found ${races?.length || 0} races without results`)

    for (const race of races || []) {
        const result = await fetchResultFromSource(race.race_id)

        if (!result?.finished) {
            console.log(`Race ${race.race_id} not finished yet`)
            continue
        }

        // race_resultsに登録（トリガーで予測結果が自動更新される）
        const { error } = await supabase
            .from('race_results')
            .upsert({
                race_id: race.race_id,
                rank1: result.rank1,
                rank2: result.rank2,
                rank3: result.rank3,
                payout_win: result.payouts?.win,
                payout_place_1: result.payouts?.place?.[0],
                payout_place_2: result.payouts?.place?.[1],
                payout_trifecta: result.payouts?.trifecta,
                payout_trio: result.payouts?.trio,
                winning_technique: result.technique,
                result_at: new Date().toISOString()
            }, { onConflict: 'race_id' })

        if (error) {
            console.error(`Error inserting result for ${race.race_id}:`, error)
        }
    }

    console.log(`[${new Date().toISOString()}] Completed`)
}
```

---

## 4. 日次集計バッチ

### 4.1 処理フロー

```
[00:00] 前日のデータを集計
    ↓
[00:01] daily_bet_summaryに登録
    ↓
[00:02] user_visible_summaryを更新（日次・週次・月次）
    ↓
[00:03] model_performance_dailyを更新
```

### 4.2 実装

```javascript
// scripts/batch/daily-summary.js

async function runDailySummary() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    console.log(`[${new Date().toISOString()}] Running daily summary for ${dateStr}`)

    // 1. モデル別の日次集計
    const models = ['standard', 'safeBet', 'upsetFocus']

    for (const modelId of models) {
        // 全レースの成績
        const { data: allStats } = await supabase.rpc('calculate_daily_stats', {
            p_date: dateStr,
            p_model_id: modelId,
            p_recommendation_filter: null
        })

        // 推奨レースの成績
        const { data: recStats } = await supabase.rpc('calculate_daily_stats', {
            p_date: dateStr,
            p_model_id: modelId,
            p_recommendation_filter: ['strong_bet', 'bet']
        })

        // スキップレースの成績
        const { data: skipStats } = await supabase.rpc('calculate_daily_stats', {
            p_date: dateStr,
            p_model_id: modelId,
            p_recommendation_filter: ['skip']
        })

        // daily_bet_summaryに登録
        await supabase
            .from('daily_bet_summary')
            .upsert({
                date: dateStr,
                model_id: modelId,

                all_races: allStats?.total || 0,
                all_hits: allStats?.hits || 0,
                all_payout: allStats?.payout || 0,
                all_recovery_rate: allStats?.recovery_rate || 0,

                recommended_races: recStats?.total || 0,
                recommended_hits: recStats?.hits || 0,
                recommended_payout: recStats?.payout || 0,
                recommended_recovery_rate: recStats?.recovery_rate || 0,

                skipped_races: skipStats?.total || 0,
                skipped_hits: skipStats?.hits || 0,
                skipped_payout: skipStats?.payout || 0,
                skipped_recovery_rate: skipStats?.recovery_rate || 0,

                recovery_improvement: (recStats?.recovery_rate || 0) - (allStats?.recovery_rate || 0),
                profit_if_all: (allStats?.payout || 0) - (allStats?.total || 0) * 100,
                profit_if_recommended: (recStats?.payout || 0) - (recStats?.total || 0) * 100
            }, { onConflict: 'date,model_id' })
    }

    // 2. user_visible_summaryを更新
    await updateUserVisibleSummary(dateStr)

    console.log(`[${new Date().toISOString()}] Completed`)
}

async function updateUserVisibleSummary(dateStr) {
    const models = ['standard', 'safeBet', 'upsetFocus']

    for (const modelId of models) {
        // 日次サマリー
        await upsertSummary('daily', dateStr, dateStr, modelId)

        // 週次サマリー（月曜始まり）
        const weekStart = getWeekStart(new Date(dateStr))
        await upsertSummary('weekly', weekStart, dateStr, modelId)

        // 月次サマリー
        const monthStart = dateStr.substring(0, 7) + '-01'
        await upsertSummary('monthly', monthStart, dateStr, modelId)

        // 全期間サマリー
        await upsertSummary('all_time', '2025-12-01', dateStr, modelId)
    }
}

async function upsertSummary(periodType, startDate, endDate, modelId) {
    const { data: stats } = await supabase
        .from('daily_bet_summary')
        .select('*')
        .eq('model_id', modelId)
        .gte('date', startDate)
        .lte('date', endDate)

    if (!stats || stats.length === 0) return

    const allTotal = stats.reduce((sum, s) => sum + s.all_races, 0)
    const allHits = stats.reduce((sum, s) => sum + s.all_hits, 0)
    const allPayout = stats.reduce((sum, s) => sum + s.all_payout, 0)

    const recTotal = stats.reduce((sum, s) => sum + s.recommended_races, 0)
    const recHits = stats.reduce((sum, s) => sum + s.recommended_hits, 0)
    const recPayout = stats.reduce((sum, s) => sum + s.recommended_payout, 0)

    const skipTotal = stats.reduce((sum, s) => sum + s.skipped_races, 0)
    const skipPayout = stats.reduce((sum, s) => sum + s.skipped_payout, 0)

    await supabase
        .from('user_visible_summary')
        .upsert({
            period_type: periodType,
            period_start: startDate,
            period_end: endDate,
            model_id: modelId,

            all_total: allTotal,
            all_hit_rate: allTotal > 0 ? allHits / allTotal : 0,
            all_recovery_rate: allTotal > 0 ? allPayout / (allTotal * 100) : 0,

            rec_total: recTotal,
            rec_hit_rate: recTotal > 0 ? recHits / recTotal : 0,
            rec_recovery_rate: recTotal > 0 ? recPayout / (recTotal * 100) : 0,
            rec_avg_payout: recHits > 0 ? Math.round(recPayout / recHits) : 0,

            rec_profit: recPayout - recTotal * 100,
            rec_profit_rate: recTotal > 0 ? (recPayout - recTotal * 100) / (recTotal * 100) : 0,
            skip_saved: skipTotal * 100 - skipPayout,

            updated_at: new Date().toISOString()
        }, {
            onConflict: 'period_type,period_start,period_end,model_id'
        })
}
```

---

## 5. 会場統計更新バッチ

```sql
-- 毎週月曜3:00に実行
SELECT update_venue_stats();
```

---

## 6. GitHub Actions設定例

```yaml
# .github/workflows/batch-jobs.yml

name: Batch Jobs

on:
  schedule:
    # データ取得: 8:00, 12:00, 16:00, 20:00 JST
    - cron: '0 23,3,7,11 * * *'  # UTC
    # 結果取得: 22:00 JST
    - cron: '0 13 * * *'
    # 日次集計: 0:00 JST
    - cron: '0 15 * * *'
    # 週次処理: 月曜 3:00 JST
    - cron: '0 18 * * 0'

jobs:
  fetch-races:
    if: github.event.schedule == '0 23,3,7,11 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/batch/fetch-daily-races.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

  fetch-results:
    if: github.event.schedule == '0 13 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: node scripts/batch/fetch-results.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

  daily-summary:
    if: github.event.schedule == '0 15 * * *'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: node scripts/batch/daily-summary.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

  weekly-stats:
    if: github.event.schedule == '0 18 * * 0'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: node scripts/batch/weekly-stats.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

---

## 7. 監視・アラート

### 7.1 監視項目

| 項目 | 閾値 | アラート先 |
|------|------|-----------|
| バッチ実行失敗 | 1回 | Slack/Discord |
| 実行時間超過 | 15分 | Slack/Discord |
| データ欠損 | 当日レース0件 | Slack/Discord |
| エラー率 | 5%超 | Slack/Discord |

### 7.2 ヘルスチェック

```javascript
// scripts/batch/health-check.js

async function healthCheck() {
    const today = new Date().toISOString().split('T')[0]

    // 今日のレース数を確認
    const { count: raceCount } = await supabase
        .from('races')
        .select('*', { count: 'exact', head: true })
        .eq('race_date', today)

    // 今日の予測数を確認
    const { count: predCount } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .in('race_id', supabase.from('races').select('race_id').eq('race_date', today))

    // 昨日の結果数を確認
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const { count: resultCount } = await supabase
        .from('race_results')
        .select('*', { count: 'exact', head: true })
        .in('race_id', supabase.from('races').select('race_id').eq('race_date', yesterday.toISOString().split('T')[0]))

    const status = {
        today_races: raceCount,
        today_predictions: predCount,
        yesterday_results: resultCount,
        healthy: raceCount > 0 && predCount > 0
    }

    if (!status.healthy) {
        await sendAlert('Data health check failed', status)
    }

    return status
}
```
