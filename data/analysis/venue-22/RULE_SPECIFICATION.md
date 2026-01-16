# 福岡（会場コード: 22）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 444レース（詳細分析）

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| F22-W001 | FUKUOKA-WIN-TOP4-INC2 | 単勝 | 4号艇1着+2号艇含む | 13戦5勝 | **324%** |
| F22-W002 | FUKUOKA-WIN-TOP4 | 単勝 | 4号艇1着 | 27戦11勝 | **227%** |
| F22-W003 | FUKUOKA-WIN-TOP2-INC1 | 単勝 | 2号艇1着+1号艇含む | 29戦14勝 | **156%** |
| F22-T001 | FUKUOKA-TRIO-45X | 3連複 | 4,5号艇含む | 44戦4勝 | **222%** |
| F22-T002 | FUKUOKA-TRIO-NO1-HC | 3連複 | 1号艇含まない×conf80+ | 56戦4勝 | **193%** |
| F22-T003 | FUKUOKA-TRIO-24X | 3連複 | 2,4号艇含む | 70戦6勝 | **178%** |
| F22-P001 | FUKUOKA-PLACE-TOP5-INC4 | 複勝 | 5号艇1着+4号艇含む | 20戦11勝 | **131%** |
| F22-P002 | FUKUOKA-PLACE-TOP6-INC1 | 複勝 | 6号艇1着+1号艇含む | 19戦8勝 | **124%** |
| F22-P003 | FUKUOKA-PLACE-TOP4-INC1 | 複勝 | 4号艇1着+1号艇含む | 17戦11勝 | **120%** |

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
    case 'F22-W001':
      return prediction.top_pick === 4 && has2;

    case 'F22-W002':
      return prediction.top_pick === 4;

    case 'F22-W003':
      return prediction.top_pick === 2 && has1;

    case 'F22-T001':
      return has4 && has5;

    case 'F22-T002':
      return !has1 && conf >= 80;

    case 'F22-T003':
      return has2 && has4;

    case 'F22-P001':
      return prediction.top_pick === 5 && has4;

    case 'F22-P002':
      return prediction.top_pick === 6 && has1;

    case 'F22-P003':
      return prediction.top_pick === 4 && has1;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

F22 = Fukuoka（福岡）の会場コード22

---

## 特記事項

- 4号艇1着の単勝が超高回収率（324%、227%）
- 4,5号艇絡みの3連複が有効
- 1号艇を含まない3連複も高回収率
- 穴狙い（4,5,6号艇）で高回収率を狙える会場
