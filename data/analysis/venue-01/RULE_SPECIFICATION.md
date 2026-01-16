# 桐生（会場コード: 01）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-16
**サンプル数**: 302レース

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
| K01-T001 | trio | 5,6号艇含む | 18 | **1850%** | 中 |
| K01-T002 | trio | 4,5号艇含む | 24 | **1755%** | 中 |
| K01-T003 | trio | 4,6号艇含む | 29 | **1325%** | 中 |
| K01-T004 | trio | 1,3,6号艇 | 17 | **986%** | 中 |
| K01-T005 | trio | 1号艇含まない×conf80+ | 35 | **951%** | 高 |
| K01-T006 | trio | 1号艇含まない | 41 | **812%** | 高 |
| K01-T007 | trio | 1,4,5号艇 | 15 | **589%** | 中 |
| K01-T008 | trio | 3,6号艇含む | 29 | **578%** | 中 |
| K01-T009 | trio | 1,2,4号艇 | 32 | **447%** | 高 |
| K01-T010 | trio | 1,3号艇含む | 131 | **392%** | 最高 |
| K01-T011 | trio | 1,6号艇含む | 67 | **378%** | 最高 |
| K01-T012 | trio | 1,4号艇含む | 98 | **376%** | 最高 |
| K01-T013 | trio | 1号艇含む×conf80+ | 220 | **342%** | 最高 |
| K01-T014 | trio | 1,3,5号艇 | 29 | **341%** | 中 |
| K01-T015 | trio | 1,5号艇含む | 86 | **310%** | 最高 |
| K01-T016 | trio | 1,2号艇含む | 140 | **299%** | 最高 |
| K01-T017 | trio | 1,2,3号艇 | 54 | **299%** | 最高 |
| K01-T018 | trio | 2,4号艇含む | 48 | **298%** | 高 |
| K01-T019 | trio | 1,3,4号艇 | 31 | **275%** | 高 |
| K01-T020 | trio | 1,4,6号艇 | 20 | **256%** | 中 |
| K01-T021 | trio | 1,2,5号艇 | 33 | **241%** | 高 |
| K01-T022 | trio | 2,3号艇含む | 70 | **230%** | 最高 |
| K01-T023 | trio | 後半R×1号艇含む | 69 | **229%** | 最高 |
| K01-T024 | trio | 3,5号艇含む | 45 | **220%** | 高 |
| K01-T025 | trio | 後半R(10R〜) | 77 | **205%** | 最高 |
| K01-T026 | trio | 3,4号艇含む | 45 | **190%** | 高 |
| K01-T027 | trio | 2,5号艇含む | 47 | **169%** | 高 |
| K01-T028 | trio | 1,2,6号艇 | 21 | **164%** | 中 |
| K01-W001 | win | 3号艇1着+1号艇含む | 14 | **151%** | 低 |
| K01-P001 | place | 6号艇1着+1号艇含む(複勝) | 13 | **122%** | 低 |
| K01-P002 | place | 2号艇1着+1号艇含む(複勝) | 24 | **121%** | 中 |
| K01-T029 | trio | 2,6号艇含む | 29 | **119%** | 中 |
| K01-P003 | place | 2号艇1着×conf80+(複勝) | 23 | **116%** | 中 |
| K01-P004 | place | 2号艇1着(複勝) | 30 | **113%** | 高 |
| K01-P005 | place | 4号艇1着×conf80+(複勝) | 18 | **113%** | 中 |
| K01-W002 | win | 1号艇1着+4号艇含む | 67 | **105%** | 最高 |
| K01-P006 | place | 1号艇1着(複勝) | 186 | **105%** | 最高 |
| K01-P007 | place | 3号艇1着+1号艇含む(複勝) | 14 | **102%** | 低 |

---

## ルール詳細

### K01-T001: 5,6号艇含む

**回収率: 1850% | サンプル: 18戦 | 信頼性: 中**

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

### K01-T002: 4,5号艇含む

**回収率: 1755% | サンプル: 24戦 | 信頼性: 中**

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

### K01-T003: 4,6号艇含む

**回収率: 1325% | サンプル: 29戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    4,
    6
  ]
};

// 賭け方
const betType = "trio";
```

---

### K01-T004: 1,3,6号艇

**回収率: 986% | サンプル: 17戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### K01-T005: 1号艇含まない×conf80+

**回収率: 951% | サンプル: 35戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "confidence": {
    "min": 80
  },
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### K01-T006: 1号艇含まない

**回収率: 812% | サンプル: 41戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### K01-T007: 1,4,5号艇

**回収率: 589% | サンプル: 15戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### K01-T008: 3,6号艇含む

**回収率: 578% | サンプル: 29戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "includes_boats": [
    3,
    6
  ]
};

// 賭け方
const betType = "trio";
```

---

### K01-T009: 1,2,4号艇

**回収率: 447% | サンプル: 32戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### K01-T010: 1,3号艇含む

**回収率: 392% | サンプル: 131戦 | 信頼性: 最高**

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

### K01-T011: 1,6号艇含む

**回収率: 378% | サンプル: 67戦 | 信頼性: 最高**

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

### K01-T012: 1,4号艇含む

**回収率: 376% | サンプル: 98戦 | 信頼性: 最高**

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

### K01-T013: 1号艇含む×conf80+

**回収率: 342% | サンプル: 220戦 | 信頼性: 最高**

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

### K01-T014: 1,3,5号艇

**回収率: 341% | サンプル: 29戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-5"
};

// 賭け方
const betType = "trio";
```

---

### K01-T015: 1,5号艇含む

**回収率: 310% | サンプル: 86戦 | 信頼性: 最高**

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
function shouldBet_01(prediction, ruleId) {
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
K01-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
