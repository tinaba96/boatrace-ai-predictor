# Linear 連携設定ガイド

Linear連携を設定することで、Claude CodeからIssueの作成・確認が可能になります。

## 1. APIキーの取得

1. [Linear](https://linear.app) にログイン
2. 左下のアイコン > **Settings** をクリック
3. **API** > **Personal API keys** を選択
4. **Create key** をクリック
5. キー名を入力（例: `claude-code`）し、作成
6. 表示されたキー（`lin_api_xxxxx`）をコピー

## 2. Team IDの確認

Team IDはLinear URLから確認できます。

1. Linearでプロジェクトを開く
2. URLを確認: `https://linear.app/YOUR_WORKSPACE/team/TEAM_ID/...`
3. `TEAM_ID` 部分をコピー（例: `ENG`, `BOAT` など）

または、APIで取得:

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: lin_api_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ teams { nodes { id name key } } }"}' | jq
```

## 3. 環境変数の設定

`.env.local` に追加:

```bash
LINEAR_API_KEY=lin_api_xxxxx
LINEAR_TEAM_ID=YOUR_TEAM_ID
```

## 4. 動作確認

```bash
# Issue一覧を取得
npm run linear:list
```

または Claude Code で:

```
Linear の Issue 一覧を見せて
```

## 5. GitHub Secrets の更新（CI/CD用）

GitHub ActionsからLinear連携を使用する場合:

1. GitHub リポジトリ > **Settings** > **Secrets and variables** > **Actions**
2. 以下のSecretsを追加/更新:
   - `LINEAR_API_KEY`: APIキー
   - `LINEAR_TEAM_ID`: Team ID

## トラブルシューティング

### Q: `401 Unauthorized` エラー

APIキーが正しくないか、期限切れの可能性があります。
新しいAPIキーを発行してください。

### Q: Team IDが見つからない

```bash
node -e "
const fetch = require('node-fetch');
fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Authorization': process.env.LINEAR_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: '{ teams { nodes { id name key } } }'
  })
})
.then(r => r.json())
.then(d => console.log(JSON.stringify(d, null, 2)));
"
```

### Q: 古いワークスペースのキーを使っている

新しいワークスペースで新しいAPIキーを発行し、`.env.local` と GitHub Secrets を更新してください。

## Linear Issue 命名規則

| プレフィックス | 用途 |
|---------------|------|
| `feat:` | 新機能 |
| `fix:` | バグ修正 |
| `refactor:` | リファクタリング |
| `docs:` | ドキュメント |
| `analysis:` | 分析タスク |
