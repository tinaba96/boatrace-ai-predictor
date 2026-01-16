---
name: collect-stats
description: 24会場の基本統計を一括収集し、分析優先順位を決定
---

# 24会場統計収集

全24会場の基本統計を収集し、どの会場から分析を始めるか判断材料を揃えます。

## 収集する情報

- レース数
- 1号艇勝率
- 荒れ度（1号艇以外が勝つ割合）
- 単勝/複勝/3連複/3連単の回収率

## 実行

```bash
node scripts/analysis/collect-venue-stats.js
```

## 出力

- コンソール: 回収率ランキング
- ファイル: `data/analysis/summary/venue-stats.json`

## 次のアクション

回収率が高い会場から順に `/analyze-venue {コード}` で詳細分析を実行
