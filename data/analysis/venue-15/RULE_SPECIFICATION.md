# 丸亀（会場コード: 15）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 486レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| R15-T001 | MARUGAME-TRIO-INC6 | 3連複 | 6号艇含む | 27戦3勝 | **171%** |
| R15-T002 | MARUGAME-TRIO-INC5-HC | 3連複 | 5号艇含む×conf75+ | 49戦10勝 | **130%** |
| R15-T003 | MARUGAME-TRIO-24X | 3連複 | 2,4号艇含む | 12戦6勝 | **139%** |
| R15-P001 | MARUGAME-PLACE-TOP1-16 | 複勝 | 1号艇1着+6号艇含む | 30戦22勝 | **111%** |
| R15-W001 | MARUGAME-WIN-TOP2-INC1 | 単勝 | 2号艇1着+1号艇含む | 19戦8勝 | **106%** |
| R15-W002 | MARUGAME-WIN-TOP1-HC | 単勝 | 1号艇1着×conf85+ | 120戦75勝 | **101%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has2 = top3.includes(2);
  const has4 = top3.includes(4);
  const has5 = top3.includes(5);
  const has6 = top3.includes(6);

  switch (ruleId) {
    case 'R15-T001':
      return has6;

    case 'R15-T002':
      return has5 && conf >= 75;

    case 'R15-T003':
      return has2 && has4;

    case 'R15-P001':
      return prediction.top_pick === 1 && has6;

    case 'R15-W001':
      return prediction.top_pick === 2 && has1;

    case 'R15-W002':
      return prediction.top_pick === 1 && conf >= 85;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

R15 = Marugame（丸亀）の会場コード15
