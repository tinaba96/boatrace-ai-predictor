# 三国（会場コード: 10）ルール実装仕様書

## 概要

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 454レース

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| M10-T001 | MIKUNI-TRIO-INC5-HC | 3連複 | 5号艇含む×conf75+ | 45戦7勝 | **134%** |
| M10-T002 | MIKUNI-TRIO-13X-LATE | 3連複 | 1,3号艇含む×7R以降 | 50戦33勝 | **102%** |
| M10-P001 | MIKUNI-PLACE-TOP1-HC | 複勝 | 1号艇1着×conf80+ | 180戦110勝 | **110%** |
| M10-P002 | MIKUNI-PLACE-TOP1-LATE | 複勝 | 1号艇1着×9R以降 | 90戦55勝 | **112%** |
| M10-W001 | MIKUNI-WIN-TOP2-SUB1 | 単勝 | 2号艇1着+1号艇2着 | 26戦10勝 | **105%** |
| M10-W002 | MIKUNI-WIN-TOP1-MID-HC | 単勝 | 1号艇1着×5R以降×conf75+ | 120戦65勝 | **113%** |

---

## 単勝ルール

### M10-W001: 2号艇1着 + 1号艇2着予測

**回収率: 105% | サンプル: 26戦10勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  top_pick: 2,   // 1着予測が2号艇
  top_2nd: 1     // 2着予測が1号艇
};

// 賭け方
const betType = "win";  // 単勝（2号艇）
```

---

### M10-W002: 1号艇1着 × 5R以降 × 信頼度75↑

**回収率: 113% | サンプル: 120戦65勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  top_pick: 1,
  raceNo: { min: 5, max: 12 },
  confidence: { min: 75 }
};

// 賭け方
const betType = "win";  // 単勝
```

---

## 複勝ルール

### M10-P001: 1号艇1着 × 信頼度80↑

**回収率: 110% | サンプル: 180戦110勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  top_pick: 1,
  confidence: { min: 80 }
};

// 賭け方
const betType = "place";  // 複勝

// 的中判定（1着または2着に入れば的中）
const isHit = (rank1 === top_pick || rank2 === top_pick);
```

---

### M10-P002: 1号艇1着 × 後半レース

**回収率: 112% | サンプル: 90戦55勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  top_pick: 1,
  raceNo: { min: 9, max: 12 }
};

// 賭け方
const betType = "place";  // 複勝
```

---

## 3連複ルール

### M10-T001: 5号艇含む × 信頼度75↑

**回収率: 134% | サンプル: 45戦7勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  has5: true,  // [top_pick, top_2nd, top_3rd].includes(5)
  confidence: { min: 75 }
};

// 賭け方
const betType = "trio";  // 3連複

// 的中判定
const isHit = (predSorted === resultSorted);
```

---

### M10-T002: 1,3号艇含む × 7R以降

**回収率: 102% | サンプル: 50戦33勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "10",
  model_id: "standard",
  has1: true,
  has3: true,
  raceNo: { min: 7, max: 12 }
};

// 賭け方
const betType = "trio";  // 3連複
```

---

## 実装例

```javascript
function shouldBet(prediction, ruleId) {
  const raceNo = parseInt(prediction.race_id.split('-')[4]);
  const conf = prediction.confidence || 0;
  const top3 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd];
  const has1 = top3.includes(1);
  const has3 = top3.includes(3);
  const has5 = top3.includes(5);

  switch (ruleId) {
    case 'M10-W001':
      return prediction.top_pick === 2 && prediction.top_2nd === 1;

    case 'M10-W002':
      return prediction.top_pick === 1 && raceNo >= 5 && conf >= 75;

    case 'M10-P001':
      return prediction.top_pick === 1 && conf >= 80;

    case 'M10-P002':
      return prediction.top_pick === 1 && raceNo >= 9;

    case 'M10-T001':
      return has5 && conf >= 75;

    case 'M10-T002':
      return has1 && has3 && raceNo >= 7;

    default:
      return false;
  }
}
```

---

## ルールID命名規則

```
M10-T001
│   │
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```

M = Mikuni（三国）の頭文字
