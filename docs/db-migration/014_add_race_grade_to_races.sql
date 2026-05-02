-- races テーブルに race_grade カラムを追加（BOA-95）
-- NULL 許容・既存データへの影響なし
ALTER TABLE races ADD COLUMN IF NOT EXISTS race_grade VARCHAR(10);
