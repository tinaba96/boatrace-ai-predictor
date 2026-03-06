# 展開予測システム v2 - 設計書

## 概要

展開予測を攻守両面のマッチアップベースに再設計し、上位3パターンをタブUIで表示する。
展開予測・展示データを3モデルのスコア計算に統合する。

## 解決する問題

1. `racer_aggregated_stats` の個人データ未使用（avgST, attackDistribution がハードコード）
2. 攻撃データのみで被攻撃データがない
3. 展開予測結果がスコアに反映されていない

## データ基盤

### DBカラム追加

`racer_aggregated_stats` に以下を追加:

- `defense_distribution` (JSONB): コース別被攻撃分布
- `course_race_counts` (JSONB): コース別出走数・勝数

マイグレーション: `docs/db-migration/add-defense-distribution.sql`

### 集計関数

- `calculateDefenseDistribution()`: 選手がNコースにいた時に負けた決まり手の分布
- `calculateCourseRaceCounts()`: コース別の出走数と勝数

## 予測アルゴリズム (predictFirstMarkV2)

### Step 1: ST予測
```
predictedST = exhibitionST * 0.55 + avgST * 0.35 + DEFAULT * 0.10
```

### Step 2: ST優位性マトリクス
```
stAdvantage[i][j] = sigmoid((ST[j] - ST[i]) / 0.03)
```

### Step 3: 逃げ確率
- 個人の逃げ実績をベイズ縮小（50走で完全信頼）
- ST差、モーター性能で補正

### Step 4: 攻撃パターン確率
- 攻撃側の実績 x 防御側の被攻撃率 の幾何平均
- まくり系はST優位が必要
- モーター・ベイズ縮小で補正

### Step 5: 正規化 -> 上位3パターン

## スコア統合

### 展開予測ボーナス
| モデル | 逃げ | その他 |
|--------|------|--------|
| スタンダード | 300 | 300 |
| 本命狙い | 500 | 150 |
| 穴狙い | 100 | 400 |

### 展示データボーナス
- 展示タイム差 x モデル別重み
- 展示ST x モデル別重み
- 穴狙いは展示重視、本命狙いは控えめ

## フロントエンド

### 3パターンタブUI
- patterns 配列から最大3つのタブを生成
- タブ切り替えでアニメーション再生
- 旧フォーマット（patterns なし）も1パターンで表示（後方互換）

## 修正ファイル

| ファイル | 変更内容 |
|---------|----------|
| `docs/db-migration/add-defense-distribution.sql` | マイグレーションSQL |
| `scripts/analysis/aggregate-racer-stats.js` | 被攻撃分布・出走数の集計関数追加 |
| `scripts/lib/winningTechniques.js` | COURSE_DEFAULT_DEFENSE 追加 |
| `scripts/lib/turnPrediction.js` | predictFirstMarkV2 実装 |
| `scripts/daily/generate-predictions.js` | racer_stats取得、ボーナス関数、スコア更新 |
| `src/services/supabaseDataService.js` | patterns フォーマット対応 |
| `src/components/race/FirstMarkAnimation.jsx` | 3パターンタブUI |
| `src/components/race/FirstMarkAnimation.css` | タブスタイル |
| `src/pages/RaceDetail.jsx` | patterns props渡し |
