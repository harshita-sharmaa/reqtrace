-- Days from submission to decision, by department.
WITH decided AS (
    SELECT department,
           JULIANDAY(approved_on) - JULIANDAY(submitted) AS days
    FROM purchase_requests
    WHERE approved_on <> ''
)
SELECT department,
       COUNT(*)                                        AS decided,
       ROUND(AVG(days), 1)                             AS avg_days,
       MAX(days)                                       AS max_days,
       SUM(days > 5)                                   AS over_5_days,
       ROUND(100.0 * SUM(days > 5) / COUNT(*), 0)      AS pct_over_5_days
FROM decided
GROUP BY department
ORDER BY pct_over_5_days DESC;
