# 下関（会場コード: 19）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 480レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| S19-W001 | SHIMONOSEKI-WIN-TOP3-INC2 | 単勝 | 3号艇1着+2号艇含む | 20戦5勝 | **217%** |
| S19-W002 | SHIMONOSEKI-WIN-TOP5-INC3 | 単勝 | 5号艇1着+3号艇含む | 15戦3勝 | **207%** |
| S19-W003 | SHIMONOSEKI-WIN-TOP5-INC2 | 単勝 | 5号艇1着+2号艇含む | 18戦3勝 | **178%** |
| S19-W004 | SHIMONOSEKI-WIN-TOP2-INC3 | 単勝 | 2号艇1着+3号艇含む | 22戦9勝 | **166%** |
| S19-P001 | SHIMONOSEKI-PLACE-TOP4-INC5 | 複勝 | 4号艇1着+5号艇含む | 11戦6勝 | **215%** |
| S19-P002 | SHIMONOSEKI-PLACE-TOP2-INC5 | 複勝 | 2号艇1着+5号艇含む | 16戦5勝 | **168%** |
| S19-P003 | SHIMONOSEKI-PLACE-TOP4-INC6 | 複勝 | 4号艇1着+6号艇含む | 14戦6勝 | **151%** |
| S19-P004 | SHIMONOSEKI-PLACE-TOP2-HC | 複勝 | 2号艇1着×conf80+ | 47戦24勝 | **126%** |
| S19-T001 | SHIMONOSEKI-TRIO-35X | 3連複 | 3,5号艇含む | 57戦4勝 | **122%** |
| S19-T002 | SHIMONOSEKI-TRIO-23X | 3連複 | 2,3号艇含む | 117戦15勝 | **107%** |

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has2 = top3.includes(2);
  const has3 = top3.includes(3);
  const has5 = top3.includes(5);
  const has6 = top3.includes(6);

  switch (ruleId) {
    case 'S19-W001':
      return prediction.top_pick === 3 && has2;

    case 'S19-W002':
      return prediction.top_pick === 5 && has3;

    case 'S19-W003':
      return prediction.top_pick === 5 && has2;

    case 'S19-W004':
      return prediction.top_pick === 2 && has3;

    case 'S19-P001':
      return prediction.top_pick === 4 && has5;

    case 'S19-P002':
      return prediction.top_pick === 2 && has5;

    case 'S19-P003':
      return prediction.top_pick === 4 && has6;

    case 'S19-P004':
      return prediction.top_pick === 2 && conf >= 80;

    case 'S19-T001':
      return has3 && has5;

    case 'S19-T002':
      return has2 && has3;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

S19 = Shimonoseki（下関）の会場コード19

---

## 特記事項

- 3号艇・5号艇1着の単勝が高回収率（217%、207%、178%）
- 4号艇1着の複勝も有効（5,6号艇含む場合）
- 3連複は回収率がやや低め（122%、107%）
- 穴狙い（2,3,5号艇）で高回収率を狙える会場
