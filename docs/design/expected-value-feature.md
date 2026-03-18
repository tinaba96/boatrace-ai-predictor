# 配当妙味（期待値）機能の検討

> **ステータス**: 設計レビュー完了・修正反映済み

## 背景・目的

ユーザーが「期待値プラスの買い目」を見つけやすくする機能。現在の予測モデルは勝率・級別・枠番・モーター2連率のみでスコアリングしており、**スタートタイミング（ST）** と **1マークの攻め方（決まり手傾向）** を考慮していない。

これらは市場（オッズ）が過小評価しやすい要素であり、配当妙味の発見に直結する。選手×モーターのST相性や、コース別の攻め方実績を加味することで、市場が見落とす「本当に勝てる選手」を検出し、期待値（predicted probability × odds > 1.0）の高い買い目を提示する。

---

## 初回調査結果（2026-02）

### 現在のAI予測精度

| 指標 | 数値 | ベースライン |
|------|------|-------------|
| 単勝的中率 | 約44% | 17%（ランダム） |
| 複勝的中率 | 約64% | — |
| 回収率 | 100%未満（全体） | — |

- 一部のルールベース条件では回収率100%超を達成しているが、サンプルサイズが小さい（12〜30レース程度）
- 統計的に有意かどうかの判断が困難

### 現在のモデルで使用していないデータ

| データ | 状況 |
|-------|------|
| 展示ST | beforeinfo ページにあるが天候のみ取得中 |
| 実際のレースST | raceresult ページにあるが未取得 |
| 選手×モーターST相性 | 未集計 |
| 決まり手（winning_technique） | 36%のレースで取得済み、予測には未使用 |
| 進入コース（course_1-6） | 92%のレースで取得済み、予測には未使用 |
| オッズ | `race_odds` テーブル定義済み・空 |
| 展示データ | `exhibition_data` テーブル定義済み・空 |

---

## 実装計画

### Phase 1: データ収集基盤

#### 1A: 展示ST取得

`scripts/scrape-to-json.js` の `getBeforeinfo()` を拡張。beforeinfo ページから展示タイム・展示STも取得する。

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/scrape-to-json.js` | `scrapeExhibitionData($)` 関数追加。返り値に `exhibitionData` 追加 |
| `scripts/daily/generate-predictions.js` | `writeToSupabase()` で `exhibition_data` テーブルにupsert |

> **レビュー指摘**: HTMLセレクタが未検証。`004_DATA_ACQUISITION.md` のセレクタ案（`td:nth-child(5)`, `td:nth-child(6)`）は `beforeinfo` 固有のDOM構造を前提としており、実装前に `node -e` で実ページのHTMLを取得・確認が必須。また、展示走行前の時間帯では展示データが null になるため、null 行を upsert しない制御が必要。

```javascript
// null データはupsertしない
const exhibitionDataToWrite = exhibitionDataList.filter(
  e => e.exhibition_time !== null || e.start_timing !== null
);
```

#### 1B: 実際のレースST取得

`scripts/daily/scrape-results.js` を拡張。raceresult ページから各艇のSTを取得。

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/daily/scrape-results.js` | `scrapeStartTimings($)` 関数追加 |

新テーブル:
```sql
CREATE TABLE race_start_timings (
  race_id VARCHAR(20) REFERENCES races(race_id) ON DELETE CASCADE,
  boat_number SMALLINT,
  start_timing DECIMAL(4,3),          -- 精度を0.001秒単位に（レビュー指摘）
  is_flying BOOLEAN DEFAULT FALSE,
  is_late_start BOOLEAN DEFAULT FALSE, -- 出遅れも記録（レビュー指摘）
  PRIMARY KEY (race_id, boat_number)
);
```

> **レビュー指摘**: F（フライング）は負の値、L（出遅れ）は大きな正の値になるため、`is_late_start` フィールドを追加。`DECIMAL(4,2)` → `DECIMAL(4,3)` に精度向上。

#### 1C: オッズ取得

段階的アプローチを採用（レビュー指摘反映）。

**Step 1（先行実装）**: `scrape-results.js` でレース結果取得時に、配当データから暗黙オッズを算出して `race_odds` に保存。実装コストが低く、過去データでのバックテストにも使える。

**Step 2（後日追加）**: 締切3分前の事前オッズ取得用の専用ワークフロー `odds.yml` を追加（20分間隔）。

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/daily/scrape-results.js` | Step 1: 結果配当から暗黙オッズ算出・保存 |
| `scripts/daily/scrape-odds.js` | Step 2: 新規。事前オッズ取得 |
| `.github/workflows/odds.yml` | Step 2: 新規。20分間隔の専用ワークフロー |

> **レビュー指摘**: 1時間間隔のメインパイプラインではリアルタイムEV不可。オッズ取得を `scrape.yml` に追加するのではなく、専用ワークフローに分離する。

#### 1D: 過去データバックフィル

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/maintenance/backfill-exhibition-data.js` | 新規。既存 `backfill-race-data.js` パターン踏襲 |

> **レビュー指摘**: `beforeinfo` ページは当日のみ有効の可能性が高い。実装前に過去日付の `beforeinfo` が取得可能か確認し、不可なら `raceresult` のSTバックフィルのみに絞る。

1A/1B/1C は並行実装可能。

---

### Phase 2: 選手統計集計

#### 2A: 選手集計テーブル

```sql
CREATE TABLE racer_aggregated_stats (
  racer_id INTEGER NOT NULL,
  venue_code SMALLINT NOT NULL DEFAULT 0,  -- 0 = 全会場合算（レビュー指摘: NULLではなくDEFAULT 0）
  avg_st DECIMAL(4,3),
  avg_st_last_30 DECIMAL(4,3),
  st_stddev DECIMAL(4,3),
  flying_rate DECIMAL(5,4),
  motor_st_data JSONB,
  attack_distribution JSONB,
  course_entry_tendency JSONB,
  total_races INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (racer_id, venue_code)        -- レビュー指摘: COALESCEは使えない
);
```

> **レビュー指摘**: `PRIMARY KEY (racer_id, COALESCE(venue_code, 0))` は PostgreSQL で動かない。`venue_code NOT NULL DEFAULT 0` に変更し、`PRIMARY KEY (racer_id, venue_code)` とする。

**JSONB フィールドの形式を明確化（レビュー指摘）:**
```json
// motor_st_data: 回数を明記
{"by_motor": [{"motor_id": 42, "avg_st": 0.12, "races": 15}]}

// attack_distribution: 比率と勝利数を明記
{"1": {"nige_rate": 0.80, "sashi_rate": 0.10, "total_wins": 50}}

// course_entry_tendency: 比率
{"lane_1": {"course_1": 0.95, "course_2": 0.05}}
```

#### 2B: 集計スクリプト

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/analysis/aggregate-racer-stats.js` | 新規。選手別ST統計・攻め方分布・進入傾向を集計 |
| `scripts/lib/winningTechniques.js` | 新規。決まり手の正規化・コース別期待決まり手マッピング |

**集計対象:**
- `calculateRacerSTStats(racerId)` — `race_start_timings` + `race_entries` → 平均ST、モーター別ST
- `calculateAttackDistribution(racerId)` — `race_results` の `winning_technique` + `course_1-6` → コース別攻め方分布
- `calculateCourseEntryTendency(racerId)` — 枠番 → 実際進入コースの傾向

**決まり手マッピング:**
```
逃げ→nige, 差し→sashi, まくり→makuri, まくり差し→makurizashi, 抜き→nuki, 恵まれ→megurmare
```

**コース別期待決まり手:**
- 1コース: 逃げ
- 2コース: 差し, まくり
- 3-4コース: まくり, まくり差し, 差し
- 5-6コース: まくり, まくり差し

#### 2C: データカバレッジの前提条件

> **レビュー指摘**: `racer_id` 32%、`winning_technique` 36% のカバレッジでは統計不足の選手が多数。Phase 1D のバックフィルと既存 `backfill-race-data.js` による `racer_id` / `winning_technique` のカバレッジ向上を Phase 2 着手の前提条件とする。攻め方スコアの公開は `winning_technique` カバレッジ 70% 以上を目安とする。

---

### Phase 3: 予測スコア強化

#### 3A: STスコア関数

`generate-predictions.js` に追加。

```
calculateSTScore(racer, exhibitionData, racerStats, courseNumber)
```

| 要素 | スコアリング |
|------|------------|
| 展示ST（当日） | 0.10以下:+80, 0.15以下:+50, 0.20以下:+20, 超:-30 |
| 平均ST（実力） | 0.12以下:+100, 0.15以下:+60, 0.18以下:+30 |
| モーター×選手ST相性 | 改善+0.02以上:+50, 悪化-0.02以下:-30 |
| コース係数 | プラス部分のみに適用（下記参照） |

> **レビュー指摘（コース係数バグ）**: `score × 0.8` の乗算だとマイナス値が緩和されてしまう（-30 → -24）。以下のようにプラス部分にのみ適用する:
```javascript
const positiveScore = Math.max(0, rawScore);
const negativeScore = Math.min(0, rawScore);
score = positiveScore * courseCoeff + negativeScore;
```

> **レビュー指摘（上限値）**: 上限200では1コース係数×1.3が機能しない（230→299→上限200で打ち切り）。上限を **250〜300** に引き上げるか、コース係数を加算方式に変更する。

> **レビュー指摘（依存関係）**: `motorSTDiff` は Phase 1B 完了前は常に0。Phase 3AのmotorSTDiffは Phase 1B 完了後に有効化する段階的実装とする。

#### 3B: 攻め方スコア関数

```
calculateAttackScore(racer, racerStats, expectedCourse)
```

| 要素 | スコアリング |
|------|------------|
| 1コース逃げ率 | 率×200 |
| 3-6コースまくり率 | 率×150 |
| 差し率 | 率×120 |
| 複数決まり手ボーナス | 3種以上:+30 |
| データ不足時 | コース別デフォルト分布で代替（下記参照） |

> **レビュー指摘（フォールバック）**: 36%カバレッジでデータ不足選手が多数。0点フォールバックではなく、**コース別のデフォルト攻め方分布**（全選手の平均値）を `data/venue-params/` に保持し、データ不足時に使用する:
```javascript
function calculateAttackScore(racerStats, expectedCourse) {
  if (racerStats && racerStats.total_wins >= 5) {
    return calculatePersonalAttackScore(racerStats, expectedCourse);
  }
  return getCourseDefaultAttackScore(expectedCourse);  // 0ではなく中立値
}
```

#### 3C: 既存3モデルへの統合

既存スコア関数を維持し、ラッパー関数でボーナス加算。

```javascript
function calculateEnhancedStandardScoreV2(racer, index, exhibitionData, racerStats) {
  let score = calculateStandardScoreV2(racer, index);  // 既存ロジック維持
  score += Math.min(calculateSTScore(...), 250);        // ST上限250点（レビュー指摘: 200→250）
  score += Math.min(calculateAttackScore(...), 150);    // 攻め方上限150点
  return score;
}
```

> **レビュー指摘（confidence張り付き問題）**: 現在の `calculateConfidence` はスコア差の絶対値ベースのため95%に張り付く。スコア比率ベースに変更を推奨:
```javascript
function calculateConfidence(players) {
  const ratio = players[1].aiScore / players[0].aiScore;
  return Math.min(95, Math.max(70, Math.round(95 - (ratio * 25))));
}
```

> **レビュー指摘（DBスキーマ）**: `race_entries` テーブルに `ai_score_value_hunter INTEGER` カラムの追加マイグレーションが必要。

#### 3D: 新モデル「valueHunter（配当妙味）」

市場が正しく織り込む要素を控えめに、市場が見落としやすい要素を重視。

| 要素 | valueHunter | standard（参考） | 設計意図 |
|------|------------|-----------------|---------|
| 枠番ボーナス（1号艇） | **+0** | +500 | 市場が正しく評価済み。EV観点ではボーナス不要（レビュー指摘で200→0に修正） |
| 枠番（2号艇） | +30 | +100 | やや過小評価 |
| 枠番（4-6号艇） | +60 | -50〜-150 | 外枠は市場が過小評価しがち |
| STスコア | ×2倍 | ×1倍 | 市場が見落としやすい |
| 攻め方スコア | ×1.5倍 | ×1倍 | 市場が見落としやすい |
| モーター2連率 | ×40 | ×20 | やや過小評価される |
| 全国勝率 | ×80 | ×150 | 市場が正しく評価 |
| 級別A1 | +150 | +400 | 市場が正しく評価 |

`models` テーブルに shadow モードで登録し、検証後に公開。

> **レビュー指摘**: Phase 1C（オッズ取得）完了前に valueHunter を公開することは無意味。Phase 3D の着手条件に Phase 1C 完了を追加する。
>
> **レビュー指摘**: `calculate-accuracy.js` の `models` 配列にも `valueHunter` を追加する必要がある。回収率計算が単勝100円仮定のため、valueHunter 用の複合指標評価も検討が必要。

---

### Phase 4: 期待値算出

#### 4A: 確率変換ユーティリティ

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/lib/probabilityConverter.js` | 新規。確率変換、EV算出、Kelly基準 |

> **レビュー指摘（Softmax問題）**: 現在のスコア範囲（1000-3000点）にそのまま Softmax を適用すると1号艇が99.9%になる。以下の対策が必要:
> - **温度パラメータ付きSoftmax**: `softmax(score / T)` で T=100〜500 の範囲をグリッドサーチし、Brier Score を最小化する T を採用
> - **代替案**: Platt Scaling（ロジスティック回帰でキャリブレーション）の方がシンプルで安全。既存の的中データがあれば実装可能
> - 3モデル（standard / safeBet / upsetFocus）はスケールが全く異なるため、モデル間で確率を比較・合成できない。valueHunter モデルでのみ確率変換を行う設計に限定することを推奨

#### 4B: 配当妙味算出

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/daily/calculate-value-bets.js` | 新規。valueHunter予測×オッズ→EV算出→ `bet_recommendations` テーブルに書き込み |

判定基準:
- EV > 20%: `strong_bet`
- EV > 5%: `bet`
- EV > -10%: `neutral`
- その他: `skip`

> **レビュー指摘（bet_recommendations テーブル修正が必要）**: 主キー `(race_id, model_id)` では賭け種別ごとの推奨ができない。Phase 4 着手前に以下のマイグレーションが必要:
```sql
ALTER TABLE bet_recommendations ADD COLUMN bet_type VARCHAR(20) NOT NULL DEFAULT 'win';
ALTER TABLE bet_recommendations DROP CONSTRAINT bet_recommendations_pkey;
ALTER TABLE bet_recommendations ADD PRIMARY KEY (race_id, model_id, bet_type);
```
> また、`actual_hit` 更新トリガーが `is_hit_win` にハードコードされているため、`bet_type` に応じた条件分岐に修正が必要。

> **レビュー指摘（EV算出のキャリブレーション）**: 現在の `analyze-expected-value-strategy.js` のEV計算は事後的中率ベースであり、モデル確率による真のEV検証ではない。`validate-ev-calibration.js` では、予測確率を10%バケットに分け、実的中率との差分（キャリブレーションエラー）を測定する必要がある。

#### 4C: パイプライン統合

メインパイプライン（`scrape.yml`）と分離した設計（レビュー指摘反映）:

```
[scrape.yml - 毎時]
scrape-to-json.js（+展示データ）
  → generate-predictions.js（+ST/攻め方スコア、4モデル）
    → scrape-results.js（+実際ST、暗黙オッズ算出）
      → calculate-accuracy.js

[odds.yml - 20分間隔（Step 2で追加）]
scrape-odds.js（事前オッズ取得）
  → calculate-value-bets.js（配当妙味算出）
```

> **レビュー指摘**: 現在のGitHub Actions消費は約114分/日（無料枠2000分/月の57%）。オッズ取得を20分間隔で追加すると+57回/日で消費が倍増する可能性。時間帯別のワークフロー分割を検討する。

#### 4D: フロントエンド表示

| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/services/valueService.js` | 新規。`getTodaysValueBets()` |
| `src/components/TodaysPicks.jsx` | 「配当妙味 注目レース」セクション追加 |

#### 4E: キャリブレーション検証

| 対象ファイル | 変更内容 |
|-------------|---------|
| `scripts/analysis/validate-ev-calibration.js` | 新規。予測確率vs実的中率の検証、回収率比較 |

---

## 依存関係（レビュー指摘反映版）

```
Phase 1A（展示ST）──┐
Phase 1B（実際ST）──┼── Phase 2（集計）── Phase 3A-C（既存モデル強化）
Phase 1D（バックフィル）─┘
                          │
Phase 1C（オッズ）────────┼── Phase 3D（valueHunter）── Phase 4（期待値算出）
                          │
データカバレッジ70%以上 ──┘── Phase 3B（攻め方スコア公開条件）
```

**着手条件の明確化（レビュー指摘）:**
- Phase 2: Phase 1A + 1B 完了 + racer_id バックフィル完了
- Phase 3A: Phase 2 完了（motorSTDiff は Phase 1B 完了後に有効化）
- Phase 3B 公開: winning_technique カバレッジ 70% 以上
- Phase 3D: Phase 1C 完了（オッズなしでは期待値計算不能）
- Phase 4: Phase 3D + Phase 1C + bet_recommendations スキーマ修正

## ファイル一覧

### 新規作成

| ファイル | Phase |
|---------|-------|
| `scripts/daily/scrape-odds.js` | 1C Step 2 |
| `.github/workflows/odds.yml` | 1C Step 2 |
| `scripts/maintenance/backfill-exhibition-data.js` | 1D |
| `scripts/analysis/aggregate-racer-stats.js` | 2B |
| `scripts/lib/winningTechniques.js` | 2B |
| `scripts/lib/probabilityConverter.js` | 4A |
| `scripts/daily/calculate-value-bets.js` | 4B |
| `src/services/valueService.js` | 4D |
| `scripts/analysis/validate-ev-calibration.js` | 4E |

### 修正

| ファイル | Phase | 変更内容 |
|---------|-------|---------|
| `scripts/scrape-to-json.js` | 1A | 展示データ抽出追加 |
| `scripts/daily/scrape-results.js` | 1B,1C | 実際ST抽出追加、暗黙オッズ算出 |
| `scripts/daily/generate-predictions.js` | 1A,3 | exhibition_data書き込み、ST/攻め方スコア、valueHunterモデル |
| `scripts/daily/calculate-accuracy.js` | 3D | valueHunterモデルの精度計算追加 |
| `src/components/TodaysPicks.jsx` | 4D | 配当妙味セクション追加 |

### DBマイグレーション

| 変更 | Phase |
|------|-------|
| `CREATE TABLE race_start_timings` | 1B |
| `CREATE TABLE racer_aggregated_stats` | 2A |
| `ALTER TABLE race_entries ADD COLUMN ai_score_value_hunter` | 3D |
| `ALTER TABLE bet_recommendations ADD COLUMN bet_type, 主キー変更` | 4B |

## リスクと対策（レビュー指摘反映版）

| リスク | 対策 |
|-------|------|
| beforeinfo の展示データHTMLセレクタが不正確 | 実装前に `node -e` で実ページHTMLを取得・確認 |
| beforeinfo の過去データが取得不可 | 事前確認し、不可なら 1B（raceresult ST）のみバックフィル |
| racer_id カバレッジ32%で統計に偏り | バックフィル優先。高グレード偏りの構造を分析してからスコアリングに組み込む |
| winning_technique 36%でデータ不足 | 0フォールバックではなくコース別デフォルト分布で代替。公開は70%以上から |
| Softmax でスコア→確率変換が歪む | Platt Scaling を検討。温度パラメータをBrier Scoreでチューニング |
| 3モデルのスケール不整合 | 確率変換は valueHunter モデルのみに限定 |
| オッズ取得タイミング | Step 1: 結果配当から暗黙オッズ → Step 2: 専用ワークフロー20分間隔 |
| confidence が95%に張り付き | スコア比率ベースの計算に変更 |
| bet_recommendations 主キー不足 | `bet_type` 列追加、トリガー修正 |
| GitHub Actions 消費増加 | オッズ専用ワークフロー分離、時間帯別実行制御 |
| valueHunter の枠番ボーナスが支配的 | 1号艇ボーナスを+0に。外枠+60で市場の過小評価を捕捉 |

---

## スコアシミュレーション結果（レビュー時実施）

### テスト条件

| 艇 | 級別 | 勝率 | モーター2連率 | 展示ST | 平均ST | 攻め方 |
|-----|------|------|-------------|--------|--------|--------|
| 1号艇 | A1 | 7.5 | 45% | 0.08 | 0.11 | 1コース逃げ90% |
| 3号艇 | B1 | 5.8 | 52% | 0.05 | 0.09 | 3コースまくり60% |
| 6号艇 | A2 | 6.2 | 38% | 0.18 | 0.16 | 6コースまくり25% |

### スコア比較

| 艇 | standard現行 | enhanced | valueHunter |
|-----|-------------|----------|-------------|
| 1号艇 | 2925 | 3275 | 3175 (枠番+0に修正後) |
| 3号艇 | 2010 | 2324 | 3165 |
| 6号艇 | 1790 | 1843 | 2184 (枠番+60に修正後) |

enhanced では順位変動なし。valueHunter（修正版）では **3号艇が1号艇を僅差で逆転** — これがEV観点での期待動作（展示ST 0.05 + まくり60%の3号艇が、市場で過小評価されている場合に配当妙味がある）。
