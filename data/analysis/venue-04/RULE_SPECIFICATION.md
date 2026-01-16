# 平和島（会場コード: 04）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-09
**サンプル数**: 419レース

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
| H04-T001 | trio | 4,5号艇含む | 37 | **1165%** | 高 |
| H04-T002 | trio | 1,4,6号艇 | 12 | **982%** | 低 |
| H04-T003 | trio | 2,4号艇含む | 81 | **768%** | 最高 |
| H04-T004 | trio | 1,4,5号艇 | 25 | **715%** | 中 |
| H04-T005 | trio | 4,6号艇含む | 30 | **675%** | 高 |
| H04-T006 | trio | 1号艇含まない×conf80+ | 55 | **617%** | 最高 |
| H04-T007 | trio | 1号艇含まない | 63 | **601%** | 最高 |
| H04-T008 | trio | 2,5号艇含む | 67 | **523%** | 最高 |
| H04-T009 | trio | 1,2,4号艇 | 65 | **518%** | 最高 |
| H04-T010 | trio | 1,4号艇含む | 147 | **487%** | 最高 |
| H04-T011 | trio | 1,5号艇含む | 118 | **367%** | 最高 |
| H04-T012 | trio | 1,2号艇含む | 198 | **366%** | 最高 |
| H04-T013 | trio | 1,6号艇含む | 82 | **362%** | 最高 |
| H04-T014 | trio | 後半R×1号艇含む | 90 | **338%** | 最高 |
| H04-T015 | trio | 1号艇含む×conf80+ | 293 | **330%** | 最高 |
| H04-T016 | trio | 1,2,3号艇 | 61 | **328%** | 最高 |
| H04-T017 | trio | 2,3号艇含む | 82 | **300%** | 最高 |
| H04-T018 | trio | 後半R(10R〜) | 105 | **298%** | 最高 |
| H04-T019 | trio | 3,6号艇含む | 51 | **281%** | 最高 |
| H04-T020 | trio | 1,2,5号艇 | 46 | **280%** | 高 |
| H04-T021 | trio | 1,3,6号艇 | 29 | **278%** | 中 |
| H04-T022 | trio | 3,5,6号艇 | 10 | **271%** | 低 |
| H04-T023 | trio | 1,3号艇含む | 167 | **269%** | 最高 |
| H04-T024 | trio | 1,3,5号艇 | 32 | **268%** | 高 |
| H04-T025 | trio | 1,5,6号艇 | 15 | **265%** | 中 |
| H04-T026 | trio | 5,6号艇含む | 37 | **263%** | 高 |
| H04-T027 | trio | 3,4号艇含む | 61 | **238%** | 最高 |
| H04-T028 | trio | 1,2,6号艇 | 26 | **225%** | 中 |
| H04-T029 | trio | 2,6号艇含む | 44 | **217%** | 高 |
| H04-T030 | trio | 3,5号艇含む | 55 | **205%** | 最高 |
| H04-T031 | trio | 1,3,4号艇 | 45 | **184%** | 高 |
| H04-P001 | place | 5号艇1着+2号艇含む(複勝) | 16 | **166%** | 中 |
| H04-P002 | place | 3号艇1着×conf80+(複勝) | 30 | **150%** | 高 |
| H04-P003 | place | 後半R(10R〜)複勝 | 105 | **144%** | 最高 |
| H04-W001 | win | 4号艇1着+3号艇含む | 11 | **140%** | 低 |
| H04-P004 | place | 3号艇1着(複勝) | 39 | **138%** | 高 |
| H04-W002 | win | 3号艇1着+6号艇含む | 14 | **136%** | 低 |
| H04-W003 | win | 5号艇1着+1号艇含む | 18 | **134%** | 中 |
| H04-P005 | place | 1号艇1着(複勝) | 233 | **128%** | 最高 |
| H04-W004 | win | 2号艇1着+5号艇含む | 14 | **126%** | 低 |
| H04-P006 | place | 5号艇1着+1号艇含む(複勝) | 18 | **124%** | 中 |
| H04-W005 | win | 2号艇1着+3号艇含む | 19 | **123%** | 中 |
| H04-P007 | place | 3号艇1着+1号艇含む(複勝) | 22 | **123%** | 中 |
| H04-P008 | place | 5号艇1着×conf80+(複勝) | 22 | **123%** | 中 |
| H04-W006 | win | 3号艇1着+1号艇含む | 22 | **119%** | 中 |
| H04-P009 | place | 5号艇1着(複勝) | 28 | **118%** | 中 |
| H04-P010 | place | 2号艇1着×conf80+(複勝) | 43 | **116%** | 高 |
| H04-P011 | place | 2号艇1着+1号艇含む(複勝) | 46 | **113%** | 高 |
| H04-P012 | place | 2号艇1着(複勝) | 60 | **112%** | 最高 |
| H04-W007 | win | 4号艇1着+6号艇含む | 10 | **107%** | 低 |

---

## ルール詳細

### H04-T001: 4,5号艇含む

**回収率: 1165% | サンプル: 37戦 | 信頼性: 高**

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

### H04-T002: 1,4,6号艇

**回収率: 982% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

### H04-T003: 2,4号艇含む

**回収率: 768% | サンプル: 81戦 | 信頼性: 最高**

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

### H04-T004: 1,4,5号艇

**回収率: 715% | サンプル: 25戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### H04-T005: 4,6号艇含む

**回収率: 675% | サンプル: 30戦 | 信頼性: 高**

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

### H04-T006: 1号艇含まない×conf80+

**回収率: 617% | サンプル: 55戦 | 信頼性: 最高**

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

### H04-T007: 1号艇含まない

**回収率: 601% | サンプル: 63戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### H04-T008: 2,5号艇含む

**回収率: 523% | サンプル: 67戦 | 信頼性: 最高**

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

### H04-T009: 1,2,4号艇

**回収率: 518% | サンプル: 65戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### H04-T010: 1,4号艇含む

**回収率: 487% | サンプル: 147戦 | 信頼性: 最高**

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

### H04-T011: 1,5号艇含む

**回収率: 367% | サンプル: 118戦 | 信頼性: 最高**

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

### H04-T012: 1,2号艇含む

**回収率: 366% | サンプル: 198戦 | 信頼性: 最高**

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

### H04-T013: 1,6号艇含む

**回収率: 362% | サンプル: 82戦 | 信頼性: 最高**

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

### H04-T014: 後半R×1号艇含む

**回収率: 338% | サンプル: 90戦 | 信頼性: 最高**

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

### H04-T015: 1号艇含む×conf80+

**回収率: 330% | サンプル: 293戦 | 信頼性: 最高**

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

## 実装例

### ルール適用関数

```javascript
function shouldBet_04(prediction, ruleId) {
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
H04-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
