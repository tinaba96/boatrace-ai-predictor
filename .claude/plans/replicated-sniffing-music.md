# SNSシェア機能修正 + アニメーション共有検討

## Context

SNSシェア機能に2つの問題がある:
1. モデル名のキー形式不一致 — `selectedModel`はkebab-case（`'safe-bet'`）だが、`MODEL_NAMES`のキーはcamelCase（`'safeBet'`）。結果、常に「スタンダード」と表示される
2. X/LINE/Facebookすべてで同じ問題が発生（共通の`generatePredictionShareText()`を使用）

加えて、SNSシェア時にアニメーション画像を添付できるか検討が必要。

## Step 1: MODEL_NAMES にkebab-caseキーを追加

**ファイル**: `src/constants/index.js`

`MODEL_NAMES` にkebab-caseキーを追加して両方の形式に対応:
```js
export const MODEL_NAMES = {
  standard: 'スタンダード',
  safeBet: '本命狙い',
  upsetFocus: '穴狙い',
  'safe-bet': '本命狙い',
  'upset-focus': '穴狙い'
};
```

**理由**: share関数のシグネチャを変えず、呼び出し側も変更不要。最小限の修正で済む。

## Step 2: RaceDetail.jsx にSNSシェアボタン追加

**ファイル**: `src/pages/RaceDetail.jsx`

現在RaceDetailにはSNSシェアボタンがない。App.jsxと同様に`SocialShareButtons`を追加:
- 配置場所: PredictionTableの下、RaceResultの上
- `selectedModel`を`generatePredictionShareText()`に渡す

## Step 3: アニメーション共有について

**結論: テキストベースのSNSシェアでは不可能。別アプローチが必要。**

理由:
- X/Facebook/LINEのシェアボタン（react-share）はテキスト+URLのみ送信
- アニメーション（SVG + framer-motion）は動的コンテンツで、OGP画像にはできない
- OGP画像は静的URLが必要（`og:image`にSVGアニメーションは指定不可）

**実現可能なアプローチ（将来的な提案）**:
- `html2canvas`でアニメーション完了時点のスナップショットを静止画として保存
- Vercel Edge Functionでサーバーサイドで画像生成（`@vercel/og`ライブラリ）
- 生成した静止画をOGP画像として設定

→ これは別タスクとして提案。今回のスコープ外。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/constants/index.js` | `MODEL_NAMES`にkebab-caseキー追加 |
| `src/pages/RaceDetail.jsx` | SocialShareButtons追加 |

## 検証

1. `npm run build` でビルドエラーがないこと
2. トップページ（/）でレース選択 → モデル切替 → Xシェアボタン → シェアテキストに正しいモデル名が表示
3. RaceDetailページ（/races/2026-03-10）でも同様にシェアが機能すること
4. LINE/Facebookも同様に正しいモデル名が表示されること
