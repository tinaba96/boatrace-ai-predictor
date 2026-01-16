# 宮島（会場コード: 17）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-13
**サンプル数**: 462レース

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
| MY17-T001 | trio | 1,5,6号艇 | 21 | **1710%** | 中 |
| MY17-T002 | trio | 1,2,6号艇 | 30 | **1129%** | 高 |
| MY17-T003 | trio | 1,6号艇含む | 101 | **780%** | 最高 |
| MY17-T004 | trio | 5,6号艇含む | 55 | **779%** | 最高 |
| MY17-T005 | trio | 4,5,6号艇 | 10 | **697%** | 低 |
| MY17-T006 | trio | 1,2,5号艇 | 39 | **652%** | 高 |
| MY17-T007 | trio | 1,5号艇含む | 116 | **576%** | 最高 |
| MY17-T008 | trio | 1,2号艇含む | 184 | **575%** | 最高 |
| MY17-T009 | trio | 2,6号艇含む | 60 | **564%** | 最高 |
| MY17-T010 | trio | 1,2,3号艇 | 68 | **484%** | 最高 |
| MY17-T011 | trio | 1号艇含む×conf80+ | 292 | **461%** | 最高 |
| MY17-T012 | trio | 2,5号艇含む | 73 | **403%** | 最高 |
| MY17-T013 | trio | 2,3号艇含む | 103 | **367%** | 最高 |
| MY17-T014 | trio | 1,2,4号艇 | 47 | **289%** | 高 |
| MY17-T015 | trio | 2,3,5号艇 | 14 | **285%** | 低 |
| MY17-T016 | trio | 1,3号艇含む | 172 | **283%** | 最高 |
| MY17-T017 | trio | 1,3,6号艇 | 29 | **279%** | 中 |
| MY17-T018 | trio | 後半R×1号艇含む | 88 | **257%** | 最高 |
| MY17-T019 | trio | 後半R(10R〜) | 113 | **200%** | 最高 |
| MY17-T020 | trio | 4,5号艇含む | 46 | **186%** | 高 |
| MY17-T021 | trio | 2,4号艇含む | 82 | **176%** | 最高 |
| MY17-T022 | trio | 1,4号艇含む | 121 | **164%** | 最高 |
| MY17-T023 | trio | 4,6号艇含む | 58 | **137%** | 最高 |
| MY17-T024 | trio | 3,6号艇含む | 62 | **130%** | 最高 |
| MY17-P001 | place | 4号艇1着+6号艇含む(複勝) | 11 | **129%** | 低 |
| MY17-P002 | place | 3号艇1着+1号艇含む(複勝) | 44 | **125%** | 高 |
| MY17-W001 | win | 1号艇1着×後半R | 56 | **121%** | 最高 |
| MY17-P003 | place | 1号艇1着(複勝) | 190 | **114%** | 最高 |
| MY17-W002 | win | 5号艇1着+2号艇含む | 17 | **109%** | 中 |
| MY17-W003 | win | 3号艇1着+5号艇含む | 27 | **108%** | 中 |
| MY17-W004 | win | 1号艇1着+3号艇含む | 95 | **105%** | 最高 |
| MY17-P004 | place | 5号艇1着+6号艇含む(複勝) | 18 | **105%** | 中 |
| MY17-P005 | place | 6号艇1着+1号艇含む(複勝) | 16 | **104%** | 中 |
| MY17-T025 | trio | 3,5号艇含む | 76 | **104%** | 最高 |
| MY17-T026 | trio | 1,3,4号艇 | 36 | **103%** | 高 |
| MY17-T027 | trio | 1号艇含まない | 115 | **103%** | 最高 |
| MY17-W005 | win | 3号艇1着+1号艇含む | 44 | **101%** | 高 |
| MY17-P006 | place | 3号艇1着(複勝) | 73 | **101%** | 最高 |
| MY17-P007 | place | 3号艇1着×conf80+(複勝) | 61 | **100%** | 最高 |

---

## ルール詳細

### MY17-T001: 1,5,6号艇

**回収率: 1710% | サンプル: 21戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T002: 1,2,6号艇

**回収率: 1129% | サンプル: 30戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-6"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T003: 1,6号艇含む

**回収率: 780% | サンプル: 101戦 | 信頼性: 最高**

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

### MY17-T004: 5,6号艇含む

**回収率: 779% | サンプル: 55戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    5,
    6
  ]
};

// 賭け方
const betType = "trio";
```

---

### MY17-T005: 4,5,6号艇

**回収率: 697% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "4-5-6"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T006: 1,2,5号艇

**回収率: 652% | サンプル: 39戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-5"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T007: 1,5号艇含む

**回収率: 576% | サンプル: 116戦 | 信頼性: 最高**

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

### MY17-T008: 1,2号艇含む

**回収率: 575% | サンプル: 184戦 | 信頼性: 最高**

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

### MY17-T009: 2,6号艇含む

**回収率: 564% | サンプル: 60戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    2,
    6
  ]
};

// 賭け方
const betType = "trio";
```

---

### MY17-T010: 1,2,3号艇

**回収率: 484% | サンプル: 68戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T011: 1号艇含む×conf80+

**回収率: 461% | サンプル: 292戦 | 信頼性: 最高**

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

### MY17-T012: 2,5号艇含む

**回収率: 403% | サンプル: 73戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    2,
    5
  ]
};

// 賭け方
const betType = "trio";
```

---

### MY17-T013: 2,3号艇含む

**回収率: 367% | サンプル: 103戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    2,
    3
  ]
};

// 賭け方
const betType = "trio";
```

---

### MY17-T014: 1,2,4号艇

**回収率: 289% | サンプル: 47戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### MY17-T015: 2,3,5号艇

**回収率: 285% | サンプル: 14戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-5"
};

// 賭け方
const betType = "trio";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_17(prediction, ruleId) {
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
MY17-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
