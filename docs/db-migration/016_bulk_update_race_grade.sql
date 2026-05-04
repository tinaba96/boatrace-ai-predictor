-- Bulk update race_grade in races table from race_conditions
-- This is more efficient than individual updates and can process all records at once

UPDATE races r
SET race_grade = rc.race_grade
FROM race_conditions rc
WHERE r.race_id = rc.race_id
  AND rc.race_grade IS NOT NULL
  AND r.race_date BETWEEN '2026-02-03' AND '2026-05-02';
