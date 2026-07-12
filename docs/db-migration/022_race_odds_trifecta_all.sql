-- 022: race_odds に3連単全120通りスナップショット列を追加（BOA-104）
--
-- 発走直前（ODDS_WINDOWS の最小=5分前ウィンドウ）のレースのみ、
-- scrape-odds.js が odds3t ページの全120通りを JSONB で保存する。
-- 例: {"1-2-3": 6.6, "1-2-4": 12.3, ...}
--
-- 用途: EV（期待値）分析・市場暗黙確率との合成（Benter式）の基礎データ。
-- パリミュチュエルの締切直前オッズは事後に取得できないため蓄積が必須。

ALTER TABLE race_odds
  ADD COLUMN IF NOT EXISTS trifecta_all JSONB;

COMMENT ON COLUMN race_odds.trifecta_all IS
  '3連単全120通りのオッズ（発走直前ウィンドウのみ・EV分析用）';
