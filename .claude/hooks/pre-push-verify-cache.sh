#!/bin/bash
# pre-push hook: キャッシュ設定の検証
# このスクリプトを .git/hooks/pre-push に配置して使用

echo "🔍 キャッシュ設定を検証中..."
node scripts/verification/verify-cache-config.js

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ キャッシュ設定にエラーがあるため、push をブロックしました"
  echo "   docs/reference/cache-strategy.md を確認してください"
  exit 1
fi

exit 0
