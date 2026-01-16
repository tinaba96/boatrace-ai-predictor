-- 会場別ルール検証システム用テーブル
-- 作成日: 2026-01-14

-- 会場ルール定義テーブル
CREATE TABLE venue_rules (
  id SERIAL PRIMARY KEY,
  rule_id TEXT UNIQUE NOT NULL,        -- 'E03-T001-S'
  venue_code TEXT NOT NULL,             -- '03'
  bet_type TEXT NOT NULL,               -- 'trio', 'win', 'place'
  conditions JSONB NOT NULL,            -- ルール条件
  description TEXT,                     -- ルール説明 (日本語)
  expected_recovery NUMERIC,            -- 期待回収率
  reliability TEXT,                     -- 'highest', 'high', 'medium'
  sample_size INTEGER,                  -- 分析時のサンプル数
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ルール適用ログテーブル
CREATE TABLE rule_applications (
  id SERIAL PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES venue_rules(rule_id),
  race_id TEXT NOT NULL,
  bet_amount INTEGER DEFAULT 100,
  is_hit BOOLEAN,                       -- NULL = 未確定
  payout INTEGER,                       -- NULL = 未確定
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_venue_rules_venue ON venue_rules(venue_code);
CREATE INDEX idx_venue_rules_active ON venue_rules(is_active);
CREATE INDEX idx_rule_applications_rule ON rule_applications(rule_id);
CREATE INDEX idx_rule_applications_race ON rule_applications(race_id);
CREATE INDEX idx_rule_applications_created ON rule_applications(created_at);

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_venue_rules_updated_at
  BEFORE UPDATE ON venue_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rule_applications_updated_at
  BEFORE UPDATE ON rule_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 初期データ: 江戸川のルール
INSERT INTO venue_rules (rule_id, venue_code, bet_type, conditions, description, expected_recovery, reliability, sample_size) VALUES
('E03-T001-S', '03', 'trio',
 '{"predSorted": "1-2-4", "raceNo": {"min": 9, "max": 12}, "confidence": {"min": 80}}',
 '1-2-4×後半×信頼度80↑', 1224.2, 'highest', 19),

('E03-T001-M', '03', 'trio',
 '{"predSorted": ["1-2-4", "1-2-3"], "raceNo": {"min": 9, "max": 12}, "confidence": {"min": 80}}',
 '(1-2-4 or 1-2-3)×後半×信頼度80↑', 748.4, 'high', 49),

('E03-T004-S', '03', 'trio',
 '{"has1": true, "raceNo": {"min": 5, "max": 12}, "confidence": {"min": 85}}',
 '1号艇含む×中盤後半×信頼度85↑', 450.2, 'high', 221),

('E03-T004-L', '03', 'trio',
 '{"has1": true, "confidence": {"min": 90}}',
 '1号艇含む×信頼度90↑', 419.7, 'high', 286),

('E03-T001', '03', 'trio',
 '{"predSorted": "1-2-4"}',
 '1-2-4組み合わせ（ベースライン）', 610.7, 'highest', 73),

('E03-T004', '03', 'trio',
 '{"has1": true}',
 '1号艇含む（ベースライン）', 383.5, 'highest', 423),

('E03-P002', '03', 'place',
 '{"top_pick": 1, "raceNo": {"min": 9, "max": 12}}',
 '1号艇×後半レース', 113.9, 'high', 118),

('E03-P001', '03', 'place',
 '{"top_pick": 1}',
 '1号艇予測（汎用）', 110.5, 'medium', 286),

('E03-W002', '03', 'win',
 '{"top_pick": 2, "raceNo": {"min": 1, "max": 4}}',
 '2号艇×前半レース', 147.7, 'medium', 22),

('E03-W003', '03', 'win',
 '{"top_pick": 3, "top_2nd": 1, "confidence": {"min": 70}}',
 '3-1予測×信頼度70↑', 181.9, 'medium', 21);

COMMENT ON TABLE venue_rules IS '会場別ルール定義テーブル - 分析で発見したルールを格納';
COMMENT ON TABLE rule_applications IS 'ルール適用ログ - 各レースでのルール適用結果を記録';
