-- /accuracy ページ高速化用 RPC関数
-- このSQLをSupabase Dashboard > SQL Editorで実行してください
--
-- 全統計を1回のRPC呼び出しで返し、フロントの8回以上のクエリを1回に削減

CREATE OR REPLACE FUNCTION get_accuracy_summary()
RETURNS JSON
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSON;
  today_date DATE;
  this_month_start DATE;
  this_month_end DATE;
  last_month_start DATE;
  last_month_end DATE;
  seven_days_ago DATE;
  ninety_days_ago DATE;
BEGIN
  today_date := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;
  this_month_start := DATE_TRUNC('month', today_date)::DATE;
  this_month_end := (DATE_TRUNC('month', today_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  last_month_start := (DATE_TRUNC('month', today_date) - INTERVAL '1 month')::DATE;
  last_month_end := (DATE_TRUNC('month', today_date) - INTERVAL '1 day')::DATE;
  seven_days_ago := today_date - 7;
  ninety_days_ago := today_date - 90;

  SELECT json_build_object(
    'lastUpdated', NOW(),
    'models', (
      SELECT json_object_agg(model_id, model_data)
      FROM (
        SELECT
          m.model_id,
          json_build_object(
            -- overall（modelsテーブルから）
            'overall', json_build_object(
              'totalRaces', COALESCE(m.total_predictions, 0),
              'finishedRaces', COALESCE(m.total_predictions, 0),
              'topPickHitRate', COALESCE(m.hit_rate_win, 0),
              'topPickPlaceRate', COALESCE(m.hit_rate_place, 0),
              'top3HitRate', COALESCE(m.hit_rate_trifecta, 0),
              'top3ExactHitRate', COALESCE(m.hit_rate_trio, 0),
              'actualRecovery', json_build_object(
                'win', json_build_object('recoveryRate', COALESCE(m.recovery_rate_win, 0)),
                'place', json_build_object('recoveryRate', COALESCE(m.recovery_rate_place, 0)),
                'trifecta', json_build_object('recoveryRate', COALESCE(m.recovery_rate_trifecta, 0)),
                'trio', json_build_object('recoveryRate', COALESCE(m.recovery_rate_trio, 0))
              )
            ),
            -- thisMonth
            'thisMonth', (
              SELECT json_build_object(
                'year', EXTRACT(YEAR FROM this_month_start)::INT,
                'month', EXTRACT(MONTH FROM this_month_start)::INT,
                'totalRaces', COUNT(*)::INT,
                'topPickHitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_win)::float / COUNT(*) ELSE 0 END,
                'topPickPlaceRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_place)::float / COUNT(*) ELSE 0 END,
                'top3HitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trifecta)::float / COUNT(*) ELSE 0 END,
                'top3IncludedRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trio)::float / COUNT(*) ELSE 0 END,
                'actualRecovery', json_build_object(
                  'win', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_win, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'place', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_place, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'trifecta', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trifecta, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'trio', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trio, 0))::float / (COUNT(*) * 100) ELSE 0 END)
                )
              )
              FROM predictions p
              WHERE p.model_id = m.model_id
                AND p.is_hit_win IS NOT NULL
                AND p.race_id >= this_month_start::text
                AND p.race_id < (this_month_end + 1)::text
            ),
            -- lastMonth
            'lastMonth', (
              SELECT json_build_object(
                'year', EXTRACT(YEAR FROM last_month_start)::INT,
                'month', EXTRACT(MONTH FROM last_month_start)::INT,
                'totalRaces', COUNT(*)::INT,
                'topPickHitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_win)::float / COUNT(*) ELSE 0 END,
                'topPickPlaceRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_place)::float / COUNT(*) ELSE 0 END,
                'top3HitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trifecta)::float / COUNT(*) ELSE 0 END,
                'top3IncludedRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trio)::float / COUNT(*) ELSE 0 END,
                'actualRecovery', json_build_object(
                  'win', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_win, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'place', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_place, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'trifecta', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trifecta, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                  'trio', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trio, 0))::float / (COUNT(*) * 100) ELSE 0 END)
                )
              )
              FROM predictions p
              WHERE p.model_id = m.model_id
                AND p.is_hit_win IS NOT NULL
                AND p.race_id >= last_month_start::text
                AND p.race_id < (last_month_end + 1)::text
            ),
            -- monthlyHistory（過去6ヶ月）
            'monthlyHistory', COALESCE((
              SELECT json_agg(month_row ORDER BY year DESC, month DESC)
              FROM (
                SELECT
                  EXTRACT(YEAR FROM d.month_start)::INT as year,
                  EXTRACT(MONTH FROM d.month_start)::INT as month,
                  COUNT(p.*)::INT as "totalRaces",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_win)::float / COUNT(p.*) ELSE 0 END as "topPickHitRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_place)::float / COUNT(p.*) ELSE 0 END as "topPickPlaceRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_trifecta)::float / COUNT(p.*) ELSE 0 END as "top3HitRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_trio)::float / COUNT(p.*) ELSE 0 END as "top3IncludedRate",
                  json_build_object(
                    'win', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_win, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'place', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_place, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'trifecta', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_trifecta, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'trio', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_trio, 0))::float / (COUNT(p.*) * 100) ELSE 0 END)
                  ) as "actualRecovery"
                FROM generate_series(
                  DATE_TRUNC('month', today_date) - INTERVAL '6 months',
                  DATE_TRUNC('month', today_date) - INTERVAL '1 month',
                  INTERVAL '1 month'
                ) AS d(month_start)
                LEFT JOIN predictions p
                  ON p.model_id = m.model_id
                  AND p.is_hit_win IS NOT NULL
                  AND p.race_id >= d.month_start::DATE::text
                  AND p.race_id < (d.month_start + INTERVAL '1 month')::DATE::text
                GROUP BY d.month_start
                HAVING COUNT(p.*) > 0
              ) AS month_row
            ), '[]'::json),
            -- dailyHistory（過去7日）
            'dailyHistory', COALESCE((
              SELECT json_agg(day_row ORDER BY date)
              FROM (
                SELECT
                  d.day::DATE::text as date,
                  COUNT(p.*)::INT as "totalRaces",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_win)::float / COUNT(p.*) ELSE 0 END as "topPickHitRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_place)::float / COUNT(p.*) ELSE 0 END as "topPickPlaceRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_trifecta)::float / COUNT(p.*) ELSE 0 END as "top3HitRate",
                  CASE WHEN COUNT(p.*) > 0 THEN COUNT(p.*) FILTER (WHERE p.is_hit_trio)::float / COUNT(p.*) ELSE 0 END as "top3IncludedRate",
                  json_build_object(
                    'win', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_win, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'place', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_place, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'trifecta', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_trifecta, 0))::float / (COUNT(p.*) * 100) ELSE 0 END),
                    'trio', json_build_object('recoveryRate', CASE WHEN COUNT(p.*) > 0 THEN SUM(COALESCE(p.payout_trio, 0))::float / (COUNT(p.*) * 100) ELSE 0 END)
                  ) as "actualRecovery"
                FROM generate_series(seven_days_ago, today_date - 1, INTERVAL '1 day') AS d(day)
                LEFT JOIN predictions p
                  ON p.model_id = m.model_id
                  AND p.is_hit_win IS NOT NULL
                  AND p.race_id >= d.day::DATE::text
                  AND p.race_id < (d.day + INTERVAL '1 day')::DATE::text
                GROUP BY d.day
                HAVING COUNT(p.*) > 0
              ) AS day_row
            ), '[]'::json),
            -- byVenue（過去90日）
            'byVenue', COALESCE((
              SELECT json_object_agg(venue_code::text, json_build_object('overall', venue_stats))
              FROM (
                SELECT
                  SUBSTRING(p.race_id, 12, 2)::INT as venue_code,
                  json_build_object(
                    'totalRaces', COUNT(*)::INT,
                    'topPickHitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_win)::float / COUNT(*) ELSE 0 END,
                    'topPickPlaceRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_place)::float / COUNT(*) ELSE 0 END,
                    'top3HitRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trifecta)::float / COUNT(*) ELSE 0 END,
                    'top3IncludedRate', CASE WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE p.is_hit_trio)::float / COUNT(*) ELSE 0 END,
                    'actualRecovery', json_build_object(
                      'win', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_win, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                      'place', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_place, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                      'trifecta', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trifecta, 0))::float / (COUNT(*) * 100) ELSE 0 END),
                      'trio', json_build_object('recoveryRate', CASE WHEN COUNT(*) > 0 THEN SUM(COALESCE(p.payout_trio, 0))::float / (COUNT(*) * 100) ELSE 0 END)
                    )
                  ) as venue_stats
                FROM predictions p
                WHERE p.model_id = m.model_id
                  AND p.is_hit_win IS NOT NULL
                  AND p.race_id >= ninety_days_ago::text
                GROUP BY SUBSTRING(p.race_id, 12, 2)::INT
              ) AS venue_data
            ), '{}'::json)
          ) as model_data
        FROM models m
        WHERE m.model_id IN ('standard', 'safeBet', 'upsetFocus')
      ) AS model_row
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 実行権限を付与
GRANT EXECUTE ON FUNCTION get_accuracy_summary() TO anon, authenticated;

-- 動作確認
-- SELECT get_accuracy_summary();
