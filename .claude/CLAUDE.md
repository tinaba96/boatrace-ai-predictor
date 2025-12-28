# BoatAI - Claude Code 設定

## プロジェクト概要
- **サイト**: https://boat-ai.jp
- **内容**: AIボートレース予想サービス（全国24場対応）
- **技術**: React 18 + Vite + react-router-dom
- **デプロイ**: git push → GitHub Actions → 自動デプロイ

---

## コアファイル（よく編集する）

### フロントエンド
| ファイル | 役割 |
|----------|------|
| `src/App.jsx` | メインコンポーネント、ルーティング |
| `src/AppRouter.jsx` | ルーティング定義 |
| `src/components/Header.jsx` | ナビゲーション、ハンバーガーメニュー |
| `src/pages/RaceDetail.jsx` | レース詳細ページ（最も複雑） |
| `src/pages/RaceHistory.jsx` | 過去データ一覧 |
| `src/components/HitRaces.jsx` | 的中レース表示 |
| `src/components/AccuracyDashboard.jsx` | 精度ダッシュボード |
| `src/components/SocialShareButtons.jsx` | SNSシェアボタン |
| `src/utils/share.js` | シェアテキスト生成 |
| `src/components/LoadingScreen.jsx` | 共通ローディングUI |

### データ・スクリプト
| ファイル | 役割 |
|----------|------|
| `public/data/predictions/*.json` | 予想データ（日付別） |
| `scripts/generate-sitemap.js` | sitemap.xml生成 |
| `scripts/scrape-to-json.js` | データスクレイピング |

---

## 重要なデータ形式

### 予想データの形式変更（必ず両方対応すること）

```javascript
// 12/18以前（旧形式）: prediction（単数形）
race.prediction = { topPick: 1, top3: [1,2,3], ... }

// 12/19以降（新形式）: predictions（複数形）
race.predictions = {
  standard: { topPick: 1, top3: [1,2,3], ... },
  safeBet: { topPick: 1, top3: [1,2,3], ... },
  upsetFocus: { topPick: 3, top3: [3,1,5], ... }
}

// 両方に対応するコード例
const prediction = race.predictions?.[modelKey] ||
                   (modelKey === 'standard' ? race.prediction : null)
```

---

## 絶対ルール

### 用語
- **「競艇」は使用禁止** → 「ボートレース」を使う
- コード、UI、ブログ、コミットメッセージすべてに適用

### モバイル対応
- `onTouchEnd` は使わない → `onClick` のみ
- 親要素の `overflow: hidden` はタッチイベントを妨げる
- ドロップダウンは親のoverflow制約を受けない位置に配置

### CSS
- `!important` は基本使わない
- 複雑なz-index管理よりDOM構造をシンプルに
- デバッグ用console.logは解決後に削除

---

## デバッグ手順

### モバイルで動作しない場合
1. PC版で動作確認
2. PC版で動く → CSS/イベントの問題を疑う
3. **3回修正して解決しない → 該当部分を削除して再実装**

### 確認すべき順序
1. CSSの `overflow`, `z-index`, `position`
2. イベントハンドラの複雑さ
3. 親要素の制約

---

## 過去のバグと解決策

### ハンバーガーメニューがモバイルで動かない（2024-12）
- **原因**: onTouchEnd + onClick の二重発火、親要素のoverflow
- **解決**: 削除して再実装。onClick のみ使用、ドロップダウンをnav外に配置

### LINEシェアでメッセージが表示されない（2024-12-24）
- **原因**: LINE APIが`title`パラメータをサポートしていない
- **解決**: `url`に`message + '\n' + url`を結合
- **ファイル**: `src/components/SocialShareButtons.jsx`

### 12/18以前のデータが表示されない（2024-12-28）
- **原因**: 旧形式（prediction）と新形式（predictions）の違い
- **解決**: 両方の形式に対応するコードを追加
- **ファイル**: `src/pages/RaceHistory.jsx`

### ローディング画面のCSSが適用されない（2024-12-28）
- **原因**: 不明（CSS詳細度の問題と推測）
- **解決**: インラインスタイルを使用した共通コンポーネントに変更
- **ファイル**: `src/components/LoadingScreen.jsx`

---

## コマンド

```bash
# 開発
npm run dev           # 開発サーバー (localhost:5173)
npm run build         # プロダクションビルド

# デプロイ
git add <files>
git commit -m "メッセージ"
git push              # → 自動デプロイ

# pushが失敗した場合
git pull --rebase && git push

# sitemap更新
node scripts/generate-sitemap.js
```

---

## コミットメッセージ

```
<type>: <短い説明>

<詳細（任意）>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <モデル名> <noreply@anthropic.com>
```

**type**: feat, fix, refactor, style, docs, chore

---

## ディレクトリ構造

```
src/
├── App.jsx              # メイン、ルーティング
├── AppRouter.jsx        # ルート定義
├── App.css              # グローバルスタイル
├── components/          # 共通コンポーネント
│   ├── Header.jsx
│   ├── HitRaces.jsx
│   ├── AccuracyDashboard.jsx
│   ├── SocialShareButtons.jsx
│   └── LoadingScreen.jsx
├── pages/               # ページコンポーネント
│   ├── RaceDetail.jsx
│   ├── RaceHistory.jsx
│   ├── Blog.jsx
│   └── ...
├── services/            # API、データサービス
└── utils/               # ユーティリティ
    └── share.js

public/
├── data/predictions/    # 予想データ (YYYY-MM-DD.json)
├── blog/                # ブログ記事 (*.md)
├── sitemap.xml
└── robots.txt

scripts/
├── generate-sitemap.js
└── scrape-to-json.js
```

---

## SEO設定

- **sitemap.xml**: `scripts/generate-sitemap.js`で生成、GitHub Actionsで自動更新
- **robots.txt**: 設定済み
- **OGP画像**: `public/ogp-image.png`
- **各ページのmeta**: Helmet使用（title, description, canonical, og:*）

---

## トラブルシューティング

### ビルドエラー
```bash
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### git push失敗
```bash
git stash
git pull --rebase
git stash pop
git push
```

### 本番で反映されない
- GitHub Actionsの実行状況を確認
- Vercelのデプロイ状況を確認
- ブラウザキャッシュをクリア

---

## Claude Codeへの指示のコツ

### 良い指示
```
src/utils/share.js の generateHitRaceShareText 関数を修正して
```

### 悪い指示（トークン消費が多い）
```
シェア機能のコードを修正して
```

**ファイルパス、関数名、行番号を明示すると効率的**
