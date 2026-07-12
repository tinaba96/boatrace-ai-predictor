-- race_history_cache テーブルの RLS ポリシー追加
-- 020_race_history_cache.sql で GRANT SELECT を付与したが、
-- RLS が有効なためポリシーがないと anon キーから読めない状態になっていた。
-- このテーブルは公開キャッシュなので全行 SELECT を許可する。

ALTER TABLE race_history_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_read" ON race_history_cache
  FOR SELECT
  USING (true);
