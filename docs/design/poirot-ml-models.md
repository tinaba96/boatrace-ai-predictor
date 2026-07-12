# ポアロ予想 機械学習モデル設計（BOA-104）

/poirot ページ（α版・非公開リンク）で提供する実験的MLモデルの設計資料。
既存の本命／スタンダード／穴モデル（ルールベース）とは独立して評価する。

## 全体アーキテクチャ

```
[Supabase]
  races / race_entries / exhibition_data / race_conditions / race_results
        │
        ▼  scripts/ml/export-training-data.js（週次目安で再輸出）
  data/ml/dataset.csv + start_timings.csv
        │
        ▼  scripts/ml/train_rf.py（V1）/ train_v2.py（V2）
  scripts/ml/models/rf_v1.pkl / lgbm_v2.pkl（+ data/ml/report_*.json）
        │
        ▼  scripts/daily/generate-poirot-predictions.js（日次）
  ① export-inference-data.js → data/ml/inference.csv
  ② predict.py → data/ml/poirot-predictions.json
  ③ poirot_predictions テーブルへ upsert
        │
        ▼
  /poirot ページ（src/pages/Poirot.jsx + poirotService.js）
```

## モデル構成（V1/V2共通の3ヘッド構成）

- **head1 = P(1着), head2 = P(2着), head3 = P(3着)** を艇単位の2値分類で学習
- 各ヘッドを isotonic 回帰でキャリブレーション（cal セット使用）
- **一般化 Plackett-Luce** で3連単120通りの確率に展開:
  `P(i,j,k) = p1_i/Σp1 × p2_j/(Σp2−p2_i) × p3_k/(Σp3−p3_i−p3_j)`
- 最尤の組み合わせを「本日の買い目」として1点出力

| バージョン | アルゴリズム | 欠損値 | model_version |
|---|---|---|---|
| V1 | RandomForest（600本, min_samples_leaf=20） | -999 sentinel | `rf-v1` |
| V2 | LightGBM（binary, early stopping） | ネイティブ処理 | `lgbm-v2` |

## 特徴量（scripts/ml/features.py）

- 艇・会場: boat_number, venue_code, race_number
- 選手: 級別, 年齢, 全国/当地勝率, 2連率/3連率
- 機材: モーター2/3連率, ボート2/3連率
- 直前: 展示タイム, 展示ST
- 気象: 風向(16方位コード), 天候, 風速, 波高, 気温, 水温
- 節: 開催日次, 最終日フラグ, グレード（ippan/G3/G2/G1/SG）
- ローリング（**shift(1)でリーク防止**）: 本番ST履歴平均(30走), 直近勝率(60走)
- レース内相対値: 勝率順位/偏差, 展示タイム順位, 展示ST順位, モーター順位, ST履歴順位

## 評価プロトコル

- レース単位の**時系列分割**: train 70% / calibration 15% / test 15%
- 指標: log loss・AUC・キャリブレーション表・**回収率**（的中率は参考値）
- ⚠️ DB列名の英日逆転に注意: `payout_trifecta`=3連複払戻, `payout_trio`=3連単払戻
  （scrape-results.js のコメント参照）

## 学習データ

2系統を `features.load_dataset()` が自動連結する（重複 race_id は Supabase 優先）:

| ソース | 期間 | 生成方法 |
|---|---|---|
| Supabase 蓄積分 | 2025-12-03〜 | `export-training-data.js` |
| 公式アーカイブ（バックフィル） | 2024-01-01〜2025-12-02 | `backfill.py download` → `parse` |

バックフィルは boatrace.jp 公式のデイリーアーカイブ（B=番組表/K=競走成績、
Shift_JIS固定幅テキスト）をパースする。3連率・展示ST・気温・水温・グレードは
アーカイブに存在しないため欠損（LightGBMはネイティブ処理、RFはsentinel）。
計 13.8万レース・74万行。

## バックテスト結果（2025-08-25〜2026-07-06, 20,704レース）

| 指標 | V1 RF | V2 LightGBM |
|---|---|---|
| head1 log loss | 0.3291 | 0.3252 |
| head1 AUC | 0.841 | 0.847 |
| 単勝ベタ買い回収率 | 90.3% | 90.3% |
| 3連単ベタ買い回収率 | 80.8% | 77.9% |
| 3連複ベタ買い回収率 | 81.1% | 79.0% |
| 3連単 p≥0.10 回収率 | 82.7%（1,410件） | 90.3%（1,276件） |
| 3連単 p≥0.15 回収率 | 113.1%（29件） | **143.5%**（17件・的中41.2%） |

- 初期評価（テスト4,810レース）の「p≥0.10で回収率100%超え」は小サンプルの
  上振れだった。5倍のテストデータでは同閾値で82〜90%に収束。
- p≥0.15 の超高確信ゾーンは両モデル100%超えだが、まだ件数が少なく確定的でない。
- 確率フィルタ単独では控除率25%の壁を安定して超えられない、という定量的根拠が
  得られた。**期待値フィルタ（モデル確率×オッズ>閾値）への移行が必須**であり、
  022 で蓄積開始した締切直前オッズがその前提データとなる。
- UI の信頼度バッジ: 高=p≥0.10 / 中=p≥0.05 / 低=それ未満

## シャドー運用の検証

`node scripts/analysis/verify-poirot.js [--from=... --to=...]` が
poirot_predictions × race_results を突き合わせ、モデル別・信頼度バケット別の
実測的中率・回収率を出力する（読み取りのみ・書き込みなし）。

## 運用

- **学習環境**: `scripts/ml/.venv`（Python 3.14, requirements.txt）。
  macOS では LightGBM に `brew install libomp` が必要。
- **再学習**: データが増えたら export-training-data.js → train_rf.py / train_v2.py。
  モデル(.pkl)・データ(csv)は gitignore（リポジトリにはコードのみ）。
- **日次推論**: `node scripts/daily/generate-poirot-predictions.js`
  現状はローカル実行（GitHub Actions はモデルアーティファクト未配備のため対象外）。
- **DBマイグレーション**: `docs/db-migration/021_poirot_predictions.sql`
  を Supabase Dashboard で実行（初回のみ）。

## 今後の拡張（Phase 3 以降）

1. **締切直前の全オッズスナップショット収集**（未着手・最優先で貯め始める）
2. 市場暗黙確率との合成（Benter式2段ロジット）+ EV = p×odds フィルタ
3. 外部予想サイト（boatrace.jp pcexpect 等）の特徴量化
4. ~~公式ダウンロードデータでの履歴バックフィル~~（実装済み: `backfill.py`）
