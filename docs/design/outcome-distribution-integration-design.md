# 出目分布と予測パイプライン統合設計

`outcome_distribution`（過去90日の会場別3連単出目集計）を実際の予測パイプラインにどう統合するかを設計する。Task #6 の調査・設計成果物。

---

## 1. 現在の予測生成フロー

### 1.1 パイプライン全体

```
scripts/daily/generate-predictions.js  (1380行)
 ├─ 1) 入力: data/races.json (当日のレース構成)
 ├─ 2) 選手統計 fetchRacerStats() / 会場勝率 fetchVenueWinRates()
 ├─ 3) 1マーク展開予測 predictFirstMark()      ── scripts/lib/turnPrediction.js
 │     → patterns: [{winnerCourse, technique, probability, secondPlace, thirdPlace}, ...]
 │
 ├─ 4) 荒れ度スコア calculateVolatilityScore()  ── イン崩れ6因子
 │     → volatilityLevel = low/medium/high
 │     → recommendedModel = safe-bet/standard/upset-focus
 │
 ├─ 5) 3モデルのスコアリング processRacersWithScoreFn()
 │     ├─ calculateStandardScoreV2()   ── 全国勝率×150 + 級別 + 枠番補正 + ボーナス
 │     ├─ calculateSafeBetScore()       ── 1号艇+150, A1+120, 枠番ペナルティ-15/枠
 │     └─ calculateUpsetFocusScore()    ── 外枠+100, モーター×180, 1号艇-100
 │     共通ボーナス:
 │       + calculateTurnBonus()        ── turnPrediction.patterns × モデル別重み
 │       + calculateExhibitionBonus()  ── 展示タイム・ST × モデル別重み
 │
 ├─ 6) 展開予測パターン → topPick 上書き
 │     patterns[0] → safeBet, patterns[1] → standard, patterns[2] → upsetFocus
 │
 ├─ 7) 出力 data/predictions/YYYY-MM-DD.json
 │
 └─ 8) Supabase デュアルライト writeToSupabase()
       ├─ races         (volatility_*, first_boat_*)
       ├─ race_entries  (ai_score_standard / safe_bet / upset_focus)
       ├─ predictions   (model_id × top_pick × scores)
       ├─ race_conditions
       ├─ race_grade
       └─ exhibition_data
```

### 1.2 重要な観察

- スコアは **AIスコア（整数値）** で順位付け。各モデルが独自の重み構成を持つ。
- `turnPrediction.patterns[i]` がモデルごとに **topPick の決定権を持つ**（スコア順位より優先される）。出目分布もこの patterns に作用する位置にあれば自然。
- `predictions.scores` カラム（JSONB）にスコア詳細が保存される設計だが、現状は AIスコアのみで出目分布シグナルは未統合。
- 出目分布は現時点では UI 表示専用（`OutcomePatternPreview.jsx` / `OutcomeDistribution.jsx`）。

---

## 2. 統合ポイントの3レイヤ

予測パイプラインで出目分布を活用しうる接合点：

| レイヤ | 介入点 | 効果 | 副作用リスク |
|-------|-------|------|------------|
| L0：スコアリング前 | `calculateXxxScore` 内 | AIスコアに出目バイアスを混入 | 既存スコアの解釈性低下 |
| L1：展開予測補正 | `predictFirstMark` 直後 | patterns の確率を出目分布で重み付け | turn と outcome の二重カウント |
| L2：買い目フィルタ | `bet_recommendations` 生成時 | 推奨買い目を「分布上位N」に制限 | 高EVの低確率買い目を捨てる |
| L3：UI 補助表示 | フロント `OutcomePatternPreview` | 参考情報のみ | 効果は限定的（現状） |

---

## 3. 統合案 A / B / C

### 案A — 早期統合（スコアリングに混入）

```
入力 → 展開予測 → 各モデルスコアリング ─┐
                                         ├─ TopN決定 → predictions 保存
                  outcome_distribution ──┘ (boat1 ごとに2着/3着確率を加算)
```

#### 実装

`calculateTurnBonus()` の隣に `calculateOutcomeBonus()` を新設し、各モデルのスコア関数に組み込む。

```js
// scripts/daily/generate-predictions.js (新規)
function calculateOutcomeBonus(outcomeDist, boatLane, modelType) {
  if (!outcomeDist) return 0;
  let bonus = 0;
  // 自艇が1着のときの2着・3着出現率を期待値として加算
  const firstAsThis = outcomeDist[boatLane] || [];
  for (const p of firstAsThis.slice(0, 10)) {
    // 1着シグナル: その艇が1着となるパターンの合計確率
    const w1 = { standard: 200, safeBet: 250, upsetFocus: 80 }[modelType];
    bonus += (p.probability / 100) * w1;
  }
  // 2着・3着で頻出する艇かも別途加算
  let secondProb = 0, thirdProb = 0;
  for (const first of Object.keys(outcomeDist)) {
    for (const p of outcomeDist[first] || []) {
      if (p.second_boat === boatLane) secondProb += p.probability;
      if (p.third_boat  === boatLane) thirdProb  += p.probability;
    }
  }
  const w2 = { standard: 80, safeBet: 100, upsetFocus: 60 }[modelType];
  const w3 = { standard: 50, safeBet: 60,  upsetFocus: 70 }[modelType];
  bonus += (secondProb / 100) * w2 + (thirdProb / 100) * w3;
  return Math.round(bonus);
}
```

呼び出し側：`processRacersWithScoreFn` に `outcomeDist` を引き渡す。

#### メリット

- 各モデルの最終ランキングに自然に反映される。`predictions.top_pick` が変化するため、既存の UI/分析パイプラインは無改修で恩恵を受ける。
- AIスコア値そのものが「過去頻度を吸収した強さ」になり、解釈もしやすい。

#### デメリット

- **circular reasoning（循環推論）**：outcome_distribution は過去のレース結果（=過去の rank1 を含む全フィールド）から作られているため、AIスコアの上に重ねると「強い艇が強い」の二重カウントになる。boat1 の全国勝率も outcome_distribution も「1号艇が強い会場では 1-X-Y が多い」を表しており、相関が高い。
- turnBonus と機能が被る（turnPrediction も "1着確率" を出している）。
- 出目分布の改修時に各モデルのスコア重みも見直す必要があり、運用負荷が大きい。

#### API変更

なし（内部スコアリングのみ）。ただし `predictions.scores` JSONB に `outcome_bonus` 内訳を入れることを推奨。

#### コスト

- 実装：1日（スコア関数3つ＋呼び出し改修）
- 検証：2-3週間（A/Bテスト：shadow predictions で is_shadow=TRUE 系を新スコアで生成）
- 重み調整：データドリブンに重みグリッドサーチが必要 → +1週間

---

### 案B — 後期統合（買い目フィルタ）

```
入力 → 展開予測 → 各モデルスコアリング → TopN決定 → predictions 保存
                                                    │
                                                    ▼
                                outcome_distribution ─┐
                                                      ├─ bet_recommendations 生成
                                EV計算（payout × 出目確率）│
```

#### 実装

`bet_recommendations` テーブル（既存）に書き込むワーカー or RPC を新設し、以下のロジックを通す：

```js
// scripts/daily/generate-bet-recommendations.js (新規)
//
// 各 prediction について：
// 1. topPick (=予想1着艇) を取得
// 2. outcome_distribution から (venue, first=topPick) の上位Nパターンを取得
// 3. 各パターンの「3連単 EV」を計算：probability × avg_payout / 100
// 4. EV ≥ 1.0 のパターンを recommended_bets[] として保存
//    （該当パターンがなければ recommendation = 'skip'）
// 5. 上位N点流しの合算EVも算出 → expected_value, expected_payout に保存
```

`bet_recommendations.recommendation` のラベル：

- `strong_bet`: 合算EV ≥ 1.20 かつ 最低1点はEV≥1.5
- `bet`:        合算EV ≥ 1.00
- `neutral`:    合算EV 0.80-1.00
- `skip`:       合算EV < 0.80（推奨しない）

#### メリット

- **予測ロジックを汚さない**。AIスコアは"純粋な選手力"、出目分布は"市場/会場の経験則"として責務分離できる。
- **EVベース**で意思決定するため、回収率の改善が直接の目的関数になる。Task #5 の検証で Top3 流し回収率 120.55% という結果が出ており、フィルタ案は数値的に裏付けがある。
- `bet_recommendations` テーブルは既に schema 001 に存在し、テーブル設計をフル活用できる。
- UI でも「このレースは買い」「見送り」が明示できる（既に existing `BettingValueSection.jsx` があり接続が容易）。

#### デメリット

- 出目分布が偏った場合（少サンプル会場）の影響を受けやすい。会場×1着艇のセルでサンプル50件以下のところでは avg_payout が暴れる。
- topPick が外れた場合の評価が含まれない。topPick 外れ込みの期待値計算には「topPick の的中率」も必要で、Task #5 から model 別の topPick 単勝的中率（standard 17.2% / safeBet 56.9% / upsetFocus 17.5%）を組み合わせる必要がある。

#### API変更

- 既存 `/api/outcome-distribution` をそのまま使用可。
- 新規 RPC `get_bet_recommendation(race_id)` または既存 `bet_recommendations` テーブルへの SELECT で十分。
- フロントは `BettingValueSection.jsx` を拡張して "EVベース推奨" を表示。

#### コスト

- 実装：3日（新規バッチ + bet_recommendations 書込み + UI）
- 検証：2週間（過去90日のバックテストを `verify-outcome-distribution-coverage.js` の延長で実装可能）
- リスク低：失敗しても "現在の予測は完全に維持された上でフィルタを外せばよい"

---

### 案C — UI補助表示（非統合・現状の延長）

```
入力 → 展開予測 → 各モデルスコアリング → TopN決定 → predictions 保存
                                                    │
                                                    ▼
                            outcome_distribution → フロント表示のみ
                                                    (OutcomePatternPreview)
```

#### 実装

既に動作している。改善ポイントのみ：

- 1着候補の `confidence` と出目分布の `probability` を並べて表示。
- topPick が分布Top3 に含まれていれば「過去90日の人気手」とラベル。
- 含まれなければ「過去90日では珍しい手」と警告。

#### メリット

- 0コスト（既に実装済み）。
- ユーザーに「分布上位パターン」を意思決定材料として渡すだけで、責任を分離。

#### デメリット

- 効果は限定的（投票判断はユーザー任せ）。
- 「データは見せているが活用していない」という UX 上のロス。

---

## 4. 統合時の課題と対策

### 4.1 モデル別出目分布の必要性

Task #2 の調査結果：

- standard: topPick が 1号艇=47, 2号艇=828, 3号艇=86, 4号艇=35, 5号艇=4（直近1000件サンプル）
- safeBet:  topPick が 1号艇=1000（100%）
- upsetFocus: topPick が 1号艇=81, 2号艇=392, 3号艇=371, 4号艇=136, 5号艇=20

→ **safeBet は実質「1号艇1着レースの分布」と等価**なので、モデル別集計の意味は薄い。standard と upsetFocus はメリットあり。

**対策**：以下の優先順位で進める。

1. Phase 1: 全体（model_id='all'）出目分布のみ。 ← 既に動作中。
2. Phase 2: standard / upsetFocus の "topPick 別フィルタ" を母集団とした分布。
3. Phase 3: モデル別 outcome_distribution テーブル（or 既存テーブル＋model_id カラム）。

### 4.2 データ鮮度

`outcome_distribution` は日次バッチ更新（`scripts/daily/update-outcome-distribution.js`）、`predictions` は当日生成。日次の鮮度差は許容範囲（90日窓のうち1日分のズレ）。

**対策**：

- 予測生成の早朝（5時頃）に `update-outcome-distribution.js` を必ず先行実行する CI 順序を保証（既に `.github/workflows/update-outcome-distribution.yml` が存在）。
- 案A 採用時は `predictions` 生成時に最新の `outcome_distribution.last_updated` を読み込んで `predictions.scores.outcome_distribution_date` に記録する（再現可能性のため）。

### 4.3 因果の逆転リスク

`outcome_distribution` は「過去レースの rank1/2/3 全結果から作られた事後分布」。これを「予測時点で未来を推定する事前情報」として使うのは妥当だが、以下のリスクに注意：

1. **Survivorship bias 類似のもの**：今いる選手のメンバー構成が90日前と違うため、過去の出目分布が将来の出目分布を予測するとは限らない。会場の物理特性（風・コース幅・水質）は90日でほぼ変わらないので、出目分布のうち "会場効果" は再現するが "選手分布効果" は揺らぎがある。
2. **集計分布の解釈**：probability は「結果としてその順位が出た頻度」。AIが予測する「事前確率」とは別物。混ぜると意味が崩れる。
3. **回収率の現在保証性**：Task #5 の Top3 回収率 120.55% は直近5日の数字。半年では揺れる。

**対策**：

- 案B採用時に、`outcome_distribution` を「条件付き確率」ではなく「会場別の事前分布として、AI予測の topPick で条件付け」するのが筋。すなわち `P(rank2=x, rank3=y | rank1=topPick, venue)` を使う。これは現テーブル構造で `first_boat=topPick` でフィルタすれば自然に得られる。
- 重み調整は **walk-forward A/B**：直近30日で重み決定 → 翌30日で検証 → スライドして再評価。

---

## 5. 推奨実装パターン

### 結論：**案B（後期統合 / 買い目フィルタ）を Phase 1 として推奨**

#### 理由

| 評価軸 | 案A | 案B | 案C |
|-------|----|----|----|
| 実装コスト | 高 | 中 | 低（済） |
| 効果の見える化 | 中（スコアに混入） | 高（EVが直接） | 低 |
| 既存機能への影響 | 大（topPick が変動） | なし | なし |
| 回収率改善の直接性 | 間接的 | 直接的 | 効果なし |
| 検証容易性 | A/B必須 | バックテスト可 | n/a |
| 因果リスク | 高（二重カウント） | 低（責務分離） | 最低 |
| 失敗時のロールバック | スコア重み修正必要 | フィルタ外すだけ | n/a |

案A はゲインが大きいが副作用も大きく、`generate-predictions.js` という最重要パスを触るため事故時の影響が深刻。案B は **既存の `bet_recommendations` テーブルを活用しつつ予測ロジックを汚さない**ため、検証コスト・心理的負荷ともに最小。

### 5.1 段階的実装

**Phase 1（2026年5-6月 / 1-2週間）：案B のシンプル実装**

```
[新規] scripts/daily/generate-bet-recommendations.js
   ↓ predictions × outcome_distribution × race_results.payout_trifecta
   ↓ EV = Σ (probability × avg_payout) / (100 × bet_count)
   ↓ recommendation ラベル付与
[書込] bet_recommendations テーブル

[改修] src/components/race/BettingValueSection.jsx
   ↓ EV と推奨買い目 (top3 patterns) を表示
   ↓ "見送り推奨" バッジ

[検証] scripts/analysis/backtest-bet-recommendations.js
   ↓ 過去90日について同ロジックを適用して回収率を出力
```

**Phase 2（2026年6-7月 / 1週間）：会場別 / 荒れ度別の重みチューニング**

- 案B の EV閾値を venue × volatility_level でグリッドサーチ。
- 既存の `scripts/analysis/` の手法（`analyze-venue.js`）と統合し、`data/analysis/venue-XX/outcome-rules.json` に格納。

**Phase 3（2026年7-8月 / 1-2週間）：モデル別 outcome_distribution の検討**

- standard / upsetFocus の topPick 別の条件付き分布で精度向上するか検証。
- 効果が +5% 以上の回収率改善があれば `outcome_distribution` に `model_id` カラム追加（Task #2 の選択肢A）。

**Phase 4（任意）：案A 早期統合の限定導入**

- Phase 1-3 で案B の重みが安定したら、`predictions.scores.outcome_bonus` として AI スコアに弱く（重み 10-20% 程度）混入。
- ただし Phase 1 の効果が +10% 回収率以上であれば案A は実施不要。

### 5.2 検証・測定方法

各 Phase の合格基準：

| Phase | KPI | 合格基準 |
|------|-----|---------|
| Phase 1 | 推奨買い目（strong_bet + bet）の回収率 | ≥ 110% on 直近90日バックテスト |
| Phase 1 | 推奨カバー率（全レース中の推奨割合） | 10-40%（少なすぎず多すぎず） |
| Phase 2 | venue × volatility_level の細粒度回収率 | 全セルで ≥ 95%、推奨上位3割で ≥ 130% |
| Phase 3 | モデル別 outcome_distribution の回収率 | 全体版より +5pt 以上 |
| Phase 4 | 案A 適用後の単勝/3連単的中率 | 既存比 -3% 以内 かつ 回収率 +5%以上 |

測定スクリプトの骨子は `scripts/analysis/verify-outcome-distribution-coverage.js`（Task #5 で作成済み）を流用・拡張する。

### 5.3 リスク管理

- **shadow mode**：Phase 1 の `bet_recommendations` 書込みは最初 `is_shadow=TRUE` 相当のフラグで運用し、UI 露出前に2週間バックグラウンド計算する。
- **撤退条件**：Phase 1 デプロイ後30日で推奨買い目の実回収率 < 95% なら全停止。
- **観測**：`scripts/daily/calculate-accuracy.js` を拡張し、`bet_recommendations` ごとの的中率・回収率を `model_performance_daily` 相当のテーブルに記録。

---

## 6. アーキテクチャ図（推奨パターン: 案B Phase 1）

```
┌──────────────────────────────────────────────────────────────┐
│                  日次バッチ (scripts/daily/)                  │
│                                                                │
│  ┌──────────────────────────┐                                  │
│  │ update-outcome-          │                                  │
│  │ distribution.js          │ ──→ outcome_distribution         │
│  │ (過去90日集計)            │       (venue × first × 2nd × 3rd)│
│  └──────────────────────────┘                                  │
│                                                                │
│  ┌──────────────────────────┐                                  │
│  │ generate-predictions.js  │ ──→ predictions                  │
│  │ (3モデルスコア + 展開予測) │       (model_id × top_pick)     │
│  └──────────────────────────┘                                  │
│                  │                                              │
│                  ▼                                              │
│  ┌──────────────────────────┐                                  │
│  │ ★ generate-bet-          │                                  │
│  │   recommendations.js     │ ──→ bet_recommendations          │
│  │ (新規)                   │       (recommendation, EV,       │
│  │                          │        recommended_bets[])       │
│  └──────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    フロントエンド (React)                      │
│                                                                │
│  RaceDetail.jsx                                                │
│    ├─ PredictionPanel       (現状: AIスコア)                    │
│    ├─ BettingValueSection   (★ 改修: EV/推奨ラベル/見送り)      │
│    └─ OutcomePatternPreview (現状: 補助表示)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. まとめ

- 現在の出目分布は UI 表示のみ。スコアリング・買い目推奨には未統合。
- **案B（後期統合・買い目フィルタ）** が実装コスト・効果・リスクのバランス最良。
- **既存 `bet_recommendations` テーブルを使う**ため、スキーマ変更は最小。
- 段階的に Phase 1 → 4 で進め、各フェーズで合格基準を満たさなければ次に進まない。
- モデル別 outcome_distribution は **Phase 3 で評価**、効果ありなら導入。

