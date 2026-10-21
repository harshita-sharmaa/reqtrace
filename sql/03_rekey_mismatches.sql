-- Approved amount vs. the amount finance typed into the PO log.
SELECT r.request_id,
       r.department,
       r.item,
       r.amount_usd                                   AS approved_usd,
       f.amount_usd                                   AS po_log_usd,
       ROUND(f.amount_usd / r.amount_usd, 2)          AS ratio,
       f.paid
FROM finance_po_log f
JOIN purchase_requests r ON r.request_id = f.request_id
WHERE ABS(f.amount_usd - r.amount_usd) > 0.01
ORDER BY ABS(f.amount_usd - r.amount_usd) DESC;
