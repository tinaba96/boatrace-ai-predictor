# 児島（会場コード: 16）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-16 〜 2026-01-16
**サンプル数**: 403レース

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
| KJ16-T001 | trio | 1,2,4号艇 | 43 | **798%** | 高 |
| KJ16-T002 | trio | 1,5,6号艇 | 16 | **604%** | 中 |
| KJ16-T003 | trio | 1,4号艇含む | 120 | **471%** | 最高 |
| KJ16-T004 | trio | 1,4,6号艇 | 20 | **468%** | 中 |
| KJ16-T005 | trio | 2,4号艇含む | 84 | **449%** | 最高 |
| KJ16-T006 | trio | 1,2号艇含む | 155 | **438%** | 最高 |
| KJ16-T007 | trio | 1,2,3号艇 | 40 | **406%** | 高 |
| KJ16-T008 | trio | 1号艇含む×conf80+ | 258 | **391%** | 最高 |
| KJ16-T009 | trio | 後半R×1号艇含む | 83 | **368%** | 最高 |
| KJ16-T010 | trio | 1,6号艇含む | 105 | **356%** | 最高 |
| KJ16-T011 | trio | 1,3,4号艇 | 30 | **345%** | 高 |
| KJ16-T012 | trio | 5,6号艇含む | 36 | **313%** | 高 |
| KJ16-T013 | trio | 後半R(10R〜) | 99 | **308%** | 最高 |
| KJ16-T014 | trio | 1,3号艇含む | 133 | **287%** | 最高 |
| KJ16-T015 | trio | 2,3号艇含む | 71 | **276%** | 最高 |
| KJ16-T016 | trio | 1,2,6号艇 | 37 | **270%** | 高 |
| KJ16-T017 | trio | 1,3,6号艇 | 32 | **260%** | 高 |
| KJ16-T018 | trio | 3,4号艇含む | 60 | **231%** | 最高 |
| KJ16-T019 | trio | 3,6号艇含む | 51 | **224%** | 最高 |
| KJ16-T020 | trio | 4,6号艇含む | 55 | **222%** | 最高 |
| KJ16-T021 | trio | 1,2,5号艇 | 35 | **211%** | 高 |
| KJ16-T022 | trio | 1,5号艇含む | 109 | **209%** | 最高 |
| KJ16-P001 | place | 4号艇1着+5号艇含む(複勝) | 13 | **199%** | 低 |
| KJ16-W001 | win | 4号艇1着+6号艇含む | 18 | **190%** | 中 |
| KJ16-W002 | win | 2号艇1着+6号艇含む | 19 | **182%** | 中 |
| KJ16-T023 | trio | 2,6号艇含む | 63 | **180%** | 最高 |
| KJ16-P002 | place | 4号艇1着×conf80+(複勝) | 36 | **170%** | 高 |
| KJ16-P003 | place | 4号艇1着+2号艇含む(複勝) | 23 | **165%** | 中 |
| KJ16-P004 | place | 4号艇1着(複勝) | 44 | **155%** | 高 |
| KJ16-W003 | win | 5号艇1着+1号艇含む | 28 | **150%** | 中 |
| KJ16-T024 | trio | 2,5号艇含む | 61 | **144%** | 最高 |
| KJ16-P005 | place | 4号艇1着+1号艇含む(複勝) | 25 | **143%** | 中 |
| KJ16-W004 | win | 5号艇1着+2号艇含む | 19 | **141%** | 中 |
| KJ16-P006 | place | 3号艇1着+1号艇含む(複勝) | 23 | **140%** | 中 |
| KJ16-W005 | win | 2号艇1着+5号艇含む | 11 | **136%** | 低 |
| KJ16-P007 | place | 4号艇1着+6号艇含む(複勝) | 18 | **134%** | 中 |
| KJ16-T025 | trio | 2,3,4号艇 | 15 | **133%** | 中 |
| KJ16-P008 | place | 2号艇1着+1号艇含む(複勝) | 46 | **124%** | 高 |
| KJ16-P009 | place | 3号艇1着×conf80+(複勝) | 41 | **124%** | 高 |
| KJ16-W006 | win | 4号艇1着 | 44 | **123%** | 高 |
| KJ16-W007 | win | 4号艇1着+5号艇含む | 13 | **121%** | 低 |
| KJ16-W008 | win | 5号艇1着 | 43 | **120%** | 高 |
| KJ16-P010 | place | 1号艇1着(複勝) | 156 | **119%** | 最高 |
| KJ16-P011 | place | 2号艇1着(複勝) | 63 | **119%** | 最高 |
| KJ16-T026 | trio | 2,3,5号艇 | 12 | **118%** | 低 |
| KJ16-W009 | win | 5号艇1着+4号艇含む | 19 | **116%** | 中 |
| KJ16-W010 | win | 2号艇1着×conf80+ | 46 | **115%** | 高 |
| KJ16-W011 | win | 5号艇1着×conf80+ | 34 | **115%** | 高 |
| KJ16-P012 | place | 2号艇1着×conf80+(複勝) | 46 | **114%** | 高 |
| KJ16-T027 | trio | 3,5号艇含む | 55 | **114%** | 最高 |
| KJ16-W012 | win | 6号艇1着+4号艇含む | 16 | **113%** | 中 |
| KJ16-W013 | win | 2号艇1着+1号艇含む | 46 | **112%** | 高 |
| KJ16-W014 | win | 2号艇1着 | 63 | **111%** | 最高 |
| KJ16-P013 | place | 3号艇1着(複勝) | 47 | **109%** | 高 |
| KJ16-P014 | place | 5号艇1着+4号艇含む(複勝) | 19 | **108%** | 中 |
| KJ16-T028 | trio | 1,3,5号艇 | 31 | **105%** | 高 |
| KJ16-T029 | trio | 1号艇含まない×conf80+ | 75 | **105%** | 最高 |

---

## ルール詳細

### KJ16-T001: 1,2,4号艇

**回収率: 798% | サンプル: 43戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### KJ16-T002: 1,5,6号艇

**回収率: 604% | サンプル: 16戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### KJ16-T003: 1,4号艇含む

**回収率: 471% | サンプル: 120戦 | 信頼性: 最高**

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

### KJ16-T004: 1,4,6号艇

**回収率: 468% | サンプル: 20戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

### KJ16-T005: 2,4号艇含む

**回収率: 449% | サンプル: 84戦 | 信頼性: 最高**

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

### KJ16-T006: 1,2号艇含む

**回収率: 438% | サンプル: 155戦 | 信頼性: 最高**

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

### KJ16-T007: 1,2,3号艇

**回収率: 406% | サンプル: 40戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### KJ16-T008: 1号艇含む×conf80+

**回収率: 391% | サンプル: 258戦 | 信頼性: 最高**

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

### KJ16-T009: 後半R×1号艇含む

**回収率: 368% | サンプル: 83戦 | 信頼性: 最高**

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

### KJ16-T010: 1,6号艇含む

**回収率: 356% | サンプル: 105戦 | 信頼性: 最高**

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

### KJ16-T011: 1,3,4号艇

**回収率: 345% | サンプル: 30戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### KJ16-T012: 5,6号艇含む

**回収率: 313% | サンプル: 36戦 | 信頼性: 高**

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

### KJ16-T013: 後半R(10R〜)

**回収率: 308% | サンプル: 99戦 | 信頼性: 最高**

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

### KJ16-T014: 1,3号艇含む

**回収率: 287% | サンプル: 133戦 | 信頼性: 最高**

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

### KJ16-T015: 2,3号艇含む

**回収率: 276% | サンプル: 71戦 | 信頼性: 最高**

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

## 実装例

### ルール適用関数

```javascript
function shouldBet_16(prediction, ruleId) {
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
KJ16-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
