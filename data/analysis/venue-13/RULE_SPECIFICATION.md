# 尼崎（会場コード: 13）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-13
**サンプル数**: 465レース

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
| A13-T001 | trio | 2,3,5号艇 | 15 | **1047%** | 中 |
| A13-T002 | trio | 1,4,5号艇 | 26 | **938%** | 中 |
| A13-T003 | trio | 1,3,6号艇 | 23 | **818%** | 中 |
| A13-T004 | trio | 4,5号艇含む | 51 | **671%** | 最高 |
| A13-T005 | trio | 3,6号艇含む | 42 | **541%** | 高 |
| A13-T006 | trio | 3,5号艇含む | 60 | **456%** | 最高 |
| A13-T007 | trio | 後半R×1号艇含まない | 24 | **441%** | 中 |
| A13-T008 | trio | 1,5号艇含む | 120 | **419%** | 最高 |
| A13-T009 | trio | 2,3号艇含む | 93 | **389%** | 最高 |
| A13-T010 | trio | 2,5号艇含む | 85 | **374%** | 最高 |
| A13-T011 | trio | 1,2,3号艇 | 56 | **366%** | 最高 |
| A13-T012 | trio | 1,3号艇含む | 158 | **359%** | 最高 |
| A13-T013 | trio | 1,2,5号艇 | 48 | **335%** | 高 |
| A13-T014 | trio | 1,6号艇含む | 90 | **330%** | 最高 |
| A13-T015 | trio | 1号艇含む×conf80+ | 299 | **330%** | 最高 |
| A13-T016 | trio | 1,2号艇含む | 197 | **301%** | 最高 |
| A13-T017 | trio | 1,4号艇含む | 161 | **301%** | 最高 |
| A13-T018 | trio | 1,2,6号艇 | 29 | **297%** | 中 |
| A13-T019 | trio | 1号艇含まない | 102 | **289%** | 最高 |
| A13-T020 | trio | 1,3,5号艇 | 32 | **265%** | 高 |
| A13-T021 | trio | 3,4号艇含む | 71 | **225%** | 最高 |
| A13-T022 | trio | 後半R(10R〜) | 118 | **223%** | 最高 |
| A13-T023 | trio | 1,2,4号艇 | 64 | **221%** | 最高 |
| A13-T024 | trio | 4,6号艇含む | 54 | **214%** | 最高 |
| A13-T025 | trio | 5,6号艇含む | 40 | **199%** | 高 |
| A13-P001 | place | 4号艇1着+6号艇含む(複勝) | 14 | **190%** | 低 |
| A13-T026 | trio | 1,3,4号艇 | 47 | **190%** | 高 |
| A13-T027 | trio | 1号艇含まない×conf80+ | 83 | **178%** | 最高 |
| A13-T028 | trio | 後半R×1号艇含む | 94 | **167%** | 最高 |
| A13-P002 | place | 5号艇1着+3号艇含む(複勝) | 11 | **145%** | 低 |
| A13-P003 | place | 4号艇1着+2号艇含む(複勝) | 22 | **138%** | 中 |
| A13-T029 | trio | 2,4号艇含む | 105 | **135%** | 最高 |
| A13-W001 | win | 5号艇1着+3号艇含む | 11 | **134%** | 低 |
| A13-W002 | win | 2号艇1着+6号艇含む | 19 | **131%** | 中 |
| A13-T030 | trio | 2,6号艇含む | 68 | **126%** | 最高 |
| A13-W003 | win | 1号艇1着+3号艇含む | 97 | **116%** | 最高 |
| A13-W004 | win | 1号艇1着×後半R | 67 | **115%** | 最高 |
| A13-P004 | place | 4号艇1着(複勝) | 39 | **112%** | 高 |
| A13-W005 | win | 1号艇1着+6号艇含む | 52 | **111%** | 最高 |
| A13-P005 | place | 4号艇1着×conf80+(複勝) | 30 | **109%** | 高 |
| A13-W006 | win | 1号艇1着+5号艇含む | 69 | **106%** | 最高 |
| A13-W007 | win | 2号艇1着+5号艇含む | 31 | **105%** | 高 |
| A13-W008 | win | 1号艇1着×conf80+ | 187 | **102%** | 最高 |
| A13-W009 | win | 1号艇1着 | 220 | **100%** | 最高 |

---

## ルール詳細

### A13-T001: 2,3,5号艇

**回収率: 1047% | サンプル: 15戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-5"
};

// 賭け方
const betType = "trio";
```

---

### A13-T002: 1,4,5号艇

**回収率: 938% | サンプル: 26戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### A13-T003: 1,3,6号艇

**回収率: 818% | サンプル: 23戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### A13-T004: 4,5号艇含む

**回収率: 671% | サンプル: 51戦 | 信頼性: 最高**

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

### A13-T005: 3,6号艇含む

**回収率: 541% | サンプル: 42戦 | 信頼性: 高**

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

### A13-T006: 3,5号艇含む

**回収率: 456% | サンプル: 60戦 | 信頼性: 最高**

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

### A13-T007: 後半R×1号艇含まない

**回収率: 441% | サンプル: 24戦 | 信頼性: 中**

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

### A13-T008: 1,5号艇含む

**回収率: 419% | サンプル: 120戦 | 信頼性: 最高**

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

### A13-T009: 2,3号艇含む

**回収率: 389% | サンプル: 93戦 | 信頼性: 最高**

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

### A13-T010: 2,5号艇含む

**回収率: 374% | サンプル: 85戦 | 信頼性: 最高**

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

### A13-T011: 1,2,3号艇

**回収率: 366% | サンプル: 56戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### A13-T012: 1,3号艇含む

**回収率: 359% | サンプル: 158戦 | 信頼性: 最高**

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

### A13-T013: 1,2,5号艇

**回収率: 335% | サンプル: 48戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-5"
};

// 賭け方
const betType = "trio";
```

---

### A13-T014: 1,6号艇含む

**回収率: 330% | サンプル: 90戦 | 信頼性: 最高**

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

### A13-T015: 1号艇含む×conf80+

**回収率: 330% | サンプル: 299戦 | 信頼性: 最高**

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
function shouldBet_13(prediction, ruleId) {
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
A13-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
