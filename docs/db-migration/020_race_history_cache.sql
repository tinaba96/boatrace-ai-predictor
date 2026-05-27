-- BOA-124: レース履歴キャッシュテーブル
-- race-history/summary の タイムアウト解消用（事前計算済みキャッシュ）
-- accuracy_cache と同じ key/value パターンを使用

CREATE TABLE IF NOT EXISTS race_history_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（key は PRIMARY KEY なので自動）
CREATE INDEX IF NOT EXISTS idx_race_history_cache_updated_at
ON race_history_cache(updated_at DESC);

-- アクセス権限
GRANT SELECT ON race_history_cache TO anon, authenticated;

-- 初期データ挿入（空配列で初期化）
-- scripts/daily/update-race-history-cache.js が実際の数値で上書きする
INSERT INTO race_history_cache (key, data, updated_at) VALUES
  ('race_history_summary_90', '{"days": []}', NOW())
ON CONFLICT (key) DO NOTHING;
