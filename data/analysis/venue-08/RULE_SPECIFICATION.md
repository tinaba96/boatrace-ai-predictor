# 常滑（会場コード: 08）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-08
**サンプル数**: 466レース

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
| TK08-T001 | trio | 3,4,5号艇 | 13 | **868%** | 低 |
| TK08-T002 | trio | 1,2,4号艇 | 47 | **858%** | 高 |
| TK08-T003 | trio | 2,3,6号艇 | 11 | **765%** | 低 |
| TK08-T004 | trio | 2,4号艇含む | 80 | **537%** | 最高 |
| TK08-T005 | trio | 1,4号艇含む | 150 | **524%** | 最高 |
| TK08-T006 | trio | 後半R×1号艇含む | 92 | **479%** | 最高 |
| TK08-T007 | trio | 1,4,6号艇 | 30 | **474%** | 高 |
| TK08-T008 | trio | 後半R(10R〜) | 109 | **404%** | 最高 |
| TK08-T009 | trio | 1,2号艇含む | 166 | **400%** | 最高 |
| TK08-T010 | trio | 4,5号艇含む | 55 | **369%** | 最高 |
| TK08-T011 | trio | 3,4号艇含む | 80 | **362%** | 最高 |
| TK08-T012 | trio | 1,3,4号艇 | 48 | **347%** | 高 |
| TK08-T013 | trio | 1号艇含む×conf80+ | 307 | **340%** | 最高 |
| TK08-T014 | trio | 3,5号艇含む | 79 | **331%** | 最高 |
| TK08-T015 | trio | 1,3,5号艇 | 36 | **331%** | 高 |
| TK08-T016 | trio | 4,6号艇含む | 45 | **316%** | 高 |
| TK08-T017 | trio | 2,6号艇含む | 53 | **303%** | 最高 |
| TK08-T018 | trio | 1,2,3号艇 | 56 | **301%** | 最高 |
| TK08-T019 | trio | 1,4,5号艇 | 25 | **295%** | 中 |
| TK08-T020 | trio | 1,2,6号艇 | 26 | **293%** | 中 |
| TK08-T021 | trio | 2,3号艇含む | 101 | **289%** | 最高 |
| TK08-T022 | trio | 1,3号艇含む | 176 | **288%** | 最高 |
| TK08-T023 | trio | 1,6号艇含む | 111 | **253%** | 最高 |
| TK08-T024 | trio | 1号艇含まない | 106 | **239%** | 最高 |
| TK08-T025 | trio | 3,6号艇含む | 62 | **220%** | 最高 |
| TK08-T026 | trio | 1,5号艇含む | 117 | **187%** | 最高 |
| TK08-W001 | win | 4号艇1着+6号艇含む | 15 | **177%** | 中 |
| TK08-T027 | trio | 1号艇含まない×conf80+ | 88 | **173%** | 最高 |
| TK08-T028 | trio | 2,3,5号艇 | 19 | **157%** | 中 |
| TK08-P001 | place | 5号艇1着+2号艇含む(複勝) | 16 | **144%** | 中 |
| TK08-T029 | trio | 1,3,6号艇 | 36 | **144%** | 高 |
| TK08-P002 | place | 5号艇1着+6号艇含む(複勝) | 14 | **141%** | 低 |
| TK08-P003 | place | 3号艇1着×conf80+(複勝) | 53 | **140%** | 最高 |
| TK08-P004 | place | 5号艇1着×conf80+(複勝) | 33 | **137%** | 高 |
| TK08-T030 | trio | 2,4,5号艇 | 12 | **136%** | 低 |
| TK08-P005 | place | 3号艇1着(複勝) | 62 | **133%** | 最高 |
| TK08-P006 | place | 4号艇1着+6号艇含む(複勝) | 15 | **131%** | 中 |
| TK08-P007 | place | 5号艇1着+3号艇含む(複勝) | 18 | **131%** | 中 |
| TK08-W002 | win | 6号艇1着+2号艇含む | 11 | **128%** | 低 |
| TK08-P008 | place | 3号艇1着+1号艇含む(複勝) | 31 | **116%** | 高 |
| TK08-P009 | place | 5号艇1着(複勝) | 46 | **115%** | 高 |
| TK08-W003 | win | 3号艇1着+6号艇含む | 15 | **109%** | 中 |
| TK08-P010 | place | 4号艇1着+1号艇含む(複勝) | 24 | **107%** | 中 |
| TK08-P011 | place | 1号艇1着(複勝) | 219 | **106%** | 最高 |
| TK08-W004 | win | 4号艇1着+2号艇含む | 20 | **103%** | 中 |
| TK08-W005 | win | 1号艇1着+4号艇含む | 92 | **102%** | 最高 |

---

## ルール詳細

### TK08-T001: 3,4,5号艇

**回収率: 868% | サンプル: 13戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "3-4-5"
};

// 賭け方
const betType = "trio";
```

---

### TK08-T002: 1,2,4号艇

**回収率: 858% | サンプル: 47戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### TK08-T003: 2,3,6号艇

**回収率: 765% | サンプル: 11戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-6"
};

// 賭け方
const betType = "trio";
```

---

### TK08-T004: 2,4号艇含む

**回収率: 537% | サンプル: 80戦 | 信頼性: 最高**

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

### TK08-T005: 1,4号艇含む

**回収率: 524% | サンプル: 150戦 | 信頼性: 最高**

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

### TK08-T006: 後半R×1号艇含む

**回収率: 479% | サンプル: 92戦 | 信頼性: 最高**

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

### TK08-T007: 1,4,6号艇

**回収率: 474% | サンプル: 30戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

### TK08-T008: 後半R(10R〜)

**回収率: 404% | サンプル: 109戦 | 信頼性: 最高**

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

### TK08-T009: 1,2号艇含む

**回収率: 400% | サンプル: 166戦 | 信頼性: 最高**

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

### TK08-T010: 4,5号艇含む

**回収率: 369% | サンプル: 55戦 | 信頼性: 最高**

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

### TK08-T011: 3,4号艇含む

**回収率: 362% | サンプル: 80戦 | 信頼性: 最高**

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

### TK08-T012: 1,3,4号艇

**回収率: 347% | サンプル: 48戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-4"
};

// 賭け方
const betType = "trio";
```

---

### TK08-T013: 1号艇含む×conf80+

**回収率: 340% | サンプル: 307戦 | 信頼性: 最高**

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

### TK08-T014: 3,5号艇含む

**回収率: 331% | サンプル: 79戦 | 信頼性: 最高**

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

### TK08-T015: 1,3,5号艇

**回収率: 331% | サンプル: 36戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-5"
};

// 賭け方
const betType = "trio";
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet_08(prediction, ruleId) {
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
TK08-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
