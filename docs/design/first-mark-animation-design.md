# 1マーク展開予測アニメーション - 設計・実装ドキュメント

> **ステータス**: 実装済み（Phase 1-4 完了、v2 アニメーション改善 + v3 拡張適用済み）
> 展開予測システム全体の仕様は `turn-prediction-v3-design.md` を参照

## 概要

AIが予測した1マークの展開（決まり手）を、SVGアニメーションで視覚化する機能。ユーザーが直感的にレース展開を理解し、納得感を持って舟券を購入できることを目的とする。

---

## アーキテクチャ

```
[スクレイピング] → [DB蓄積] → [統計集計] → [展開予測] → [予測保存] → [フロントエンド表示]

Phase 1          Phase 1     Phase 2      Phase 3      Phase 3      Phase 4
scrape-to-json   Supabase    aggregate-   turnPredic-  generate-    FirstMark
scrape-results              racer-stats   tion.js      predictions  Animation
```

---

## Phase 1: データ収集基盤

### Phase 1A: 展示データ取得

**ファイル**: `scripts/scrape-to-json.js` - `scrapeExhibitionData()` 関数

beforeinfo ページから展示タイムと展示STを取得。

```
HTML構造: .table1 (2番目) → 6つの tbody → 各4行
- 展示タイム: tbody[n]/tr[0]/td[4]
- 展示ST:    tbody[n]/tr[2]/td[2]
```

**注意**: beforeinfo ページは raceresult ページとHTML構造が全く異なる。`.table1_boatImage1` セレクタは beforeinfo では使えない。

### Phase 1B: レースSTスクレイピング

**ファイル**: `scripts/daily/scrape-results.js` - `scrapeStartTimings()` 関数

raceresult ページから実際のスタートタイミングを取得。

```
HTML構造: .table1_boatImage1 → 各ボートの行
- ST値: .table1_boatImage1Time のテキスト
- F/L判定: テキスト先頭の F/L プレフィックス
```

取得データは `race_start_timings` テーブルに upsert。

### Phase 1C: バックフィルスクリプト

| スクリプト | 用途 |
|-----------|------|
| `scripts/maintenance/backfill-start-timings.js` | 過去レースのST + 決まり手を補完 |
| `scripts/maintenance/backfill-racer-ids.js` | race_entries の racer_id 欠損を補完 |

**CLI**: `--from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--verbose]`

---

## Phase 2: 選手統計集計

### Phase 2A: 決まり手マッピング

**ファイル**: `scripts/lib/winningTechniques.js`

- `TECHNIQUES`: 日本語→英語マッピング（逃げ→nige 等）
- `TECHNIQUE_NAMES`: 英語→日本語マッピング
- `COURSE_DEFAULT_DISTRIBUTION`: 14,155レースから算出したコース別決まり手確率分布
- `COURSE_DEFAULT_DEFENSE`: コース別の防御（被攻撃）確率分布

### Phase 2C: 選手統計集計スクリプト

**ファイル**: `scripts/analysis/aggregate-racer-stats.js`

**CLI**: `--racer=NNNN | --all [--venue=NN] [--dry-run]`

算出する統計:
1. **ST統計**: 平均ST、直近30レース平均ST、標準偏差、F率、L率
2. **攻撃分布**: コース別の1着時決まり手比率（5勝未満はデフォルト分布にフォールバック）
3. **防御分布**: コース別の非1着時の被攻撃決まり手比率
4. **コース出走数**: コース別の勝利数・出走数
5. **コース進入傾向**: 各コースへの進入率

ベイジアンシュリンケージにより、個人データが少ない場合はデフォルト分布とブレンド。

結果は `racer_aggregated_stats` テーブルに保存。

---

## Phase 3: 展開予測ロジック

### Phase 3A: 予測関数

**ファイル**: `scripts/lib/turnPrediction.js`

詳細は `turn-prediction-v3-design.md` のセクション2を参照。

### Phase 3B: 予測生成への組み込み

**ファイル**: `scripts/daily/generate-predictions.js`

- `generateRacePrediction()` 内で `predictFirstMark()` を呼び出し
- 結果を `feature_contributions.turnPrediction` + `feature_contributions.racerStats` として保存
- 3モデル（standard/safeBet/upsetFocus）すべてに `feature_contributions` を格納

### Phase 3C: フロントエンドデータ取得

**ファイル**: `src/services/supabaseDataService.js`

- `standardPred?.feature_contributions?.turnPrediction` から展開予測データを抽出
- `standardPred?.feature_contributions?.racerStats` から選手統計データを抽出
- `createPlayers()` は AI スコア降順ソート（注意: アニメーションでは boat number 昇順に再ソート必要）

---

## Phase 4: SVGアニメーション

### コンポーネント構成

**ファイル**: `src/components/race/FirstMarkAnimation.jsx` (1,025行)

| コンポーネント/関数 | 役割 |
|-------------------|------|
| `FirstMarkAnimation` | メインラッパー（props変換 + 条件レンダリング） |
| `FirstMarkAnimationInner` | コアロジック + アニメーション状態管理 |
| `BoatIcon` | framer-motion でアニメーションするボート |
| `StaticBoatIcon` | ロード中の静止ボート |
| `ResultBadge` | SVG内の順位バッジ |
| `ResultCards` | SVG下の順位カード |
| `DistributionBars` | 確率分布バーチャート |
| `useMotion()` | framer-motion 動的インポートフック |
| `interpolatePath()` | 7点→13点パス補間 |
| `getAnimationPaths()` | 決まり手別6艇パス生成 |
| `getTopCourse()` | 重複除外付き最大確率コース選出 |

### 6パターンのアニメーション

| 決まり手 | 勝者コース | アニメーション概要 |
|---------|-----------|-----------------|
| 逃げ（nige） | 1 | 1号艇がターンマーク内側を先行旋回 |
| 差し（sashi） | 2 | 1号艇が膨らむ → 2号艇が内側を突く |
| まくり（makuri） | 3-4 | 外の艇がスタート先行 → 外から叩いて旋回 |
| まくり差し（makurizashi） | 4-5 | まくりに行く艇の内側を差す |
| 抜き（nuki） | any | 1マーク後の直線で追い抜き |
| 恵まれ（megumare） | any | 先行艇がトラブル → 後続が浮上 |

各パターンで6艇すべてのキーフレームパスを定義（7点 → 補間で13点）。

### SVG座標系

- **キャンバス**: 400×280 viewBox
- **スタート位置**: x=340（右端）, y=220→95（6コース、下から上）
- **ターンマーク**: x=120, y=160（左中央）
- **離脱位置**: `getExitPosition(rankOrder)` で順位に応じた位置（1着=右上先頭、6着=左下末尾）

### アニメーションフェーズ（3.5秒）

| 時間 | フェーズ | 表示 |
|------|---------|------|
| 0-0.2s | スタート | 「スタート」ラベル |
| 1.05-1.75s | 旋回 | 「1マーク旋回」ラベル |
| 1.9-3.0s | 決まり手 | 「{決まり手}!」黄色ラベル |
| 3.5s~ | 完了 | 順位バッジ + 順位カード表示 |

---

## v2: アニメーション改善

ユーザーフィードバック「カクカクする」「わかりにくい」を受けて実施した改善。

| 問題 | 原因 | 対策 |
|------|------|------|
| アニメーションがカクカク | `lazy()` + 個別 `<Suspense>` で6つのボートがバラバラにマウント | `useEffect` で1回だけ動的 import → state 保持 |
| リプレイがラグる | `key={animKey}` でSVG全体を破棄・再構築 | SVG構造は保持し `<motion.g>` にのみ key を付与 |
| ターンが角張る | 5点の離散座標を直線補間 | `interpolatePath()` で13点に補間、ターン付近を密に配置 |
| 進行方向がわからない | ボートが単なる丸 | 楕円+三角の舟形に変更、キーフレーム間の角度で `rotate` を計算 |
| 何が起きているかわからない | 説明テキストなし | フェーズラベル表示 |
| 軌跡が見えない | 航跡なし | `motion.path` で航跡表示。勝利艇は太線強調 |
| どのコースの決まり手かわからない | 分布に確率のみ | バックエンドに `courseByTechnique` を追加 |

## v3: 拡張改善

| 問題 | 対策 |
|------|------|
| ターン後に直進しているように見える | 7点パスで明確なL字カーブを実装 |
| ゴール位置が予測順位と不一致 | `getExitPosition(rankOrder)` で順位に応じた離脱位置を割り当て |
| 2着・3着が同じコースになる | `getTopCourse()` に除外コースリストを追加 |
| ボートとコースの対応ずれ | players配列をboat number昇順ソートしてから使用 |
| 勝者ボートが目立たない | グローエフェクト + 太い航跡線 + 決まり手ポップアップ |
| 展開パターンを切り替えられない | パターンタブUI追加（展開1/2/3） |
| 超展開データの行不足 | 逃げ行・その他行を `TECHNIQUE_ROWS` に追加 |

---

## DBスキーマ

### race_start_timings

```sql
CREATE TABLE race_start_timings (
  race_id TEXT NOT NULL REFERENCES races(race_id),
  boat_number INT NOT NULL CHECK (boat_number BETWEEN 1 AND 6),
  start_timing NUMERIC(4,2),
  is_flying BOOLEAN DEFAULT FALSE,
  is_late_start BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (race_id, boat_number)
);
```

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

---

## ファイル一覧

| ファイル | Phase | 種別 |
|---------|-------|------|
| `scripts/scrape-to-json.js` | 1A | 修正 |
| `scripts/daily/scrape-results.js` | 1B | 修正 |
| `scripts/maintenance/backfill-start-timings.js` | 1C | 新規 |
| `scripts/maintenance/backfill-racer-ids.js` | 1C | 新規 |
| `scripts/lib/winningTechniques.js` | 2A | 新規 |
| `scripts/lib/placementDistribution.js` | 2 | 新規 |
| `scripts/analysis/aggregate-racer-stats.js` | 2C | 新規 |
| `scripts/lib/turnPrediction.js` | 3A | 新規 |
| `scripts/daily/generate-predictions.js` | 3B | 修正 |
| `src/services/supabaseDataService.js` | 3C | 修正 |
| `src/utils/turnPrediction.js` | 4 | 新規 |
| `src/components/race/FirstMarkAnimation.jsx` | 4 | 新規 |
| `src/components/race/FirstMarkAnimation.css` | 4 | 新規 |
| `src/components/race/AttackDefenseTable.jsx` | 4 | 新規 |
| `src/components/race/AttackDefenseTable.css` | 4 | 新規 |
| `src/components/race/index.js` | 4 | 修正 |
| `src/pages/RaceDetail.jsx` | 4 | 修正 |
| `src/App.jsx` | 4 | 修正 |

---

## 残タスク

- [ ] フロントエンド動作確認（モバイル実機テスト）
- [ ] 精度検証: 予測した決まり手と実際の決まり手の一致率を測定
