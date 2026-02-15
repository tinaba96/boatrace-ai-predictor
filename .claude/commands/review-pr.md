# PR レビュー

指定されたPRの内容を確認し、CLAUDE.mdのルールに照らしてレビューを行います。

## 引数
- `$ARGUMENTS`: PR番号（例: 123）またはPR URL

## 実行手順

### 1. PR情報の取得

```bash
gh pr view $ARGUMENTS --json number,title,body,additions,deletions,changedFiles,headRefName,baseRefName
```

### 2. 差分の取得

```bash
gh pr diff $ARGUMENTS
```

### 3. レビュー観点

CLAUDE.mdのルールに照らして、以下を確認:

#### コーディング規約
- [ ] `!important` が不必要に使われていないか
- [ ] イベントハンドラがシンプルに保たれているか
- [ ] ES Modules（import/export）が使用されているか
- [ ] async/awaitが使用されているか

#### ファイル配置
- [ ] スクリプトが適切なディレクトリに配置されているか
  - 日次実行: `scripts/daily/`
  - 分析・調査: `scripts/analysis/`
  - メンテナンス: `scripts/maintenance/`
- [ ] 新しいドキュメントが適切な場所に配置されているか

#### 命名規則
- [ ] ファイル名が `kebab-case` になっているか
- [ ] 分析結果ファイルが `data/analysis/` に配置されているか

#### セキュリティ
- [ ] 環境変数やシークレットがハードコードされていないか
- [ ] SQLインジェクション等の脆弱性がないか

#### モバイル対応（該当する場合）
- [ ] タッチイベントが `onClick` のみで実装されているか
- [ ] 余白がモバイルで適切か

### 4. レビュー結果の出力

以下の形式でレビュー結果をまとめてください:

```
## PR #123 レビュー結果

### 概要
- **タイトル**: XXX
- **変更ファイル数**: XX
- **追加/削除行数**: +XX / -XX

### 問題点
1. **[重要]** `src/xxx.js`: `!important` が使用されています
2. **[軽微]** `scripts/xxx.js`: ファイル名がkebab-caseではありません

### 良い点
- XXX

### 推奨アクション
- [ ] XXXを修正してください
```

レビュー完了後、必要に応じて `gh pr review $ARGUMENTS --comment --body "..."` でコメントを残すか確認してください。
