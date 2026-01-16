# 鳴門（会場コード: 14）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-16
**サンプル数**: 467レース

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
| N14-T001 | trio | 2,3,6号艇 | 15 | **1024%** | 中 |
| N14-T002 | trio | 1,5,6号艇 | 20 | **1015%** | 中 |
| N14-T003 | trio | 2,4,6号艇 | 14 | **759%** | 低 |
| N14-T004 | trio | 1,2,6号艇 | 36 | **741%** | 高 |
| N14-T005 | trio | 後半R×1号艇含む | 92 | **678%** | 最高 |
| N14-T006 | trio | 2,6号艇含む | 80 | **658%** | 最高 |
| N14-T007 | trio | 1,2,4号艇 | 63 | **638%** | 最高 |
| N14-T008 | trio | 後半R(10R〜) | 115 | **580%** | 最高 |
| N14-T009 | trio | 1,2号艇含む | 199 | **577%** | 最高 |
| N14-T010 | trio | 1,2,5号艇 | 39 | **562%** | 高 |
| N14-T011 | trio | 1,4,5号艇 | 17 | **545%** | 中 |
| N14-T012 | trio | 1,5号艇含む | 113 | **542%** | 最高 |
| N14-T013 | trio | 1,6号艇含む | 96 | **529%** | 最高 |
| N14-T014 | trio | 2,4号艇含む | 96 | **529%** | 最高 |
| N14-T015 | trio | 1号艇含む×conf80+ | 296 | **522%** | 最高 |
| N14-T016 | trio | 1,4号艇含む | 135 | **458%** | 最高 |
| N14-T017 | trio | 3,4,5号艇 | 10 | **449%** | 低 |
| N14-T018 | trio | 2,3号艇含む | 95 | **436%** | 最高 |
| N14-T019 | trio | 1,2,3号艇 | 61 | **427%** | 最高 |
| N14-T020 | trio | 5,6号艇含む | 56 | **362%** | 最高 |
| N14-T021 | trio | 1,3号艇含む | 157 | **311%** | 最高 |
| N14-T022 | trio | 3,6号艇含む | 57 | **308%** | 最高 |
| N14-T023 | trio | 1,3,4号艇 | 37 | **289%** | 高 |
| N14-T024 | trio | 2,5号艇含む | 78 | **281%** | 最高 |
| N14-T025 | trio | 4,5号艇含む | 51 | **270%** | 最高 |
| N14-T026 | trio | 1,3,5号艇 | 37 | **266%** | 高 |
| N14-T027 | trio | 1号艇含まない | 117 | **261%** | 最高 |
| N14-T028 | trio | 3,4号艇含む | 65 | **234%** | 最高 |
| N14-T029 | trio | 4,6号艇含む | 55 | **224%** | 最高 |
| N14-T030 | trio | 3,5号艇含む | 68 | **211%** | 最高 |
| N14-T031 | trio | 後半R×1号艇含まない | 23 | **189%** | 中 |
| N14-T032 | trio | 1号艇含まない×conf80+ | 95 | **187%** | 最高 |
| N14-P001 | place | 6号艇1着+2号艇含む(複勝) | 17 | **145%** | 中 |
| N14-P002 | place | 6号艇1着+3号艇含む(複勝) | 18 | **136%** | 中 |
| N14-P003 | place | 3号艇1着+1号艇含む(複勝) | 19 | **130%** | 中 |
| N14-W001 | win | 5号艇1着+1号艇含む | 25 | **127%** | 中 |
| N14-W002 | win | 5号艇1着+6号艇含む | 19 | **124%** | 中 |
| N14-P004 | place | 6号艇1着+1号艇含む(複勝) | 23 | **118%** | 中 |
| N14-P005 | place | 4号艇1着+6号艇含む(複勝) | 21 | **107%** | 中 |
| N14-P006 | place | 1号艇1着(複勝) | 205 | **104%** | 最高 |
| N14-P007 | place | 3号艇1着(複勝) | 37 | **104%** | 高 |
| N14-T033 | trio | 1,3,6号艇 | 22 | **100%** | 中 |

---

## ルール詳細

### N14-T001: 2,3,6号艇

**回収率: 1024% | サンプル: 15戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-6"
};

// 賭け方
const betType = "trio";
```

---

### N14-T002: 1,5,6号艇

**回収率: 1015% | サンプル: 20戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### N14-T003: 2,4,6号艇

**回収率: 759% | サンプル: 14戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-4-6"
};

// 賭け方
const betType = "trio";
```

---

### N14-T004: 1,2,6号艇

**回収率: 741% | サンプル: 36戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-6"
};

// 賭け方
const betType = "trio";
```

---

### N14-T005: 後半R×1号艇含む

**回収率: 678% | サンプル: 92戦 | 信頼性: 最高**

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

### N14-T006: 2,6号艇含む

**回収率: 658% | サンプル: 80戦 | 信頼性: 最高**

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

### N14-T007: 1,2,4号艇

**回収率: 638% | サンプル: 63戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### N14-T008: 後半R(10R〜)

**回収率: 580% | サンプル: 115戦 | 信頼性: 最高**

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

### N14-T009: 1,2号艇含む

**回収率: 577% | サンプル: 199戦 | 信頼性: 最高**

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

### N14-T010: 1,2,5号艇

**回収率: 562% | サンプル: 39戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-5"
};

// 賭け方
const betType = "trio";
```

---

### N14-T011: 1,4,5号艇

**回収率: 545% | サンプル: 17戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### N14-T012: 1,5号艇含む

**回収率: 542% | サンプル: 113戦 | 信頼性: 最高**

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

### N14-T013: 1,6号艇含む

**回収率: 529% | サンプル: 96戦 | 信頼性: 最高**

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

### N14-T014: 2,4号艇含む

**回収率: 529% | サンプル: 96戦 | 信頼性: 最高**

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

### N14-T015: 1号艇含む×conf80+

**回収率: 522% | サンプル: 296戦 | 信頼性: 最高**

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
function shouldBet_14(prediction, ruleId) {
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
N14-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
