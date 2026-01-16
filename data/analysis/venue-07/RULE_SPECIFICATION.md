# 蒲郡（会場コード: 07）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 655レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| G07-W001 | GAMAGORI-WIN-TOP3-HC | 単勝 | 3号艇1着×conf75+ | 55戦12勝 | **136%** |
| G07-W002 | GAMAGORI-WIN-TOP3-INC4 | 単勝 | 3号艇1着+4号艇含む | 29戦7勝 | **199%** |
| G07-W003 | GAMAGORI-WIN-TOP5-INC1 | 単勝 | 5号艇1着+1号艇含む | 25戦7勝 | **190%** |
| G07-P001 | GAMAGORI-PLACE-TOP4-HC | 複勝 | 4号艇1着×conf75+ | 41戦19勝 | **135%** |
| G07-P002 | GAMAGORI-PLACE-TOP2-INC1 | 複勝 | 2号艇1着+1号艇含む | 70戦39勝 | **113%** |
| G07-P003 | GAMAGORI-PLACE-TOP5-INC1 | 複勝 | 5号艇1着+1号艇含む | 25戦17勝 | **134%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has4 = top3.includes(4);

  switch (ruleId) {
    case 'G07-W001':
      return prediction.top_pick === 3 && conf >= 75;

    case 'G07-W002':
      return prediction.top_pick === 3 && has4;

    case 'G07-W003':
      return prediction.top_pick === 5 && has1;

    case 'G07-P001':
      return prediction.top_pick === 4 && conf >= 75;

    case 'G07-P002':
      return prediction.top_pick === 2 && has1;

    case 'G07-P003':
      return prediction.top_pick === 5 && has1;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

G07 = Gamagori（蒲郡）の会場コード07

---

## 特記事項

- 3連複は回収率100%超のルールが見つからなかったため、対象外
- 1号艇勝率は57.4%と高いが、単勝回収率は100%未満
- 穴狙い（3号艇・5号艇）で高回収率を狙える会場
