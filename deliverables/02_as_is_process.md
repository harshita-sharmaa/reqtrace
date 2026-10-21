# 2. As-is process (current state)

```mermaid
flowchart LR
  subgraph Requester
    A[Fill Excel request form] --> B[Email form to manager]
    H[No status visible.<br/>Resubmit?]:::pain
  end
  subgraph Dept_Manager[Dept manager]
    C[Reply 'approved' by email]:::pain
  end
  subgraph Dept_Admin[Dept admin]
    D[Type row into shared request sheet]:::pain
  end
  subgraph Finance_Clerk[Finance clerk]
    E[Re-type approved rows into PO log]:::pain --> F[Issue PO number<br/>sometimes never]:::pain
  end
  subgraph Finance_Director[Finance director]
    G[Supposed to approve 5K+<br/>not in the flow]:::pain
  end
  B --> C --> D --> E
  C -.no reply.-> H
  E -.GL code optional.-> F
  classDef pain fill:#fde2e2,stroke:#d03b3b,color:#0b0b0b
```

| Pain point (red) | Finding it causes |
|---|---|
| Approval lives in email | No audit trail, no amount routing → **12 over-$5K approvals skipped the Director** |
| No status for the requester | **3 duplicate resubmissions**, 2 of them already approved |
| Two manual re-entries (admin sheet, PO log) | **3 amount errors**, one paid at 10x |
| PO issued by hand after approval | **7 approved requests with no PO** |
| GL code optional | **8 POs** can't be charged to a budget |
| No SLA or reminders | **32%** of decisions take more than 5 days |
