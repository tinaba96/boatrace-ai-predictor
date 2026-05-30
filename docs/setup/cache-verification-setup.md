# キャッシュ検証セットアップ

キャッシュ設定の誤りを防ぐための自動検証には 2 つの層があります。

---

## レイヤー1：Git Hook（ローカル - push 前）

### セットアップ手順

```bash
cp .claude/hooks/pre-push-verify-cache.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### 動作

- **タイミング**: `git push` 実行時（push 直前）
- **実行内容**: `node scripts/verification/verify-cache-config.js`
- **失敗時**: push がブロックされ、エラーメッセージが表示される

### 例

```bash
$ git push origin feature/my-feature
🔍 キャッシュ設定を検証中...
✅ キャッシュ設定は正しく統一されています
(push successful)
```

キャッシュ設定に誤りがある場合：

```bash
$ git push origin feature/my-feature
🔍 キャッシュ設定を検証中...
⚠️  api/race-history/summary.js
   期待: 毎日1回更新（バッチ実行） (s-maxage=86400, swr=3600)
   実際: s-maxage=300, swr=60

❌ キャッシュ設定にエラーがあるため、push をブロックしました
   docs/reference/cache-strategy.md を確認してください
```

---

## レイヤー2：GitHub Actions CI（リモート - PR 作成時）

### 自動実行

- **ファイル**: `.github/workflows/verify-cache-config.yml`
- **トリガー**: PR 作成時、Edge Function ファイル（`api/**/*.js`）が変更された場合
- **実行内容**: `node scripts/verification/verify-cache-config.js`
- **結果**: PR チェックとして表示される

### PR チェック画面

PR が作成されると、GitHub の PR 画面に以下のようなチェックが表示されます：

```
Verify Cache Configuration ✅ passed
```

キャッシュ設定に誤りがある場合、PR の「Checks」タブに詳細が表示され、マージボタンが無効化されます。

---

## 3 層防御システム

| レイヤー | 実行タイミング | 対象 | 効果 |
|---------|-------------|------|-----|
| **ドキュメント** | コード変更前 | 開発者 | キャッシュルールの理解 |
| **Git Hook** | push 前 | ローカル | 誤ったコミットを push しない |
| **GitHub Actions** | PR 作成後 | PR | 万一 hook をバイパスした場合のセーフネット |

---

## トラブルシューティング

### Git Hook が実行されない

```bash
# hook ファイルの確認
ls -la .git/hooks/pre-push

# 実行権限がない場合
chmod +x .git/hooks/pre-push
```

### 特定の変更を強制的に push したい

```bash
# Hook をスキップ（ただしレビュー後のマージは必須）
git push --no-verify

# この場合、GitHub Actions CI で検証されるため、
# PR レビューで必ず キャッシュ設定を確認してください
```

### CI 検証を再実行したい

```bash
# PR の「Re-run jobs」ボタンから実行（GitHub UI）
# または

gh run rerun <run-id>
```

---

## 参考資料

- **キャッシュ戦略**: `docs/reference/cache-strategy.md`
- **検証スクリプト**: `scripts/verification/verify-cache-config.js`
- **Git Hook**: `.claude/hooks/pre-push-verify-cache.sh`
- **CI ワークフロー**: `.github/workflows/verify-cache-config.yml`
