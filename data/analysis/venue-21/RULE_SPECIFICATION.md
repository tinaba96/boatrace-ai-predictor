# 芦屋（会場コード: 21）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-15
**サンプル数**: 381レース

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
| AS21-T001 | trio | 2,4,6号艇 | 10 | **17760%** | 低 |
| AS21-T002 | trio | 後半R×1号艇含まない | 32 | **7417%** | 高 |
| AS21-T003 | trio | 4,6号艇含む | 42 | **4800%** | 高 |
| AS21-T004 | trio | 2,3,6号艇 | 10 | **4643%** | 低 |
| AS21-T005 | trio | 2,6号艇含む | 62 | **3734%** | 最高 |
| AS21-T006 | trio | 2,4号艇含む | 67 | **2790%** | 最高 |
| AS21-T007 | trio | 1号艇含まない×conf80+ | 90 | **2734%** | 最高 |
| AS21-T008 | trio | 後半R(10R〜) | 95 | **2563%** | 最高 |
| AS21-T009 | trio | 1号艇含まない | 103 | **2427%** | 最高 |
| AS21-T010 | trio | 3,6号艇含む | 54 | **1242%** | 最高 |
| AS21-T011 | trio | 2,3号艇含む | 77 | **909%** | 最高 |
| AS21-T012 | trio | 1,3,6号艇 | 24 | **696%** | 中 |
| AS21-T013 | trio | 4,5号艇含む | 46 | **521%** | 高 |
| AS21-T014 | trio | 1,2,5号艇 | 36 | **518%** | 高 |
| AS21-T015 | trio | 1,4,6号艇 | 12 | **428%** | 低 |
| AS21-T016 | trio | 1,2,3号艇 | 44 | **426%** | 高 |
| AS21-T017 | trio | 5,6号艇含む | 42 | **419%** | 高 |
| AS21-T018 | trio | 2,3,5号艇 | 12 | **404%** | 低 |
| AS21-T019 | trio | 1,6号艇含む | 80 | **400%** | 最高 |
| AS21-T020 | trio | 1,2号艇含む | 145 | **374%** | 最高 |
| AS21-T021 | trio | 1,3号艇含む | 129 | **369%** | 最高 |
| AS21-T022 | trio | 1号艇含む×conf80+ | 243 | **351%** | 最高 |
| AS21-T023 | trio | 1,4,5号艇 | 20 | **341%** | 中 |
| AS21-T024 | trio | 2,5号艇含む | 71 | **331%** | 最高 |
| AS21-T025 | trio | 1,5号艇含む | 97 | **322%** | 最高 |
| AS21-T026 | trio | 1,4号艇含む | 105 | **289%** | 最高 |
| AS21-T027 | trio | 3,4,6号艇 | 14 | **281%** | 低 |
| AS21-T028 | trio | 1,2,6号艇 | 28 | **267%** | 中 |
| AS21-T029 | trio | 1,2,4号艇 | 37 | **252%** | 高 |
| AS21-T030 | trio | 1,3,4号艇 | 36 | **252%** | 高 |
| AS21-T031 | trio | 3,4号艇含む | 72 | **212%** | 最高 |
| AS21-T032 | trio | 3,4,5号艇 | 11 | **205%** | 低 |
| AS21-W001 | win | 5号艇1着+1号艇含む | 13 | **199%** | 低 |
| AS21-T033 | trio | 3,5号艇含む | 54 | **190%** | 最高 |
| AS21-W002 | win | 5号艇1着+6号艇含む | 11 | **168%** | 低 |
| AS21-T034 | trio | 1,5,6号艇 | 16 | **167%** | 中 |
| AS21-W003 | win | 2号艇1着+4号艇含む | 19 | **155%** | 中 |
| AS21-W004 | win | 6号艇1着+5号艇含む | 16 | **152%** | 中 |
| AS21-P001 | place | 3号艇1着(複勝) | 46 | **132%** | 高 |
| AS21-P002 | place | 3号艇1着×conf80+(複勝) | 39 | **131%** | 高 |
| AS21-W005 | win | 2号艇1着+5号艇含む | 17 | **129%** | 中 |
| AS21-W006 | win | 2号艇1着+6号艇含む | 18 | **129%** | 中 |
| AS21-T035 | trio | 1,3,5号艇 | 25 | **126%** | 中 |
| AS21-W007 | win | 4号艇1着+6号艇含む | 12 | **122%** | 低 |
| AS21-P003 | place | 3号艇1着+1号艇含む(複勝) | 21 | **119%** | 中 |
| AS21-W008 | win | 2号艇1着×conf80+ | 44 | **117%** | 高 |
| AS21-W009 | win | 後半R(10R〜)単勝 | 95 | **112%** | 最高 |
| AS21-W010 | win | 1号艇1着+6号艇含む | 41 | **108%** | 高 |
| AS21-W011 | win | 5号艇1着 | 31 | **105%** | 高 |
| AS21-W012 | win | 1号艇1着×後半R | 50 | **102%** | 最高 |
| AS21-P004 | place | 2号艇1着(複勝) | 52 | **102%** | 最高 |
| AS21-P005 | place | 2号艇1着×conf80+(複勝) | 44 | **102%** | 高 |
| AS21-P006 | place | 6号艇1着+5号艇含む(複勝) | 16 | **101%** | 中 |

---

## ルール詳細

### AS21-T001: 2,4,6号艇

**回収率: 17760% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-4-6"
};

// 賭け方
const betType = "trio";
```

---

### AS21-T002: 後半R×1号艇含まない

**回収率: 7417% | サンプル: 32戦 | 信頼性: 高**

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

### AS21-T003: 4,6号艇含む

**回収率: 4800% | サンプル: 42戦 | 信頼性: 高**

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

### AS21-T004: 2,3,6号艇

**回収率: 4643% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-6"
};

// 賭け方
const betType = "trio";
```

---

### AS21-T005: 2,6号艇含む

**回収率: 3734% | サンプル: 62戦 | 信頼性: 最高**

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

### AS21-T006: 2,4号艇含む

**回収率: 2790% | サンプル: 67戦 | 信頼性: 最高**

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

### AS21-T007: 1号艇含まない×conf80+

**回収率: 2734% | サンプル: 90戦 | 信頼性: 最高**

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

### AS21-T008: 後半R(10R〜)

**回収率: 2563% | サンプル: 95戦 | 信頼性: 最高**

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

### AS21-T009: 1号艇含まない

**回収率: 2427% | サンプル: 103戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### AS21-T010: 3,6号艇含む

**回収率: 1242% | サンプル: 54戦 | 信頼性: 最高**

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

### AS21-T011: 2,3号艇含む

**回収率: 909% | サンプル: 77戦 | 信頼性: 最高**

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

### AS21-T012: 1,3,6号艇

**回収率: 696% | サンプル: 24戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### AS21-T013: 4,5号艇含む

**回収率: 521% | サンプル: 46戦 | 信頼性: 高**

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

### AS21-T014: 1,2,5号艇

**回収率: 518% | サンプル: 36戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-5"
};

// 賭け方
const betType = "trio";
```

---

### AS21-T015: 1,4,6号艇

**回収率: 428% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_21(prediction, ruleId) {
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
AS21-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
