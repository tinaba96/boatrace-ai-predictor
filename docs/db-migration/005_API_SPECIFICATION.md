# API仕様書

## 1. 概要

### 1.1 目的
Supabaseを活用したREST API/RealtimeAPIの設計仕様を定義する。

### 1.2 API種別
- **Supabase Auto-generated REST API**: テーブル・ビューへの直接アクセス
- **Supabase Edge Functions**: カスタムロジックが必要なエンドポイント
- **Realtime Subscriptions**: リアルタイムデータ更新

---

## 2. 認証・認可

### 2.1 認証方式

```javascript
// クライアント初期化
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 2.2 Row Level Security (RLS)

```sql
-- 公開読み取り（認証不要）
CREATE POLICY "Public read access"
ON races FOR SELECT
USING (true);

-- 管理者のみ書き込み可能
CREATE POLICY "Admin write access"
ON races FOR INSERT
USING (auth.role() = 'service_role');
```

### 2.3 APIキーの種類

| キー種別 | 用途 | 権限 |
|---------|------|------|
| `anon` | フロントエンド | 公開データ読み取りのみ |
| `service_role` | バックエンド/バッチ | 全テーブルへのフルアクセス |

---

## 3. REST API エンドポイント

### 3.1 レース一覧取得

**GET** `/rest/v1/races`

```javascript
// 本日のレース一覧
const { data, error } = await supabase
    .from('races')
    .select(`
        race_id,
        race_date,
        venue_code,
        race_number,
        start_time,
        volatility_score,
        volatility_level,
        recommended_model,
        venues (
            venue_name,
            venue_name_short
        )
    `)
    .eq('race_date', '2026-01-05')
    .order('start_time', { ascending: true })
```

**レスポンス例:**
```json
{
    "data": [
        {
            "race_id": "20260105-01-01",
            "race_date": "2026-01-05",
            "venue_code": "01",
            "race_number": 1,
            "start_time": "10:00",
            "volatility_score": 45,
            "volatility_level": "low",
            "recommended_model": "safeBet",
            "venues": {
                "venue_name": "桐生",
                "venue_name_short": "桐生"
            }
        }
    ]
}
```

---

### 3.2 レース詳細取得

**GET** `/rest/v1/races?race_id=eq.{race_id}`

```javascript
// レース詳細（出走表・予測・結果含む）
const { data, error } = await supabase
    .from('races')
    .select(`
        *,
        venues (*),
        race_entries (*),
        predictions (*),
        race_results (*),
        race_conditions (*),
        race_odds (*)
    `)
    .eq('race_id', raceId)
    .single()
```

---

### 3.3 予測パフォーマンス取得

**GET** `/rest/v1/v_prediction_performance`

```javascript
// モデル別パフォーマンス（直近7日）
const { data, error } = await supabase
    .from('v_prediction_performance')
    .select('*')
    .gte('race_date', '2025-12-29')
```

**レスポンス例:**
```json
{
    "data": [
        {
            "model_id": "standard",
            "race_date": "2026-01-05",
            "total_races": 110,
            "hit_win": 45,
            "hit_place": 62,
            "hit_rate_win": 0.409,
            "hit_rate_place": 0.564,
            "total_payout_win": 52800,
            "recovery_rate_win": 0.96,
            "avg_confidence": 72.5
        }
    ]
}
```

---

### 3.4 本日のベット推奨取得

**GET** `/rest/v1/v_todays_recommendations`

```javascript
// 本日のベット推奨レース
const { data, error } = await supabase
    .from('v_todays_recommendations')
    .select('*')
    .gte('recommendation_score', 70)
    .order('recommendation_score', { ascending: false })
```

**レスポンス例:**
```json
{
    "data": [
        {
            "race_id": "20260105-06-08",
            "venue_name": "丸亀",
            "race_number": 8,
            "start_time": "15:30",
            "model_id": "upsetFocus",
            "top_pick": 3,
            "confidence": 78,
            "recommendation_score": 85,
            "expected_value": 1.35,
            "filter_name": "穴狙い高期待値"
        }
    ]
}
```

---

### 3.5 ユーザー向けサマリー取得

**GET** `/rest/v1/user_visible_summary`

```javascript
// ユーザーに公開するサマリー
const { data, error } = await supabase
    .from('user_visible_summary')
    .select('*')
    .eq('is_visible', true)
    .order('summary_date', { ascending: false })
    .limit(7)
```

---

### 3.6 会場別パフォーマンス取得

**GET** `/rest/v1/rpc/get_venue_performance`

```sql
-- Edge Functionまたはストアドプロシージャ
CREATE OR REPLACE FUNCTION get_venue_performance(
    p_model_id TEXT,
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    venue_code TEXT,
    venue_name TEXT,
    total_races INT,
    hit_rate NUMERIC,
    recovery_rate NUMERIC,
    avg_payout INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.venue_code,
        v.venue_name,
        COUNT(*)::INT AS total_races,
        AVG(CASE WHEN p.is_hit_win THEN 1 ELSE 0 END)::NUMERIC AS hit_rate,
        COALESCE(SUM(p.payout_win), 0)::NUMERIC / (COUNT(*) * 100) AS recovery_rate,
        COALESCE(AVG(p.payout_win), 0)::INT AS avg_payout
    FROM predictions p
    JOIN races r ON p.race_id = r.race_id
    JOIN venues v ON r.venue_code = v.venue_code
    WHERE p.model_id = p_model_id
      AND r.race_date >= CURRENT_DATE - p_days
      AND p.is_hit_win IS NOT NULL
    GROUP BY r.venue_code, v.venue_name
    ORDER BY recovery_rate DESC;
END;
$$ LANGUAGE plpgsql;
```

```javascript
// 呼び出し
const { data, error } = await supabase
    .rpc('get_venue_performance', {
        p_model_id: 'upsetFocus',
        p_days: 30
    })
```

---

## 4. Edge Functions

### 4.1 予測生成エンドポイント

**POST** `/functions/v1/generate-predictions`

```typescript
// supabase/functions/generate-predictions/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const { race_date } = await req.json()

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 予測生成ロジック
    const predictions = await generatePredictions(race_date)

    // DB保存
    const { error } = await supabase
        .from('predictions')
        .upsert(predictions)

    return new Response(
        JSON.stringify({ success: !error, count: predictions.length }),
        { headers: { 'Content-Type': 'application/json' } }
    )
})
```

---

### 4.2 結果取得・更新エンドポイント

**POST** `/functions/v1/fetch-results`

```typescript
// supabase/functions/fetch-results/index.ts
serve(async (req) => {
    const { race_date } = await req.json()

    // 公式サイトから結果取得
    const results = await fetchOfficialResults(race_date)

    // race_results に保存（トリガーで predictions も自動更新）
    const { error } = await supabase
        .from('race_results')
        .upsert(results)

    return new Response(
        JSON.stringify({ success: !error, count: results.length }),
        { headers: { 'Content-Type': 'application/json' } }
    )
})
```

---

### 4.3 ベット推奨評価エンドポイント

**POST** `/functions/v1/evaluate-recommendations`

```typescript
// supabase/functions/evaluate-recommendations/index.ts
serve(async (req) => {
    const { race_date } = await req.json()

    // フィルター取得
    const { data: filters } = await supabase
        .from('bet_filters')
        .select('*')
        .eq('is_active', true)

    // 各レースを評価
    const { data: races } = await supabase
        .from('races')
        .select(`
            *,
            predictions (*),
            race_conditions (*)
        `)
        .eq('race_date', race_date)

    const recommendations = []

    for (const race of races) {
        for (const filter of filters) {
            const score = evaluateFilter(race, filter)
            if (score > 0) {
                recommendations.push({
                    race_id: race.race_id,
                    filter_id: filter.filter_id,
                    model_id: filter.model_id,
                    recommendation_score: score,
                    expected_value: calculateExpectedValue(race, filter)
                })
            }
        }
    }

    // 保存
    await supabase
        .from('bet_recommendations')
        .upsert(recommendations)

    return new Response(
        JSON.stringify({ success: true, count: recommendations.length }),
        { headers: { 'Content-Type': 'application/json' } }
    )
})
```

---

## 5. Realtime Subscriptions

### 5.1 結果更新のリアルタイム通知

```javascript
// クライアント側
const channel = supabase
    .channel('race-results')
    .on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'race_results'
        },
        (payload) => {
            console.log('New result:', payload.new)
            // UIを更新
            updateRaceResult(payload.new)
        }
    )
    .subscribe()

// クリーンアップ
// supabase.removeChannel(channel)
```

### 5.2 予測更新のリアルタイム通知

```javascript
const channel = supabase
    .channel('predictions')
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'predictions',
            filter: `race_id=eq.${raceId}`
        },
        (payload) => {
            console.log('Prediction updated:', payload)
            refreshPredictions(raceId)
        }
    )
    .subscribe()
```

---

## 6. フロントエンド統合

### 6.1 React カスタムフック

```javascript
// src/hooks/useRaces.js
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

export function useRaces(date) {
    const [races, setRaces] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchRaces() {
            setLoading(true)

            const { data, error } = await supabase
                .from('races')
                .select(`
                    *,
                    venues (*),
                    predictions (*),
                    race_results (*)
                `)
                .eq('race_date', date)
                .order('start_time')

            if (error) {
                setError(error)
            } else {
                setRaces(data)
            }

            setLoading(false)
        }

        fetchRaces()
    }, [date])

    return { races, loading, error }
}
```

### 6.2 Realtime フック

```javascript
// src/hooks/useRealtimeResults.js
import { useEffect } from 'react'
import { supabase } from '../services/supabase'

export function useRealtimeResults(date, onNewResult) {
    useEffect(() => {
        const channel = supabase
            .channel(`results-${date}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'race_results'
                },
                (payload) => {
                    // 該当日のレースのみ処理
                    if (payload.new.race_id.startsWith(date.replace(/-/g, ''))) {
                        onNewResult(payload.new)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [date, onNewResult])
}
```

---

## 7. エラーハンドリング

### 7.1 共通エラーハンドラ

```javascript
// src/services/supabase.js
export async function handleSupabaseError(error) {
    if (!error) return null

    const errorMap = {
        'PGRST116': '該当データが見つかりません',
        '23505': '重複データが存在します',
        '23503': '関連データが存在しません',
        '42501': '権限がありません',
        'rate_limit': 'リクエスト制限に達しました'
    }

    const message = errorMap[error.code] || error.message

    console.error('Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details
    })

    return { code: error.code, message }
}
```

### 7.2 リトライロジック

```javascript
export async function withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (error) {
            if (i === maxRetries - 1) throw error

            // 指数バックオフ
            const delay = Math.min(1000 * Math.pow(2, i), 10000)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
}
```

---

## 8. パフォーマンス最適化

### 8.1 クエリ最適化

```javascript
// 不要なカラムを除外
const { data } = await supabase
    .from('races')
    .select('race_id, venue_code, race_number, start_time')  // 必要なカラムのみ
    .eq('race_date', date)

// ページネーション
const { data, count } = await supabase
    .from('predictions')
    .select('*', { count: 'exact' })
    .range(0, 49)  // 50件ずつ
```

### 8.2 キャッシュ戦略

```javascript
// src/services/cache.js
const cache = new Map()

export async function getCachedData(key, fetcher, ttl = 60000) {
    const cached = cache.get(key)

    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data
    }

    const data = await fetcher()
    cache.set(key, { data, timestamp: Date.now() })

    return data
}

// 使用例
const races = await getCachedData(
    `races-${date}`,
    () => supabase.from('races').select('*').eq('race_date', date),
    300000  // 5分キャッシュ
)
```

---

## 9. APIレート制限

### 9.1 Supabaseの制限

| プラン | リクエスト/秒 | 同時接続 |
|--------|--------------|---------|
| Free | 500 | 200 |
| Pro | 1000 | 500 |

### 9.2 クライアント側の対策

```javascript
// リクエストキュー
class RequestQueue {
    constructor(maxConcurrent = 5) {
        this.queue = []
        this.running = 0
        this.maxConcurrent = maxConcurrent
    }

    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject })
            this.process()
        })
    }

    async process() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return
        }

        this.running++
        const { fn, resolve, reject } = this.queue.shift()

        try {
            const result = await fn()
            resolve(result)
        } catch (error) {
            reject(error)
        } finally {
            this.running--
            this.process()
        }
    }
}

export const requestQueue = new RequestQueue()
```

---

## 10. セキュリティ

### 10.1 環境変数管理

```bash
# .env.local（フロントエンド用）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx...

# .env（バックエンド/バッチ用）
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...  # 絶対に公開しない
```

### 10.2 入力バリデーション

```javascript
// Edge Function内でのバリデーション
function validateRaceDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format')
    }

    const d = new Date(date)
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date')
    }

    return date
}
```

---

## 11. API一覧サマリー

| エンドポイント | メソッド | 用途 |
|---------------|---------|------|
| `/rest/v1/races` | GET | レース一覧・詳細取得 |
| `/rest/v1/race_entries` | GET | 出走表取得 |
| `/rest/v1/predictions` | GET | 予測取得 |
| `/rest/v1/race_results` | GET | 結果取得 |
| `/rest/v1/v_prediction_performance` | GET | パフォーマンス取得 |
| `/rest/v1/v_todays_recommendations` | GET | 本日の推奨取得 |
| `/rest/v1/user_visible_summary` | GET | ユーザーサマリー取得 |
| `/rest/v1/rpc/get_venue_performance` | POST | 会場別分析 |
| `/functions/v1/generate-predictions` | POST | 予測生成 |
| `/functions/v1/fetch-results` | POST | 結果取得・更新 |
| `/functions/v1/evaluate-recommendations` | POST | 推奨評価 |
