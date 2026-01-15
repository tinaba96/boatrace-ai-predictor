# 江戸川（会場コード: 03）ルール実装仕様書

## 概要

このドキュメントは、分析で発見したルールを**実装するための仕様**を定義する。

**分析対象**: スタンダードモデル (standard)
**分析期間**: 2025年12月〜2026年1月
**サンプル数**: 492レース（結果確定分）

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
payout_trifecta: number # 3連単払戻金
```

### 導出値

```javascript
// race_idからレース番号を取得
const raceNo = parseInt(race_id.split('-')[4]);  // 1-12

// 3連複の予測組み合わせ（順不同）
const predSorted = [top_pick, top_2nd, top_3rd].sort((a,b) => a-b).join('-');
// 例: "1-2-4"

// 3連複の結果組み合わせ（順不同）
const resultSorted = [rank1, rank2, rank3].sort((a,b) => a-b).join('-');

// 1号艇を含むかどうか
const has1 = [top_pick, top_2nd, top_3rd].includes(1);
```

---

## ルール定義

### 凡例

- **条件**: ルール適用の条件（全てAND）
- **賭け方**: 購入する券種
- **的中判定**: 的中とみなす条件
- **払戻金取得**: 的中時に取得する金額

---

## 単勝ルール

### E03-W003: 3号艇1着 + 1号艇2着予測 × 信頼度70↑

**回収率: 182% | サンプル: 21戦10勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 3,   // 1着予測が3号艇
  top_2nd: 1,    // 2着予測が1号艇
  confidence: { min: 70 }
};

// 賭け方
const betType = "win";  // 単勝（3号艇）

// 的中判定
const isHit = (rank1 === top_pick);

// 払戻金
const payout = isHit ? race_results.payout_win : 0;
```

---

### E03-W002: 2号艇1着予測 × 前半レース

**回収率: 148% | サンプル: 22戦10勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 2,  // 2号艇を1着予測
  raceNo: { min: 1, max: 4 }  // 前半レース
};

// 賭け方
const betType = "win";  // 単勝
```

---

### E03-W004: 3号艇1着予測 × 信頼度70↑

**回収率: 111% | サンプル: 50戦16勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 3,  // 3号艇を1着予測
  confidence: { min: 70 }
};

// 賭け方
const betType = "win";  // 単勝
```

---

### E03-W005: 2号艇1着予測 × 信頼度75↑

**回収率: 100% | サンプル: 60戦22勝 | 信頼性: 中**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 2,  // 2号艇を1着予測
  confidence: { min: 75 }
};

// 賭け方
const betType = "win";  // 単勝
```

---

## 3連複ルール

### E03-T002: 1-2-3予測 × 後半 × 信頼度80↑

**回収率: 153% | サンプル: 30戦5勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  predSorted: "1-2-3",      // [top_pick, top_2nd, top_3rd].sort().join('-') === "1-2-3"
  raceNo: { min: 9, max: 12 },  // 後半レース
  confidence: { min: 80 }
};

// 賭け方
const betType = "trio";  // 3連複

// 的中判定
const isHit = (predSorted === resultSorted);

// 払戻金
const payout = isHit ? race_results.payout_trio : 0;
```

---

### E03-T001-M: (1-2-4 or 1-2-3)予測 × 後半 × 信頼度80↑

**回収率: 113% | サンプル: 50戦6勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  predSorted: ["1-2-4", "1-2-3"],  // いずれかに一致
  raceNo: { min: 9, max: 12 },
  confidence: { min: 80 }
};
```

---

### E03-T004-S: 1号艇含む × 5R以降 × 信頼度85↑

**回収率: 104% | サンプル: 228戦20勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  has1: true,  // [top_pick, top_2nd, top_3rd].includes(1)
  raceNo: { min: 5, max: 12 },  // 中盤〜後半
  confidence: { min: 85 }
};
```

---

### E03-T004-L: 1号艇含む × 後半 × 信頼度85↑

**回収率: 104% | サンプル: 134戦11勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  has1: true,
  raceNo: { min: 9, max: 12 },  // 後半レース
  confidence: { min: 85 }
};
```

---

## 複勝ルール

### E03-P002: 1号艇1着予測 × 後半レース

**回収率: 113% | サンプル: 122戦100勝 | 信頼性: 最高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 1,  // 1号艇を1着予測
  raceNo: { min: 9, max: 12 }
};

// 賭け方
const betType = "place";  // 複勝

// 的中判定（1着または2着に入れば的中）
const isHit = (rank1 === top_pick || rank2 === top_pick);

// 払戻金
let payout = 0;
if (rank1 === top_pick) payout = race_results.payout_place_1;
else if (rank2 === top_pick) payout = race_results.payout_place_2;
```

---

### E03-P003: 1号艇1着予測 × 信頼度85↑

**回収率: 111% | サンプル: 239戦185勝 | 信頼性: 高**

```javascript
// 条件
const conditions = {
  venue_code: "03",
  model_id: "standard",
  top_pick: 1,
  confidence: { min: 85 }
};

// 賭け方
const betType = "place";  // 複勝
```

---

## 非推奨ルール

### 3連単全般

**回収率: 19.8% | 理由: 順番一致が難しく配当も低い**

```javascript
// 使用しない
// 3連複的中時の3連単的中率: 32.9%
// 1着的中時の2-3着順番的中率: 12.7%
```

---

## 実装例

### ルール適用関数

```javascript
function shouldBet(prediction, ruleId) {
  const raceNo = parseInt(prediction.race_id.split('-')[4]);
  const conf = prediction.confidence || 0;
  const predSorted = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd]
    .sort((a, b) => a - b).join('-');
  const has1 = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd].includes(1);

  switch (ruleId) {
    case 'E03-W003':
      return prediction.top_pick === 3 && prediction.top_2nd === 1 && conf >= 70;

    case 'E03-W002':
      return prediction.top_pick === 2 && raceNo <= 4;

    case 'E03-W004':
      return prediction.top_pick === 3 && conf >= 70;

    case 'E03-W005':
      return prediction.top_pick === 2 && conf >= 75;

    case 'E03-T002':
      return predSorted === '1-2-3' && raceNo >= 9 && conf >= 80;

    case 'E03-T001-M':
      return ['1-2-4', '1-2-3'].includes(predSorted) && raceNo >= 9 && conf >= 80;

    case 'E03-T004-S':
      return has1 && raceNo >= 5 && conf >= 85;

    case 'E03-T004-L':
      return has1 && raceNo >= 9 && conf >= 85;

    case 'E03-P002':
      return prediction.top_pick === 1 && raceNo >= 9;

    case 'E03-P003':
      return prediction.top_pick === 1 && conf >= 85;

    default:
      return false;
  }
}
```

### 払戻金計算関数

```javascript
function calculatePayout(prediction, result, ruleId) {
  const predSorted = [prediction.top_pick, prediction.top_2nd, prediction.top_3rd]
    .sort((a, b) => a - b).join('-');
  const resultSorted = [result.rank1, result.rank2, result.rank3]
    .sort((a, b) => a - b).join('-');

  // 3連複ルール
  if (ruleId.startsWith('E03-T')) {
    return predSorted === resultSorted ? result.payout_trio : 0;
  }

  // 複勝ルール
  if (ruleId.startsWith('E03-P')) {
    if (result.rank1 === prediction.top_pick) return result.payout_place_1;
    if (result.rank2 === prediction.top_pick) return result.payout_place_2;
    return 0;
  }

  // 単勝ルール
  if (ruleId.startsWith('E03-W')) {
    return result.rank1 === prediction.top_pick ? result.payout_win : 0;
  }

  return 0;
}
```

---

## ルールID命名規則

```
E03-T001-S
│   │    └── バリエーション: S=厳選, M=中間, L=緩め, なし=ベースライン
│   └────── 連番
└────────── 賭け方: W=単勝, P=複勝, T=3連複, F=3連単
```

---

## ルール一覧サマリー

| ID | パターン名 | 賭け方 | 条件 | 実績 | 回収率 |
|----|-----------|--------|------|------|--------|
| E03-W003 | EDOGAWA-WIN-TOP3-SUB1-MC | 単勝 | 3号艇1着+1号艇2着×conf70+ | 21戦10勝 | **182%** |
| E03-T002 | EDOGAWA-TRIO-123-LATE-HC | 3連複 | 予測123×9R以降×conf80+ | 30戦5勝 | **153%** |
| E03-W002 | EDOGAWA-WIN-TOP2-EARLY | 単勝 | 2号艇1着×4R以前 | 22戦10勝 | **148%** |
| E03-T001-M | EDOGAWA-TRIO-12X-LATE-HC | 3連複 | 予測123or124×9R以降×conf80+ | 50戦6勝 | **113%** |
| E03-P002 | EDOGAWA-PLACE-TOP1-LATE | 複勝 | 1号艇1着×9R以降 | 122戦100勝 | **113%** |
| E03-W004 | EDOGAWA-WIN-TOP3-MC | 単勝 | 3号艇1着×conf70+ | 50戦16勝 | **111%** |
| E03-P003 | EDOGAWA-PLACE-TOP1-HC | 複勝 | 1号艇1着×conf85+ | 239戦185勝 | **111%** |
| E03-T004-S | EDOGAWA-TRIO-INC1-MID-HC | 3連複 | 1号艇含む×5R以降×conf85+ | 228戦20勝 | **104%** |
| E03-T004-L | EDOGAWA-TRIO-INC1-LATE-HC | 3連複 | 1号艇含む×9R以降×conf85+ | 134戦11勝 | **104%** |
| E03-W005 | EDOGAWA-WIN-TOP2-MC | 単勝 | 2号艇1着×conf75+ | 60戦22勝 | **100%** |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-14 | 初版作成 |
| 2026-01-15 | スタンダードモデル全期間分析に基づき更新（492レース） |
