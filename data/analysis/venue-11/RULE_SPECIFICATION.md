# びわこ（会場コード: 11）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 534レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| B11-T001 | BIWAKO-TRIO-56X | 3連複 | 5,6号艇含む | 59戦4勝 | **185%** |
| B11-T002 | BIWAKO-TRIO-46X | 3連複 | 4,6号艇含む | 67戦5勝 | **174%** |
| B11-T003 | BIWAKO-TRIO-16X | 3連複 | 1,6号艇含む | 127戦8勝 | **131%** |
| B11-W001 | BIWAKO-WIN-TOP6-INC2 | 単勝 | 6号艇1着+2号艇含む | 22戦5勝 | **162%** |
| B11-W002 | BIWAKO-WIN-TOP2-INC4 | 単勝 | 2号艇1着+4号艇含む | 25戦12勝 | **160%** |
| B11-W003 | BIWAKO-WIN-TOP1-MC | 単勝 | 1号艇1着×conf60-74 | 13戦6勝 | **132%** |
| B11-P001 | BIWAKO-PLACE-TOP2-INC4 | 複勝 | 2号艇1着+4号艇含む | 25戦17勝 | **127%** |
| B11-P002 | BIWAKO-PLACE-TOP4-INC5 | 複勝 | 4号艇1着+5号艇含む | 17戦11勝 | **122%** |
| B11-P003 | BIWAKO-PLACE-TOP1-INC2 | 複勝 | 1号艇1着+2号艇含む | 124戦105勝 | **116%** |

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
    case 'B11-T001':
      return has5 && has6;

    case 'B11-T002':
      return has4 && has6;

    case 'B11-T003':
      return has1 && has6;

    case 'B11-W001':
      return prediction.top_pick === 6 && has2;

    case 'B11-W002':
      return prediction.top_pick === 2 && has4;

    case 'B11-W003':
      return prediction.top_pick === 1 && conf >= 60 && conf < 75;

    case 'B11-P001':
      return prediction.top_pick === 2 && has4;

    case 'B11-P002':
      return prediction.top_pick === 4 && has5;

    case 'B11-P003':
      return prediction.top_pick === 1 && has2;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

B11 = Biwako（びわこ）の会場コード11

---

## 特記事項

- 6号艇絡みの3連複が高回収率（185%、174%）
- 2号艇と4号艇の組み合わせが単勝・複勝ともに有効
- 穴狙い（4,5,6号艇）で高回収率を狙える会場
