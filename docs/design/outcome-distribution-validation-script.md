# 出目分布 価値測定検証スクリプト 実装設計

Linear: BOA-? (Task #4)
配置先: `scripts/analysis/validate-outcome-distribution.js`

## 1. 目的

`outcome_distribution` テーブル（過去90日の3連単出目集計）が、AI 予測に対してどの程度の付加価値を持つかを定量的に測定する。具体的には次の問いに答える。

1. **出目分布データは予測の的中率/回収率を向上させ得るか？**
2. **会場別・1着艇別・モデル別に、出目分布への適合率はどのように分布するか？**
3. **「出目分布上位 N パターン」を抽出して購入した場合の理論回収率はいくらか？**
4. **AI 予測（predictions.top_pick/2nd/3rd）と出目分布の合議で何が変わるか？**

---

## 2. 入力仕様

### 2.1 データソース

| ソース | 取得カラム | フィルタ |
|---|---|---|
| `race_results` | `race_id`, `rank1`, `rank2`, `rank3`, `payout_trifecta`, `payout_trio`, `payout_win`, `payout_place_1`, `payout_place_2` | `is_cancelled=false`, `is_no_race=false`, 3連単が全て非NULL |
| `outcome_distribution` | `venue_code`, `first_boat`, `second_boat`, `third_boat`, `count_90days`, `total_races`, `probability`, `avg_payout` | 全件（テーブル全体で 24会場 × 最大 120パターン程度） |
| `predictions` | `race_id`, `model_id`, `top_pick`, `top_2nd`, `top_3rd`, `is_hit_*`, `payout_*` | `is_shadow=false`, `is_hit_win is not null` |
| `races` | `race_id`, `venue_code`, `race_grade`, `volatility_level` | （オプション）グレード/荒れ度別評価で使用 |

### 2.2 CLI 引数

```bash
node scripts/analysis/validate-outcome-distribution.js [options]

  --period <N>            検証対象期間（日数, default: 30）
                          例: 30 → 過去30日間のレース結果に対し
                              当時 outcome_distribution に保存されていた分布で評価
                          ※ outcome_distribution は日次更新のため、現スナップショット
                            を「全期間の代理値」として使用する近似でも初期値としては妥当
  --venue <code>          特定会場のみ（例: 03）省略時は全24会場
  --model <id>            特定モデルのみ（standard|safeBet|upsetFocus）省略時は全モデル
  --top-n <N>             出目分布の上位 N パターンを採用候補とする（default: 5）
  --format <fmt>          出力形式: json | csv | html | all（default: json）
  --output-dir <path>     出力ディレクトリ（default: data/analysis/outcome-distribution-validation/）
  --include-trio          3連複の評価も含める（default: false / 3連単のみ）
  --min-samples <N>       会場×条件ごとの最低サンプル数（default: 30）
```

---

## 3. 出力仕様

### 3.1 ディレクトリ構成

```
data/analysis/outcome-distribution-validation/
├── summary.json                      # 全体サマリ
├── summary.csv                       # 集計表（Excel/Sheets 取込用）
├── report.html                       # 人間用 HTML レポート
├── by-venue/
│   ├── venue-01.json
│   ├── venue-02.json
│   └── ...
└── raw/
    ├── matched-races.jsonl           # レース単位の照合ログ（デバッグ用）
    └── run-log.txt
```

### 3.2 summary.json スキーマ

```json
{
  "generated_at": "2026-05-15T09:00:00+09:00",
  "period": { "from": "2026-04-15", "to": "2026-05-14", "days": 30 },
  "total_races": 7234,
  "top_n": 5,

  "overall": {
    "distribution_hit_rate": 0.31,
    "distribution_theoretical_recovery": 0.87,
    "ai_top_trifecta_hit_rate": 0.12,
    "ai_top_trifecta_recovery": 0.78,
    "ai_intersect_distribution_hit_rate": 0.18,
    "ai_intersect_distribution_recovery": 1.04,
    "lift_vs_ai_only": 0.26
  },

  "by_venue": [
    {
      "venue_code": 3,
      "venue_name": "江戸川",
      "total_races": 420,
      "distribution_hit_rate": 0.45,
      "distribution_recovery": 1.12,
      "ai_recovery": 0.71,
      "lift": 0.41,
      "verdict": "valuable"
    }
  ],

  "by_model": [
    {
      "model_id": "standard",
      "ai_only_recovery": 0.78,
      "ai_intersect_dist_recovery": 1.04,
      "ai_union_dist_recovery": 0.92,
      "lift": 0.26
    }
  ],

  "by_first_boat": [
    { "first_boat": 1, "races": 4200, "top1_pattern_rate": 0.18,
      "top5_pattern_rate": 0.58, "avg_payout": 2400 }
  ],

  "interesting_findings": [
    "江戸川: 出目分布 top5 で 112% 回収（AI: 71%）— 採用候補",
    "戸田: 1着1号艇のとき 1-2-3 が 12.5% で 1位パターン — 配当 1800円"
  ]
}
```

### 3.3 summary.csv スキーマ

| カラム | 説明 |
|---|---|
| venue_code | 会場コード |
| venue_name | 会場名 |
| model_id | モデルID |
| races | レース数 |
| dist_hit_rate | 出目分布TopN への適合率 |
| dist_recovery | 出目分布TopN を買った場合の回収率 |
| ai_hit_rate | AI 予測 3連単的中率 |
| ai_recovery | AI 予測 3連単回収率 |
| intersect_hit_rate | AI ∩ 分布 の的中率 |
| intersect_recovery | AI ∩ 分布 の回収率 |
| lift | intersect_recovery - ai_recovery |

### 3.4 report.html

最小限の自前 HTML（外部 CDN 依存なし）。`<table>` + 簡単な `<style>` のみ。
- 全体サマリ表
- 会場別ランキング表（lift 降順）
- モデル別比較表
- 注目所見（interesting_findings の箇条書き）

---

## 4. 処理ロジック (pseudocode)

```text
main():
    args = parseArgs()
    config = {
        period: args.period ?? 30,
        venue: args.venue,
        model: args.model,
        topN: args.topN ?? 5,
        minSamples: args.minSamples ?? 30,
    }

    // ===== Phase 1: データ取得 =====
    distMap = fetchOutcomeDistribution(config.venue)
        // Map<venueCode, Array<{first,second,third,count,probability,avg_payout}>>
        // 各 venue 内で probability 降順にソート済み

    raceResults = fetchRaceResults(config.period, config.venue)
        // [{race_id, venue_code, rank1, rank2, rank3, payout_trifecta, ...}]

    predictions = fetchPredictions(config.period, config.venue, config.model)
        // [{race_id, model_id, top_pick, top_2nd, top_3rd, payout_trifecta, ...}]

    predIndex = groupBy(predictions, p => p.race_id + ':' + p.model_id)

    // ===== Phase 2: レース単位の照合 =====
    matched = []
    for race in raceResults:
        actualPattern = `${race.rank1}-${race.rank2}-${race.rank3}`
        venueDist = distMap.get(race.venue_code) ?? []
        topNPatterns = venueDist.slice(0, config.topN)  // 既にソート済み

        // 出目分布の評価
        distHit = topNPatterns.some(p =>
            `${p.first}-${p.second}-${p.third}` === actualPattern
        )
        distInvestment = topNPatterns.length * 100  // 1点100円
        distPayout = distHit ? race.payout_trifecta : 0

        // AI 予測の評価（モデル別）
        for modelId in ['standard', 'safeBet', 'upsetFocus']:
            pred = predIndex.get(race.race_id + ':' + modelId)
            if pred is null: continue

            aiPattern = `${pred.top_pick}-${pred.top_2nd}-${pred.top_3rd}`
            aiHit = aiPattern === actualPattern
            aiPayout = pred.payout_trifecta ?? 0

            // 合議: AI 予測が出目分布 TopN に含まれるか
            aiInDist = topNPatterns.some(p =>
                `${p.first}-${p.second}-${p.third}` === aiPattern
            )

            matched.push({
                race_id, venue_code, model_id,
                actualPattern, aiPattern,
                distHit, distInvestment, distPayout,
                aiHit, aiPayout,
                aiInDist,  // AI 予測が分布上位に入っていたか
            })

    // ===== Phase 3: 集計 =====
    overall = aggregate(matched)
    byVenue = aggregateBy(matched, 'venue_code')
        .filter(g => g.races >= config.minSamples)
    byModel = aggregateBy(matched, 'model_id')
    byFirstBoat = aggregateBy(matched, m => m.actualPattern[0])

    // ===== Phase 4: 知見抽出 =====
    findings = []
    for row in byVenue:
        if row.distRecovery >= 1.0 and row.races >= 50:
            findings.push(`${VENUE_NAMES[row.venue_code]}: 出目分布 top${topN} で ${pct(row.distRecovery)} 回収`)
        if row.lift >= 0.15 and row.races >= 50:
            findings.push(`${VENUE_NAMES[row.venue_code]}: AI∩分布 で +${pct(row.lift)} lift`)

    // ===== Phase 5: 出力 =====
    saveJson(`${args.outputDir}/summary.json`, { overall, byVenue, byModel, byFirstBoat, findings, ... })
    if args.format in ['csv', 'all']:
        saveCsv(`${args.outputDir}/summary.csv`, flatten(byVenue, byModel))
    if args.format in ['html', 'all']:
        saveHtml(`${args.outputDir}/report.html`, renderHtml(...))

    if args.venue is null:
        for venueCode in 1..24:
            saveJson(`${args.outputDir}/by-venue/venue-${pad(venueCode)}.json`,
                     byVenue[venueCode])

    printSummary(overall, findings)

aggregate(matched):
    n = matched.length
    return {
        distribution_hit_rate: count(m => m.distHit) / n,
        distribution_theoretical_recovery:
            sum(m.distPayout) / sum(m.distInvestment),
        ai_top_trifecta_hit_rate: count(m => m.aiHit) / n,
        ai_top_trifecta_recovery: sum(m.aiPayout) / (n * 100),
        ai_intersect_distribution_hit_rate:
            count(m => m.aiHit && m.aiInDist) / count(m => m.aiInDist),
        ai_intersect_distribution_recovery:
            sum(m.aiPayout where m.aiInDist) / (count(m.aiInDist) * 100),
        lift_vs_ai_only:
            ai_intersect_distribution_recovery - ai_top_trifecta_recovery,
    }
```

---

## 5. 評価メトリクス（詳細）

### 5.1 出目分布単独の評価

| メトリクス | 計算式 | 意味 |
|---|---|---|
| `distribution_hit_rate` | 分布TopN に実出目が含まれるレース数 / 総レース数 | 分布カバレッジ |
| `distribution_theoretical_recovery` | Σ的中時配当 / (レース数 × TopN × 100円) | TopN 平等買い回収率 |
| `top1_pattern_rate` | 1位パターンと実出目の一致率 | 最頻パターンの精度 |

### 5.2 AI 単独の評価

| メトリクス | 計算式 |
|---|---|
| `ai_top_trifecta_hit_rate` | `is_hit_trifecta=true` のレース数 / 総レース数 |
| `ai_top_trifecta_recovery` | Σ`payout_trifecta` / (レース数 × 100円) |

### 5.3 AI × 出目分布 合議の評価（最重要）

| メトリクス | 計算式 | 解釈 |
|---|---|---|
| `ai_intersect_distribution_hit_rate` | AI予測が分布TopN に入っていてかつ的中 / AI予測が分布TopN に入っていたレース | 分布で絞った時の的中率 |
| `ai_intersect_distribution_recovery` | 上記分子に対応する配当合計 / 投資額 | 分布で絞った時の回収率 |
| `lift_vs_ai_only` | `ai_intersect_distribution_recovery - ai_top_trifecta_recovery` | **これが正なら分布データは価値あり** |

### 5.4 採否判定の閾値（提案）

| 判定 | 条件 |
|---|---|
| **採用候補** (`valuable`) | `lift >= 0.10` かつ サンプル `>= 50` |
| **要追加検証** (`promising`) | `lift >= 0.05` かつ サンプル `>= 50` |
| **効果なし** (`neutral`) | `-0.05 < lift < 0.05` |
| **悪化** (`harmful`) | `lift <= -0.05` |

---

## 6. 既存スクリプトを参考にする実装上の注意点

### 6.1 Supabase 関連
- **必ず `scripts/lib/supabaseClient.js` を使用**。`fetchAll()` ヘルパーがページネーション済み
- 環境変数は `SUPABASE_SERVICE_KEY`（`SUPABASE_SERVICE_ROLE_KEY` ではない — メモリに記載）
- ページネーション必須: デフォルト limit 1000 行（`scripts/daily/update-outcome-distribution.js:fetchAllRaceResults` を参照）
- race_id は文字列キー（`'YYYY-MM-DD-VV-RR'` 形式）。会場コード抽出は `race_id.split('-')[3]`

### 6.2 日付処理
- JST 計算は `scripts/daily/update-outcome-distribution.js:getTodayDateJST` をそのまま流用可
- 過去N日: `new Date(now - N*86400000 + 9*3600000)` → ISO 文字列の date 部分

### 6.3 集計ロジック
- メモリ集計を採用（`scripts/daily/calculate-accuracy.js` と同じパターン）
  - 過去90日でも数万行程度なので Map/filter で十分速い
- Supabase 側で集計 SQL は使わず、Node で集約 → CSV/JSON 出力

### 6.4 出力ファイル
- `data/analysis/outcome-distribution-validation/` を `fs.mkdirSync({ recursive: true })` で作成
- 既存ファイルは上書き（差分管理は git に任せる）
- ファイル名は kebab-case（`.claude/rules/documentation.md`）

### 6.5 ログ出力
- `console.log` で進捗を逐次表示（`scripts/daily/update-outcome-distribution.js` と同様）
  - フェーズ区切り: `=== Phase X: ... ===`
  - 件数表示: `取得完了: NNNN件`
- 統計値は `(value * 100).toFixed(1) + '%'` 形式

### 6.6 エラーハンドリング
- 各 Supabase 呼び出しで `error` をチェック → `console.error` → 当該会場をスキップ
- `process.exit(1)` は `main()` の最外で `catch` した時のみ

### 6.7 期間の近似に関する注意（重要）
- `outcome_distribution` テーブルは **現在の90日スナップショット** しか保持しない
  → 「過去Nか月前のレースを評価する際の出目分布」は厳密には取得できない
- **初期実装では現スナップショットを全期間に適用する近似**で進める
- 厳密化したい場合の選択肢:
  1. 評価期間を過去30日以内に限定（現スナップショットとの誤差が小）
  2. `outcome_distribution_history` テーブル（日次スナップショット）を別途設計（将来）
- スクリプトの先頭ログにこの近似を明記する

---

## 7. 環境・依存関係

### 7.1 必須環境変数（`.env.local`）

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### 7.2 必須テーブル

- `outcome_distribution`（マイグレーション 020 適用済み）
- `race_results`
- `predictions`
- `races`（オプション、グレード別評価用）

### 7.3 npm 依存（既存）

- `@supabase/supabase-js`（プロジェクトに既存）
- `dotenv`（既存）

### 7.4 新規依存（不要）

CSV と HTML はテンプレート文字列で十分。**新規 npm パッケージは追加しない**。
- CSV: `rows.map(r => cols.join(',')).join('\n')`
- HTML: テンプレート文字列 + 最低限の `<style>` 埋め込み

### 7.5 実行例

```bash
# 全会場・全モデル・過去30日
node scripts/analysis/validate-outcome-distribution.js

# 江戸川のみ・standard モデルのみ・過去60日・top10
node scripts/analysis/validate-outcome-distribution.js \
  --venue 03 --model standard --period 60 --top-n 10 --format all

# 結果ディレクトリ
open data/analysis/outcome-distribution-validation/report.html
```

### 7.6 想定実行時間

| ケース | 想定時間 |
|---|---|
| 全会場 / 30日 | 30〜60秒（race_results 約 7000 行、predictions 約 21000 行） |
| 全会場 / 90日 | 90〜180秒 |
| 単一会場 / 30日 | 5〜10秒 |

---

## 8. テスト戦略

1. **スモークテスト**: `--venue 03 --period 7` で実行 → エラーなく `summary.json` が出力されること
2. **既知会場の検証**: 江戸川（イン弱い → 出目分布の価値が高いはず）で `distribution_hit_rate` が他会場より明確に高いこと
3. **整合性チェック**: `total_races` がレース結果テーブルの件数と一致すること
4. **数値妥当性**: `distribution_theoretical_recovery` が 0.5〜1.5 のレンジに収まること（極端な値なら集計ロジックの誤り）

---

## 9. 後続タスク

このスクリプトの結果から導かれる次のアクション:
- `verdict='valuable'` の会場では出目分布データを UI に強調表示
- AI 予測モデルに「出目分布TopN内かどうか」を特徴量として追加（generate-predictions.js に統合）
- 出目分布の過去スナップショット保存（`outcome_distribution_history` 設計）が必要かを判断

---

## 10. 実装ファイル一覧（着手時の参考）

| 配置 | ファイル | 役割 |
|---|---|---|
| 新規 | `scripts/analysis/validate-outcome-distribution.js` | 本体 |
| 既存 | `scripts/lib/supabaseClient.js` | DB 接続・`fetchAll` 流用 |
| 既存（参考） | `scripts/daily/update-outcome-distribution.js` | データ取得パターン |
| 既存（参考） | `scripts/daily/calculate-accuracy.js` | 集計ロジックパターン |
| 既存（参考） | `scripts/analysis/analyze-outcome-patterns.js` | 出目集計ロジック |
| 出力 | `data/analysis/outcome-distribution-validation/` | 結果保存先 |
