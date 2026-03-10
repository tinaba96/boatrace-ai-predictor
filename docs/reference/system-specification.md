# システム仕様書

BoatAIルールベース予測システムの詳細仕様。

> **関連ドキュメント:**
> - [database-design.md](./database-design.md) - データベース設計書
> - [analysis-guide.md](./analysis-guide.md) - 分析ガイド
> - [design-system.md](./design-system.md) - デザインシステム

---

## 目次

1. [用語定義](#用語定義)
2. [データモデル](#データモデル)
3. [データフロー](#データフロー)
4. [指標の計算仕様](#指標の計算仕様)
5. [ページ別仕様](#ページ別仕様)
6. [API・サービス仕様](#apiサービス仕様)

---

## 用語定義

### 基本用語

| 用語 | 定義 | 例 |
|------|------|-----|
| **予測 (prediction)** | AIモデルが出力した1レースの順位予測 | 1-2-3（1着:1号艇、2着:2号艇、3着:3号艇） |
| **ルール (rule)** | 特定条件下で賭けを推奨する判定ロジック | 「江戸川7R以降、conf80以上なら3連単」 |
| **ルール適用 (rule application)** | 1つの予測に1つのルールがマッチしたこと | 1レースに3ルールがマッチ → 3件のルール適用 |
| **レース (race)** | ボートレースの1つのレース | 2026-02-05 江戸川 7R |
| **結果 (result)** | レースの確定着順と配当 | 着順: 1-3-2、単勝配当: 150円 |

### 重要な区別

```
1つのレース → 1つの予測 → 複数のルールがマッチ可能 → 複数のルール適用
```

**例：**
- 江戸川 7R の予測: `1-2-3`、confidence: 82
- マッチするルール:
  - E03-W001（単勝: 1号艇推し、conf80以上）
  - E03-T001（3連複: 1-2含む、conf75以上）
  - E03-EX001（3連単: 7R以降）

→ **レース数: 1、ルール適用数: 3**

---

## データモデル

> **詳細は [database-design.md](./database-design.md) を参照**

### predictions テーブル

AIモデルの予測データを格納。

| カラム | 型 | 説明 |
|--------|-----|------|
| `race_id` | string | レースID（主キー）。形式: `YYYY-MM-DD-会場コード-レース番号` |
| `model_id` | string | モデルID。現在は `standard` のみ使用 |
| `top_pick` | int | 1着予測の艇番 (1-6) |
| `top_2nd` | int | 2着予測の艇番 (1-6) |
| `top_3rd` | int | 3着予測の艇番 (1-6) |
| `confidence` | float | 予測の信頼度 (0-100) |
| `predicted_at` | timestamp | 予測生成日時 |

**race_id の例:**
```
2026-02-05-03-07
    │       │  └─ レース番号（7R）
    │       └──── 会場コード（03=江戸川）
    └──────────── 日付
```

### race_results テーブル

レース結果（着順・配当）を格納。

| カラム | 型 | 説明 |
|--------|-----|------|
| `race_id` | string | レースID（主キー） |
| `rank1` | int | 1着の艇番 |
| `rank2` | int | 2着の艇番 |
| `rank3` | int | 3着の艇番 |
| `payout_win` | int | 単勝配当（円） |
| `payout_place_1` | int | 複勝1着配当（円） |
| `payout_place_2` | int | 複勝2着配当（円） |
| `payout_trifecta` | int | 3連複配当（円） |
| `payout_trio` | int | 3連単配当（円） |

### ルール定義（コード内）

`src/services/ruleMatchService.js` にハードコード。

```javascript
{
  id: 'E03-W001',           // ルールID（一意）
  patternName: 'EDOGAWA-WIN-NO2-CONF70',  // パターン名
  description: '2号艇推し×conf70-80',     // 説明
  betType: 'win',           // 賭け種別: win/place/trio/exacta
  stats: {                  // 発掘時の統計（参考値）
    samples: 12,
    hits: 6,
    recovery: 203
  },
  reliability: 'highest',   // 信頼性: highest/high/medium
  check: (pred, raceNo, conf, predSorted, has1) => {
    // 判定ロジック
    return pred.topPick === 2 && conf >= 70 && conf < 80
  }
}
```

### 賭け種別 (betType)

| betType | 日本語 | 的中条件 | 配当カラム |
|---------|--------|----------|-----------|
| `win` | 単勝 | 1着のみ一致 | `payout_win` |
| `place` | 複勝 | 1着または2着に含まれる | `payout_place_1` or `payout_place_2` |
| `trio` | 3連複 | 3艇が順不同で一致 | `payout_trifecta` |
| `exacta` | 3連単 | 3艇が順番通り一致 | `payout_trio` |

---

## データフロー

### 日次処理

```
[1. 予測生成]
    │ scripts/daily/generate-predictions.js
    │ → predictions テーブルに保存
    ▼
[2. レース開催]
    │ 実際のボートレース
    ▼
[3. 結果スクレイピング]
    │ scripts/daily/scrape-results.js
    │ → race_results テーブルに保存
    ▼
[4. ページ表示時に計算]
    /picks, /admin/rules でリアルタイム集計
```

### ページ読み込み時の処理

```
[ユーザーがページを開く]
    │
    ▼
[Supabaseから予測データ取得]
    │ predictions テーブル
    ▼
[Supabaseから結果データ取得]
    │ race_results テーブル
    ▼
[ルールマッチング]
    │ 各予測に対してVENUE_RULESをチェック
    │ → マッチしたルールを抽出
    ▼
[的中判定・配当計算]
    │ 結果があるルール適用のみ
    ▼
[集計・表示]
```

---

## 指標の計算仕様

### 累積成績 (getOverallPerformance)

**ファイル:** `src/services/ruleMatchService.js`

| 指標 | 計算方法 | 注意点 |
|------|---------|--------|
| レース数 | `totalSamples` | **実際はルール適用数**（結果ありのみ） |
| 的中数 | `totalHits` | 的中したルール適用数 |
| 的中率 | `totalHits / totalSamples * 100` | パーセント表示 |
| 投資 | `totalSamples * 100` | 1ルール適用 = 100円と仮定 |
| 回収 | `totalPayout` | 的中時の配当合計 |
| 回収率 | `totalPayout / (totalSamples * 100) * 100` | パーセント表示 |

**重要: 「レース数」の実態**

```javascript
// getOverallPerformance() 内のカウントロジック
for (const pred of allPredictions) {
  for (const rule of rules) {
    if (rule.check(...)) {
      if (result) {           // 結果がある場合のみカウント
        totalSamples++        // ← これが「レース数」として表示される
      }
    }
  }
}
```

- 1レースに3ルールがマッチ → totalSamples += 3
- 表示上は「レース数」だが、実際は「ルール適用数（結果あり）」

### 履歴件数 (getRuleApplicationHistory)

**ファイル:** `src/services/adminRuleService.js`

| 指標 | 計算方法 | 注意点 |
|------|---------|--------|
| total | Supabaseのcount | 予測データの行数 |
| historyItems.length | ループで生成 | ルール適用数（結果の有無問わず） |

**注意:** `total` と `historyItems.length` は異なる可能性がある。

```javascript
// 現在の実装
const { data: predictions, count } = await supabase
  .from('predictions')
  .select('*', { count: 'exact' })  // count = 予測データ数

// historyItemsはルール適用ごとに生成
for (const pred of predictions) {
  const rules = getMatchingRules(...)
  for (const rule of rules) {
    historyItems.push({...})  // ルールごとに1件
  }
}

return { data: historyItems, total: count }  // totalは予測数、dataはルール適用数
```

### 週別パフォーマンス (getWeeklyPerformance)

**ファイル:** `src/services/adminRuleService.js`

- 日付ごとにルール適用数と配当を集計
- 週単位（月曜始まり）でグループ化
- 累積値を計算

---

## ページ別仕様

### /picks（今日のおすすめ）

**対象ユーザー:** 一般ユーザー

#### サマリーセクション

| 表示項目 | データソース | 説明 |
|---------|-------------|------|
| 投資 | `overallPerformance.totalInvestment` | ルール適用数 × 100円 |
| 回収 | `overallPerformance.totalPayout` | 的中配当合計 |
| 回収率 | `overallPerformance.recovery` | 回収 / 投資 × 100 |
| レース数 | `overallPerformance.samples` | ルール適用数（結果あり） |
| 的中数 | `overallPerformance.hits` | 的中ルール適用数 |

#### 注目レース

**表示条件:**
- 回収率 100% 以上
- 運用サンプル数 10 件以上
- `reliability` が `high` または `highest`

#### レースカード

- 全アクティブルールでマッチしたレースを表示
- ルールID・詳細は非表示（ユーザー向け）

### /admin/rules（管理者ダッシュボード）

**対象ユーザー:** 管理者（URLを知っている人のみ）

#### 概要タブ

| 表示項目 | 説明 |
|---------|------|
| 累積成績 | 全ルールの合算成績 |
| 全ルールテーブル | ソート可能（回収率、的中率、サンプル数、ルールID） |
| 週別推移グラフ | 週ごとの回収率推移 |

#### 会場別タブ

- 会場セレクタで絞り込み
- 選択会場のルール一覧

#### 本日タブ

- 今日適用されたルール一覧
- 結果あり/なしを区別

#### 履歴タブ

| 項目 | 説明 |
|------|------|
| 日付範囲フィルタ | 開始日・終了日を指定 |
| ページネーション | 300件/ページ |
| テーブル | 日付、会場、R番号、ルールID、種別、予測、結果、的中/不的中、配当 |

**日付フィルタの仕様:**
- `race_id` で文字列比較（タイムゾーン問題を回避）
- 開始日 ≤ race_id < 終了日の翌日

---

## API・サービス仕様

### ruleMatchService.js

主要な公開関数:

| 関数 | 戻り値 | 用途 |
|------|--------|------|
| `getMatchingRules(prediction, venueCode, raceNo)` | Rule[] | 予測にマッチするルール一覧 |
| `getOverallPerformance()` | Object | 全体の累積成績 |
| `getTopPerformingRules(options)` | Rule[] | 成績順のルール一覧 |
| `getTodaysMatchingRaces(today)` | Object[] | 今日のルールマッチレース |
| `getRulePerformanceByVenue(venueCode)` | Object | 会場別のルール成績 |
| `getAvailableVenues()` | Object[] | ルールが定義されている会場一覧 |
| `getBetTypeName(betType)` | string | 種別の日本語名 |
| `getVenueName(venueCode)` | string | 会場の日本語名 |

### adminRuleService.js

| 関数 | 戻り値 | 用途 |
|------|--------|------|
| `getRuleApplicationHistory(startDate, endDate, limit, offset)` | {data, total} | ルール適用履歴 |
| `getWeeklyPerformance()` | Object[] | 週別累積パフォーマンス |

---

## 会場コード一覧

```
01:桐生    02:戸田    03:江戸川  04:平和島  05:多摩川  06:浜名湖
07:蒲郡    08:常滑    09:津      10:三国    11:びわこ  12:住之江
13:尼崎    14:鳴門    15:丸亀    16:児島    17:宮島    18:徳山
19:下関    20:若松    21:芦屋    22:福岡    23:唐津    24:大村
```

---

## 既知の仕様上の注意点

### 1. 「レース数」の表示

- 画面上の「レース数」は実際には「ルール適用数（結果あり）」
- 1レースに複数ルールがマッチすると、複数カウントされる
- 将来的に「ユニークレース数」と「ルール適用数」を分けて表示することを検討

### 2. 履歴の件数表示

- `total` は予測データ数を表示
- 実際の履歴アイテム数（ルール適用数）とは異なる場合がある
- ページネーションは予測データ数に基づく

### 3. サマリーの遡及計算

- ルールを削除すると、過去の成績も再計算される
- 「現在アクティブなルールで運用開始日から賭けていたら」という仮想成績
- 過去にルールが存在していたかどうかは考慮されない
