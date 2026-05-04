-- race_conditions.race_grade カラムを廃止
-- races.race_grade が唯一の Source of Truth となる
-- ※ 実行前に update-race-info.js と generate-predictions.js の修正をデプロイすること
-- ※ スクリプトがこのカラムに書き込もうとしてエラーになることを防ぐため

ALTER TABLE race_conditions DROP COLUMN IF EXISTS race_grade;
