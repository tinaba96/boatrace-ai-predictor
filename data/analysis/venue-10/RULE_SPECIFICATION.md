# 三国（会場コード: 10）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 511レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| M10-T001 | MIKUNI-TRIO-24X | 3連複 | 2,4号艇含む | 96戦3勝 | **1865%** |
| M10-T002 | MIKUNI-TRIO-15X | 3連複 | 1,5号艇含む | 129戦6勝 | **144%** |
| M10-P001 | MIKUNI-PLACE-TOP3-INC5 | 複勝 | 3号艇1着+5号艇含む | 18戦11勝 | **391%** |
| M10-P002 | MIKUNI-PLACE-TOP3-HC | 複勝 | 3号艇1着×conf75+ | 46戦30勝 | **214%** |
| M10-P003 | MIKUNI-PLACE-TOP2-HC | 複勝 | 2号艇1着×conf75+ | 64戦43勝 | **134%** |
| M10-W001 | MIKUNI-WIN-TOP5-INC4 | 単勝 | 5号艇1着+4号艇含む | 22戦4勝 | **181%** |
| M10-W002 | MIKUNI-WIN-TOP5-HC | 単勝 | 5号艇1着×conf80+ | 43戦7勝 | **140%** |

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

  switch (ruleId) {
    case 'M10-T001':
      return has2 && has4;

    case 'M10-T002':
      return has1 && has5;

    case 'M10-P001':
      return prediction.top_pick === 3 && has5;

    case 'M10-P002':
      return prediction.top_pick === 3 && conf >= 75;

    case 'M10-P003':
      return prediction.top_pick === 2 && conf >= 75;

    case 'M10-W001':
      return prediction.top_pick === 5 && has4;

    case 'M10-W002':
      return prediction.top_pick === 5 && conf >= 80;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

M10 = Mikuni（三国）の会場コード10

---

## 特記事項

- 2,4号艇含む3連複が爆発的回収率（1865%）
- 3号艇1着の複勝も高回収率（391%、214%）
- 穴狙い（2,3,4,5号艇）で高回収率を狙える会場
