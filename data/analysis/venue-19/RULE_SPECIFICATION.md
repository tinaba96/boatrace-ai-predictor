# 下関（会場コード: 19）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-07 〜 2026-01-13
**サンプル数**: 384レース

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
| SK19-T001 | trio | 1,5,6号艇 | 20 | **1734%** | 中 |
| SK19-T002 | trio | 1,4,5号艇 | 18 | **1309%** | 中 |
| SK19-T003 | trio | 5,6号艇含む | 39 | **1007%** | 高 |
| SK19-T004 | trio | 1,5号艇含む | 77 | **909%** | 最高 |
| SK19-T005 | trio | 1,2,3号艇 | 64 | **709%** | 最高 |
| SK19-T006 | trio | 1,6号艇含む | 89 | **654%** | 最高 |
| SK19-T007 | trio | 1,2,4号艇 | 52 | **651%** | 最高 |
| SK19-T008 | trio | 1,2号艇含む | 161 | **593%** | 最高 |
| SK19-T009 | trio | 1,4号艇含む | 117 | **579%** | 最高 |
| SK19-T010 | trio | 1号艇含む×conf80+ | 249 | **572%** | 最高 |
| SK19-T011 | trio | 4,5号艇含む | 43 | **567%** | 高 |
| SK19-T012 | trio | 2,3号艇含む | 89 | **556%** | 最高 |
| SK19-T013 | trio | 1,3号艇含む | 144 | **464%** | 最高 |
| SK19-T014 | trio | 2,3,5号艇 | 10 | **411%** | 低 |
| SK19-T015 | trio | 3,6号艇含む | 52 | **406%** | 最高 |
| SK19-T016 | trio | 2,4号艇含む | 88 | **385%** | 最高 |
| SK19-T017 | trio | 1,2,6号艇 | 25 | **361%** | 中 |
| SK19-T018 | trio | 1,3,6号艇 | 29 | **361%** | 中 |
| SK19-T019 | trio | 1,2,5号艇 | 20 | **358%** | 中 |
| SK19-T020 | trio | 後半R×1号艇含む | 80 | **349%** | 最高 |
| SK19-W001 | win | 5号艇1着+2号艇含む | 10 | **320%** | 低 |
| SK19-T021 | trio | 3,5号艇含む | 45 | **314%** | 高 |
| SK19-T022 | trio | 後半R(10R〜) | 103 | **271%** | 最高 |
| SK19-T023 | trio | 1,4,6号艇 | 15 | **268%** | 中 |
| SK19-W002 | win | 3号艇1着+2号艇含む | 17 | **255%** | 中 |
| SK19-T024 | trio | 2,5号艇含む | 46 | **245%** | 高 |
| SK19-T025 | trio | 1,3,5号艇 | 19 | **242%** | 中 |
| SK19-T026 | trio | 3,4号艇含む | 58 | **227%** | 最高 |
| SK19-T027 | trio | 4,6号艇含む | 48 | **210%** | 高 |
| SK19-W003 | win | 2号艇1着+3号艇含む | 17 | **202%** | 中 |
| SK19-T028 | trio | 1,3,4号艇 | 32 | **197%** | 高 |
| SK19-T029 | trio | 1号艇含まない | 90 | **173%** | 最高 |
| SK19-W004 | win | 3号艇1着+5号艇含む | 15 | **166%** | 中 |
| SK19-T030 | trio | 2,6号艇含む | 56 | **161%** | 最高 |
| SK19-T031 | trio | 1号艇含まない×conf80+ | 76 | **151%** | 最高 |
| SK19-W005 | win | 3号艇1着+1号艇含む | 27 | **148%** | 中 |
| SK19-W006 | win | 5号艇1着 | 29 | **144%** | 中 |
| SK19-W007 | win | 2号艇1着+1号艇含む | 28 | **144%** | 中 |
| SK19-W008 | win | 5号艇1着×conf80+ | 23 | **140%** | 中 |
| SK19-P001 | place | 4号艇1着+6号艇含む(複勝) | 12 | **138%** | 低 |
| SK19-W009 | win | 3号艇1着 | 45 | **132%** | 高 |
| SK19-P002 | place | 2号艇1着×conf80+(複勝) | 43 | **128%** | 高 |
| SK19-P003 | place | 6号艇1着+1号艇含む(複勝) | 17 | **124%** | 中 |
| SK19-W010 | win | 2号艇1着×conf80+ | 43 | **120%** | 高 |
| SK19-P004 | place | 2号艇1着(複勝) | 53 | **119%** | 最高 |
| SK19-P005 | place | 3号艇1着+1号艇含む(複勝) | 27 | **115%** | 中 |
| SK19-W011 | win | 2号艇1着 | 53 | **113%** | 最高 |
| SK19-W012 | win | 後半R(10R〜)単勝 | 103 | **109%** | 最高 |
| SK19-P006 | place | 4号艇1着+1号艇含む(複勝) | 15 | **108%** | 中 |
| SK19-P007 | place | 1号艇1着(複勝) | 187 | **105%** | 最高 |
| SK19-P008 | place | 4号艇1着(複勝) | 33 | **105%** | 高 |
| SK19-P009 | place | 4号艇1着×conf80+(複勝) | 28 | **104%** | 中 |
| SK19-W013 | win | 1号艇1着+4号艇含む | 75 | **101%** | 最高 |
| SK19-P010 | place | 6号艇1着+4号艇含む(複勝) | 15 | **101%** | 中 |
| SK19-W014 | win | 3号艇1着×conf80+ | 32 | **100%** | 高 |

---

## ルール詳細

### SK19-T001: 1,5,6号艇

**回収率: 1734% | サンプル: 20戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### SK19-T002: 1,4,5号艇

**回収率: 1309% | サンプル: 18戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-4-5"
};

// 賭け方
const betType = "trio";
```

---

### SK19-T003: 5,6号艇含む

**回収率: 1007% | サンプル: 39戦 | 信頼性: 高**

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

### SK19-T004: 1,5号艇含む

**回収率: 909% | サンプル: 77戦 | 信頼性: 最高**

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

### SK19-T005: 1,2,3号艇

**回収率: 709% | サンプル: 64戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-3"
};

// 賭け方
const betType = "trio";
```

---

### SK19-T006: 1,6号艇含む

**回収率: 654% | サンプル: 89戦 | 信頼性: 最高**

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

### SK19-T007: 1,2,4号艇

**回収率: 651% | サンプル: 52戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### SK19-T008: 1,2号艇含む

**回収率: 593% | サンプル: 161戦 | 信頼性: 最高**

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

### SK19-T009: 1,4号艇含む

**回収率: 579% | サンプル: 117戦 | 信頼性: 最高**

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

### SK19-T010: 1号艇含む×conf80+

**回収率: 572% | サンプル: 249戦 | 信頼性: 最高**

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

### SK19-T011: 4,5号艇含む

**回収率: 567% | サンプル: 43戦 | 信頼性: 高**

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

### SK19-T012: 2,3号艇含む

**回収率: 556% | サンプル: 89戦 | 信頼性: 最高**

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

### SK19-T013: 1,3号艇含む

**回収率: 464% | サンプル: 144戦 | 信頼性: 最高**

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

### SK19-T014: 2,3,5号艇

**回収率: 411% | サンプル: 10戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "2-3-5"
};

// 賭け方
const betType = "trio";
```

---

### SK19-T015: 3,6号艇含む

**回収率: 406% | サンプル: 52戦 | 信頼性: 最高**

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

## 実装例

### ルール適用関数

```javascript
function shouldBet_19(prediction, ruleId) {
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
SK19-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
