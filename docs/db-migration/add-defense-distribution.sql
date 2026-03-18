-- racer_aggregated_stats に被攻撃分布・コース別出走数カラムを追加
-- 展開予測v2で使用

ALTER TABLE racer_aggregated_stats
  ADD COLUMN IF NOT EXISTS defense_distribution JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS course_race_counts JSONB DEFAULT '{}';

-- defense_distribution: コース別の被攻撃分布
-- 例: { "1": { "sashi": 0.30, "makuri": 0.25, ... }, "2": { ... } }
-- 「この選手がNコースにいた時、他の選手にどの決まり手で負けたか」

-- course_race_counts: コース別の出走数・勝数
-- 例: { "1": { "total": 50, "wins": 28 }, "2": { "total": 30, "wins": 8 } }
