# 多摩川（会場コード: 05）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-05 〜 2026-01-13
**サンプル数**: 488レース

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
| TM05-T001 | trio | 1,5,6号艇 | 19 | **2131%** | 中 |
| TM05-T002 | trio | 5,6号艇含む | 57 | **944%** | 最高 |
| TM05-T003 | trio | 1,3,6号艇 | 15 | **876%** | 中 |
| TM05-T004 | trio | 3,5,6号艇 | 12 | **690%** | 低 |
| TM05-T005 | trio | 1,6号艇含む | 96 | **687%** | 最高 |
| TM05-T006 | trio | 1,5号艇含む | 136 | **524%** | 最高 |
| TM05-T007 | trio | 2,4,6号艇 | 18 | **507%** | 中 |
| TM05-T008 | trio | 4,5,6号艇 | 10 | **506%** | 低 |
| TM05-T009 | trio | 3,6号艇含む | 44 | **487%** | 高 |
| TM05-T010 | trio | 1,3,4号艇 | 44 | **460%** | 高 |
| TM05-T011 | trio | 1号艇含む×conf80+ | 296 | **459%** | 最高 |
| TM05-T012 | trio | 2,4,5号艇 | 18 | **416%** | 中 |
| TM05-T013 | trio | 2,4号艇含む | 101 | **403%** | 最高 |
| TM05-T014 | trio | 3,4号艇含む | 70 | **394%** | 最高 |
| TM05-T015 | trio | 1,2,4号艇 | 52 | **384%** | 最高 |
| TM05-T016 | trio | 1,2,5号艇 | 66 | **365%** | 最高 |
| TM05-T017 | trio | 1,3号艇含む | 153 | **364%** | 最高 |
| TM05-T018 | trio | 4,5号艇含む | 50 | **356%** | 最高 |
| TM05-T019 | trio | 1,2号艇含む | 212 | **347%** | 最高 |
| TM05-T020 | trio | 1,2,6号艇 | 36 | **325%** | 高 |
| TM05-T021 | trio | 2,3,4号艇 | 13 | **320%** | 低 |
| TM05-T022 | trio | 1,4号艇含む | 137 | **313%** | 最高 |
| TM05-T023 | trio | 1号艇含まない | 121 | **308%** | 最高 |
| TM05-T024 | trio | 1,2,3号艇 | 58 | **307%** | 最高 |
| TM05-T025 | trio | 1号艇含まない×conf80+ | 102 | **304%** | 最高 |
| TM05-T026 | trio | 2,5号艇含む | 110 | **287%** | 最高 |
| TM05-T027 | trio | 2,6号艇含む | 81 | **257%** | 最高 |
| TM05-T028 | trio | 後半R×1号艇含む | 104 | **256%** | 最高 |
| TM05-T029 | trio | 4,6号艇含む | 60 | **247%** | 最高 |
| TM05-T030 | trio | 3,5号艇含む | 65 | **246%** | 最高 |
| TM05-T031 | trio | 2,3号艇含む | 92 | **238%** | 最高 |
| TM05-T032 | trio | 後半R(10R〜) | 123 | **217%** | 最高 |
| TM05-P001 | place | 3号艇1着+1号艇含む(複勝) | 27 | **212%** | 中 |
| TM05-P002 | place | 4号艇1着+6号艇含む(複勝) | 18 | **182%** | 中 |
| TM05-P003 | place | 4号艇1着+2号艇含む(複勝) | 29 | **168%** | 中 |
| TM05-P004 | place | 3号艇1着×conf80+(複勝) | 38 | **162%** | 高 |
| TM05-W001 | win | 4号艇1着+5号艇含む | 17 | **146%** | 中 |
| TM05-P005 | place | 2号艇1着×conf80+(複勝) | 61 | **145%** | 最高 |
| TM05-W002 | win | 4号艇1着+2号艇含む | 29 | **144%** | 中 |
| TM05-P006 | place | 5号艇1着+3号艇含む(複勝) | 16 | **144%** | 中 |
| TM05-P007 | place | 3号艇1着(複勝) | 51 | **139%** | 最高 |
| TM05-T033 | trio | 1,4,5号艇 | 15 | **139%** | 中 |
| TM05-P008 | place | 2号艇1着(複勝) | 76 | **138%** | 最高 |
| TM05-P009 | place | 4号艇1着×conf80+(複勝) | 46 | **130%** | 高 |
| TM05-T034 | trio | 1,3,5号艇 | 36 | **126%** | 高 |
| TM05-P010 | place | 2号艇1着+1号艇含む(複勝) | 52 | **125%** | 最高 |
| TM05-P011 | place | 6号艇1着+1号艇含む(複勝) | 19 | **124%** | 中 |
| TM05-P012 | place | 4号艇1着(複勝) | 54 | **121%** | 最高 |
| TM05-P013 | place | 4号艇1着+5号艇含む(複勝) | 17 | **119%** | 中 |
| TM05-P014 | place | 5号艇1着+1号艇含む(複勝) | 23 | **117%** | 中 |
| TM05-P015 | place | 6号艇1着+2号艇含む(複勝) | 15 | **117%** | 中 |
| TM05-P016 | place | 5号艇1着+4号艇含む(複勝) | 12 | **116%** | 低 |
| TM05-P017 | place | 後半R(10R〜)複勝 | 123 | **112%** | 最高 |
| TM05-P018 | place | 6号艇1着(複勝) | 41 | **110%** | 高 |
| TM05-P019 | place | 6号艇1着+4号艇含む(複勝) | 15 | **110%** | 中 |
| TM05-P020 | place | 6号艇1着×conf80+(複勝) | 31 | **110%** | 高 |
| TM05-P021 | place | 5号艇1着(複勝) | 46 | **108%** | 高 |
| TM05-P022 | place | 6号艇1着+5号艇含む(複勝) | 20 | **108%** | 中 |
| TM05-P023 | place | 1号艇1着(複勝) | 220 | **107%** | 最高 |
| TM05-P024 | place | 5号艇1着×conf80+(複勝) | 36 | **104%** | 高 |
| TM05-W003 | win | 4号艇1着×conf80+ | 46 | **103%** | 高 |

---

## ルール詳細

### TM05-T001: 1,5,6号艇

**回収率: 2131% | サンプル: 19戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T002: 5,6号艇含む

**回収率: 944% | サンプル: 57戦 | 信頼性: 最高**

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

### TM05-T003: 1,3,6号艇

**回収率: 876% | サンプル: 15戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T004: 3,5,6号艇

**回収率: 690% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "3-5-6"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T005: 1,6号艇含む

**回収率: 687% | サンプル: 96戦 | 信頼性: 最高**

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

### TM05-T006: 1,5号艇含む

**回収率: 524% | サンプル: 136戦 | 信頼性: 最高**

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

### TM05-T007: 2,4,6号艇

**回収率: 507% | サンプル: 18戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-4-6"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T008: 4,5,6号艇

**回収率: 506% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "4-5-6"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T009: 3,6号艇含む

**回収率: 487% | サンプル: 44戦 | 信頼性: 高**

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

### TM05-T010: 1,3,4号艇

**回収率: 460% | サンプル: 44戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T011: 1号艇含む×conf80+

**回収率: 459% | サンプル: 296戦 | 信頼性: 最高**

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

### TM05-T012: 2,4,5号艇

**回収率: 416% | サンプル: 18戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-4-5"
};

// 賭け方
const betType = "trio";
```

---

### TM05-T013: 2,4号艇含む

**回収率: 403% | サンプル: 101戦 | 信頼性: 最高**

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

### TM05-T014: 3,4号艇含む

**回収率: 394% | サンプル: 70戦 | 信頼性: 最高**

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

### TM05-T015: 1,2,4号艇

**回収率: 384% | サンプル: 52戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_05(prediction, ruleId) {
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
TM05-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
