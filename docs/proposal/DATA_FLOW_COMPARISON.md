# スクレイピング・Supabase データフロー比較

## 概要

現在のデータフローにおける、DBスキーマ定義 vs 実際の書き込み処理の乖離を整理。

---

## 1. races テーブル

### スキーマ定義
| カラム | 型 | 説明 |
|--------|-----|------|
| race_id | VARCHAR(20) | PK |
| race_date | DATE | 必須 |
| venue_code | SMALLINT | 必須 |
| race_number | SMALLINT | 必須 |
| start_time | TIME | |
| volatility_score | SMALLINT | |
| volatility_level | VARCHAR(10) | |
| recommended_model | VARCHAR(50) | |
| volatility_reasons | JSONB | |
| first_boat_grade | VARCHAR(5) | |
| first_boat_win_rate | DECIMAL(5,3) | |
| first_boat_motor_2rate | DECIMAL(5,2) | |
| win_rate_stddev | DECIMAL(5,3) | |
| win_rate_avg | DECIMAL(5,3) | |
| motor_2rate_stddev | DECIMAL(5,2) | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 実際の書き込み (generate-predictions.js)
| カラム | 書き込み | 状況 |
|--------|---------|------|
| race_id | ✅ | |
| race_date | ✅ | |
| venue_code | ✅ | |
| race_number | ✅ | |
| start_time | ✅ | |
| volatility_score | ✅ | |
| volatility_level | ✅ | |
| recommended_model | ✅ | |
| volatility_reasons | ✅ | |
| first_boat_grade | ✅ | |
| first_boat_win_rate | ✅ | |
| first_boat_motor_2rate | ✅ | |
| win_rate_stddev | ✅ | |
| win_rate_avg | ✅ | |
| motor_2rate_stddev | ✅ | |
| updated_at | ✅ | |

**状況: ✅ 完全一致**

---

## 2. race_entries テーブル

### スキーマ定義
| カラム | 型 | 説明 |
|--------|-----|------|
| race_id | VARCHAR(20) | PK |
| boat_number | SMALLINT | PK |
| player_name | VARCHAR(50) | |
| grade | VARCHAR(5) | |
| age | SMALLINT | |
| win_rate | DECIMAL(5,3) | 全国勝率 |
| local_win_rate | DECIMAL(5,3) | 当地勝率 |
| motor_number | SMALLINT | |
| motor_2rate | DECIMAL(5,2) | |
| boat_number_id | SMALLINT | |
| boat_2rate | DECIMAL(5,2) | |
| ai_score_standard | INTEGER | |
| ai_score_safe_bet | INTEGER | |
| ai_score_upset_focus | INTEGER | |

### 実際の書き込み (generate-predictions.js)
| カラム | 書き込み | 状況 |
|--------|---------|------|
| race_id | ✅ | |
| boat_number | ✅ | |
| player_name | ✅ | |
| grade | ✅ | |
| age | ✅ | |
| win_rate | ✅ | 全国勝率 |
| local_win_rate | ✅ | |
| motor_number | ✅ | |
| motor_2rate | ✅ | |
| boat_number_id | ✅ | |
| boat_2rate | ✅ | |
| ai_score_standard | ✅ | |
| ai_score_safe_bet | ✅ | |
| ai_score_upset_focus | ✅ | |

### 未保存データ（JSONには存在）
| データ | JSON変数名 | DBカラム | 状況 |
|--------|-----------|----------|------|
| 全国2連率 | global2Rate | **未定義** | ❌ スキーマ追加が必要 |
| 当地2連率 | local2Rate | **未定義** | ❌ スキーマ追加が必要 |

**状況: ⚠️ 一部データがDBスキーマに未定義**

---

## 3. predictions テーブル

### スキーマ定義
| カラム | 型 | 説明 |
|--------|-----|------|
| prediction_id | SERIAL | PK |
| race_id | VARCHAR(20) | FK |
| model_id | VARCHAR(50) | FK |
| top_pick | SMALLINT | 必須 |
| top_2nd | SMALLINT | |
| top_3rd | SMALLINT | |
| confidence | SMALLINT | |
| scores | JSONB | |
| feature_contributions | JSONB | |
| is_hit_win | BOOLEAN | |
| is_hit_place | BOOLEAN | |
| is_hit_trifecta | BOOLEAN | |
| is_hit_trio | BOOLEAN | |
| payout_win | INTEGER | |
| payout_place | INTEGER | |
| payout_trifecta | INTEGER | |
| payout_trio | INTEGER | |
| is_shadow | BOOLEAN | |
| predicted_at | TIMESTAMPTZ | |

### 実際の書き込み
| カラム | generate-predictions.js | scrape-results.js |
|--------|------------------------|-------------------|
| race_id | ✅ | - |
| model_id | ✅ | - |
| top_pick | ✅ | - |
| top_2nd | ✅ | - |
| top_3rd | ✅ | - |
| confidence | ✅ | - |
| scores | ❌ 未使用 | - |
| feature_contributions | ❌ 未使用 | - |
| is_hit_win | - | ✅ |
| is_hit_place | - | ✅ |
| is_hit_trifecta | - | ✅ |
| is_hit_trio | - | ✅ |
| payout_win | - | ✅ |
| payout_place | - | ✅ |
| payout_trifecta | - | ✅ |
| payout_trio | - | ✅ |
| is_shadow | ✅ | - |

**状況: ⚠️ scores, feature_contributions は未使用**

---

## 4. race_results テーブル

### スキーマ定義
| カラム | 型 | 説明 |
|--------|-----|------|
| race_id | VARCHAR(20) | PK |
| rank1 | SMALLINT | 必須 |
| rank2 | SMALLINT | 必須 |
| rank3 | SMALLINT | 必須 |
| payout_win | INTEGER | |
| payout_place_1 | INTEGER | |
| payout_place_2 | INTEGER | |
| payout_trifecta | INTEGER | 3連複 |
| payout_trio | INTEGER | 3連単 |
| is_cancelled | BOOLEAN | |
| is_no_race | BOOLEAN | |
| course_1〜6 | SMALLINT | 進入コース |
| winning_technique | VARCHAR(20) | 決まり手 |
| result_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### 実際の書き込み (scrape-results.js)
| カラム | 書き込み | 状況 |
|--------|---------|------|
| race_id | ✅ | |
| rank1 | ✅ | |
| rank2 | ✅ | |
| rank3 | ✅ | |
| payout_win | ✅ | |
| payout_place_1 | ✅ | |
| payout_place_2 | ✅ | |
| payout_trifecta | ✅ | |
| payout_trio | ✅ | |
| is_cancelled | ❌ 未取得 | スクレイピング未実装 |
| is_no_race | ❌ 未取得 | スクレイピング未実装 |
| course_1〜6 | ❌ 未取得 | スクレイピング未実装 |
| winning_technique | ❌ 未取得 | スクレイピング未実装 |
| result_at | ✅ | |

**状況: ⚠️ 進入コース・決まり手・中止フラグが未取得**

---

## 5. race_conditions テーブル

### スキーマ定義
| カラム | 型 | 説明 |
|--------|-----|------|
| race_id | VARCHAR(20) | PK |
| weather | VARCHAR(10) | |
| wind_direction | VARCHAR(10) | |
| wind_speed | DECIMAL(4,1) | |
| wave_height | SMALLINT | |
| temperature | DECIMAL(4,1) | 気温 |
| water_temperature | DECIMAL(4,1) | 水温 |
| race_grade | VARCHAR(10) | SG/G1等 |
| race_title | VARCHAR(100) | |
| series_day | SMALLINT | 節何日目 |
| is_final_day | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### 実際の書き込み (generate-predictions.js)
| カラム | 書き込み | 状況 |
|--------|---------|------|
| race_id | ✅ | |
| weather | ✅ | |
| wind_direction | ✅ | |
| wind_speed | ✅ | |
| wave_height | ✅ | |
| temperature | ✅ | |
| water_temperature | ✅ | |
| race_grade | ❌ null | スクレイピング未実装 |
| race_title | ❌ null | スクレイピング未実装 |
| series_day | ❌ null | スクレイピング未実装 |
| is_final_day | ❌ null | スクレイピング未実装 |

**状況: ⚠️ 天候は保存、グレード・節情報は未取得**

---

## 6. 未使用テーブル（スキーマ定義済み、書き込み処理なし）

| テーブル | 用途 | 状況 |
|----------|------|------|
| race_odds | オッズ情報 | ❌ スクレイピング未実装 |
| exhibition_data | 展示タイム・ST | ❌ スクレイピング未実装 |
| bet_filters | 賭けフィルタ条件 | ❌ 未使用 |
| bet_recommendations | 賭け推奨 | ❌ 未使用 |
| daily_bet_summary | 日次集計 | ❌ 未使用 |
| user_visible_summary | 公開サマリー | ❌ 未使用 |
| model_performance_daily | モデル日次成績 | ❌ 未使用 |
| model_experiments | A/Bテスト | ❌ 未使用 |

---

## 7. JSONのみ保存（Supabase未保存）

scrape-to-json.js で取得してJSONに保存しているが、Supabaseには書き込んでいないデータ：

| データ | JSON変数名 | 理由 |
|--------|-----------|------|
| 全国2連率 | global2Rate | DBスキーマに未定義 |
| 当地2連率 | local2Rate | DBスキーマに未定義 |

---

## 優先度別 改善項目

### 高優先度（データ分析に必須）
1. **race_entries に global_2rate, local_2rate カラム追加** - 予測精度向上に有用
2. **race_conditions の race_grade 取得** - レースグレード別分析に必要

### 中優先度（分析精度向上）
3. **展示タイム・ST取得** (exhibition_data) - モーター性能の直接指標
4. **オッズ取得** (race_odds) - 期待値計算に必須
5. **決まり手取得** (race_results.winning_technique) - レース傾向分析

### 低優先度（将来対応）
6. **進入コース取得** - 枠なり崩れの分析
7. **レース中止フラグ** - データクリーニング
8. **predictions.scores, feature_contributions** - デバッグ用

---

## データフロー図

```
[ボートレース公式サイト]
        │
        ▼
┌─────────────────────┐
│  scrape-to-json.js  │ ── data/races.json
└─────────────────────┘
        │
        ▼
┌───────────────────────────┐
│  generate-predictions.js  │
└───────────────────────────┘
        │
        ├─▶ races テーブル (✅ 完全)
        ├─▶ race_entries テーブル (⚠️ 2連率未保存)
        ├─▶ predictions テーブル (⚠️ scores未使用)
        └─▶ race_conditions テーブル (⚠️ グレード未取得)

[レース終了後]
        │
        ▼
┌─────────────────────┐
│  scrape-results.js  │
└─────────────────────┘
        │
        ├─▶ race_results テーブル (⚠️ 決まり手等未取得)
        └─▶ predictions テーブル (的中フラグ更新)

[未実装]
        │
        ├─✗ race_odds テーブル
        ├─✗ exhibition_data テーブル
        └─✗ bet_* テーブル群
```
