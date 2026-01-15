# びわこ（会場コード: 11）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 429レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| B11-T001 | BIWAKO-TRIO-23X | 3連複 | 2,3号艇含む | 16戦7勝 | **187%** |
| B11-T002 | BIWAKO-TRIO-INC5-HC | 3連複 | 5号艇含む×conf75+ | 23戦6勝 | **157%** |
| B11-T003 | BIWAKO-TRIO-24X | 3連複 | 2,4号艇含む | 10戦5勝 | **155%** |
| B11-P001 | BIWAKO-PLACE-TOP2-HC | 複勝 | 2号艇1着×conf75+ | 64戦22勝 | **111%** |
| B11-P002 | BIWAKO-PLACE-TOP1-16 | 複勝 | 1号艇1着+6号艇含む | 24戦17勝 | **103%** |
| B11-W001 | BIWAKO-WIN-TOP1-MC | 単勝 | 1号艇1着×conf60-74 | 12戦5勝 | **129%** |
| B11-W002 | BIWAKO-WIN-TOP1-13 | 単勝 | 1号艇1着+3号艇含む | 38戦28勝 | **117%** |
| B11-W003 | BIWAKO-WIN-TOP1-HC | 単勝 | 1号艇1着×conf80+ | 150戦100勝 | **102%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has2 = top3.includes(2);
  const has3 = top3.includes(3);
  const has4 = top3.includes(4);
  const has5 = top3.includes(5);
  const has6 = top3.includes(6);

  switch (ruleId) {
    case 'B11-T001':
      return has2 && has3;

    case 'B11-T002':
      return has5 && conf >= 75;

    case 'B11-T003':
      return has2 && has4;

    case 'B11-P001':
      return prediction.top_pick === 2 && conf >= 75;

    case 'B11-P002':
      return prediction.top_pick === 1 && has6;

    case 'B11-W001':
      return prediction.top_pick === 1 && conf >= 60 && conf < 75;

    case 'B11-W002':
      return prediction.top_pick === 1 && has3;

    case 'B11-W003':
      return prediction.top_pick === 1 && conf >= 80;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

B = Biwako（びわこ）の頭文字
