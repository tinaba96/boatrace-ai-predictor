# 浜名湖（会場コード: 06）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 624レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| H06-T001 | HAMANAKO-TRIO-26X | 3連複 | 2,6号艇含む | 94戦6勝 | **485%** |
| H06-T002 | HAMANAKO-TRIO-36X | 3連複 | 3,6号艇含む | 87戦2勝 | **475%** |
| H06-T003 | HAMANAKO-TRIO-23X | 3連複 | 2,3号艇含む | 140戦14勝 | **396%** |
| H06-W001 | HAMANAKO-WIN-TOP3-INC2 | 単勝 | 3号艇1着+2号艇含む | 33戦10勝 | **231%** |
| H06-W002 | HAMANAKO-WIN-TOP3-INC1 | 単勝 | 3号艇1着+1号艇含む | 46戦12勝 | **181%** |
| H06-W003 | HAMANAKO-WIN-TOP3 | 単勝 | 3号艇1着 | 78戦20勝 | **139%** |
| H06-P001 | HAMANAKO-PLACE-TOP4-INC5 | 複勝 | 4号艇1着+5号艇含む | 15戦8勝 | **215%** |
| H06-P002 | HAMANAKO-PLACE-TOP3-INC6 | 複勝 | 3号艇1着+6号艇含む | 27戦18勝 | **186%** |
| H06-P003 | HAMANAKO-PLACE-TOP3-HC | 複勝 | 3号艇1着×conf75+ | 64戦40勝 | **141%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has2 = top3.includes(2);
  const has3 = top3.includes(3);
  const has5 = top3.includes(5);
  const has6 = top3.includes(6);

  switch (ruleId) {
    case 'H06-T001':
      return has2 && has6;

    case 'H06-T002':
      return has3 && has6;

    case 'H06-T003':
      return has2 && has3;

    case 'H06-W001':
      return prediction.top_pick === 3 && has2;

    case 'H06-W002':
      return prediction.top_pick === 3 && has1;

    case 'H06-W003':
      return prediction.top_pick === 3;

    case 'H06-P001':
      return prediction.top_pick === 4 && has5;

    case 'H06-P002':
      return prediction.top_pick === 3 && has6;

    case 'H06-P003':
      return prediction.top_pick === 3 && conf >= 75;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

H06 = Hamanako（浜名湖）の会場コード06

---

## 特記事項

- 6号艇絡みの3連複が超高回収率（485%、475%）
- 3号艇1着の単勝・複勝も有効
- 穴狙い（2,3,6号艇）で高回収率を狙える会場
