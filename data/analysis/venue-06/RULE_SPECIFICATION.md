# 浜名湖（会場コード: 06）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 474レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| H06-T001 | HAMANAKO-TRIO-INC3-MC | 3連複 | 3号艇含む×conf60-74 | 10戦2勝 | **405%** |
| H06-T002 | HAMANAKO-TRIO-INC3-LC | 3連複 | 3号艇含む×conf80未満 | 30戦8勝 | **205%** |
| H06-T003 | HAMANAKO-TRIO-35X | 3連複 | 3,5号艇含む | 10戦2勝 | **100%** |
| H06-P001 | HAMANAKO-PLACE-TOP1-14 | 複勝 | 1号艇1着+4号艇含む | 53戦39勝 | **114%** |
| H06-P002 | HAMANAKO-PLACE-TOP1-12 | 複勝 | 1号艇1着+2号艇含む | 68戦49勝 | **104%** |
| H06-P003 | HAMANAKO-PLACE-TOP1-15 | 複勝 | 1号艇1着+5号艇含む | 22戦15勝 | **102%** |
| H06-W001 | HAMANAKO-WIN-TOP1-MC | 単勝 | 1号艇1着×conf60-74 | 13戦7勝 | **122%** |
| H06-W002 | HAMANAKO-WIN-TOP1-HC | 単勝 | 1号艇1着×conf80+ | 185戦124勝 | **102%** |

---

## 3連複ルール

### H06-T001: 3号艇含む × 信頼度60-74

**回収率: 405% | サンプル: 10戦2勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "06",
  model_id: "standard",
  has3: true,  // [top_pick, top_2nd, top_3rd].includes(3)
  confidence: { min: 60, max: 74 }
};

// 賭け方
const betType = "trio";  // 3連複
```

---

### H06-T002: 3号艇含む × 信頼度80未満

**回収率: 205% | サンプル: 30戦8勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "06",
  model_id: "standard",
  has3: true,
  confidence: { max: 79 }
};

// 賭け方
const betType = "trio";  // 3連複
```

---

## 複勝ルール

### H06-P001: 1号艇1着 + 4号艇含む

**回収率: 114% | サンプル: 53戦39勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "06",
  model_id: "standard",
  top_pick: 1,
  has4: true
};

// 賭け方
const betType = "place";  // 複勝
```

---

## 単勝ルール

### H06-W001: 1号艇1着 × 信頼度60-74

**回収率: 122% | サンプル: 13戦7勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "06",
  model_id: "standard",
  top_pick: 1,
  confidence: { min: 60, max: 74 }
};

// 賭け方
const betType = "win";  // 単勝
```

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

  switch (ruleId) {
    case 'H06-T001':
      return has3 && conf >= 60 && conf < 75;

    case 'H06-T002':
      return has3 && conf < 80;

    case 'H06-T003':
      return has3 && has5;

    case 'H06-P001':
      return prediction.top_pick === 1 && has4;

    case 'H06-P002':
      return prediction.top_pick === 1 && has2;

    case 'H06-P003':
      return prediction.top_pick === 1 && has5;

    case 'H06-W001':
      return prediction.top_pick === 1 && conf >= 60 && conf < 75;

    case 'H06-W002':
      return prediction.top_pick === 1 && conf >= 80;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

```
H06-T001
│   │
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```

H = Hamanako（浜名湖）の頭文字
