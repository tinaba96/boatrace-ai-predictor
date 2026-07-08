# trifecta / trio カラムの命名スワップ問題

## 概要

`predictions` と `race_results` テーブルの trifecta / trio 系カラムは、
**カラム名と実体が入れ替わっている**。

| カラム | 名前が示す意味 | 実際に格納されている値 |
|--------|----------------|------------------------|
| `predictions.is_hit_trifecta` | 3連単的中 | **3連複的中**（順不同一致） |
| `predictions.is_hit_trio` | 3連複的中 | **3連単的中**（順序一致） |
| `predictions.payout_trifecta` | 3連単払戻 | **3連複払戻** |
| `predictions.payout_trio` | 3連複払戻 | **3連単払戻** |
| `race_results.payout_trifecta` | 3連単払戻 | **3連複払戻** |
| `race_results.payout_trio` | 3連複払戻 | **3連単払戻** |

一方、`prediction_odds` テーブル（`trifecta_odds_*` / `trio_odds_*`）の命名は
**正しい**（3連単オッズ > 3連複オッズの関係が常に成立している）。

## 検証エビデンス（2026-06-20〜07-01, standardモデル 1,968レース）

- `is_hit_trio = true` は38件で、**全件が予想3艇と着順の完全一致**（順序込み）
  - 的中率 1.9% は3連単の妥当な水準
  - 例: `2026-06-20-17-01` pred `2-1-4` / result `2-1-4`、
    `payout_trio = 12,910円`（高額 = 3連単の払戻水準）、
    同レースの `race_results.payout_trifecta = 340円`（低額 = 3連複水準）
- `is_hit_trifecta = true` は328件で、うち290件は**順序不一致だが3艇の集合が一致**
  - 的中率 16.7% は3連複の妥当な水準
  - 例: `2026-06-20-02-01` pred `3-1-4` / result `1-4-3`（集合一致・順序不一致）

## 影響範囲

- `scripts/analysis/train-moriarty-calibration.js` — 対応表
  `BET_TYPE_TO_HIT_KEY` で正しい対応付けに補正済み
- `scripts/daily/update-moriarty-outcomes.js` — `judgeBet` 内で
  payout カラムの対応を補正済み
- `scripts/analysis/compare-pcexpect.js` — `is_hit_trifecta` を3連単として
  扱っている可能性あり（**未対応・要確認**）
- `scripts/analysis/analyze-prediction-ensemble.js`（BOA-104, 未コミット）—
  `is_hit_trifecta` / `payout_trifecta` を3連単として扱っている（**未対応・要確認**）
- `calculate-accuracy.js` 起点の的中率統計・フロントエンド表示 —
  「3連単的中率」として表示している値が実際は3連複（またはその逆）の
  可能性あり（**未対応・要確認**）

## 恒久対応の選択肢

1. **DBカラム名を実体に合わせて入れ替える**（マイグレーション + 全参照箇所の一括修正）
2. 書き込み側（`calculate-accuracy.js` 等の非正規化処理）を修正して
   値を正しいカラムに入れ直し、過去分をバックフィル

どちらの場合も、修正済みの Moriarty スクリプト2ファイルの補正マッピングを
同時に外す必要がある。upstream に `feature/fix-trifecta-trio-naming`
ブランチが存在するため、対応状況を確認してから着手すること。
