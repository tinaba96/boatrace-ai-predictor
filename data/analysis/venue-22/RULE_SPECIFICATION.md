# 福岡（会場コード: 22）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 約450レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| F22-T001 | FUKUOKA-TRIO-INC4-HC | 3連複 | 4号艇含む×conf75+ | 23戦9勝 | **202%** |
| F22-T002 | FUKUOKA-TRIO-45X | 3連複 | 4,5号艇含む | 12戦3勝 | **208%** |
| F22-T003 | FUKUOKA-TRIO-INC2-HC | 3連複 | 2号艇含む×conf75+ | 35戦14勝 | **109%** |
| F22-P001 | FUKUOKA-PLACE-TOP2-INC1 | 複勝 | 2号艇1着+1号艇含む | 18戦7勝 | **143%** |
| F22-W001 | FUKUOKA-WIN-TOP1-MC | 単勝 | 1号艇1着×conf60-74 | 10戦4勝 | **119%** |
| F22-W002 | FUKUOKA-WIN-TOP1-13 | 単勝 | 1号艇1着+3号艇含む | 44戦28勝 | **102%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has2 = top3.includes(2);
  const has3 = top3.includes(3);
  const has4 = top3.includes(4);
  const has5 = top3.includes(5);

  switch (ruleId) {
    case 'F22-T001':
      return has4 && conf >= 75;

    case 'F22-T002':
      return has4 && has5;

    case 'F22-T003':
      return has2 && conf >= 75;

    case 'F22-P001':
      return prediction.top_pick === 2 && has1;

    case 'F22-W001':
      return prediction.top_pick === 1 && conf >= 60 && conf < 75;

    case 'F22-W002':
      return prediction.top_pick === 1 && has3;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

F22 = Fukuoka（福岡）の会場コード22
