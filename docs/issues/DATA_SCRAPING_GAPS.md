# スクレイピング仕様と既知の課題

> **関連ドキュメント**: [DATA_ACQUISITION_STRATEGY.md](../proposal/DATA_ACQUISITION_STRATEGY.md)

---

## 実行スケジュール

### GitHub Actions (`scrape.yml`)

```
cron: '0 0-13,18-23 * * *' (UTC)
```

| UTC | JST | 状態 |
|-----|-----|------|
| 18:00-23:00 | 3:00-8:00 | 実行（早朝） |
| 0:00-13:00 | 9:00-22:00 | 実行（日中〜夜間） |
| 14:00-17:00 | 23:00-2:00 | 停止 |

**実質**: JST 3:00〜22:00 の間、**1時間間隔**で実行

### 実行ステップの順序

```
[1] scrape-to-json.js        ← 出走表・天候・展示データ取得
    ↓ data/races.json 生成
[2] generate-predictions.js   ← AI予想生成 + Supabase書込
    ↓ races, race_entries, predictions, exhibition_data, race_conditions
[3] scrape-results.js         ← レース結果取得 (continue-on-error)
    ↓ race_results, predictions(的中判定)
[4] calculate-accuracy.js     ← 精度統計更新 (continue-on-error)
    ↓ models テーブル更新
[5] git commit & push
[6] Vercel deploy
```

- Step 1-2 は失敗するとワークフロー停止
- Step 3-4 は失敗しても続行（`continue-on-error: true`）

---

## 各スクリプトの仕様

### 1. scrape-to-json.js

**対象**: 本日（JST）開催中の全会場・全レース
**出力**: `data/races.json`

#### スクレイピング対象ページ（レースごと）

| ページ | URL | 取得データ |
|--------|-----|----------|
| beforeinfo | `/race/beforeinfo?rno=X&jcd=XX&hd=YYYYMMDD` | 天候、展示タイム、展示ST |
| racelist | `/race/racelist?rno=X&jcd=XX&hd=YYYYMMDD` | 選手情報、成績 |
| raceindex | `/race/raceindex?jcd=XX&hd=YYYYMMDD` | 発走時刻（会場単位） |

#### 展示データの取得

beforeinfo ページの `.table1`（2番目）から抽出:
- **展示タイム** (`exhibitionTime`): 各艇の直線走行タイム（6.XX秒台）
- **展示ST** (`startTiming`): 各艇のスタートタイミング（0.XX秒）
- 展示未実施の場合: HTMLにデータなし → `null` を返す

### 2. generate-predictions.js

**入力**: `data/races.json` + Supabase `racer_aggregated_stats`
**出力**: 複数テーブルに upsert

#### 展示データがない場合の挙動

```javascript
function calculateExhibitionBonus(exhibitionEntry, avgExTime, modelType) {
    if (!exhibitionEntry) return 0;  // 展示データなし → ボーナス0
    // ...
}
```

- 展示データなし → 展示ボーナス = 0（選手基礎成績のみで予想生成）
- 展開予測（turnPrediction）の `exhibitionST` も null → デフォルトST（0.15）を使用

### 3. scrape-results.js

**対象**: Supabase `races` テーブルにある当日レースの結果
**取得元**: `/race/raceresult` ページ

取得データ: 1-3着艇番、配当、決まり手、進入コース、各艇ST
結果未公開のレースはスキップ → 次回スクレイピングで再試行

---

## 展示データのタイミング問題

### ボートレースのタイムライン

```
     レース開催の1日の流れ（例: デイレース）

10:00  1R展示航走（約5分間）
10:20  1R発走
10:30  1R結果公開
  :
10:50  2R展示航走
11:10  2R発走
  :
16:00  11R展示航走
16:20  11R発走
  :
16:50  12R展示航走
17:10  12R発走
17:20  12R結果公開（最終）
```

### 展示データが取得できる条件

```
beforeinfo ページに展示データが表示されるタイミング:

  展示航走    beforeinfoに反映    発走     結果ページに切替
  ──●───────────●──────────────●──────────●──────→
    ↑           ↑              ↑          ↑
  約30分前    〜25分前        レース開始   5-15分後

  ※ 発走後もbeforinfoに展示データが残っているケースもあるが
    確実ではない
```

### 1時間間隔スクレイピングで発生するギャップ

```
時刻      スクレイピング  レースの状況
─────────────────────────────────────────────────
09:00  ← [スクレイピング①] 1R〜3R: 展示済み ✅ 取得可能
                           4R以降: 展示前 ❌ 取得不可
  :
09:20     1R展示航走
09:40     1R発走 → 結果確定
09:50     2R展示航走
  :
10:00  ← [スクレイピング②] 1R: 発走済み（beforeinfoデータ不明）
                           2R〜5R: 展示済み ✅ 取得可能
                           6R以降: 展示前 ❌ 取得不可
  :
10:10     2R発走
10:20     3R展示航走
10:30     3R発走  ← 展示〜発走の間にスクレイピングなし
  :
11:00  ← [スクレイピング③] ...
```

### 取り逃すパターン

| パターン | 例 | 発生頻度 |
|---------|-----|---------|
| **展示〜発走の間にスクレイピングなし** | 展示10:05、発走10:25、次回スクレイプ11:00 | 高（毎日複数レース） |
| **最初のスクレイピングの時点でまだ展示前** | 9:00スクレイプ時に6R以降は未展示 | 必ず発生 |

**影響**: 展示データが取得できなかったレースは、展示ボーナスなし（=0）で予想が生成される。
展開予測のST優位性計算でもデフォルト値（0.15）が使われ、精度が低下する。

### ただし: 毎時上書きにより改善されるケース

generate-predictions.js は毎回 **upsert**（上書き）するため:
- 9:00 時点: 6Rの展示データなしで予想生成
- 10:00 時点: 6Rの展示データありで予想を**上書き** → 改善

**問題が残るのは**: 展示から発走までの間にスクレイピングが1回もないレース

---

## 背景: なぜ展示データの取得漏れが問題か

フロントエンドの「詳細データ分析」テーブルに展示タイム・展示STを表示する機能を追加した。
しかし、1時間間隔のスクレイピングでは展示データを取り逃すレースが毎日複数発生し、
ユーザーに「-」表示が頻出してしまう。

展示データはAI予想の精度にも直結する（展示ボーナス・展開予測のST優位性計算）ため、
漏れなく取得することが重要。

## 検討した改善案

| 案 | 内容 | 展示取得率 | 実行時間 | 問題点 |
|----|------|-----------|---------|--------|
| A: 30分間隔（フル） | 既存ワークフローを30分間隔に | ~80% | 平均27分 | 実行が重複する（平均27分 vs 30分間隔） |
| B: 15分間隔（展示専用） | beforeinfo取得+予想再生成のみの軽量ワークフロー | ~95% | 2-3分 | 新規ワークフロー追加 |
| C: 発走時刻ベース | 発走時刻から逆算して動的スケジュール | ~98% | 最小 | 実装が複雑、cron精度の問題 |

### 不採用: 公式サイトからのプッシュ通知

公式サイト（boatrace.jp）の beforeinfo ページは完全に静的なサーバーサイドレンダリング。
WebSocket、EventSource、meta refresh、Ajax ポーリングは一切なし。
「展示が公開されたら通知を受ける」仕組みは存在しないため、ポーリング方式が必須。

### 展示データの公開状態の判別方法

beforeinfo ページの HTML は展示前後でテーブル構造が同一。セルの値で判別する:

| 状態 | 展示タイム (td[4]) | 展示ST (row2 td[2]) |
|------|-------------------|---------------------|
| 前検前 | 空 | 空 |
| 前検後・展示前 | 空 | 空 |
| 展示後 | 数値（例: 6.84） | 数値（例: .09） |

## 採用: 案B — 15分間隔の展示専用軽量ワークフロー

### 理由

- 既存の scrape.yml（1時間間隔）は結果取得（scrape-results.js）が平均24分かかるため間隔を縮められない
- 展示データ取得 + 予想再生成だけなら2-3分で完了し、15分間隔でも余裕がある
- 既存ワークフローへの影響がない（独立して動作）

### 設計概要

```
[新規] .github/workflows/scrape-exhibition.yml
  cron: 15分間隔（JST 9:00-17:00、レース開催時間帯のみ）

  ステップ:
  1. 全会場の beforeinfo をスクレイピング（展示データのみ）
  2. 新しく展示データが入ったレースを検出
  3. 該当レースの予想を展示データ込みで再生成
  4. Supabase に exhibition_data + predictions を upsert
```

---

## 取得データ一覧

### 出走表 (scrape-to-json.js / racelist)

| データ | 取得状況 | 保存先 |
|--------|---------|--------|
| 選手名 | ✅ | race_entries.player_name |
| 級別 | ✅ | race_entries.grade |
| 年齢 | ✅ | race_entries.age |
| 全国勝率/2連率/3連率 | ✅ | race_entries.win_rate, global_2rate, global_3rate |
| 当地勝率/2連率/3連率 | ✅ | race_entries.local_win_rate, local_2rate, local_3rate |
| モーター番号/2連率/3連率 | ✅ | race_entries.motor_number, motor_2rate, motor_3rate |
| ボート番号/2連率/3連率 | ✅ | race_entries.boat_number_id, boat_2rate, boat_3rate |
| 選手登録番号 | ✅ | race_entries.racer_id |
| 支部・出身地 | ❌ | ページ上に存在するが未取得 |
| 体重 | ❌ | ページ上に存在するが未取得 |

### 天候 (scrape-to-json.js / beforeinfo)

| データ | 取得状況 | 保存先 |
|--------|---------|--------|
| 天気/気温/風向/風速/水温/波高 | ✅ | race_conditions |
| グレード/レースタイトル | ✅ | race_conditions.race_grade, race_title |
| 節情報（何日目か） | ❌ | 未取得 |

### 展示データ (scrape-to-json.js / beforeinfo)

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| 展示タイム | ✅ | exhibition_data.exhibition_time | タイミング問題あり（上記参照） |
| 展示ST | ✅ | exhibition_data.start_timing | 同上 |

### 結果 (scrape-results.js / raceresult)

| データ | 取得状況 | 保存先 |
|--------|---------|--------|
| 1-3着艇番 | ✅ | race_results.rank1/2/3 |
| 配当（単勝/複勝/3連複/3連単） | ✅ | race_results.payout_* |
| 決まり手 | ✅ | race_results.winning_technique |
| 進入コース | ✅ | race_results.course_1〜6 |
| 各艇ST | ✅ | race_start_timings |
| 2連単/2連複/拡連複配当 | ❌ | 未取得 |
| 単勝オッズ | ❌ | race_odds テーブル存在するが未使用 |
