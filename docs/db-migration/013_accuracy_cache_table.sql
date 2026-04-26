-- accuracy_cache テーブル作成
-- /accuracy ページ高速化: calculate-accuracy.js が夜間バッチで全統計を pre-compute し保存
-- api/accuracy/index.js がこのテーブルを単一行読み込みで参照する（重い RPC を廃止）

CREATE TABLE IF NOT EXISTS accuracy_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- anon/authenticated は SELECT のみ許可
GRANT SELECT ON accuracy_cache TO anon, authenticated;
-- service_role はフルアクセス（calculate-accuracy.js がバッチで UPSERT する）
GRANT ALL ON accuracy_cache TO service_role;

-- 動作確認
-- SELECT key, updated_at FROM accuracy_cache;
