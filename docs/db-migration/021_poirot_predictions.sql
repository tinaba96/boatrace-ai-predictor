-- 021: ポアロ予想（BOA-104）V1/V2 予測テーブル
-- /poirot ページ（α版）で表示する ML モデルの予測を保持する。
-- model_version: 'rf-v1'（ランダムフォレスト） | 'lgbm-v2'（LightGBM）

CREATE TABLE IF NOT EXISTS poirot_predictions (
  race_id VARCHAR(20) NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  -- 各艇の1着確率（キャリブレーション・正規化済み） 例: {"1": 0.42, "2": 0.15, ...}
  win_probs JSONB NOT NULL,
  -- 3連単の最尤買い目（一般化 Plackett-Luce による）
  top_pick INTEGER NOT NULL,
  top_2nd INTEGER NOT NULL,
  top_3rd INTEGER NOT NULL,
  trifecta_prob NUMERIC(7, 5),
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (race_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_poirot_predictions_race
  ON poirot_predictions (race_id);

-- RLS: 匿名ユーザーは読み取りのみ（書き込みは service role が RLS をバイパス）
ALTER TABLE poirot_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poirot_predictions_public_read" ON poirot_predictions;
CREATE POLICY "poirot_predictions_public_read"
  ON poirot_predictions FOR SELECT
  USING (true);
