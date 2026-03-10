# 展開予測のAIスコア反映強化

## Context

展開予測アルゴリズム（turnPrediction）は1マークの展開パターンを確率ベースで予測しているが、AIスコアへの反映が弱い（現在スコアspreadの5-10%程度）。ユーザーは展開予測をスコアの20-30%を占める主要ファクターにしたい。UIの変更は不要。

## 現状のスコアレンジ（平和島2026-03-09）

| モデル | スコア範囲 | スプレッド（max-min） |
|--------|-----------|---------------------|
| standard | 1000-2900 | 800〜1600 |
| safeBet | 1600-3400 | 600〜1600 |
| upsetFocus | 7000-16000 | 3000〜7000 |

## 現状の `calculateTurnBonus()` 係数

| 要素 | standard | safeBet | upsetFocus |
|------|----------|---------|------------|
| 1着（逃げ） | prob×300 | prob×500 | prob×100 |
| 1着（他） | prob×300 | prob×150 | prob×400 |
| 2着 | prob×2着prob×150 | prob×2着prob×200 | prob×2着prob×100 |
| 3着 | prob×3着prob×80 | prob×3着prob×100 | prob×3着prob×60 |
| **最大実効値** | **~200** | **~300** | **~200** |
| **spread比** | **~15%** | **~20%** | **~4%** |

## 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `scripts/daily/generate-predictions.js` | `calculateTurnBonus()` の係数変更 + 2要素追加 |

## 新しい `calculateTurnBonus()` — 4要素構成

### A. 1着パターンボーナス（係数強化）

| モデル | 逃げ | 他の決まり手 | 設計意図 |
|--------|------|-------------|---------|
| standard | prob×600 | prob×600 | 決まり手に中立 |
| safeBet | prob×900 | prob×300 | 逃げ重視（3:1） |
| upsetFocus | prob×300 | prob×1800 | まくり/差し重視（1:6） |

### B. 2着・3着ボーナス（係数強化）

| モデル | 2着 | 3着 |
|--------|-----|-----|
| standard | prob×2着prob×350 | prob×3着prob×180 |
| safeBet | prob×2着prob×450 | prob×3着prob×220 |
| upsetFocus | prob×2着prob×500 | prob×3着prob×250 |

### C. 非勝利コースペナルティ（NEW）

上位3パターンのいずれの `winnerCourse` にも入らないコースにペナルティ。

| モデル | ペナルティ |
|--------|-----------|
| standard | -topProb × 200 |
| safeBet | -topProb × 280 |
| upsetFocus | -topProb × 400 |

典型例: 逃げ prob=0.55 で 1,2,3コースが勝者に含まれる場合、4-6コースに -110(std)/-154(safe)/-220(upset) のペナルティ。

### D. boatStrengths 直接反映（NEW）

`boatStrengths[i]`（0-1, 0.5=平均）をスコアに直接反映。

| モデル | 式 |
|--------|-----|
| standard | (strength - 0.5) × 500 |
| safeBet | (strength - 0.5) × 350 |
| upsetFocus | (strength - 0.5) × 800 |

典型的な deviation は ±0.1 なので、実効値は ±50(std)/±35(safe)/±80(upset)。

### 新しい最大実効値と spread 比

| モデル | A+B最大 | C最大 | D最大 | 合計最大 | spread比 |
|--------|---------|-------|-------|---------|---------|
| standard | ~420 | -110 | ±50 | +420〜-160 → spread +580 | **~30%** |
| safeBet | ~560 | -154 | ±35 | +560〜-189 → spread +749 | **~35%** |
| upsetFocus | ~720 | -220 | ±80 | +720〜-300 → spread +1020 | **~20%** |

## 後方互換性

- `turnResult?.patterns` が null → 既存の早期 return 0 で対応済み
- `turnResult.boatStrengths` → `if (turnResult.boatStrengths && ...)` ガード
- 関数シグネチャ変更なし

## 検証

```bash
# 1. ビルド確認
npm run build

# 2. 予測再生成して新係数でスコア確認
node scripts/daily/generate-predictions.js

# 3. 新旧スコア比較（DB上で確認）
# - 展開予測で1着に選ばれたコースのスコアが従来より高くなっていること
# - 選ばれなかったコースにペナルティが適用されていること
# - spread比が20-30%程度であること
```
