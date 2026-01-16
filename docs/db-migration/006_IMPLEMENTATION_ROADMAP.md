# 実装ロードマップ

## 1. 概要

### 1.1 目的
JSON → Supabaseへ一気に切り替え、シンプルな構成を維持する。

### 1.2 全体フェーズ

```
Phase 1: 基盤構築        ████████░░░░░░░░░░░░
Phase 2: データ移行      ░░░░░░░░████████░░░░
Phase 3: バッチ切替      ░░░░░░░░░░░░░░██████
Phase 4: 機能拡張        ░░░░░░░░░░░░░░░░░░██
```

### 1.3 方針

- **並行運用なし**: JSON → Supabase に一気に切り替える
- **データ欠損ゼロ**: 移行前後で厳密な検証を実施
- **シンプル**: 切り替え後はSupabaseのみを使用

---

## 2. Phase 1: 基盤構築

### 2.1 タスク一覧

| # | タスク | 依存 | 優先度 |
|---|--------|------|--------|
| 1.1 | Supabaseプロジェクト作成 | - | 必須 |
| 1.2 | スキーマ作成（001_schema.sql） | 1.1 | 必須 |
| 1.3 | RLS設定 | 1.2 | 必須 |
| 1.4 | 初期データ投入（venues, models） | 1.2 | 必須 |
| 1.5 | Supabaseクライアント設定 | 1.1 | 必須 |
| 1.6 | 環境変数設定（local, GitHub Secrets） | 1.1 | 必須 |

### 2.2 詳細手順

#### 1.1 Supabaseプロジェクト作成

```bash
# 1. supabase.com でプロジェクト作成
# 2. Project Settings > API から以下を取得
#    - Project URL
#    - anon key
#    - service_role key
```

#### 1.2 スキーマ作成

```bash
# Supabase Dashboard > SQL Editor で実行
# docs/db-migration/001_schema.sql の内容をコピー&ペースト

# または Supabase CLI を使用
supabase db push
```

#### 1.4 初期データ投入

```sql
-- venues テーブル
INSERT INTO venues (venue_code, venue_name, venue_name_short, prefecture, region) VALUES
('01', '桐生', '桐生', '群馬県', '関東'),
('02', '戸田', '戸田', '埼玉県', '関東'),
('03', '江戸川', '江戸川', '東京都', '関東'),
('04', '平和島', '平和島', '東京都', '関東'),
('05', '多摩川', '多摩川', '東京都', '関東'),
('06', '浜名湖', '浜名湖', '静岡県', '東海'),
('07', '蒲郡', '蒲郡', '愛知県', '東海'),
('08', '常滑', '常滑', '愛知県', '東海'),
('09', '津', '津', '三重県', '東海'),
('10', '三国', '三国', '福井県', '北陸'),
('11', 'びわこ', 'びわこ', '滋賀県', '近畿'),
('12', '住之江', '住之江', '大阪府', '近畿'),
('13', '尼崎', '尼崎', '兵庫県', '近畿'),
('14', '鳴門', '鳴門', '徳島県', '四国'),
('15', '丸亀', '丸亀', '香川県', '四国'),
('16', '児島', '児島', '岡山県', '中国'),
('17', '宮島', '宮島', '広島県', '中国'),
('18', '徳山', '徳山', '山口県', '中国'),
('19', '下関', '下関', '山口県', '中国'),
('20', '若松', '若松', '福岡県', '九州'),
('21', '芦屋', '芦屋', '福岡県', '九州'),
('22', '福岡', '福岡', '福岡県', '九州'),
('23', '唐津', '唐津', '佐賀県', '九州'),
('24', '大村', '大村', '長崎県', '九州');

-- models テーブル
INSERT INTO models (model_id, model_name, description, status, parameters) VALUES
('standard', 'スタンダード', 'バランス重視の標準モデル', 'production', '{"weights": {"winRate": 0.3, "localWinRate": 0.2, "motor2Rate": 0.25, "boat2Rate": 0.15, "course": 0.1}}'),
('safeBet', '堅実派', '1号艇重視・低配当安定型', 'production', '{"weights": {"winRate": 0.25, "localWinRate": 0.15, "motor2Rate": 0.2, "boat2Rate": 0.1, "course": 0.3}}'),
('upsetFocus', '穴狙い', '高配当狙い・波乱予想型', 'production', '{"weights": {"winRate": 0.2, "localWinRate": 0.25, "motor2Rate": 0.3, "boat2Rate": 0.2, "course": 0.05}}');
```

#### 1.5 Supabaseクライアント設定

```javascript
// src/services/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### 1.6 環境変数設定

```bash
# .env.local
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...

# GitHub Secrets（バッチ用）
# Settings > Secrets and variables > Actions
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxxx...
```

### 2.3 完了条件

- [ ] Supabaseプロジェクトが作成されている
- [ ] 全テーブル・ビュー・トリガーが作成されている
- [ ] RLSポリシーが設定されている
- [ ] venues, modelsに初期データが投入されている
- [ ] フロントエンドからSupabaseに接続できる
- [ ] GitHub Actionsから接続できる

---

## 3. Phase 2: データ移行（欠損ゼロ保証）

### 3.1 タスク一覧

| # | タスク | 依存 | 優先度 |
|---|--------|------|--------|
| 2.1 | 移行スクリプト作成 | Phase 1 | 必須 |
| 2.2 | **移行前カウント取得** | 2.1 | 必須 |
| 2.3 | ドライラン実行（1日分） | 2.1 | 必須 |
| 2.4 | 全データ移行実行 | 2.3 | 必須 |
| 2.5 | **移行後検証（自動）** | 2.4 | 必須 |
| 2.6 | **差分レポート確認** | 2.5 | 必須 |
| 2.7 | トリガー動作確認 | 2.5 | 必須 |

### 3.2 データ欠損防止策

#### Step 1: 移行前にJSONの全データをカウント

```javascript
// scripts/count-json-data.js
const fs = require('fs')
const path = require('path')

const PREDICTIONS_DIR = './public/data/predictions'

function countJsonData() {
    const files = fs.readdirSync(PREDICTIONS_DIR)
        .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))

    const summary = {
        files: files.length,
        races: 0,
        entries: 0,
        predictions: 0,
        results: 0,
        byDate: {}
    }

    for (const file of files) {
        const dateStr = file.replace('.json', '')
        const data = JSON.parse(fs.readFileSync(path.join(PREDICTIONS_DIR, file), 'utf8'))

        const dateStats = {
            races: data.races.length,
            entries: 0,
            predictions: 0,
            results: 0
        }

        for (const race of data.races) {
            // 出走表
            const players = race.predictions?.standard?.players || []
            dateStats.entries += players.length

            // 予測（3モデル分）
            if (race.predictions?.standard) dateStats.predictions++
            if (race.predictions?.safeBet) dateStats.predictions++
            if (race.predictions?.upsetFocus) dateStats.predictions++

            // 結果
            if (race.result?.finished) dateStats.results++
        }

        summary.byDate[dateStr] = dateStats
        summary.races += dateStats.races
        summary.entries += dateStats.entries
        summary.predictions += dateStats.predictions
        summary.results += dateStats.results
    }

    // 結果をファイルに保存（検証用）
    fs.writeFileSync(
        './migration-expected-counts.json',
        JSON.stringify(summary, null, 2)
    )

    console.log('=== JSON Data Counts ===')
    console.log(`Files: ${summary.files}`)
    console.log(`Races: ${summary.races}`)
    console.log(`Entries: ${summary.entries}`)
    console.log(`Predictions: ${summary.predictions}`)
    console.log(`Results: ${summary.results}`)

    return summary
}

countJsonData()
```

#### Step 2: 移行スクリプトにエラーハンドリング追加

```javascript
// scripts/migrate-to-supabase.js（抜粋）

// 移行失敗したレースを記録
const failedRaces = []

async function migrateDay(dateStr) {
    // ... 既存のコード ...

    for (const race of data.races) {
        try {
            // 移行処理
        } catch (error) {
            failedRaces.push({
                date: dateStr,
                race_id: race.raceId,
                error: error.message
            })
            // 失敗しても次のレースへ続行
            continue
        }
    }
}

// 移行完了後に失敗レースを出力
async function migrateAll() {
    // ... 移行処理 ...

    if (failedRaces.length > 0) {
        console.error('\n=== FAILED RACES ===')
        fs.writeFileSync(
            './migration-failed-races.json',
            JSON.stringify(failedRaces, null, 2)
        )
        console.error(`${failedRaces.length} races failed. See migration-failed-races.json`)
        process.exit(1)  // 失敗があれば異常終了
    }
}
```

#### Step 3: 移行後の自動検証

```javascript
// scripts/verify-migration.js
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

async function verifyMigration() {
    // 期待値を読み込み
    const expected = JSON.parse(
        fs.readFileSync('./migration-expected-counts.json', 'utf8')
    )

    // DBの実際のカウント
    const actual = {}

    const { count: racesCount } = await supabase
        .from('races')
        .select('*', { count: 'exact', head: true })
    actual.races = racesCount

    const { count: entriesCount } = await supabase
        .from('race_entries')
        .select('*', { count: 'exact', head: true })
    actual.entries = entriesCount

    const { count: predictionsCount } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
    actual.predictions = predictionsCount

    const { count: resultsCount } = await supabase
        .from('race_results')
        .select('*', { count: 'exact', head: true })
    actual.results = resultsCount

    // 比較
    const report = {
        timestamp: new Date().toISOString(),
        status: 'OK',
        comparisons: []
    }

    const compare = (name, exp, act) => {
        const match = exp === act
        if (!match) report.status = 'MISMATCH'
        report.comparisons.push({
            table: name,
            expected: exp,
            actual: act,
            match,
            diff: act - exp
        })
    }

    compare('races', expected.races, actual.races)
    compare('race_entries', expected.entries, actual.entries)
    compare('predictions', expected.predictions, actual.predictions)
    compare('race_results', expected.results, actual.results)

    // レポート出力
    console.log('\n=== MIGRATION VERIFICATION ===')
    console.log(`Status: ${report.status}`)
    console.log('\nTable Comparisons:')
    for (const c of report.comparisons) {
        const icon = c.match ? '✓' : '✗'
        console.log(`  ${icon} ${c.table}: expected=${c.expected}, actual=${c.actual}, diff=${c.diff}`)
    }

    fs.writeFileSync(
        './migration-verification-report.json',
        JSON.stringify(report, null, 2)
    )

    if (report.status !== 'OK') {
        console.error('\n!!! MIGRATION VERIFICATION FAILED !!!')
        process.exit(1)
    }

    console.log('\n✓ Migration verified successfully!')
}

verifyMigration()
```

#### Step 4: 日付別の詳細検証

```sql
-- 日付別のレース数比較クエリ
-- migration-expected-counts.json の byDate と比較する

SELECT
    race_date,
    COUNT(*) AS races,
    (SELECT COUNT(*) FROM race_entries re
     JOIN races r2 ON re.race_id = r2.race_id
     WHERE r2.race_date = r.race_date) AS entries,
    (SELECT COUNT(*) FROM predictions p
     JOIN races r3 ON p.race_id = r3.race_id
     WHERE r3.race_date = r.race_date) AS predictions,
    (SELECT COUNT(*) FROM race_results rr
     JOIN races r4 ON rr.race_id = r4.race_id
     WHERE r4.race_date = r.race_date) AS results
FROM races r
GROUP BY race_date
ORDER BY race_date;
```

### 3.3 移行実行手順

```bash
# 1. 移行前カウント取得（必須）
node scripts/count-json-data.js
# -> migration-expected-counts.json が生成される

# 2. ドライラン（1日分）
node scripts/migrate-to-supabase.js --date 2026-01-04

# 3. ドライラン検証
node scripts/verify-migration.js --date 2026-01-04

# 4. 全データ移行
node scripts/migrate-to-supabase.js

# 5. 全データ検証（必須）
node scripts/verify-migration.js
# -> migration-verification-report.json が生成される
# -> status が OK でなければ移行失敗

# 6. 失敗レースの再移行（あれば）
node scripts/migrate-to-supabase.js --retry-failed
```

### 3.4 完了条件

- [ ] `migration-expected-counts.json` と DB の件数が完全一致
- [ ] `migration-verification-report.json` の status が OK
- [ ] `migration-failed-races.json` が存在しない（または空）
- [ ] 日付別のレース数が全て一致
- [ ] 予測の的中フラグが正しく設定されている
- [ ] ビューが正常にデータを返す

---

## 4. Phase 3: バッチ切替（一気に切り替え）

### 4.1 タスク一覧

| # | タスク | 依存 | 優先度 |
|---|--------|------|--------|
| 3.1 | データ取得スクリプト作成（Supabase版） | Phase 2 | 必須 |
| 3.2 | 結果取得スクリプト作成（Supabase版） | Phase 2 | 必須 |
| 3.3 | GitHub Actions ワークフロー更新 | 3.1, 3.2 | 必須 |
| 3.4 | フロントエンドをSupabase対応に更新 | Phase 2 | 必須 |
| 3.5 | 動作確認 | 3.3, 3.4 | 必須 |
| 3.6 | JSON出力の完全停止 | 3.5 | 必須 |

### 4.2 切り替え手順

#### 3.1 データ取得スクリプト（Supabase専用）

```javascript
// scripts/batch/fetch-races.js
// Supabaseへ直接保存（JSON出力なし）

async function main() {
    const races = await fetchTodayRaces()

    // Supabaseに保存
    const { error } = await supabase
        .from('races')
        .upsert(races)

    if (error) {
        console.error('Failed to save races:', error)
        process.exit(1)
    }

    console.log(`Saved ${races.length} races to Supabase`)
}
```

#### 3.3 GitHub Actions 更新

```yaml
# .github/workflows/daily-batch.yml
name: Daily Batch

on:
  schedule:
    - cron: '0 23 * * *'  # 08:00 JST
  workflow_dispatch:

jobs:
  fetch-races:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: node scripts/batch/fetch-races.js
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

#### 3.4 フロントエンド更新

```javascript
// src/services/raceService.js
// Supabaseのみ（JSONフォールバックなし）

import { supabase } from './supabase'

export async function getRaces(date) {
    const { data, error } = await supabase
        .from('races')
        .select(`
            *,
            venues (*),
            race_entries (*),
            predictions (*),
            race_results (*)
        `)
        .eq('race_date', date)
        .order('start_time')

    if (error) throw error
    return transformFromSupabase(data)
}
```

### 4.3 完了条件

- [ ] バッチがSupabaseにデータを保存している
- [ ] フロントエンドがSupabaseからデータを取得できる
- [ ] 既存機能が全て動作している
- [ ] JSON関連のコードが削除されている

---

## 5. Phase 4: 機能拡張

### 5.1 タスク一覧

| # | タスク | 依存 | 優先度 |
|---|--------|------|--------|
| 4.1 | オッズデータ取得追加 | Phase 3 | 高 |
| 4.2 | 展示データ取得追加 | Phase 3 | 高 |
| 4.3 | 天候データ取得追加 | Phase 3 | 中 |
| 4.4 | ベットフィルター機能実装 | Phase 3 | 高 |
| 4.5 | ベット推奨表示UI | 4.4 | 高 |
| 4.6 | パフォーマンスダッシュボード | Phase 3 | 中 |
| 4.7 | リアルタイム結果通知 | Phase 3 | 低 |
| 4.8 | 新モデル追加インフラ | Phase 3 | 中 |

### 5.2 優先順位の考え方

```
回収率改善に直結する機能を優先:
1. ベットフィルター（bet/skip判断）
2. オッズデータ（期待値計算に必須）
3. 展示データ（モデル精度向上）
4. パフォーマンス可視化（改善PDCAに必要）
```

### 5.3 完了条件

- [ ] オッズデータが取得・保存されている
- [ ] 展示データが取得・保存されている
- [ ] ベットフィルターが動作している
- [ ] 推奨レースがUIに表示されている
- [ ] パフォーマンスダッシュボードが閲覧可能

---

## 6. リスク管理

### 6.1 リスク一覧

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Supabase障害 | 高 | 障害時はサービス停止（JSONはgitに残っているので復元可能） |
| スクレイピング失敗 | 高 | リトライ + アラート通知 |
| データ不整合 | 中 | 検証クエリの定期実行 |
| API制限超過 | 中 | レート制限対策 + Pro移行検討 |
| **移行中のデータ欠損** | **高** | **移行前後の件数検証を必須化** |

### 6.2 データ欠損時の対処

```bash
# 欠損が見つかった場合
# 1. migration-verification-report.json で差分を確認
# 2. 日付別検証クエリで欠損箇所を特定
# 3. 該当日のJSONから再移行

node scripts/migrate-to-supabase.js --date 2026-01-04
```

---

## 7. チェックリスト

### Phase 1 完了チェック
- [ ] Supabaseプロジェクト作成済み
- [ ] スキーマ作成済み
- [ ] RLS設定済み
- [ ] 初期データ投入済み
- [ ] 環境変数設定済み

### Phase 2 完了チェック（データ欠損ゼロ保証）
- [ ] `migration-expected-counts.json` 生成済み
- [ ] 移行スクリプト動作確認
- [ ] 全データ移行完了
- [ ] **`migration-verification-report.json` の status が OK**
- [ ] **日付別の件数が全て一致**
- [ ] トリガー動作確認

### Phase 3 完了チェック
- [ ] バッチ処理動作確認
- [ ] フロントエンド切替完了
- [ ] 既存機能の動作確認
- [ ] JSON関連コード削除

### Phase 4 完了チェック
- [ ] 追加データ取得動作確認
- [ ] ベットフィルター動作確認
- [ ] UI表示確認
- [ ] パフォーマンス検証

---

## 8. 参照ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [001_schema.sql](./001_schema.sql) | DBスキーマ定義 |
| [002_MIGRATION_SCRIPT.md](./002_MIGRATION_SCRIPT.md) | データ移行仕様 |
| [003_BATCH_PROCESSING.md](./003_BATCH_PROCESSING.md) | バッチ処理仕様 |
| [004_DATA_ACQUISITION.md](./004_DATA_ACQUISITION.md) | データ取得仕様 |
| [005_API_SPECIFICATION.md](./005_API_SPECIFICATION.md) | API仕様 |
| [SUPABASE_MIGRATION_SPEC.md](../SUPABASE_MIGRATION_SPEC.md) | 要件定義書 |
