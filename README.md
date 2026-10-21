# ReqTrace: Purchase Approval Digitization Case

Takes a college's email-and-Excel purchasing process, finds where it breaks using its own request and PO data, and designs the future-state approval flow and requirements for an ERP rollout.

Built with SQL (SQLite) and Python (pandas, matplotlib) for the analysis, Mermaid for the process maps, and user stories with acceptance criteria for the ERP requirements.

> **Data note:** the dataset is synthetic. `src/generate_data.py` simulates three months of purchase requests and a finance PO log with a fixed seed. Westbridge College, staff and vendors are made up; the numbers are reproducible but not from a real organization.

## The question it answers

The Director of Finance is about to configure purchasing in a new ERP and asks: *what is broken in today's process, how bad is it, and what should the new process look like?* (Full request: [`brief/stakeholder_email.md`](brief/stakeholder_email.md).)

## Data

```
data/purchase_requests.csv  request_id, submitted, department, requester, item, vendor,
                            amount_usd, approver, approved_on, status, po_number, notes
data/finance_po_log.csv     po_number, request_id, entered_by, entered_on, amount_usd, gl_code, paid
```

63 requests across 6 departments (July–September 2026); 43 approved requests were re-keyed into the finance log.

## Deliverables

| # | File | What it is |
|---|---|---|
| 1 | [Data findings](deliverables/01_data_findings.md) | Issue log with counts, $ exposure and example rows |
| 2 | [As-is process](deliverables/02_as_is_process.md) | Current-state swimlane map with pain points marked |
| 3 | [To-be process](deliverables/03_to_be_process.md) | Future-state ERP approval workflow with routing rules |
| 4 | [Requirements](deliverables/04_requirements.md) | 8 user stories + acceptance criteria, prioritized (MoSCoW) |
| 5 | [Exec summary](deliverables/05_exec_summary.md) | One-page summary for the VP |

## Results

![Issue log](outputs/issue_log.png)

| Issue | Requests | $ affected | ERP control that fixes it |
|---|---|---|---|
| Amount re-keyed wrong in PO log | 3 | $144,455 | PO auto-created from the request + 3-way match |
| Over $5K approved without Finance Director | 12 | $111,473 | Amount-based approval routing |
| PO entered with no GL code | 8 | $102,962 | GL code required at submission |
| Approved with no PO number | 7 | $41,596 | PO auto-created on final approval |
| Duplicate resubmission | 3 | $6,036 | Status view + duplicate warning |

What the analysis shows:

- **Re-typing is the most expensive problem.** One request approved at $7,336 was logged and **paid at $73,363** (a decimal slip). That's a ~$66K overpayment, from a single manual step.
- **The $5K policy exists only on paper.** 12 of the 16 approved requests over $5K (75%) were signed off by a department manager alone, because approvals happen by email and nothing routes on amount.
- **Duplicates are a visibility problem, not an approval problem.** Two of the three resubmitted requests had already been approved; the requester just never heard back.
- **32% of decisions take more than 5 days**, led by Admissions (50%) and Student Services (43%).

![Approval cycle](outputs/approval_cycle.png)

## How it works

**SQL** (`sql/`, run against both CSVs loaded into SQLite):

| File | What it does | SQL used |
|---|---|---|
| `01_issue_log.sql` | Finds every control issue and totals requests and $ per issue | CTEs, `UNION ALL`, self-join, `GROUP_CONCAT` |
| `02_approval_cycle.sql` | Days to decision and % over 5 days, by department | date math (`JULIANDAY`), conditional aggregates |
| `03_rekey_mismatches.sql` | Approved amount vs. the amount finance typed | join across both sheets |

`src/analyze.py` runs the queries, writes the results to `outputs/*.csv` and draws the two charts.

## How to reproduce

```bash
pip install -r requirements.txt
python3 src/generate_data.py   # rebuild the synthetic data (same seed, same numbers)
python3 src/analyze.py         # run the SQL, write outputs/
```
