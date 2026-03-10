# 展開予測 v3 設計書 — 仕様・実装・データフロー

> **ステータス**: 実装済み（2026-03-09時点）

## 概要

1マーク展開予測は以下の3つのサブシステムで構成される。

| サブシステム | コンポーネント | 役割 |
|-------------|--------------|------|
| 超展開データ | `AttackDefenseTable` | 各選手の過去の攻守実績を表形式で表示 |
| 展開予測アルゴリズム | `turnPrediction.js` | 攻守データ + モーター + STから展開確率を算出 |
| アニメーション | `FirstMarkAnimation` | SVGアニメーションで展開を視覚化 |

表示箇所: トップページ（`/`）とレース詳細ページ（`/races/:date`）の両方

---

## 1. 超展開データテーブル（AttackDefenseTable）

### 1.1 テーブル構成（7行 × 7列）

| | 1コース(守備) | 2コース(攻撃) | 3コース(攻撃) | 4コース(攻撃) | 5コース(攻撃) | 6コース(攻撃) |
|---|---|---|---|---|---|---|
| 選手 | 名前 | 名前 | 名前 | 名前 | 名前 | 名前 |
| 1着/出走 | wins/total | wins/total | ... | ... | ... | ... |
| 逃げ | 逃げ回数/出走 | - | - | - | - | - |
| 差され/差し | 被差し回数/出走 | 差し回数/出走 | ... | ... | ... | ... |
| まくられ/まくり | 被まくり回数/出走 | まくり回数/出走 | ... | ... | ... | ... |
| 捲差され/まくり差し | 被捲差し回数/出走 | まくり差し回数/出走 | ... | ... | ... | ... |
| その他 | (抜き+恵まれ)/出走 | (抜き+恵まれ)/出走 | ... | ... | ... | ... |

### 1.2 回数算出ロジック

```
■ 1コース（守備）
  逃げ:     attackDistribution["1"]["nige"] × wins / total
  差され等:  defenseDistribution["1"][technique] × losses / total
  ※ losses = total - wins（負けた回数が分母）

■ 2-6コース（攻撃）
  差し等:    attackDistribution[c][technique] × wins / total

■ その他:    nuki + megumare の合算
```

**重要**: `defenseDistribution` は「負けたレースにおける決まり手の割合」なので、乗じる分母は `total` ではなく `losses`。

### 1.3 デフォルト分布ガード

全コース合計勝利数が5回未満の選手は `COURSE_DEFAULT_DISTRIBUTION`（14,155レースの統計平均）にフォールバックされる。この分布から算出した回数は不正確なため、攻撃系セルを `-` で非表示にする。

```javascript
const isDefaultDist = getTotalWins(stats) < 5;
// true → 逃げ行 + 2-6コース全行が "-" 表示
// 1コースの防御行（差され/まくられ/捲差され）は常に表示
```

### 1.4 凡例

テーブル下に以下を表示:
- 色分けの説明（赤=防御、青=攻撃、緑=逃げ）
- 実データから生成した例文（最大2件、選手名なし）

例文の形式:
- `1コースの「差され 2/7」→ 1コースで7回出走し、うち2回は他の選手に「差し」で1着を取られた`
- `3コースの「まくり 1/5」→ 3コースで5回出走し、うち1回は「まくり」で1着を取った`

### 1.5 デザイン

- `players-table` クラスを再利用（AI予想順位テーブルと統一）
- 1コースヘッダー: 薄グレー背景 + 濃い文字（白背景+白文字の視認性問題を修正済み）
- 常時表示（トグルなし）
- デスクトップ: フル表示
- モバイル (480px以下): 横スクロールテーブル + ラベル列 sticky 固定

### 1.6 実装ファイル

- `src/components/race/AttackDefenseTable.jsx` (347行)
- `src/components/race/AttackDefenseTable.css` (119行)

---

## 2. 展開予測アルゴリズム

### 2.0 予測の全体像

```
┌─────────────────────────────────────────────────────────────────┐
│                    展開予測の流れ（概要図）                        │
└─────────────────────────────────────────────────────────────────┘

  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  過去の実績    │   │  当日の情報    │   │  統計ベース    │
  │              │   │              │   │              │
  │ 攻撃分布      │   │ 展示ST       │   │ デフォルト分布  │
  │ 防御分布      │   │ 平均ST       │   │ 配置確率      │
  │ コース別勝率   │   │ モーター2連率  │   │              │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         │                  │                  │
         └──────────┬───────┴──────────┬───────┘
                    ▼                  ▼
         ┌──────────────────────────────────┐
         │       1着予測（決まり手別）         │
         │                                  │
         │  各決まり手 × 各コースの確率を算出    │
         │  → 正規化して上位3パターンを選出      │
         └────────────────┬─────────────────┘
                          ▼
         ┌──────────────────────────────────┐
         │       2着・3着予測                 │
         │                                  │
         │  PLACEMENT_DISTRIBUTION ベース     │
         │  × ST・モーター・スキル補正          │
         │  ※ 1着コースを除外して2着選出        │
         │  ※ 1着+2着コースを除外して3着選出    │
         └────────────────┬─────────────────┘
                          ▼
         ┌──────────────────────────────────┐
         │       出力: 最大3パターン           │
         │                                  │
         │  展開1: 逃げ 1コース (55%)          │
         │    2着: 2コース  3着: 3コース       │
         │  展開2: 差し 2コース (20%)          │
         │    2着: 1コース  3着: 3コース       │
         │  展開3: まくり 4コース (12%)         │
         │    2着: 5コース  3着: 1コース       │
         └─────────────────────────────────┘
```

### 1着確率の算出イメージ（「逃げ」の場合）

```
1コース選手の逃げ確率を例にすると:

  ベース逃げ率（個人 or デフォルト）
  ┌────────────────────────────────┐
  │  0.80（過去の逃げ成功率）         │
  └───────────────┬────────────────┘
                  ▼
  ST補正 ──────── × 1.05 ← 展示STが2,3コースより速い → 有利
                  ▼
  モーター補正 ─── × 1.02 ← モーター2連率が高い → 微増
                  ▼
  まくり圧力 ──── × 0.95 ← 3コースにまくり得意な選手 → 減算
                  ▼
  ┌────────────────────────────────┐
  │  結果: 0.80 × 1.05 × 1.02 × 0.95 = 0.814   │
  │  → clamp(0.1, 0.9) = 0.814                  │
  └────────────────────────────────────────────┘

同様に他の決まり手（差し/まくり/まくり差し/抜き/恵まれ）×
各コースの確率を算出し、全て合計して1.0に正規化
```

### 2着・3着の算出イメージ

```
例: 展開1「逃げ 1コース」の場合

  PLACEMENT_DISTRIBUTION["nige_1"] から2着のベース確率を取得
  ┌──────────────────────────────────┐
  │  2着ベース: { 2: 0.33, 3: 0.29, 4: 0.18, 5: 0.12, 6: 0.08 }  │
  │  ※ 1コース(1着)は除外済み                                      │
  └───────────────┬──────────────────┘
                  ▼
  各コースに補正を適用:
    2コース: 0.33 × ST補正(1.1) × モーター補正(1.0) = 0.363
    3コース: 0.29 × ST補正(0.9) × モーター補正(1.05) = 0.274
    ...
                  ▼
  正規化して最大確率のコースを2着に選出: → 2コース
                  ▼
  3着は 1コース(1着) + 2コース(2着) を除外して同様に算出: → 3コース
```

### 4着〜6着の算出（アニメーション用）

```
4着〜6着は確率ベースの予測をしていない。
1着・2着・3着のコースを除外した残り3コースを、
boatStrengths（総合強さスコア）の降順に 4着 → 5着 → 6着 として割り当てる。

boatStrengths の算出:
  avgStAdv = 他5艇に対する平均ST優位性（sigmoid正規化、0.5=互角）
  motorScore = motorZ × 0.1 + 0.5（0-1にスケーリング）
  strength = avgStAdv × 0.6 + motorScore × 0.4

例: 1着=1コース, 2着=3コース, 3着=5コース の場合
  残りコース: [2, 4, 6]
  boatStrengths: [-, 0.52, -, 0.48, -, 0.55]
  → 強さ順ソート: [6(0.55), 2(0.52), 4(0.48)]
  → 4着: 6コース, 5着: 2コース, 6着: 4コース

※ boatStrengths が未設定の旧データはコース番号順にフォールバック
※ アニメーションのゴール位置決定にのみ使用（UIには4着以降を表示しない）
```

### 2.1 入力データ

6名の選手それぞれについて:

```javascript
{
  boatNumber: 1-6,
  course: 1-6,              // 進入コース
  exhibitionST: float|null, // 展示ST
  avgST: float|null,        // 平均ST（racer_aggregated_stats）
  stStddev: float|null,     // ST標準偏差
  attackDistribution: {},    // コース別攻撃決まり手分布
  defenseDistribution: {},   // コース別防御決まり手分布
  courseRaceCounts: {},      // コース別 { wins, total }
  exhibitionTime: float|null,// 展示タイム
  motor2Rate: float|null    // モーター2連率
}
```

### 2.2 算出ステップ

1. **ST予測**: exhibitionST (55%) + avgST (35%) + デフォルト0.15 (10%) の加重平均
2. **ST優位性マトリクス**: `sigmoid((ST[j] - ST[i]) / 0.03)` で全ペアの速度比較
3. **1コース逃げ確率**: ベース逃げ率 × ST補正 × モーター補正 → clamp(0.1, 0.9)
4. **2-6コース攻撃確率**: `sqrt(attackRate × defenseRate) × courseWinRate` × ST補正 × モーター補正
5. **正規化**: 全確率の合計を1.0にし、上位3パターンを選出
6. **2着・3着確率**: `PLACEMENT_DISTRIBUTION` をベースに ST・モーター・スキルで補正

### 2.3 出力構造

```javascript
{
  patterns: [
    {
      technique: "nige",       // 決まり手
      winnerCourse: 1,         // 勝利コース
      probability: 0.55,       // 確率
      secondPlace: { 2: 0.33, 3: 0.29, ... },  // 2着コース確率分布
      thirdPlace:  { 2: 0.22, 3: 0.24, ... }   // 3着コース確率分布
    },
    // 最大3パターン
  ],
  technique: "nige",           // 最有力決まり手
  probability: 0.55,           // 最有力確率
  winnerCourse: 1,             // 最有力勝利コース
  distribution: {              // 決まり手別の集約確率
    nige: 0.55, sashi: 0.15, makuri: 0.13, ...
  },
  boatStrengths: [0.55, 0.52, 0.50, 0.48, 0.46, 0.44]  // 各コースの総合強さスコア（0-1）
}
```

### 2.4 2着・3着の重複排除

```javascript
const secondResult = getTopCourse(pattern.secondPlace, [winnerCourse]);
const thirdResult  = getTopCourse(pattern.thirdPlace,  [winnerCourse, secondCourse]);
```

`getTopCourse()` は `excludeCourses` で既選出コースを除外し、残りから最大確率のコースを選出。

### 2.5 デフォルト分布

| 定数 | ソース | 用途 |
|------|--------|------|
| `COURSE_DEFAULT_DISTRIBUTION` | 14,155レースの統計 | 攻撃分布フォールバック（5勝未満） |
| `COURSE_DEFAULT_DEFENSE` | 同上 | 防御分布フォールバック（5敗未満） |
| `PLACEMENT_DISTRIBUTION` | 同上 | 2着・3着のベース確率分布 |

### 2.6 ベイジアンシュリンケージ

個人データが少ない場合（< 50レース/コース）、個人分布とデフォルト分布をブレンド:
```
blended = personal × weight + default × (1 - weight)
weight = min(1, races / 50)
```

### 2.7 実装ファイル

- `scripts/lib/turnPrediction.js` — 予測アルゴリズム本体
- `scripts/lib/winningTechniques.js` — デフォルト分布・決まり手マッピング
- `scripts/lib/placementDistribution.js` — 2着・3着確率ベースデータ

---

## 3. アニメーション（FirstMarkAnimation）

### 3.1 Props

```javascript
<FirstMarkAnimation
  patterns={prediction.turnPrediction.patterns}
  technique={prediction.turnPrediction.technique}
  probability={prediction.turnPrediction.probability}
  winnerCourse={prediction.turnPrediction.winnerCourse}
  distribution={prediction.turnPrediction.distribution}
  boatStrengths={prediction.turnPrediction.boatStrengths}
  players={prediction.allPlayers?.map(p => ({ number: p.number, name: p.name }))}
/>
```

`App.jsx` と `RaceDetail.jsx` で同一の props を渡す。レガシー props（`technique`/`winnerCourse`/`probability` 単体）にも後方互換あり。

### 3.2 SVGアニメーション

- **キャンバス**: 400×280 SVG viewBox
- **パス生成**: 7点キーフレーム → `interpolatePath()` で13点に補間 → L字カーブ
- **所要時間**: 3.5秒

```
  SVG座標系 (400×280)

  y=0  ┌────────────────────────────────────────┐
       │                                        │
       │          ●1着(180,95)                   │
       │        ●2着(155,110)        6コース ◇ y=95
       │      ●3着(135,122)          5コース ◇ y=120
       │    ●4着(115,135)            4コース ◇ y=145
       │  ●5着(100,145)              3コース ◇ y=170    x=340
       │  ●6着(90,155)               2コース ◇ y=195   (スタート)
       │                             1コース ◇ y=220
       │         ◎ ターンマーク                  │
       │        (120,160)                       │
       │                                        │
  y=280└────────────────────────────────────────┘
       x=0                                    x=400

  ◇ = スタート位置（右端）
  ◎ = 1マークターンマーク
  ● = ゴール位置（順位順、1着が最も右上）

  ボートの動き:
    右(スタート) → 左下(マーク接近) → マーク下を通過
    → 反時計回りに旋回 → 左上(離脱) → 順位に応じたゴール位置
```

### 3.3 アニメーションにおける順位決定

```
  1着: turnPrediction の winnerCourse（確率ベース予測）
  2着: secondPlace から最大確率コースを選出（1着コースを除外）
  3着: thirdPlace から最大確率コースを選出（1着+2着コースを除外）
  4着〜6着: 残りコースをboatStrengths降順に割り当て（旧データはコース番号順）

  例: 逃げ 1コース の場合
  ┌──────────────────────────────────────────┐
  │ 1着: 1コース ← winnerCourse              │
  │ 2着: 2コース ← max(secondPlace, 除外[1]) │
  │ 3着: 3コース ← max(thirdPlace, 除外[1,2])│
  │ 4着: ?コース ← 残り3艇をboatStrengths降順  │
  │ 5着: ?コース ← でソートして割り当て        │
  │ 6着: ?コース ← (旧データはコース番号順)     │
  └──────────────────────────────────────────┘

  ※ UIに表示するのは1着・2着・3着のみ
  ※ 4着〜6着はアニメーションのゴール位置にのみ使用
```

### 3.4 決まり手ごとの動き

| 決まり手 | 勝者の動き | 1コースの動き |
|---------|-----------|-------------|
| 逃げ | 最内をタイトに旋回、先頭離脱 | （勝者） |
| 差し | 内側に飛び込む | 膨らんで後方へ |
| まくり | 外から高速で被せて旋回 | 内側で押し込まれる |
| まくり差し | まくりターゲットの内側を差す | 標準旋回 |
| 抜き | 広いアプローチから直線で追い抜き | 標準旋回 |
| 恵まれ | 先行艇トラブルで浮上 | 特殊パス |

```
■ 逃げ（1コースが勝つ）

                ●1着(1コース)
               /
  ◎マーク ← ①タイトに旋回
            ↑
  ②③④⑤⑥ → 外側を順に旋回

■ 差し（2コースが勝つ）

               ●1着(2コース)
              / ← ②が内側を突く
  ◎マーク ← ①が膨らむ → 後方へ
            ↑
  ③④⑤⑥ → 通常旋回

■ まくり（3-4コースが勝つ）

               ●1着(外コース)
              / ← 外から高速で被せる
  ◎マーク ← ①②が内側で押し込まれる → 後方
            ↑
  残りの艇 → 通常旋回

■ まくり差し（4-5コースが勝つ）

               ●1着(差すコース)
              / ← まくり艇の内側を差す
  ◎マーク ← まくり艇が外に膨らむ
            ↑
  ①と残り → 通常旋回
```

### 3.4 UI構成

1. **パターンタブ** — 展開1/展開2/展開3（タブ切り替え、選択時にアニメーションリセット）
2. **SVGアニメーション** — 6艇 + ターンマーク + 航跡 + グローエフェクト
3. **フェーズラベル** — 「スタート」(0-0.2s) → 「1マーク旋回」(1.05-1.75s) → 「{決まり手}!」(1.9-3.0s)
4. **順位バッジ** — アニメーション完了後にSVG内に表示（金/銀/銅ボーダー）
5. **順位カード** — SVG下に3列表示（1着/2着/3着のコース・確率）
6. **確率分布バー** — 全決まり手を確率降順で表示
7. **リプレイボタン**

### 3.5 技術的特記事項

**framer-motion の読み込み**: `useMotion()` カスタムフックで1回だけ動的 import。ロード完了まで静止画表示。v1の `lazy()` + `<Suspense>` 方式はボートがバラバラに出現する問題があった。

**players ソート**: 入力の `players` 配列は AI スコア降順。アニメーション内で boat number 昇順にソートし直してインデックスとコースを一致させる。

**ボート形状**: 楕円 + 三角（舟形）。キーフレーム間の角度差から `rotate` を計算して進行方向に向ける。

### 3.6 実装ファイル

- `src/components/race/FirstMarkAnimation.jsx` (1,025行)
- `src/components/race/FirstMarkAnimation.css`

---

## 4. データパイプライン

### 4.1 全体フロー

```
[1] racer_aggregated_stats テーブル（選手統計）
    ├── attack_distribution    コース別攻撃決まり手分布
    ├── defense_distribution   コース別防御決まり手分布
    ├── course_race_counts     コース別 { wins, total }
    ├── avg_st / st_stddev     ST統計
    └── course_entry_tendency  コース進入傾向
            ↓
[2] generate-predictions.js（日次バッチ）
    ├── racerStatsMap を Supabase から一括取得
    ├── predictFirstMark() で展開予測算出
    ├── 3モデル（standard/safeBet/upsetFocus）のスコア算出
    └── predictions テーブルに feature_contributions として格納
            ↓
[3] Supabase predictions テーブル
    └── feature_contributions (JSONB)
        ├── turnPrediction  { patterns, technique, probability, ... }
        └── racerStats      [{ boatNumber, course, attackDist, defenseDist, ... }]
            ↓
[4] supabaseDataService.js（フロントエンド取得）
    ├── standardPred.feature_contributions.turnPrediction → FirstMarkAnimation
    └── standardPred.feature_contributions.racerStats → AttackDefenseTable
```

### 4.2 統計集計（aggregate-racer-stats.js）

選手ごとに以下を算出して `racer_aggregated_stats` テーブルに保存:

1. **ST統計**: 平均ST、直近30レース平均ST、標準偏差、F率
2. **攻撃分布**: コース別の1着時決まり手割合（5勝未満 → デフォルト分布フォールバック）
3. **防御分布**: コース別の非1着時の被攻撃決まり手割合
4. **コース出走数**: コース別の勝利数・出走数
5. **コース進入傾向**: 枠番→コースの分布

### 4.3 予測生成（generate-predictions.js）

- 全選手の `racer_aggregated_stats` を一括フェッチ（900件/バッチ）
- レースごとに `predictFirstMark()` を呼び出し
- `feature_contributions` に `turnPrediction` と `racerStats` の両方を格納
- **修正済み**: `turnPrediction` が null でも `racerStats` があれば `feature_contributions` を保存
- **修正済み**: 3モデルすべてに `feature_contributions` を格納（以前は standard のみ）

### 4.4 フロントエンド取得（supabaseDataService.js）

- `getPredictions(date)` で当日の全レースを取得
- `createPlayers()` は AI スコア降順ソート（表示用）
- `turnPrediction` がパターン形式でない場合、`technique`/`probability`/`winnerCourse` から変換
- `racerStats` を `prediction.racerStats` として返す

### 4.5 テーブル関係図

```
racer_aggregated_stats (選手統計、venue_code=0 でグローバル)
        ↓ generate-predictions.js が参照
races
  ├── race_entries        (各レースの選手情報)
  ├── predictions         (3モデル × feature_contributions)
  │     └── feature_contributions (JSONB)
  │           ├── turnPrediction
  │           └── racerStats
  ├── race_conditions     (天候・グレード等)
  ├── exhibition_data     (展示タイム・展示ST)
  ├── race_start_timings  (実ST・F/L判定)
  └── race_results        (レース結果)
```

---

## 5. DBスキーマ

### racer_aggregated_stats

```sql
CREATE TABLE racer_aggregated_stats (
  racer_id TEXT PRIMARY KEY,
  venue_code INT DEFAULT 0,
  avg_st NUMERIC(4,3),
  avg_st_last_30 NUMERIC(4,3),
  st_stddev NUMERIC(4,3),
  flying_rate NUMERIC(5,4),
  late_start_rate NUMERIC(5,4),
  st_sample_count INT,
  total_races INT,
  attack_distribution JSONB,
  defense_distribution JSONB,
  course_race_counts JSONB,
  course_entry_tendency JSONB,
  aggregated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### predictions テーブル（feature_contributions 部分）

```jsonc
{
  "turnPrediction": {
    "technique": "nige",
    "probability": 0.55,
    "winnerCourse": 1,
    "distribution": { "nige": 0.55, "sashi": 0.15, ... },
    "patterns": [
      {
        "technique": "nige",
        "winnerCourse": 1,
        "probability": 0.55,
        "secondPlace": { "2": 0.33, "3": 0.29, ... },
        "thirdPlace": { "2": 0.22, "3": 0.24, ... }
      }
    ],
    "boatStrengths": [0.55, 0.52, 0.50, 0.48, 0.46, 0.44]
  },
  "racerStats": [
    {
      "boatNumber": 1,
      "course": 1,
      "attackDistribution": { "1": { "nige": 0.8, "sashi": 0.05, ... }, ... },
      "defenseDistribution": { "1": { "sashi": 0.3, "makuri": 0.25, ... }, ... },
      "courseRaceCounts": { "1": { "wins": 28, "total": 50 }, ... }
    }
  ]
}
```

---

## 6. ファイル一覧

### バックエンド

| ファイル | 役割 |
|---------|------|
| `scripts/lib/turnPrediction.js` | 展開予測アルゴリズム本体（v2） |
| `scripts/lib/winningTechniques.js` | デフォルト分布・決まり手マッピング |
| `scripts/lib/placementDistribution.js` | 2着・3着確率ベースデータ |
| `scripts/analysis/aggregate-racer-stats.js` | 選手統計集計バッチ |
| `scripts/daily/generate-predictions.js` | 日次予測生成バッチ |

### フロントエンド

| ファイル | 役割 |
|---------|------|
| `src/components/race/AttackDefenseTable.jsx` | 超展開データテーブル |
| `src/components/race/AttackDefenseTable.css` | テーブルスタイル |
| `src/components/race/FirstMarkAnimation.jsx` | SVGアニメーション |
| `src/components/race/FirstMarkAnimation.css` | アニメーションスタイル |
| `src/components/race/index.js` | barrel export |
| `src/utils/turnPrediction.js` | フロントエンド用ユーティリティ |
| `src/services/supabaseDataService.js` | データ取得・パース |
| `src/pages/RaceDetail.jsx` | レース詳細ページ（統合箇所） |
| `src/App.jsx` | トップページ（統合箇所） |

---

## 7. 既知の課題

### データ精度

| 課題 | 影響 | 対策状況 |
|------|------|---------|
| `racer_aggregated_stats` 未登録の選手 | テーブルに `-` 表示 | 未対応（バックフィル要） |
| 出走数が少ない選手のデータ信頼性 | 統計的に不安定 | ベイジアンシュリンケージ適用済み |
| 5勝未満でデフォルト分布にフォールバック | 攻撃回数が不正確 | `isDefaultDist` ガードで `-` 表示 |
| 5敗未満で `defenseDistribution` が null | 防御セルが `-` | 許容範囲 |

### 対象外

- 「抵抗」「絞り」は公式ボートレースデータに存在しない（競合サイト独自の派生指標）

### レビューで発見された潜在的問題

| 問題 | 重要度 | 対応 |
|------|--------|------|
| FirstMarkAnimation の入力バリデーション不足 | 低 | `patterns` が空/undefined で null 返却（安全） |
| players に重複 boat number がある場合 | 低 | 実運用では発生しない |
| 1コース全勝（losses=0）で防御行が `0/total` | 低 | 正しい挙動（防御機会なし=0回） |
| SVG の ARIA ラベルなし | 低 | アクセシビリティ改善として検討 |

---

## 8. top3統一（v3.1）

### 概要

全AIモデル（standard/safeBet/upsetFocus）のtop3予想を展開予測（turnPrediction）の結果に統一。
展開予測がサイトの目玉機能であり、予想の一貫性を確保する。

### ヘルパー関数: `getTop3FromTurnPrediction()`

`turnPrediction.patterns[0]` から1着・2着・3着を抽出:
- 1着: `winnerCourse`
- 2着: `secondPlace` の最大確率コース（1着除外）
- 3着: `thirdPlace` の最大確率コース（1着・2着除外）

### フォールバック

- `turnPrediction` がnull、またはpatterns が空の場合 → 従来のAIスコアベースtop3を使用
- confidence値は各モデル独自のまま維持

### 詳細テーブル拡充

詳細データ分析テーブルに以下の列を追加:

| 列名 | データソース | 表示形式 |
|------|------------|---------|
| 総合力 | `turnPrediction.boatStrengths[boatIndex]` | パーセンテージ（例: 55%） |
| コース勝率 | `racerStats[i].courseRaceCounts[course].wins/total` | 勝数/出走数（例: 3/5） |

データがない場合は「-」を表示。
