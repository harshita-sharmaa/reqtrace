-- One row per control issue: how many requests, how much money, which request IDs.
WITH approved AS (
    SELECT * FROM purchase_requests WHERE status = 'Approved'
),
issues AS (
    -- Policy: requests of $5,000+ need Finance Director sign-off
    SELECT 'Over $5K approved without Finance Director' AS issue, request_id, amount_usd
    FROM approved
    WHERE amount_usd >= 5000 AND approver NOT LIKE '%Finance Dir%'
    UNION ALL
    -- Approved but no PO issued: vendor can ship and invoice with nothing to match
    SELECT 'Approved with no PO number', request_id, amount_usd
    FROM approved
    WHERE COALESCE(po_number, '') = ''
    UNION ALL
    -- Same department + item + amount submitted again
    SELECT 'Duplicate resubmission', d.request_id, d.amount_usd
    FROM purchase_requests d
    JOIN purchase_requests o
      ON o.department = d.department AND o.item = d.item AND o.amount_usd = d.amount_usd
     AND o.request_id < d.request_id
    UNION ALL
    -- Finance re-typed a different amount than was approved
    SELECT 'Amount re-keyed wrong in PO log', f.request_id, ABS(f.amount_usd - r.amount_usd)
    FROM finance_po_log f
    JOIN purchase_requests r ON r.request_id = f.request_id
    WHERE ABS(f.amount_usd - r.amount_usd) > 0.01
    UNION ALL
    SELECT 'PO entered with no GL code', request_id, amount_usd
    FROM finance_po_log
    WHERE COALESCE(gl_code, '') = ''
)
SELECT issue,
       COUNT(*)                     AS requests,
       ROUND(SUM(amount_usd), 0)    AS dollars,
       GROUP_CONCAT(request_id, ', ') AS request_ids
FROM issues
GROUP BY issue
ORDER BY dollars DESC;
