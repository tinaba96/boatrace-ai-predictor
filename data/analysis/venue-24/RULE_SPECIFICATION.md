# 大村（会場コード: 24）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-08
**サンプル数**: 409レース

---

## データソース

### 使用テーブル

| テーブル | 用途 |
|---------|------|
| `predictions` | AI予測結果 |
| `race_results` | レース結果・払戻金 |
| `race_entries` | 出走選手情報 |

### 主要カラム

#### predictions
```
race_id: string      # "YYYY-MM-DD-VV-RR" 形式（VV=会場コード, RR=レース番号）
model_id: string     # "standard" | "safeBet" | "upsetFocus"
top_pick: number     # 1着予測の艇番 (1-6)
top_2nd: number      # 2着予測の艇番 (1-6)
top_3rd: number      # 3着予測の艇番 (1-6)
confidence: number   # 信頼度 (0-100)
```

#### race_results
```
race_id: string
rank1: number        # 1着の艇番
rank2: number        # 2着の艇番
rank3: number        # 3着の艇番
payout_win: number   # 単勝払戻金
payout_place_1: number  # 複勝払戻金（1着艇）
payout_place_2: number  # 複勝払戻金（2着艇）
payout_trio: number  # 3連複払戻金
```

---

## ルール一覧サマリー

| ID | 賭け方 | 条件 | サンプル | 回収率 | 信頼性 |
|----|--------|------|---------|--------|--------|
| O24-T001 | trio | 1,3,5号艇 | 30 | **1044%** | 高 |
| O24-T002 | trio | 1,2,4号艇 | 63 | **871%** | 最高 |
| O24-T003 | trio | 3,5号艇含む | 43 | **833%** | 高 |
| O24-T004 | trio | 後半R×1号艇含む | 94 | **760%** | 最高 |
| O24-T005 | trio | 2,4号艇含む | 82 | **669%** | 最高 |
| O24-T006 | trio | 後半R(10R〜) | 107 | **668%** | 最高 |
| O24-T007 | trio | 1,4号艇含む | 136 | **647%** | 最高 |
| O24-T008 | trio | 1,3,6号艇 | 21 | **602%** | 中 |
| O24-T009 | trio | 1,2,6号艇 | 41 | **519%** | 高 |
| O24-T010 | trio | 4,5号艇含む | 22 | **502%** | 中 |
| O24-T011 | trio | 1,3号艇含む | 166 | **488%** | 最高 |
| O24-T012 | trio | 1,6号艇含む | 93 | **461%** | 最高 |
| O24-T013 | trio | 1号艇含む×conf80+ | 309 | **459%** | 最高 |
| O24-T014 | trio | 1,2号艇含む | 228 | **441%** | 最高 |
| O24-T015 | trio | 1,5号艇含む | 101 | **425%** | 最高 |
| O24-T016 | trio | 1,4,6号艇 | 21 | **425%** | 中 |
| O24-T017 | trio | 1,3,4号艇 | 45 | **393%** | 高 |
| O24-T018 | trio | 2,6号艇含む | 55 | **387%** | 最高 |
| O24-T019 | trio | 3,6号艇含む | 33 | **383%** | 高 |
| O24-T020 | trio | 3,4号艇含む | 62 | **358%** | 最高 |
| O24-T021 | trio | 4,6号艇含む | 32 | **279%** | 高 |
| O24-T022 | trio | 1,2,3号艇 | 70 | **277%** | 最高 |
| O24-T023 | trio | 2,3号艇含む | 84 | **230%** | 最高 |
| O24-P001 | place | 6号艇1着+1号艇含む(複勝) | 16 | **131%** | 中 |
| O24-P002 | place | 4号艇1着+1号艇含む(複勝) | 17 | **123%** | 中 |
| O24-W001 | win | 3号艇1着+5号艇含む | 11 | **119%** | 低 |
| O24-T024 | trio | 1号艇含まない×conf80+ | 39 | **115%** | 高 |
| O24-P003 | place | 1号艇1着(複勝) | 255 | **113%** | 最高 |
| O24-P004 | place | 6号艇1着(複勝) | 19 | **110%** | 中 |
| O24-W002 | win | 1号艇1着+5号艇含む | 60 | **109%** | 最高 |
| O24-W003 | win | 6号艇1着+1号艇含む | 16 | **108%** | 中 |
| O24-P005 | place | 3号艇1着+1号艇含む(複勝) | 18 | **102%** | 中 |
| O24-P006 | place | 4号艇1着×conf80+(複勝) | 20 | **101%** | 中 |
| O24-P007 | place | 6号艇1着×conf80+(複勝) | 15 | **101%** | 中 |

---

## ルール詳細

### O24-T001: 1,3,5号艇

**回収率: 1044% | サンプル: 30戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-5"
};

// 賭け方
const betType = "trio";
```

---

### O24-T002: 1,2,4号艇

**回収率: 871% | サンプル: 63戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### O24-T003: 3,5号艇含む

**回収率: 833% | サンプル: 43戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    3,
    5
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T004: 後半R×1号艇含む

**回収率: 760% | サンプル: 94戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "race_number": {
    "min": 10,
    "max": 12
  },
  "includes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### O24-T005: 2,4号艇含む

**回収率: 669% | サンプル: 82戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    2,
    4
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T006: 後半R(10R〜)

**回収率: 668% | サンプル: 107戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "race_number": {
    "min": 10,
    "max": 12
  }
};

// 賭け方
const betType = "trio";
```

---

### O24-T007: 1,4号艇含む

**回収率: 647% | サンプル: 136戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    1,
    4
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T008: 1,3,6号艇

**回収率: 602% | サンプル: 21戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### O24-T009: 1,2,6号艇

**回収率: 519% | サンプル: 41戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-6"
};

// 賭け方
const betType = "trio";
```

---

### O24-T010: 4,5号艇含む

**回収率: 502% | サンプル: 22戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    4,
    5
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T011: 1,3号艇含む

**回収率: 488% | サンプル: 166戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    1,
    3
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T012: 1,6号艇含む

**回収率: 461% | サンプル: 93戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    1,
    6
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T013: 1号艇含む×conf80+

**回収率: 459% | サンプル: 309戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "confidence": {
    "min": 80
  },
  "includes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### O24-T014: 1,2号艇含む

**回収率: 441% | サンプル: 228戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    1,
    2
  ]
};

// 賭け方
const betType = "trio";
```

---

### O24-T015: 1,5号艇含む

**回収率: 425% | サンプル: 101戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    1,
    5
  ]
};

// 賭け方
const betType = "trio";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_24(prediction, ruleId) {
  const raceNo = parseInt(prediction.race_id.split('-')[4]);
  const conf = prediction.confidence || 0;
  const predSorted = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd]
    .sort((a, b) => a - b).join('-');
  const has1 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd].includes(1);

  // ルール別の条件チェック
  // ※各ルールの条件に応じて実装
  return false;
}
```

---

## ルールID命名規則

```
O24-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
