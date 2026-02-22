# データ取得の課題と改善提案

現在のスクレイピングで取得しているデータと、取得すべきだが未取得のデータを整理。

> **関連ドキュメント**: [DATA_ACQUISITION_STRATEGY.md](../proposal/DATA_ACQUISITION_STRATEGY.md)

---

## 現状のデータ取得フロー

```
[毎時0分] GitHub Actions
    │
    ├─ scrape-to-json.js ─────────────────────┐
    │   ├─ 開催会場一覧                         │
    │   ├─ 出走表（選手情報）                    │ → data/races.json
    │   ├─ 天候情報（朝時点）                    │    + Supabase
    │   └─ レース開始時刻                        │
    │                                          │
    ├─ generate-predictions.js ───────────────┤
    │   └─ AI予測生成                           │ → Supabase (predictions)
    │                                          │
    └─ scrape-results.js ─────────────────────┤
        ├─ 着順（1-3着）                        │
        ├─ 配当（単勝/複勝/3連複/3連単）          │ → Supabase (race_results)
        └─ 決まり手                             │
```

---

## 取得データ一覧

### 出走表スクレイピング (scrape-to-json.js)

**取得URL**: `https://www.boatrace.jp/owpc/pc/race/racelist`

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| 選手名 | ✅ 取得中 | race_entries.player_name | |
| 級別 | ✅ 取得中 | race_entries.grade | A1/A2/B1/B2 |
| 年齢 | ✅ 取得中 | race_entries.age | |
| 全国勝率 | ✅ 取得中 | race_entries.win_rate | |
| 当地勝率 | ✅ 取得中 | race_entries.local_win_rate | |
| 全国2連率 | ✅ 取得中 | race_entries.global_2rate | |
| 当地2連率 | ✅ 取得中 | race_entries.local_2rate | |
| モーター番号 | ✅ 取得中 | race_entries.motor_number | |
| モーター2連率 | ✅ 取得中 | race_entries.motor_2rate | |
| ボート番号 | ✅ 取得中 | race_entries.boat_number_id | |
| ボート2連率 | ✅ 取得中 | race_entries.boat_2rate | |
| 全国3連率 | ✅ 取得中 | race_entries.global_3rate | 2026-02-12実装完了 |
| 当地3連率 | ✅ 取得中 | race_entries.local_3rate | 2026-02-12実装完了 |
| モーター3連率 | ✅ 取得中 | race_entries.motor_3rate | 2026-02-12実装完了 |
| ボート3連率 | ✅ 取得中 | race_entries.boat_3rate | 2026-02-12実装完了 |
| 選手登録番号 | ✅ 取得中 | race_entries.racer_id | 2026-02-12実装完了 |
| **支部・出身地** | ❌ 未取得 | - | ページ上に存在 |
| **体重** | ❌ 未取得 | - | ページ上に存在 |

### 天候情報 (scrape-to-json.js)

**取得URL**: `https://www.boatrace.jp/owpc/pc/race/beforeinfo`

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| 天気 | ✅ 取得中 | race_conditions.weather | |
| 気温 | ✅ 取得中 | race_conditions.temperature | |
| 風向 | ✅ 取得中 | race_conditions.wind_direction | |
| 風速 | ✅ 取得中 | race_conditions.wind_speed | |
| 水温 | ✅ 取得中 | race_conditions.water_temperature | |
| 波高 | ✅ 取得中 | race_conditions.wave_height | |

**課題**: 朝1回の取得のため、ナイターレースの天候変化を反映できない

### レースグレード (scrape-to-json.js)

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| グレード | ✅ 取得中 | race_conditions.race_grade | SG/G1/G2/G3/ippan |
| レースタイトル | ✅ 取得中 | race_conditions.race_title | |
| **節情報** | ❌ 未取得 | - | 何日目かの情報 |
| **最終日フラグ** | ❌ 未取得 | - | 優勝戦かどうか |

### 結果スクレイピング (scrape-results.js)

**取得URL**: `https://www.boatrace.jp/owpc/pc/race/raceresult`

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| 1着艇番 | ✅ 取得中 | race_results.rank1 | |
| 2着艇番 | ✅ 取得中 | race_results.rank2 | |
| 3着艇番 | ✅ 取得中 | race_results.rank3 | |
| 単勝配当 | ✅ 取得中 | race_results.payout_win | |
| 複勝配当（1着） | ✅ 取得中 | race_results.payout_place_1 | |
| 複勝配当（2着） | ✅ 取得中 | race_results.payout_place_2 | |
| 3連複配当 | ✅ 取得中 | race_results.payout_trifecta | |
| 3連単配当 | ✅ 取得中 | race_results.payout_trio | |
| 決まり手 | ✅ 取得中 | race_results.winning_technique | |
| 進入コース | ✅ 取得中 | race_results.course_1〜6 | 2026-02-11実装完了 |
| **2連単配当** | ❌ 未取得 | - | カラムなし |
| **2連複配当** | ❌ 未取得 | - | カラムなし |
| **拡連複配当** | ❌ 未取得 | - | カラムなし |
| **単勝オッズ** | ❌ 未取得 | race_odds | テーブルは存在するが未使用 |
| **スタートタイミング** | ❌ 未取得 | - | 結果ページに存在 |

### 展示情報

**取得URL**: `https://www.boatrace.jp/owpc/pc/race/beforeinfo`

| データ | 取得状況 | 保存先 | 備考 |
|--------|---------|--------|------|
| **展示タイム** | ❌ 未取得 | exhibition_data | テーブルは存在するが未使用 |
| **展示ST** | ❌ 未取得 | exhibition_data | テーブルは存在するが未使用 |

---

## 優先度別の改善提案

### 優先度: 高（追加負荷なし）

同一ページから取得可能なため、スクリプト修正のみで対応可能。

| 項目 | 現状 | 改善内容 | 期待効果 |
|------|------|---------|---------|
| ~~進入コース~~ | ✅ 完了 | - | 2026-02-11実装完了 |
| ~~3連率（全国/当地/モーター/ボート）~~ | ✅ 完了 | - | 2026-02-12実装完了 |
| ~~選手登録番号~~ | ✅ 完了 | - | 2026-02-12実装完了 |

### 優先度: 中（軽微な追加負荷）

結果取得時に追加ページアクセスが必要。

| 項目 | 追加負荷 | 改善内容 | 期待効果 |
|------|---------|---------|---------|
| 展示タイム・ST | +288リクエスト/日 | beforeinfoページから取得 | モデル改善の分析材料 |
| 確定天候 | +288リクエスト/日 | 結果取得時にbeforeinfoも取得 | ナイター天候の正確な記録 |
| 単勝オッズ | 追加なし | raceresultページから取得 | 期待値分析 |

### 優先度: 低（大きな追加負荷）

リアルタイム取得は負荷が高く、費用対効果が低い。

| 項目 | 追加負荷 | 現実的な対応 |
|------|---------|-------------|
| リアルタイム天候 | +288リクエスト/日 | 結果取得時の確定値で代替 |
| リアルタイム展示 | +288リクエスト/日 | 将来検討（外部APIがあれば） |
| リアルタイムオッズ | +288〜576リクエスト/日 | 対応不要（確定配当で十分） |

---

## DBスキーマとの乖離

### テーブル別レコード数（2026-02-20時点）

| テーブル | レコード数 | 状態 |
|---------|-----------|------|
| venues | 24 | ✅ マスタ完備 |
| races | 12,720 | ✅ 稼働中 |
| race_entries | 76,320 | ✅ 稼働中 |
| race_results | 11,969 | ✅ 稼働中 |
| race_conditions | 2,424 | ⚠️ 一部のみ（19%） |
| predictions | 33,552 | ✅ 稼働中 |
| models | 3 | ✅ マスタ完備 |
| race_odds | 0 | ❌ 未使用 |
| exhibition_data | 0 | ❌ 未使用 |
| bet_filters | 0 | ❌ 未使用 |
| bet_recommendations | 0 | ❌ 未使用 |
| daily_bet_summary | 0 | ❌ 未使用 |
| user_visible_summary | 0 | ❌ 未使用 |
| model_performance_daily | 0 | ❌ 未使用 |
| model_experiments | 0 | ❌ 未使用 |

### カラム別データ格納率

#### venues（24件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| code, name, water_type | 24 | 100% | ✅ マスタ |
| cluster | 24 | 100% | ✅ |
| avg_first_win_rate | 20 | 83% | ⚠️ 4会場欠損 |
| avg_volatility_score | 20 | 83% | ⚠️ 4会場欠損 |

#### races（12,720件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| race_id, race_date, venue_code, race_number | 12,720 | 100% | ✅ |
| start_time | 12,720 | 100% | ✅ |
| volatility_score | 10,398 | 81.7% | ✅ |
| volatility_level, recommended_model | 10,416 | 81.9% | ✅ |
| volatility_reasons | 10,416 | 81.9% | ✅ |
| first_boat_grade | 12,720 | 100% | ✅ |
| first_boat_win_rate | 12,720 | 100% | ✅ |
| first_boat_motor_2rate | 12,720 | 100% | ✅ |
| win_rate_stddev | 12,720 | 100% | ✅ |
| win_rate_avg | 12,720 | 100% | ✅ |
| motor_2rate_stddev | 12,720 | 100% | ✅ |

#### race_entries（76,320件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| race_id, boat_number | 76,320 | 100% | ✅ PK |
| player_name | 76,320 | 100% | ✅ |
| grade | 76,320 | 100% | ✅ |
| age | 76,320 | 100% | ✅ |
| win_rate | 76,298 | 100.0% | ✅ |
| local_win_rate | 73,950 | 96.9% | ✅ |
| global_2rate | 27,690 | 36.3% | ✅ 日次取得中 |
| local_2rate | 25,580 | 33.5% | ✅ 日次取得中 |
| global_3rate | 24,168 | 31.7% | ✅ 日次取得中 |
| local_3rate | 22,326 | 29.3% | ✅ 日次取得中 |
| motor_number | 76,320 | 100% | ✅ |
| motor_2rate | 74,384 | 97.5% | ✅ |
| motor_3rate | 23,985 | 31.4% | ✅ 日次取得中 |
| boat_number_id | 76,320 | 100% | ✅ |
| boat_2rate | 75,173 | 98.5% | ✅ |
| boat_3rate | 24,258 | 31.8% | ✅ 日次取得中 |
| racer_id | 24,408 | 32.0% | ✅ 日次取得中 |
| ai_score_standard | 76,320 | 100% | ✅ |
| ai_score_safe_bet | 62,496 | 81.9% | ✅ |
| ai_score_upset_focus | 62,496 | 81.9% | ✅ |

#### race_results（11,969件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| race_id | 11,969 | 100% | ✅ PK |
| rank1, rank2, rank3 | 11,969 | 100% | ✅ |
| payout_win | 11,969 | 100% | ✅ |
| payout_place_1 | 11,964 | 100.0% | ✅ |
| payout_place_2 | 11,940 | 99.8% | ✅ |
| payout_trifecta | 11,969 | 100% | ✅ |
| payout_trio | 11,969 | 100% | ✅ |
| course_1〜6 | 11,010〜11,014 | 92.0% | ✅ 日次取得中 |
| winning_technique | 4,310 | 36.0% | ✅ 日次取得中 |
| is_cancelled | 11,969 | 100% | 全てFALSE（判定ロジック未実装） |
| is_no_race | 11,969 | 100% | 全てFALSE（判定ロジック未実装） |
| result_at | 11,969 | 100% | ✅ |

#### race_conditions（2,424件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| race_id | 2,424 | 100% | ✅ PK |
| weather | 2,399 | 99.0% | ✅ |
| wind_direction | 2,191 | 90.4% | ✅ |
| wind_speed | 2,388 | 98.5% | ✅ |
| wave_height | 2,388 | 98.5% | ✅ |
| temperature | 2,388 | 98.5% | ✅ |
| water_temperature | 2,388 | 98.5% | ✅ |
| race_grade | 2,280 | 94.1% | ✅ |
| race_title | 2,280 | 94.1% | ✅ |
| series_day | 0 | 0% | ❌ 未実装 |
| is_final_day | 0 | 0% | ❌ 未実装 |

#### predictions（33,552件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| race_id, model_id | 33,552 | 100% | ✅ |
| top_pick, top_2nd, top_3rd | 33,552 | 100% | ✅ |
| confidence | 33,552 | 100% | ✅ |
| scores | 14,184 | 42.3% | ⚠️ 一部のみ |
| feature_contributions | 0 | 0% | ❌ 未実装 |
| is_hit_win | 31,767 | 94.7% | ✅ トリガー自動更新 |
| is_hit_place | 31,767 | 94.7% | ✅ |
| is_hit_trifecta | 31,767 | 94.7% | ✅ |
| is_hit_trio | 31,767 | 94.7% | ✅ |
| payout_win | 14,484 | 43.2% | 的中分のみ |
| payout_place | 19,858 | 59.2% | 的中分のみ |
| payout_trifecta | 8,435 | 25.1% | 的中分のみ |
| payout_trio | 5,473 | 16.3% | 的中分のみ |
| is_shadow | 33,552 | 100% | ✅ |

#### models（3件）

| カラム | 格納数 | 格納率 | 備考 |
|--------|--------|--------|------|
| model_id, display_name, model_type | 3 | 100% | ✅ |
| description | 3 | 100% | ✅ |
| version | 3 | 100% | ✅ |
| hyperparameters, feature_list | 3 | 100% | ✅ |
| status, is_public | 3 | 100% | ✅ |
| total_predictions, hit_rate_win, recovery_rate_win | 3 | 100% | ✅ |
| last_evaluated_at | 3 | 100% | ✅ |
| parent_model_id | 0 | 0% | ❌ 未使用 |
| target_venues | 0 | 0% | ❌ 未使用 |
| target_volatility_min/max | 0 | 0% | ❌ 未使用 |
| trained_at | 0 | 0% | ❌ 未使用 |
| training_data_from/to | 0 | 0% | ❌ 未使用 |
| training_race_count | 0 | 0% | ❌ 未使用 |

### 定義済みだが未使用のテーブル

| テーブル | 用途 | 未使用理由 |
|---------|------|-----------|
| race_odds | オッズ情報 | スクレイピング未実装 |
| exhibition_data | 展示タイム・ST | スクレイピング未実装 |
| bet_filters | フィルタ条件 | 機能未実装 |
| bet_recommendations | 賭け推奨 | 機能未実装 |
| daily_bet_summary | 日次集計 | 機能未実装 |
| user_visible_summary | ユーザー表示サマリー | 機能未実装 |
| model_performance_daily | モデル日次パフォーマンス | 機能未実装 |
| model_experiments | A/Bテスト | 機能未実装 |

---

## 推奨アクション

### 短期（1週間以内）

1. ~~**進入コース取得の実装**~~ ✅ 完了（2026-02-11）
   - `scrape-results.js` に `scrapeCourseInfo()` 関数を追加
   - 過去データも96.7%補完済み

2. ~~**3連率の取得追加**~~ ✅ 完了（2026-02-12）
   - `scrape-to-json.js` を修正済み
   - 全国/当地/モーター/ボートの3連率を取得
   - `race_entries` テーブルに4カラム追加済み

3. ~~**選手登録番号の取得追加**~~ ✅ 完了（2026-02-12）
   - `scrape-to-json.js` を修正済み
   - `race_entries.racer_id` カラム追加済み

4. ~~**過去データ補完**~~ ✅ 完了（2026-02-12）
   - `scripts/maintenance/backfill-race-data.js` を作成
   - 2025-12〜2026-02の過去データを補完
   - racer_id: 792件 → 24,408件 (32.0%)
   - global_3rate等: 792件 → 24,000件超 (31%)
   - winning_technique: 1,133件 → 4,310件 (36.0%)

### 中期（1ヶ月以内）

5. **展示タイム・STの取得**
   - `scrape-results.js` に追加
   - 結果取得後に `beforeinfo` ページをフェッチ
   - `exhibition_data` テーブルに保存

6. **単勝オッズの取得**
   - 結果ページに確定オッズがあるか確認
   - あれば `race_odds` テーブルに保存

### 長期（要検討）

7. **外部データソースの調査**
   - ボートレース公式API（存在確認）
   - サードパーティデータプロバイダー
   - コスト vs 価値の評価

---

## 参考: 取得可能なURLパターン

| ページ | URL | 取得可能データ |
|--------|-----|---------------|
| 出走表 | `/race/racelist?rno=X&jcd=XX&hd=YYYYMMDD` | 選手情報、グレード |
| 直前情報 | `/race/beforeinfo?rno=X&jcd=XX&hd=YYYYMMDD` | 天候、展示タイム、ST |
| オッズ | `/race/odds?rno=X&jcd=XX&hd=YYYYMMDD` | 各種オッズ |
| 結果 | `/race/raceresult?rno=X&jcd=XX&hd=YYYYMMDD` | 着順、配当、決まり手、進入 |
| 節間成績 | `/race/setsuki?jcd=XX&hd=YYYYMMDD` | 節情報 |
