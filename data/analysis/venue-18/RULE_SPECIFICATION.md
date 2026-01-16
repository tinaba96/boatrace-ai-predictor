# 徳山（会場コード: 18）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-04 〜 2026-01-13
**サンプル数**: 456レース

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
| TY18-T001 | trio | 1,5,6号艇 | 17 | **2081%** | 中 |
| TY18-T002 | trio | 2,4,5号艇 | 12 | **1848%** | 低 |
| TY18-T003 | trio | 1,4,6号艇 | 27 | **936%** | 中 |
| TY18-T004 | trio | 1,2,4号艇 | 44 | **852%** | 高 |
| TY18-T005 | trio | 5,6号艇含む | 59 | **797%** | 最高 |
| TY18-T006 | trio | 1,2,3号艇 | 60 | **789%** | 最高 |
| TY18-T007 | trio | 2,4号艇含む | 81 | **779%** | 最高 |
| TY18-T008 | trio | 2,5号艇含む | 67 | **752%** | 最高 |
| TY18-T009 | trio | 1,4号艇含む | 127 | **686%** | 最高 |
| TY18-T010 | trio | 1,5号艇含む | 100 | **683%** | 最高 |
| TY18-T011 | trio | 4,5号艇含む | 55 | **663%** | 最高 |
| TY18-T012 | trio | 1号艇含む×conf80+ | 279 | **647%** | 最高 |
| TY18-T013 | trio | 1,6号艇含む | 118 | **642%** | 最高 |
| TY18-T014 | trio | 1,2号艇含む | 175 | **627%** | 最高 |
| TY18-T015 | trio | 2,3号艇含む | 91 | **601%** | 最高 |
| TY18-T016 | trio | 4,6号艇含む | 62 | **571%** | 最高 |
| TY18-T017 | trio | 4,5,6号艇 | 13 | **512%** | 低 |
| TY18-T018 | trio | 1,3号艇含む | 160 | **497%** | 最高 |
| TY18-T019 | trio | 1,2,5号艇 | 33 | **482%** | 高 |
| TY18-T020 | trio | 1,3,4号艇 | 35 | **478%** | 高 |
| TY18-T021 | trio | 後半R×1号艇含む | 85 | **393%** | 最高 |
| TY18-T022 | trio | 1号艇含まない | 116 | **384%** | 最高 |
| TY18-T023 | trio | 後半R(10R〜) | 114 | **381%** | 最高 |
| TY18-T024 | trio | 1号艇含まない×conf80+ | 91 | **379%** | 最高 |
| TY18-T025 | trio | 1,4,5号艇 | 21 | **365%** | 中 |
| TY18-T026 | trio | 2,5,6号艇 | 14 | **356%** | 低 |
| TY18-T027 | trio | 後半R×1号艇含まない | 29 | **349%** | 中 |
| TY18-T028 | trio | 1,3,5号艇 | 29 | **322%** | 中 |
| TY18-W001 | win | 3号艇1着+4号艇含む | 18 | **274%** | 中 |
| TY18-T029 | trio | 3,5号艇含む | 61 | **273%** | 最高 |
| TY18-W002 | win | 3号艇1着+2号艇含む | 21 | **271%** | 中 |
| TY18-T030 | trio | 3,4号艇含む | 63 | **266%** | 最高 |
| TY18-T031 | trio | 2,4,6号艇 | 14 | **247%** | 低 |
| TY18-T032 | trio | 1,2,6号艇 | 38 | **237%** | 高 |
| TY18-T033 | trio | 2,6号艇含む | 78 | **224%** | 最高 |
| TY18-W003 | win | 4号艇1着+6号艇含む | 21 | **195%** | 中 |
| TY18-W004 | win | 4号艇1着+3号艇含む | 17 | **184%** | 中 |
| TY18-W005 | win | 3号艇1着×conf80+ | 43 | **175%** | 高 |
| TY18-T034 | trio | 1,3,6号艇 | 36 | **171%** | 高 |
| TY18-P001 | place | 5号艇1着+4号艇含む(複勝) | 11 | **166%** | 低 |
| TY18-W006 | win | 3号艇1着 | 59 | **153%** | 最高 |
| TY18-P002 | place | 4号艇1着+6号艇含む(複勝) | 21 | **150%** | 中 |
| TY18-P003 | place | 5号艇1着×conf80+(複勝) | 25 | **120%** | 中 |
| TY18-W007 | win | 3号艇1着+1号艇含む | 32 | **115%** | 高 |
| TY18-W008 | win | 4号艇1着 | 54 | **112%** | 最高 |
| TY18-P004 | place | 5号艇1着+3号艇含む(複勝) | 12 | **110%** | 低 |
| TY18-W009 | win | 後半R(10R〜)単勝 | 114 | **109%** | 最高 |
| TY18-W010 | win | 6号艇1着+4号艇含む | 17 | **108%** | 中 |
| TY18-P005 | place | 4号艇1着+5号艇含む(複勝) | 23 | **107%** | 中 |
| TY18-W011 | win | 3号艇1着+6号艇含む | 24 | **103%** | 中 |
| TY18-P006 | place | 5号艇1着(複勝) | 33 | **103%** | 高 |
| TY18-P007 | place | 1号艇1着(複勝) | 206 | **102%** | 最高 |

---

## ルール詳細

### TY18-T001: 1,5,6号艇

**回収率: 2081% | サンプル: 17戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### TY18-T002: 2,4,5号艇

**回収率: 1848% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-4-5"
};

// 賭け方
const betType = "trio";
```

---

### TY18-T003: 1,4,6号艇

**回収率: 936% | サンプル: 27戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-6"
};

// 賭け方
const betType = "trio";
```

---

### TY18-T004: 1,2,4号艇

**回収率: 852% | サンプル: 44戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### TY18-T005: 5,6号艇含む

**回収率: 797% | サンプル: 59戦 | 信頼性: 最高**

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

### TY18-T006: 1,2,3号艇

**回収率: 789% | サンプル: 60戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### TY18-T007: 2,4号艇含む

**回収率: 779% | サンプル: 81戦 | 信頼性: 最高**

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

### TY18-T008: 2,5号艇含む

**回収率: 752% | サンプル: 67戦 | 信頼性: 最高**

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

### TY18-T009: 1,4号艇含む

**回収率: 686% | サンプル: 127戦 | 信頼性: 最高**

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

### TY18-T010: 1,5号艇含む

**回収率: 683% | サンプル: 100戦 | 信頼性: 最高**

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

### TY18-T011: 4,5号艇含む

**回収率: 663% | サンプル: 55戦 | 信頼性: 最高**

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

### TY18-T012: 1号艇含む×conf80+

**回収率: 647% | サンプル: 279戦 | 信頼性: 最高**

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

### TY18-T013: 1,6号艇含む

**回収率: 642% | サンプル: 118戦 | 信頼性: 最高**

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

### TY18-T014: 1,2号艇含む

**回収率: 627% | サンプル: 175戦 | 信頼性: 最高**

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

### TY18-T015: 2,3号艇含む

**回収率: 601% | サンプル: 91戦 | 信頼性: 最高**

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
function shouldBet_18(prediction, ruleId) {
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
TY18-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
