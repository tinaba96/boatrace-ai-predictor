-- Moriarty meta-model setup (BOA-103)

-- 1. moriarty モデル登録
INSERT INTO models (model_id, display_name, model_type, status, description) VALUES (
  'moriarty',
  'モリアーティ予想 (Calibration + Kelly)',
  'venue_specific',
  'shadow',
  '既存3モデルのスコアをキャリブレーション後、Kelly基準で最適ベット額を算出するメタモデル'
) ON CONFLICT (model_id) DO NOTHING;

-- 2. Kelly ベット割合カラム追加
ALTER TABLE bet_recommendations ADD COLUMN IF NOT EXISTS
  bet_fraction DECIMAL(5,4);

-- 検証用 SELECT (コメントで)
-- SELECT * FROM models WHERE model_id = 'moriarty';
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'bet_recommendations' AND column_name = 'bet_fraction';
