# 廃止メンテナンススクリプト

これらのスクリプトは、2026-05-05 の修正「race_grade の Source of Truth 統一」により、用途がなくなったため廃止しました。

## 廃止スクリプト一覧

### 1. backfill-race-grades.js
**目的**: 過去レースの race_grade（SG/G1/G2/G3）を `race_conditions` テーブルに書き込み

**廃止理由**: 
- `race_conditions.race_grade` カラムが削除された
- `race_grade` は `races` テーブルで管理される（Source of Truth 統一）
- 本修正で過去データはすべて `races` テーブルに反映済み

**代替機能**: なし。race_grade の設定は now:
- 朝のバッチ: `generate-predictions.js` が `races.race_grade` に書き込み
- 発走60分前: `update-race-info.js` が `races.race_grade` を更新

---

### 2. regenerate-past-predictions.js
**目的**: 過去日付の予想データを再生成し、`race_conditions.race_grade` の変更を反映

**廃止理由**:
- `race_conditions.race_grade` が廃止されたため、このスクリプトは実行不可
- 予想の再生成が必要な場合は、`generate-predictions.js --refresh` を使用

**代替機能**: `node scripts/daily/generate-predictions.js --refresh`

---

### 3. regenerate-past-predictions-parallel.js
**目的**: regenerate-past-predictions.js の並列版

**廃止理由**: 同上。regenerate-past-predictions.js に依存

**代替機能**: 同上

---

## 参考

修正の詳細は以下を参照:
- `docs/operation/api-architecture-analysis.md` - API・RPC アーキテクチャ分析
- `docs/db-migration/017_drop_race_grade_from_race_conditions.sql` - DB マイグレーション実行済み

廃止日: 2026-05-06
