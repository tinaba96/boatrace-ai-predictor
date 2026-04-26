-- accuracy_cache テーブルの RLS ポリシー追加
-- 013_accuracy_cache_table.sql で GRANT SELECT を付与したが、
-- RLS が有効なためポリシーがないと anon キーから読めない状態になっていた。
-- このテーブルは公開キャッシュなので全行 SELECT を許可する。

ALTER TABLE accuracy_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_read" ON accuracy_cache
  FOR SELECT
  USING (true);
