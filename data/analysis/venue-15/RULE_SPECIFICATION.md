# 丸亀（会場コード: 15）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 649レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| R15-W001 | MARUGAME-WIN-TOP6-INC3 | 単勝 | 6号艇1着+3号艇含む | 22戦3勝 | **236%** |
| R15-W002 | MARUGAME-WIN-TOP5-INC1 | 単勝 | 5号艇1着+1号艇含む | 30戦9勝 | **205%** |
| R15-W003 | MARUGAME-WIN-TOP6-INC1 | 単勝 | 6号艇1着+1号艇含む | 35戦4勝 | **153%** |
| R15-P001 | MARUGAME-PLACE-TOP5-INC2 | 複勝 | 5号艇1着+2号艇含む | 25戦12勝 | **222%** |
| R15-P002 | MARUGAME-PLACE-TOP5-INC1 | 複勝 | 5号艇1着+1号艇含む | 30戦15勝 | **193%** |
| R15-P003 | MARUGAME-PLACE-TOP3-INC2 | 複勝 | 3号艇1着+2号艇含む | 33戦25勝 | **165%** |
| R15-P004 | MARUGAME-PLACE-TOP5 | 複勝 | 5号艇1着 | 56戦24勝 | **147%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has2 = top3.includes(2);
  const has3 = top3.includes(3);

  switch (ruleId) {
    case 'R15-W001':
      return prediction.top_pick === 6 && has3;

    case 'R15-W002':
      return prediction.top_pick === 5 && has1;

    case 'R15-W003':
      return prediction.top_pick === 6 && has1;

    case 'R15-P001':
      return prediction.top_pick === 5 && has2;

    case 'R15-P002':
      return prediction.top_pick === 5 && has1;

    case 'R15-P003':
      return prediction.top_pick === 3 && has2;

    case 'R15-P004':
      return prediction.top_pick === 5;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

R15 = Marugame（丸亀）の会場コード15

---

## 特記事項

- 3連複は回収率100%超のルールがサンプル10以上で見つからなかったため、対象外
- 5号艇1着の単勝・複勝が非常に高回収率
- 6号艇1着の単勝も有効
- 穴狙い（5,6号艇）で高回収率を狙える会場
