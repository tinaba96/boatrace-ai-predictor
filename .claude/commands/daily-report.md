---
name: daily-report
description: 本日の予測結果と回収率をレポート
---

# 日次レポート生成

本日（または指定日）の予測結果をレポートします。

## 引数

- `$ARGUMENTS`: 日付（YYYY-MM-DD形式、省略時は本日）

## レポート内容

1. **全体サマリー**
   - 総レース数
   - モデル別的中率
   - モデル別回収率

2. **会場別パフォーマンス**
   - 会場ごとの的中率・回収率

3. **注目ポイント**
   - 回収率100%超えの条件
   - 大きく外れたレース

## 実行

```bash
node scripts/daily/calculate-accuracy.js --date=$ARGUMENTS
```

## 出力

- コンソール: サマリー表示
- ファイル: `data/analysis/daily-report-{日付}.json`
