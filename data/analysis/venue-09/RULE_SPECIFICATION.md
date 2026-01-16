# 津（会場コード: 09）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-06 〜 2026-01-13
**サンプル数**: 316レース

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
| TS09-T001 | trio | 1,3,4号艇 | 32 | **764%** | 高 |
| TS09-T002 | trio | 3,4号艇含む | 51 | **588%** | 最高 |
| TS09-T003 | trio | 1,2,6号艇 | 28 | **442%** | 中 |
| TS09-T004 | trio | 1,4号艇含む | 97 | **404%** | 最高 |
| TS09-T005 | trio | 1,3号艇含む | 127 | **397%** | 最高 |
| TS09-T006 | trio | 2,3号艇含む | 64 | **363%** | 最高 |
| TS09-T007 | trio | 1,2,3号艇 | 49 | **361%** | 高 |
| TS09-T008 | trio | 1,2,4号艇 | 32 | **359%** | 高 |
| TS09-T009 | trio | 2,4号艇含む | 53 | **338%** | 最高 |
| TS09-T010 | trio | 1,2号艇含む | 148 | **314%** | 最高 |
| TS09-T011 | trio | 2,6号艇含む | 40 | **309%** | 高 |
| TS09-T012 | trio | 1号艇含む×conf80+ | 224 | **303%** | 最高 |
| TS09-W001 | win | 5号艇1着×conf80+ | 13 | **289%** | 低 |
| TS09-T013 | trio | 1,3,5号艇 | 23 | **229%** | 中 |
| TS09-W002 | win | 5号艇1着 | 17 | **221%** | 中 |
| TS09-T014 | trio | 1,6号艇含む | 76 | **202%** | 最高 |
| TS09-T015 | trio | 1号艇含まない×conf80+ | 36 | **178%** | 高 |
| TS09-T016 | trio | 1,4,5号艇 | 19 | **173%** | 中 |
| TS09-T017 | trio | 1,5号艇含む | 92 | **146%** | 最高 |
| TS09-T018 | trio | 3,5号艇含む | 37 | **142%** | 高 |
| TS09-T019 | trio | 1号艇含まない | 46 | **140%** | 高 |
| TS09-T020 | trio | 1,3,6号艇 | 23 | **128%** | 中 |
| TS09-P001 | place | 3号艇1着×conf80+(複勝) | 28 | **125%** | 中 |
| TS09-T021 | trio | 1,2,5号艇 | 39 | **125%** | 高 |
| TS09-W003 | win | 1号艇1着+5号艇含む | 55 | **118%** | 最高 |
| TS09-P002 | place | 3号艇1着(複勝) | 35 | **115%** | 高 |
| TS09-P003 | place | 4号艇1着+3号艇含む(複勝) | 11 | **115%** | 低 |
| TS09-T022 | trio | 4,5号艇含む | 36 | **115%** | 高 |
| TS09-P004 | place | 1号艇1着(複勝) | 172 | **106%** | 最高 |
| TS09-T023 | trio | 2,5号艇含む | 55 | **104%** | 最高 |
| TS09-P005 | place | 2号艇1着+1号艇含む(複勝) | 27 | **103%** | 中 |
| TS09-P006 | place | 4号艇1着×conf80+(複勝) | 23 | **102%** | 中 |
| TS09-T024 | trio | 3,6号艇含む | 29 | **102%** | 中 |
| TS09-W004 | win | 1号艇1着+4号艇含む | 64 | **100%** | 最高 |

---

## ルール詳細

### TS09-T001: 1,3,4号艇

**回収率: 764% | サンプル: 32戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### TS09-T002: 3,4号艇含む

**回収率: 588% | サンプル: 51戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    3,
    4
  ]
};

// 賭け方
const betType = "trio";
```

---

### TS09-T003: 1,2,6号艇

**回収率: 442% | サンプル: 28戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-6"
};

// 賭け方
const betType = "trio";
```

---

### TS09-T004: 1,4号艇含む

**回収率: 404% | サンプル: 97戦 | 信頼性: 最高**

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

### TS09-T005: 1,3号艇含む

**回収率: 397% | サンプル: 127戦 | 信頼性: 最高**

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

### TS09-T006: 2,3号艇含む

**回収率: 363% | サンプル: 64戦 | 信頼性: 最高**

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

### TS09-T007: 1,2,3号艇

**回収率: 361% | サンプル: 49戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### TS09-T008: 1,2,4号艇

**回収率: 359% | サンプル: 32戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### TS09-T009: 2,4号艇含む

**回収率: 338% | サンプル: 53戦 | 信頼性: 最高**

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

### TS09-T010: 1,2号艇含む

**回収率: 314% | サンプル: 148戦 | 信頼性: 最高**

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

### TS09-T011: 2,6号艇含む

**回収率: 309% | サンプル: 40戦 | 信頼性: 高**

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

### TS09-T012: 1号艇含む×conf80+

**回収率: 303% | サンプル: 224戦 | 信頼性: 最高**

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

### TS09-W001: 5号艇1着×conf80+

**回収率: 289% | サンプル: 13戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "top_pick": 5,
  "confidence": {
    "min": 80
  }
};

// 賭け方
const betType = "win";
```

---

### TS09-T013: 1,3,5号艇

**回収率: 229% | サンプル: 23戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-5"
};

// 賭け方
const betType = "trio";
```

---

### TS09-W002: 5号艇1着

**回収率: 221% | サンプル: 17戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "top_pick": 5
};

// 賭け方
const betType = "win";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_09(prediction, ruleId) {
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
TS09-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
