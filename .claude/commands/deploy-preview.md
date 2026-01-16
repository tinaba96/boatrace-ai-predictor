---
name: deploy-preview
description: developブランチをVercel Previewにデプロイして確認
---

# Vercel Preview デプロイ

開発中の変更をVercel Previewにデプロイして確認します。

## 手順

1. **ビルド確認**
   ```bash
   npm run build
   ```

2. **developブランチにpush**
   ```bash
   git add .
   git commit -m "Preview deploy"
   git push origin develop
   ```

3. **Vercel Preview URL確認**
   - Vercelダッシュボードで自動生成されたPreview URLを確認
   - または `vercel` CLIでデプロイ

## 注意

- 本番（master）には直接pushしない
- Preview URLで動作確認後、masterにマージ
