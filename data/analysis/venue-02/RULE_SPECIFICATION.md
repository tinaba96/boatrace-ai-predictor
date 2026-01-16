# 戸田（会場コード: 02）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-12
**サンプル数**: 355レース

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
| T02-T001 | trio | 1,5,6号艇 | 10 | **1744%** | 低 |
| T02-T002 | trio | 2,3,4号艇 | 11 | **1187%** | 低 |
| T02-T003 | trio | 5,6号艇含む | 19 | **1103%** | 中 |
| T02-T004 | trio | 1,3,4号艇 | 24 | **859%** | 中 |
| T02-T005 | trio | 3,4号艇含む | 47 | **821%** | 高 |
| T02-T006 | trio | 1,3,5号艇 | 24 | **787%** | 中 |
| T02-T007 | trio | 1,3,6号艇 | 20 | **717%** | 中 |
| T02-T008 | trio | 1,3号艇含む | 123 | **689%** | 最高 |
| T02-T009 | trio | 1,2,4号艇 | 44 | **655%** | 高 |
| T02-T010 | trio | 2,3号艇含む | 80 | **594%** | 最高 |
| T02-T011 | trio | 2,4号艇含む | 74 | **579%** | 最高 |
| T02-T012 | trio | 1,2,3号艇 | 55 | **562%** | 最高 |
| T02-T013 | trio | 1,5号艇含む | 102 | **546%** | 最高 |
| T02-T014 | trio | 1号艇含まない×conf80+ | 46 | **545%** | 高 |
| T02-T015 | trio | 後半R×1号艇含む | 82 | **528%** | 最高 |
| T02-T016 | trio | 3,6号艇含む | 36 | **516%** | 高 |
| T02-T017 | trio | 1,4号艇含む | 106 | **508%** | 最高 |
| T02-T018 | trio | 3,5号艇含む | 46 | **503%** | 高 |
| T02-T019 | trio | 後半R(10R〜) | 91 | **476%** | 最高 |
| T02-T020 | trio | 1,6号艇含む | 75 | **455%** | 最高 |
| T02-T021 | trio | 1号艇含む×conf80+ | 228 | **453%** | 最高 |
| T02-T022 | trio | 1,2号艇含む | 174 | **443%** | 最高 |
| T02-T023 | trio | 1号艇含まない | 65 | **400%** | 最高 |
| T02-T024 | trio | 1,2,5号艇 | 42 | **394%** | 高 |
| T02-T025 | trio | 2,5号艇含む | 64 | **359%** | 最高 |
| T02-T026 | trio | 2,3,5号艇 | 10 | **198%** | 低 |
| T02-W001 | win | 3号艇1着+2号艇含む | 19 | **193%** | 中 |
| T02-W002 | win | 3号艇1着+5号艇含む | 15 | **189%** | 中 |
| T02-P001 | place | 3号艇1着×conf80+(複勝) | 23 | **181%** | 中 |
| T02-W003 | win | 3号艇1着×conf80+ | 23 | **175%** | 中 |
| T02-P002 | place | 後半R(10R〜)複勝 | 91 | **153%** | 最高 |
| T02-T027 | trio | 4,6号艇含む | 28 | **151%** | 中 |
| T02-T028 | trio | 4,5号艇含む | 43 | **140%** | 高 |
| T02-P003 | place | 3号艇1着+1号艇含む(複勝) | 19 | **139%** | 中 |
| T02-T029 | trio | 1,4,6号艇 | 12 | **133%** | 低 |
| T02-P004 | place | 1号艇1着(複勝) | 191 | **132%** | 最高 |
| T02-P005 | place | 3号艇1着(複勝) | 39 | **129%** | 高 |
| T02-T030 | trio | 2,6号艇含む | 48 | **122%** | 高 |
| T02-W004 | win | 3号艇1着 | 39 | **121%** | 高 |
| T02-W005 | win | 2号艇1着+5号艇含む | 18 | **119%** | 中 |
| T02-W006 | win | 2号艇1着+1号艇含む | 41 | **115%** | 高 |
| T02-P006 | place | 2号艇1着+1号艇含む(複勝) | 41 | **112%** | 高 |
| T02-T031 | trio | 1,4,5号艇 | 26 | **109%** | 中 |
| T02-P007 | place | 2号艇1着×conf80+(複勝) | 36 | **106%** | 高 |
| T02-P008 | place | 2号艇1着(複勝) | 49 | **105%** | 高 |
| T02-W007 | win | 2号艇1着 | 49 | **104%** | 高 |
| T02-P009 | place | 5号艇1着+1号艇含む(複勝) | 14 | **102%** | 低 |
| T02-W008 | win | 3号艇1着+4号艇含む | 15 | **101%** | 中 |

---

## ルール詳細

### T02-T001: 1,5,6号艇

**回収率: 1744% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### T02-T002: 2,3,4号艇

**回収率: 1187% | サンプル: 11戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-4"
};

// 賭け方
const betType = "trio";
```

---

### T02-T003: 5,6号艇含む

**回収率: 1103% | サンプル: 19戦 | 信頼性: 中**

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

### T02-T004: 1,3,4号艇

**回収率: 859% | サンプル: 24戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### T02-T005: 3,4号艇含む

**回収率: 821% | サンプル: 47戦 | 信頼性: 高**

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

### T02-T006: 1,3,5号艇

**回収率: 787% | サンプル: 24戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-5"
};

// 賭け方
const betType = "trio";
```

---

### T02-T007: 1,3,6号艇

**回収率: 717% | サンプル: 20戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### T02-T008: 1,3号艇含む

**回収率: 689% | サンプル: 123戦 | 信頼性: 最高**

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

### T02-T009: 1,2,4号艇

**回収率: 655% | サンプル: 44戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### T02-T010: 2,3号艇含む

**回収率: 594% | サンプル: 80戦 | 信頼性: 最高**

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

### T02-T011: 2,4号艇含む

**回収率: 579% | サンプル: 74戦 | 信頼性: 最高**

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

### T02-T012: 1,2,3号艇

**回収率: 562% | サンプル: 55戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### T02-T013: 1,5号艇含む

**回収率: 546% | サンプル: 102戦 | 信頼性: 最高**

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

### T02-T014: 1号艇含まない×conf80+

**回収率: 545% | サンプル: 46戦 | 信頼性: 高**

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

### T02-T015: 後半R×1号艇含む

**回収率: 528% | サンプル: 82戦 | 信頼性: 最高**

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

## 実装例

### ルール適用関数

```javascript
function shouldBet_02(prediction, ruleId) {
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
T02-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
