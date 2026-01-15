# BoatAI プロジェクト - Claude Code 設定

## プロジェクト概要
- ボートレースAI予想サービス
- React + Vite + react-router-dom
- モバイルファーストのPWA
- Supabase（データベース）

---

## ディレクトリ構造

```
boatrace-ai-predictor/
├── .claude/
│   ├── CLAUDE.md          # このファイル（プロジェクトルール）
│   ├── commands/          # カスタムスラッシュコマンド
│   └── settings.local.json
├── src/                   # フロントエンド（React）
│   ├── App.jsx
│   ├── components/
│   ├── services/
│   └── pages/
├── scripts/
│   ├── daily/             # 日次実行スクリプト
│   ├── analysis/          # 分析用スクリプト
│   ├── maintenance/       # メンテナンス用
│   └── lib/               # 共通ライブラリ
├── data/
│   ├── analysis/          # 分析結果JSON
│   ├── venue-params/      # 会場別パラメータ
│   └── predictions/       # 予測データ
├── docs/
│   ├── db-migration/      # DBスキーマ・マイグレーション
│   ├── setup/             # セットアップガイド
│   └── archive/           # 古いドキュメント
├── archive/               # 古いファイル（参照用）
└── api/                   # Vercel Edge Functions
```

---

## 分析・調査アプローチの優先順位

**Node.jsスクリプトを優先して使用する。SQLの手動実行は最終手段。**

### 優先度1: 既存スクリプトを使用
```bash
node scripts/analysis/find-profitable-strategies.js
```
- 既存スクリプトで目的を達成できるか確認
- パラメータを調整すれば対応できるか検討

### 優先度2: 既存スクリプトを拡張
```javascript
// scripts/analysis/find-profitable-strategies.js に機能追加
async function analyzeNewCondition() { ... }
```
- 今後も使う可能性がある機能か？
- 他の会場でも使えるか？

### 優先度3: 一時的なNode.jsコード（`node -e`）
**ファイルを作成せず、一度きりの調査に使用**
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
(async () => {
  const { data, count } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true });
  console.log('予測データ件数:', count);
})();
"
```
- 一度きりの調査
- 再利用の可能性が低い
- **ファイルを増やしたくない**

### 優先度4: SQLスクリプト（最終手段）
- Supabase Dashboard での手動実行が必須の場合のみ
- 複雑なマイグレーションなど

---

## ドキュメントルール

### 禁止事項
以下はGit履歴で追跡可能なため**記載しない**：
- 最終更新日（例: `最終更新: 2025-01-13`）
- 変更履歴セクション
- 問い合わせセクション
- 著者・作成者セクション

### ドキュメントの種類と配置場所
| 種類 | 配置場所 | 例 |
|------|----------|-----|
| **リファレンス** | `docs/db-migration/` | スキーマ定義、RPC関数 |
| **分析結果** | `data/analysis/` | JSON形式で保存 |
| **セットアップ** | `docs/setup/` | 環境構築手順 |
| **古いドキュメント** | `docs/archive/` | 参照用に保持 |

### ドキュメント作成時のチェックリスト
- [ ] 既存ドキュメントを検索したか？
- [ ] 既存ドキュメントへの追記で対応できないか？
- [ ] 適切なディレクトリに配置したか？
- [ ] **ルートに置いていないか？**

---

## ファイル命名規則

### 基本ルール
**すべてのファイルは `kebab-case` を使用**
- 例外: `README.md`, `TODO.md` は大文字OK

### スクリプトファイル
```
scripts/analysis/
├── analyze-venue-{コード}.js      # 会場別分析
├── find-{対象}.js                 # データ探索
├── verify-{ルール名}.js           # ルール検証
└── design-{モデル名}.js           # モデル設計
```

### 分析結果ファイル
```
data/analysis/
├── venue-{コード}-analysis.json   # 会場別分析結果
├── profitable-conditions.json     # 回収率100%超え条件
└── rule-{ルール名}-verification.json  # ルール検証結果
```

---

## 分析ワークフロー（会場別モデル開発）

### 目標
各会場で「回収率100%超え」のルール・条件を統計的に発見し、厳選型のモデルを構築する。

### ステップ
1. **データ収集**: Supabaseから過去データを取得
2. **条件探索**: 回収率100%超えの条件を統計的に探索
3. **ルール検証**: 発見したルールの信頼性を検証（サンプル数、期間）
4. **モデル化**: ルールをスコア計算ロジックに組み込み

### 分析結果の保存形式
```json
{
  "venue_code": 3,
  "venue_name": "江戸川",
  "analysis_date": "2025-01-13",
  "rules": [
    {
      "name": "1号艇A1級+モーター2連率40%以上",
      "bet_type": "win",
      "conditions": { ... },
      "stats": {
        "sample_size": 150,
        "hit_rate": 0.72,
        "recovery_rate": 1.08
      }
    }
  ]
}
```

---

## スクリプト作成ルール

### 新しいスクリプトを作成する場合
| 用途 | 配置場所 |
|------|---------|
| 毎日実行するもの | `scripts/daily/` |
| 分析・調査 | `scripts/analysis/` |
| データ修正・補完 | `scripts/maintenance/` |

### 共通処理
- Supabase接続は `scripts/lib/supabase.js` を使用
- 共通のユーティリティは `scripts/lib/` に切り出す

### スクリプトのテンプレート
```javascript
// scripts/analysis/analyze-venue-XX.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 分析ロジック
}

main().catch(console.error);
```

---

## 重要な制約

### Claude Codeの限界
- モバイル実機でのテストは不可能。ユーザーに確認を依頼する
- 複雑な修正を何度も試すより、**シンプルに再実装**を優先する
- 3回以上同じ問題で失敗したら、一度立ち止まって別のアプローチを提案する

### モバイル対応で注意すること
- iOSのタッチイベントは問題が多い。`onClick` のみでシンプルに実装する
- `overflow: hidden/auto` はサブ要素のタッチイベントを妨げる

### モバイル余白・スペーシングの最適化
| 要素 | デスクトップ | モバイル (480px以下) |
|------|-------------|---------------------|
| margin | 2-2.5rem | 0.75-1rem |
| padding | 1.5-2.5rem | 0.75-1rem |
| gap | 1-1.5rem | 0.5-0.75rem |

---

## コーディング規約

### CSS
- `!important` は基本使わない
- メディアクエリで同じ要素に対する重複したスタイルを避ける

### React
- イベントハンドラはシンプルに保つ
- 状態管理が複雑になったらカスタムフックに切り出す
- デバッグ用コード（console.log）は問題解決後に必ず削除

### JavaScript/Node.js
- ES Modules（import/export）を使用
- async/awaitを使用（コールバック地獄を避ける）
- エラーハンドリングは適切に行う

---

## 開発フロー

### ブランチ戦略
```
master     ← 本番環境（boatai.net）
  ↑
develop    ← 開発用（Vercel Previewで確認）
  ↑
feature/*  ← 機能開発用
```

| ブランチ | 用途 | デプロイ先 |
|---------|------|-----------|
| `master` | 本番リリース | boatai.net |
| `develop` | 開発・テスト | Vercel Preview URL |
| `feature/*` | 機能開発 | - |

### デプロイフロー
```
1. feature/* で開発
2. develop にマージ → Vercel Previewで確認
3. 問題なければ master にマージ → 本番デプロイ
```

### 環境変数
| 変数 | ローカル | 本番 |
|------|---------|------|
| `SUPABASE_URL` | .env.local | Vercel環境変数 |
| `SUPABASE_SERVICE_ROLE_KEY` | .env.local | Vercel環境変数 |
| `VITE_GA_MEASUREMENT_ID` | .env.local | Vercel環境変数 |

---

## 分析PDCA

### ワークフロー
```
[仮説立案] → [データ分析] → [ルール発見] → [検証] → [本番適用] → [結果確認]
     ↑                                                              ↓
     └──────────────────── フィードバック ←─────────────────────────┘
```

### 分析ディレクトリ構造
```
data/analysis/
├── venue-01/                    # 桐生
│   ├── hypothesis.json          # 仮説
│   ├── analysis.json            # 分析結果
│   ├── rules.json               # 発見したルール
│   └── README.md                # 会場の特徴まとめ
├── venue-03/                    # 江戸川
│   └── ...
└── summary/                     # 全体サマリー
    ├── profitable-rules.json    # 回収率100%超えルール一覧
    └── failed-hypotheses.json   # 失敗した仮説（学習用）
```

### 分析スクリプト
| スクリプト | 用途 |
|-----------|------|
| `test-hypothesis.js` | 仮説検証 |
| `find-conditions.js` | 条件探索 |
| `verify-rule.js` | ルール検証 |
| `summarize-results.js` | 結果サマリー生成 |

### 分析の進め方
1. **仮説立案**: 「江戸川で1号艇A1+モーター40%以上なら勝率高い？」
2. **スクリプト実行**: `node scripts/analysis/test-hypothesis.js --venue=03`
3. **結果保存**: 自動で `data/analysis/venue-03/` に保存
4. **検証**: 別期間のデータで再検証
5. **適用判断**: 信頼性が高ければモデルに組み込み

---

## 月次会場分析の運用ルール

### 実施頻度
月1回程度（月初または運用成績を見て判断）

### 分析フロー

```
[1. 全会場統計収集] → [2. 会場選定] → [3. 詳細分析] → [4. ルール実装] → [5. ドキュメント作成]
```

### Step 1: 全会場統計収集

```bash
# /collect-stats スキルを実行、または直接スクリプト実行
node scripts/analysis/collect-venue-stats.js
```

**出力**: `data/analysis/summary/venue-stats.json`

各会場の以下を確認：
- レース数（サンプル数）
- 1号艇勝率
- 単勝/複勝/3連複の回収率
- 分析優先度スコア

### Step 2: 会場選定

優先度が高い会場を選定する基準：
| 優先度 | 条件 |
|--------|------|
| 高 | 3連複回収率 400%以上、またはサンプル数500以上 |
| 中 | 複勝回収率 100%以上 |
| 低 | 既に分析済み、またはサンプル不足 |

### Step 3: 詳細分析

```bash
# /analyze-venue スキルを実行
# 例: /analyze-venue 10（三国）
```

または直接スクリプト実行：
```bash
node scripts/analysis/collect-venue-stats.js --venue=10
```

**分析対象**:
- 単勝: top_pick別、confidence帯別、top3組み合わせ別
- 複勝: 同上
- 3連複: top3の艇番組み合わせ、confidence帯別

**ルール採用基準**:
| 指標 | 基準 |
|------|------|
| 回収率 | 100%以上（必須） |
| サンプル数 | 10以上（推奨20以上） |
| 的中率 | 参考値（回収率優先） |

### Step 4: ルール実装

**ファイル**: `src/services/ruleMatchService.js`

1. 会場のルール定数を追加（例: `MIKUNI_RULES`）
2. `VENUE_RULES`マップに登録

```javascript
// 会場別ルール定数
const MIKUNI_RULES = [
  {
    id: 'M10-T001',           // ルールID
    patternName: 'MIKUNI-TRIO-NO1-HC',  // パターン名
    description: '1号艇含まず×conf80+', // 条件の説明
    betType: 'trio',          // 賭け方
    stats: { samples: 25, hits: 6, recovery: 218 },  // 発掘時の統計
    reliability: 'highest',   // 信頼性
    check: (pred, raceNo, conf, predSorted, has1) =>
      !has1 && conf >= 80     // 判定ロジック
  },
  // ... 他のルール
]

// VENUE_RULESに登録
const VENUE_RULES = {
  '03': EDOGAWA_RULES,
  '10': MIKUNI_RULES,  // ← 追加
  // ...
}
```

**ルールID命名規則**:
| 会場 | プレフィックス |
|------|---------------|
| 江戸川(03) | E03 |
| 浜名湖(06) | H06 |
| 三国(10) | M10 |
| びわこ(11) | B11 |
| 丸亀(15) | R15 |
| 福岡(22) | F22 |

### Step 5: ドキュメント作成

**必須ファイル**（3点セット）:

```
data/analysis/venue-{コード}/
├── README.md              # 会場特性・分析概要
├── rules.json             # ルール定義（JSON）
└── RULE_SPECIFICATION.md  # 実装仕様書
```

#### README.md テンプレート

```markdown
# {会場名}（会場コード: {コード}）分析

> **実装時は [RULE_SPECIFICATION.md](./RULE_SPECIFICATION.md) を参照**

## 会場特性
- **水面**: 淡水/海水/汽水
- **1号艇勝率**: XX%
- **特徴**: （特筆すべき傾向）

## 分析概要
- **対象期間**: YYYY-MM-DD 〜 YYYY-MM-DD
- **サンプル数**: XXXレース

## 発見したルール
（単勝/複勝/3連複ごとに表形式）

## 推奨賭け方
（優先度順）
```

#### rules.json テンプレート

```json
{
  "venue_code": 10,
  "venue_name": "三国",
  "analysis_date": "2026-01-15",
  "status": "active",
  "win_rules": [...],
  "place_rules": [...],
  "trio_rules": [...]
}
```

#### RULE_SPECIFICATION.md テンプレート

```markdown
# {会場名}（会場コード: {コード}）ルール実装仕様書

## 概要
- 分析対象、期間、サンプル数

## ルール一覧サマリー
（表形式）

## 実装例
（JavaScriptコード）

## ルールID命名規則
```

### 会場コード一覧（参照用）

```
1:桐生, 2:戸田, 3:江戸川, 4:平和島, 5:多摩川, 6:浜名湖,
7:蒲郡, 8:常滑, 9:津, 10:三国, 11:びわこ, 12:住之江,
13:尼崎, 14:鳴門, 15:丸亀, 16:児島, 17:宮島, 18:徳山,
19:下関, 20:若松, 21:芦屋, 22:福岡, 23:唐津, 24:大村
```

### 分析済み会場の管理

現在ルールが実装されている会場:
- 江戸川(03): 10ルール
- 浜名湖(06): 8ルール
- 三国(10): 6ルール
- びわこ(11): 8ルール
- 丸亀(15): 6ルール
- 福岡(22): 6ルール

**合計**: 6会場 / 44ルール

---

## よく使うコマンド

### 開発
```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
```

### 日次スクリプト
```bash
node scripts/daily/generate-predictions.js
node scripts/daily/scrape-results.js
node scripts/daily/calculate-accuracy.js
```

### 分析
```bash
node scripts/analysis/analyze-venue-03.js   # 江戸川分析
node scripts/analysis/find-profitable-strategies.js
```
