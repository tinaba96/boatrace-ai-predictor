# 若松（会場コード: 20）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-05 〜 2026-01-13
**サンプル数**: 357レース

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
| W20-T001 | trio | 1,3,4号艇 | 20 | **629%** | 中 |
| W20-T002 | trio | 1,4,6号艇 | 29 | **621%** | 中 |
| W20-T003 | trio | 3,5,6号艇 | 12 | **569%** | 低 |
| W20-T004 | trio | 後半R×1号艇含まない | 13 | **525%** | 低 |
| W20-T005 | trio | 1,4,5号艇 | 17 | **499%** | 中 |
| W20-T006 | trio | 1,4号艇含む | 111 | **453%** | 最高 |
| W20-T007 | trio | 1,2,3号艇 | 49 | **445%** | 高 |
| W20-T008 | trio | 1,3,6号艇 | 21 | **409%** | 中 |
| W20-T009 | trio | 1,3号艇含む | 117 | **402%** | 最高 |
| W20-T010 | trio | 4,6号艇含む | 49 | **368%** | 高 |
| W20-T011 | trio | 1,6号艇含む | 88 | **344%** | 最高 |
| W20-T012 | trio | 1号艇含む×conf80+ | 236 | **344%** | 最高 |
| W20-T013 | trio | 2,3号艇含む | 76 | **343%** | 最高 |
| W20-T014 | trio | 3,6号艇含む | 45 | **343%** | 高 |
| W20-T015 | trio | 3,4号艇含む | 44 | **286%** | 高 |
| W20-T016 | trio | 3,5号艇含む | 54 | **279%** | 最高 |
| W20-T017 | trio | 1,2号艇含む | 143 | **270%** | 最高 |
| W20-T018 | trio | 1,2,4号艇 | 45 | **250%** | 高 |
| W20-T019 | trio | 後半R(10R〜) | 87 | **218%** | 最高 |
| W20-T020 | trio | 4,5号艇含む | 40 | **212%** | 高 |
| W20-W001 | win | 6号艇1着+4号艇含む | 11 | **208%** | 低 |
| W20-T021 | trio | 5,6号艇含む | 46 | **205%** | 高 |
| W20-T022 | trio | 1,5号艇含む | 89 | **184%** | 最高 |
| W20-W002 | win | 4号艇1着+6号艇含む | 12 | **166%** | 低 |
| W20-T023 | trio | 2,5号艇含む | 53 | **165%** | 最高 |
| W20-T024 | trio | 後半R×1号艇含む | 74 | **164%** | 最高 |
| W20-T025 | trio | 2,4号艇含む | 72 | **156%** | 最高 |
| W20-T026 | trio | 1号艇含まない | 83 | **153%** | 最高 |
| W20-T027 | trio | 1,3,5号艇 | 27 | **148%** | 中 |
| W20-P001 | place | 6号艇1着+4号艇含む(複勝) | 11 | **133%** | 低 |
| W20-T028 | trio | 1,2,6号艇 | 21 | **127%** | 中 |
| W20-W003 | win | 1号艇1着+6号艇含む | 36 | **113%** | 高 |
| W20-W004 | win | 2号艇1着+5号艇含む | 11 | **107%** | 低 |
| W20-T029 | trio | 1,2,5号艇 | 28 | **104%** | 中 |
| W20-P002 | place | 2号艇1着×conf80+(複勝) | 35 | **102%** | 高 |

---

## ルール詳細

### W20-T001: 1,3,4号艇

**回収率: 629% | サンプル: 20戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### W20-T002: 1,4,6号艇

**回収率: 621% | サンプル: 29戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

### W20-T003: 3,5,6号艇

**回収率: 569% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "3-5-6"
};

// 賭け方
const betType = "trio";
```

---

### W20-T004: 後半R×1号艇含まない

**回収率: 525% | サンプル: 13戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "race_number": {
    "min": 10,
    "max": 12
  },
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### W20-T005: 1,4,5号艇

**回収率: 499% | サンプル: 17戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### W20-T006: 1,4号艇含む

**回収率: 453% | サンプル: 111戦 | 信頼性: 最高**

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

### W20-T007: 1,2,3号艇

**回収率: 445% | サンプル: 49戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### W20-T008: 1,3,6号艇

**回収率: 409% | サンプル: 21戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### W20-T009: 1,3号艇含む

**回収率: 402% | サンプル: 117戦 | 信頼性: 最高**

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

### W20-T010: 4,6号艇含む

**回収率: 368% | サンプル: 49戦 | 信頼性: 高**

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

### W20-T011: 1,6号艇含む

**回収率: 344% | サンプル: 88戦 | 信頼性: 最高**

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

### W20-T012: 1号艇含む×conf80+

**回収率: 344% | サンプル: 236戦 | 信頼性: 最高**

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

### W20-T013: 2,3号艇含む

**回収率: 343% | サンプル: 76戦 | 信頼性: 最高**

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

### W20-T014: 3,6号艇含む

**回収率: 343% | サンプル: 45戦 | 信頼性: 高**

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

### W20-T015: 3,4号艇含む

**回収率: 286% | サンプル: 44戦 | 信頼性: 高**

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

## 実装例

### ルール適用関数

```javascript
function shouldBet_20(prediction, ruleId) {
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
W20-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
