# 唐津（会場コード: 23）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025-12-14 〜 2026-01-16
**サンプル数**: 373レース

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
| KR23-T001 | trio | 1,5,6号艇 | 12 | **1707%** | 低 |
| KR23-T002 | trio | 5,6号艇含む | 25 | **1092%** | 中 |
| KR23-T003 | trio | 1,6号艇含む | 77 | **678%** | 最高 |
| KR23-T004 | trio | 1,2,6号艇 | 32 | **627%** | 高 |
| KR23-T005 | trio | 2,4号艇含む | 80 | **563%** | 最高 |
| KR23-T006 | trio | 3,6号艇含む | 32 | **555%** | 高 |
| KR23-T007 | trio | 2,5号艇含む | 49 | **543%** | 高 |
| KR23-T008 | trio | 1,2,4号艇 | 66 | **518%** | 最高 |
| KR23-T009 | trio | 1,3,6号艇 | 22 | **497%** | 中 |
| KR23-T010 | trio | 1,2,5号艇 | 33 | **477%** | 高 |
| KR23-T011 | trio | 1号艇含まない | 39 | **454%** | 高 |
| KR23-T012 | trio | 2,6号艇含む | 45 | **446%** | 高 |
| KR23-T013 | trio | 1,2号艇含む | 201 | **430%** | 最高 |
| KR23-T014 | trio | 1,5号艇含む | 94 | **425%** | 最高 |
| KR23-T015 | trio | 1号艇含む×conf80+ | 278 | **375%** | 最高 |
| KR23-T016 | trio | 4,5号艇含む | 32 | **370%** | 高 |
| KR23-T017 | trio | 1,4号艇含む | 137 | **366%** | 最高 |
| KR23-T018 | trio | 1,3,4号艇 | 39 | **366%** | 高 |
| KR23-T019 | trio | 後半R(10R〜) | 93 | **344%** | 最高 |
| KR23-T020 | trio | 1号艇含まない×conf80+ | 32 | **340%** | 高 |
| KR23-T021 | trio | 後半R×1号艇含む | 85 | **296%** | 最高 |
| KR23-T022 | trio | 3,4号艇含む | 50 | **285%** | 最高 |
| KR23-T023 | trio | 1,3号艇含む | 159 | **279%** | 最高 |
| KR23-T024 | trio | 3,5号艇含む | 38 | **252%** | 高 |
| KR23-T025 | trio | 1,2,3号艇 | 70 | **235%** | 最高 |
| KR23-T026 | trio | 2,3号艇含む | 79 | **208%** | 最高 |
| KR23-W001 | win | 3号艇1着+1号艇含む | 21 | **196%** | 中 |
| KR23-P001 | place | 4号艇1着×conf80+(複勝) | 18 | **191%** | 中 |
| KR23-P002 | place | 4号艇1着+1号艇含む(複勝) | 21 | **187%** | 中 |
| KR23-P003 | place | 4号艇1着+2号艇含む(複勝) | 15 | **184%** | 中 |
| KR23-P004 | place | 3号艇1着×conf80+(複勝) | 27 | **168%** | 中 |
| KR23-P005 | place | 4号艇1着(複勝) | 25 | **162%** | 中 |
| KR23-P006 | place | 3号艇1着+1号艇含む(複勝) | 21 | **162%** | 中 |
| KR23-P007 | place | 3号艇1着(複勝) | 31 | **154%** | 高 |
| KR23-W002 | win | 3号艇1着 | 31 | **152%** | 高 |
| KR23-P008 | place | 2号艇1着×conf80+(複勝) | 35 | **114%** | 高 |
| KR23-P009 | place | 2号艇1着+1号艇含む(複勝) | 34 | **111%** | 高 |
| KR23-P010 | place | 1号艇1着(複勝) | 228 | **110%** | 最高 |
| KR23-W003 | win | 1号艇1着+2号艇含む | 138 | **106%** | 最高 |
| KR23-W004 | win | 2号艇1着+3号艇含む | 12 | **106%** | 低 |
| KR23-W005 | win | 1号艇1着×conf80+ | 195 | **101%** | 最高 |
| KR23-W006 | win | 1号艇1着+4号艇含む | 93 | **100%** | 最高 |
| KR23-P011 | place | 5号艇1着+2号艇含む(複勝) | 16 | **100%** | 中 |

---

## ルール詳細

### KR23-T001: 1,5,6号艇

**回収率: 1707% | サンプル: 12戦 | 信頼性: 低**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-5-6"
};

// 賭け方
const betType = "trio";
```

---

### KR23-T002: 5,6号艇含む

**回収率: 1092% | サンプル: 25戦 | 信頼性: 中**

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

### KR23-T003: 1,6号艇含む

**回収率: 678% | サンプル: 77戦 | 信頼性: 最高**

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

### KR23-T004: 1,2,6号艇

**回収率: 627% | サンプル: 32戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-6"
};

// 賭け方
const betType = "trio";
```

---

### KR23-T005: 2,4号艇含む

**回収率: 563% | サンプル: 80戦 | 信頼性: 最高**

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

### KR23-T006: 3,6号艇含む

**回収率: 555% | サンプル: 32戦 | 信頼性: 高**

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

### KR23-T007: 2,5号艇含む

**回収率: 543% | サンプル: 49戦 | 信頼性: 高**

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

### KR23-T008: 1,2,4号艇

**回収率: 518% | サンプル: 66戦 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-4"
};

// 賭け方
const betType = "trio";
```

---

### KR23-T009: 1,3,6号艇

**回収率: 497% | サンプル: 22戦 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-3-6"
};

// 賭け方
const betType = "trio";
```

---

### KR23-T010: 1,2,5号艇

**回収率: 477% | サンプル: 33戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "prediction_sorted": "1-2-5"
};

// 賭け方
const betType = "trio";
```

---

### KR23-T011: 1号艇含まない

**回収率: 454% | サンプル: 39戦 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  "excludes_boat_1": true
};

// 賭け方
const betType = "trio";
```

---

### KR23-T012: 2,6号艇含む

**回収率: 446% | サンプル: 45戦 | 信頼性: 高**

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

### KR23-T013: 1,2号艇含む

**回収率: 430% | サンプル: 201戦 | 信頼性: 最高**

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

### KR23-T014: 1,5号艇含む

**回収率: 425% | サンプル: 94戦 | 信頼性: 最高**

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

### KR23-T015: 1号艇含む×conf80+

**回収率: 375% | サンプル: 278戦 | 信頼性: 最高**

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
function shouldBet_23(prediction, ruleId) {
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
KR23-T001
│   └── 連番
└────── 賭け方: W=単勝, P=複勝, T=3連複
```
