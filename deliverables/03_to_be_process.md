# 3. To-be process (ERP workflow)

```mermaid
flowchart TD
  A[Requester submits request in ERP<br/>GL code + vendor required] --> B{Duplicate check<br/>same dept+item+amount<br/>in last 30 days?}
  B -- yes --> W[Warn requester,<br/>link existing request] --> C
  B -- no --> C[Dept manager approves]
  C --> D{Amount >= $5,000?}
  D -- yes --> E[Finance Director approves]
  D -- no --> F
  E --> F[ERP creates PO automatically<br/>amount copied, not typed]
  F --> G[PO sent to vendor]
  G --> H[3-way match:<br/>PO / receipt / invoice before payment]
  C -. 3 days: reminder<br/>5 days: escalate .-> C
  E -. 3 days: reminder<br/>5 days: escalate .-> E
  A & C & E & F -. status notification .-> R[Requester sees status<br/>in My Requests]
```

## Routing and control rules
| Rule | Fixes finding |
|---|---|
| Amount-based routing: ≥ $5,000 → Finance Director after the manager | #2 policy bypass |
| PO auto-generated on final approval, amount carried over from the request | #1 re-keying, #4 missing PO |
| GL code mandatory at submission (dropdown from the chart of accounts) | #3 missing GL |
| Duplicate warning (dept + item + amount, 30 days) | #5 duplicates |
| Status notifications + "My Requests" view | #5 duplicates |
| SLA: reminder at 3 days, escalate to the next approver at 5 | approval delays |
| 3-way match before payment | stops an overpayment like REQ-023 |

## Out of scope (phase 2)
Vendor onboarding, catalog/punch-out ordering, budget-availability checks.
