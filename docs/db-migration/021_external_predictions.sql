-- 外部予想テーブル（BOA-104）
-- 公式コンピュータ予想 (pcexpect) 等、外部ソースの予想を保存
-- 将来 RF / アンサンブル学習の特徴量として利用
--
-- payload JSONB 構造（pcexpect_official の場合）:
--   focus_2t: [{ pattern: "2=5", seps: ["="] }, ...]
--   focus_3t: [{ pattern: "2=5-1", seps: ["=","-"] }, ...]
--   confidence: 1..5 または null
--   entry_prediction_image: "/static_extra/.../img_corner1_1.png"

CREATE TABLE IF NOT EXISTS external_predictions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source VARCHAR(32) NOT NULL,
  race_date DATE NOT NULL,
  venue_code SMALLINT NOT NULL,
  race_no SMALLINT NOT NULL,
  payload JSONB NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  race_start_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, race_date, venue_code, race_no)
);

CREATE INDEX IF NOT EXISTS idx_external_pred_race
  ON external_predictions(race_date, venue_code, race_no);

CREATE INDEX IF NOT EXISTS idx_external_pred_source_date
  ON external_predictions(source, race_date);

CREATE OR REPLACE FUNCTION trg_external_predictions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS external_predictions_updated_at
  ON external_predictions;

CREATE TRIGGER external_predictions_updated_at
  BEFORE UPDATE ON external_predictions
  FOR EACH ROW
  EXECUTE FUNCTION trg_external_predictions_updated_at();

ALTER TABLE external_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON external_predictions
  FOR SELECT
  USING (true);

GRANT SELECT ON external_predictions TO anon, authenticated;
GRANT ALL ON external_predictions TO service_role;
