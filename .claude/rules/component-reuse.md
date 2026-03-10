# コンポーネント再利用ルール

## 原則
- **同じUIパターンが2箇所以上で使われる場合、必ず共通コンポーネントに切り出す**
- App.jsx にインラインでUIを書く前に、既存の `src/components/race/` コンポーネントを確認する
- 新しいUIパターンを作る場合、他のページでも使う可能性があるならコンポーネント化する

## チェックリスト（UI変更時）
- [ ] 同じUIが App.jsx と RaceDetail.jsx の両方にないか？
- [ ] インラインスタイルで書いた部分は既存コンポーネントで代替できないか？
- [ ] 新規コンポーネントは `src/components/race/index.js` の barrel export に追加したか？

## 既存の共通コンポーネント一覧（race/）
| コンポーネント | 用途 |
|--------------|------|
| **PredictionPanel** | **AI予想セクション全体（App.jsx/RaceDetail.jsx共通）** |
| PredictionLoadingOverlay | AI分析中のローディング演出 |
| ModelSwitcher | モデル切替タブ（本命/スタンダード/穴） |
| ModelDescription | 予想モデル説明セクション |
| PredictionTable | AIデータ予想テーブル + 注目ポイント + データの見方 |
| FirstMarkAnimation | 1マーク展開予測アニメーション |
| AttackDefenseTable | 超展開データテーブル |
| RaceResult | レース結果表示 |
| VenueSelector | 会場選択 |
| RaceCard | レースカード |
| VolatilityDisplay | 荒れ度表示 |

## App.jsx について
- App.jsx は巨大になりやすいため、UIブロックはできる限りコンポーネントに切り出す
- App.jsx 内にインラインで100行以上のUI定義がある場合は、コンポーネント化を検討する
