# 4. Requirements (user stories)

Prioritized with MoSCoW. Each story traces back to a finding in [01_data_findings.md](01_data_findings.md).

| ID | Priority | User story | Finding |
|---|---|---|---|
| US-1 | Must | As the **Finance Director**, I want requests of $5,000+ routed to me after the manager approves, so that the approval policy is enforced. | #2 |
| US-2 | Must | As a **finance clerk**, I want the PO created automatically from the approved request, so that I never re-type amounts. | #1, #4 |
| US-3 | Must | As a **finance clerk**, I want invoices matched to the PO and receipt before payment, so that we never pay more than was approved. | #1 |
| US-4 | Must | As a **budget owner**, I want the GL code required at submission, so that all spend is charged to a budget line. | #3 |
| US-5 | Should | As a **requester**, I want to see my request's status and approver, so that I don't resubmit. | #5 |
| US-6 | Should | As a **requester**, I want a warning when a matching request already exists, so that I don't create duplicates. | #5 |
| US-7 | Should | As a **department head**, I want approvers reminded at 3 days and escalated at 5, so that purchases aren't stuck. | delays |
| US-8 | Could | As the **Finance Director**, I want a monthly report of cycle time and exceptions by department, so that I can see where the process is slow. | delays |

## Acceptance criteria

**US-1: $5K routing**
- Given a request of **$5,000.00 or more**, when the department manager approves it, then it moves to *Pending Finance Director* and **no PO is created yet**.
- Given a request of **$4,999.99**, when the manager approves it, then the PO is created without Finance Director approval.
- Given the Finance Director rejects it, then the requester is notified with the reason.

**US-2: Auto-PO**
- Given final approval, when the workflow completes, then a PO is created with the **request's amount, vendor and GL code copied over** and no editable amount field.
- Changing the amount after approval sends the request back for approval.

**US-3: 3-way match**
- Given an invoice amount that differs from the PO by more than 2% or $50, then payment is blocked and finance is alerted.

**US-4: GL code**
- Given a request without a GL code, when the requester submits it, then submission is blocked with the message "Select a GL code."

**US-5: Status**
- Given I submitted a request, when I open *My Requests*, then I see its current step, current approver and how long it has been waiting.
- I get an email at each status change.

**US-6: Duplicate warning**
- Given a request with the same department, item and amount in the last 30 days, when I submit, then I see a warning linking to the existing request and must confirm to continue.

**US-7: SLA**
- Given a request waiting 3 business days, then the approver gets a reminder; at 5 days it escalates to their backup or manager.

## Open questions for stakeholders
1. Is the $5,000 threshold per request or per vendor per month (to stop orders being split)?
2. Who is the backup approver for each department?
3. Should REQ-023 be recovered from the vendor or offset against the next invoice?
