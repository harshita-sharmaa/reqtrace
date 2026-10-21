// Westbridge Purchasing: a small mock ERP purchasing module for recording workflows.
// Plain JS, no build step. State lives in localStorage so work survives a reload;
// Settings → "Reset demo data" puts everything back to the seed.

const STORE_KEY = "westbridge-purchasing-v1";
const SEED = window.SEED;
const TODAY = SEED.today;
const DEPTS = Object.keys(SEED.managers);
const VENDORS = ["Amazon Business", "B&H Photo", "CDW", "Dell", "Grainger", "Home Depot Pro", "Office Depot", "Staples"];
const THRESHOLD = 5000;

const CONTROLS = [
  ["routing", "Amount-based approval routing", "Requests of $5,000 or more go to the Finance Director after the department manager."],
  ["requireGl", "Require GL code on submission", "Requesters must pick a GL code before a request can be submitted."],
  ["dupCheck", "Duplicate request warning", "Warn when the same department submits the same item at a similar amount within 60 days."],
  ["autoPo", "Auto-create PO on final approval", "The PO is generated from the approved request. Finance never re-types the amount."],
  ["threeWay", "3-way match before payment", "Invoices can only be paid when they match the PO and the approved request."],
];

// ---------- state ----------

function freshState() {
  const s = JSON.parse(JSON.stringify(SEED));
  return {
    requests: s.requests,
    pos: s.pos,
    invoices: s.invoices,
    audit: [],
    settings: { routing: false, requireGl: false, dupCheck: false, autoPo: false, threeWay: false },
    role: "requester:Facilities",
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage blocked: fall back to seed */ }
  return freshState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

// ---------- helpers ----------

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => "$" + Math.round(n).toLocaleString("en-US");
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function parseRole(key = state.role) {
  const [type, dept] = key.split(":");
  return { type, dept, key };
}

function actorName(role = parseRole()) {
  if (role.type === "requester") return `${role.dept} staff`;
  if (role.type === "manager") return `${SEED.managers[role.dept]} (${role.dept} Mgr)`;
  if (role.type === "director") return SEED.director;
  return "Finance clerk";
}

function log(what, ref) {
  state.audit.unshift({ when: TODAY, who: actorName(), what, ref });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

function nextId(prefix, list, key) {
  const max = list.reduce((m, x) => Math.max(m, parseInt(String(x[key]).replace(/\D/g, ""), 10) || 0), 0);
  return prefix + String(max + 1).padStart(prefix === "REQ-" ? 3 : 0, "0");
}

const reqById = (id) => state.requests.find((r) => r.id === id);
const poFor = (r) => state.pos.find((p) => p.request === r.id && p.po);
const invoiceFor = (r) => state.invoices.find((i) => i.request === r.id);

// ---------- business rules ----------

function statusPill(r) {
  if (r.status === "Pending") return `<span class="pill warn">Pending · ${r.step === "Director" ? "Finance Dir." : "Manager"}</span>`;
  if (r.status === "Approved") return `<span class="pill ok">Approved</span>`;
  if (r.status === "Rejected") return `<span class="pill bad">Rejected</span>`;
  return `<span class="pill muted">${esc(r.status)}</span>`;
}

function canApprove(r, role = parseRole()) {
  if (r.status !== "Pending") return false;
  if (r.step === "Manager") return role.type === "manager" && role.dept === r.department;
  if (r.step === "Director") return role.type === "director";
  return false;
}

function approvalQueue(role = parseRole()) {
  return state.requests.filter((r) => canApprove(r, role));
}

function approve(r) {
  if (r.step === "Manager" && state.settings.routing && r.amount >= THRESHOLD) {
    r.step = "Director";
    r.mgrApproved = TODAY;
    log(`Approved by manager; routed to Finance Director (≥ ${money0(THRESHOLD)})`, r.id);
    return "Approved. Routed to the Finance Director because it's $5,000 or more.";
  }
  r.approver = r.step === "Director" ? SEED.director : actorName();
  r.status = "Approved";
  r.step = null;
  r.decided = TODAY;
  log("Final approval", r.id);
  if (state.settings.autoPo) {
    const po = createPo(r, r.amount, r.gl);
    return `Approved. ${po} created automatically.`;
  }
  return "Approved. Finance needs to create the PO.";
}

function reject(r, reason) {
  r.status = "Rejected";
  r.step = null;
  r.approver = actorName();
  r.decided = TODAY;
  r.reason = reason;
  log(`Rejected: ${reason || "no reason given"}`, r.id);
}

function createPo(r, amount, gl) {
  const po = nextId("PO-", state.pos.filter((p) => p.po), "po");
  r.po = po;
  if (gl) r.gl = gl;
  state.pos.push({ po, request: r.id, entered: TODAY, amount: Number(amount), gl: gl || "", paid: false });
  const inv = invoiceFor(r);
  if (inv && !inv.po) inv.po = po;
  log(`${po} created for ${money(amount)}${state.settings.autoPo ? " (auto)" : " (manual entry)"}`, r.id);
  return po;
}

function findDuplicates(draft) {
  return state.requests.filter(
    (r) =>
      r.department === draft.department &&
      r.item.trim().toLowerCase() === draft.item.trim().toLowerCase() &&
      Math.abs(r.amount - draft.amount) <= draft.amount * 0.1 &&
      days(r.submitted, TODAY) <= 60
  );
}

function matchStatus(inv) {
  const r = reqById(inv.request);
  const po = state.pos.find((p) => p.po && p.po === inv.po);
  if (inv.status === "Paid" && inv.paid_amount > inv.amount + 0.01) return { key: "overpaid", label: "Overpaid", cls: "bad", diff: inv.paid_amount - inv.amount };
  if (inv.status === "Paid" && inv.paid_amount < inv.amount - 0.01) return { key: "underpaid", label: "Underpaid", cls: "warn", diff: inv.amount - inv.paid_amount };
  if (!po) return { key: "nopo", label: "No PO", cls: "bad" };
  const tol = Math.max(50, inv.amount * 0.02);
  if (Math.abs(po.amount - inv.amount) > tol || Math.abs(po.amount - r.amount) > tol) return { key: "mismatch", label: "Amount mismatch", cls: "bad", diff: po.amount - inv.amount };
  return { key: "matched", label: "Matched", cls: "ok" };
}

function exceptions() {
  const approved = state.requests.filter((r) => r.status === "Approved");
  const out = [];
  const add = (issue, r, dollars, detail) => out.push({ issue, r, dollars, detail });
  approved.forEach((r) => {
    if (r.amount >= THRESHOLD && !String(r.approver).includes("Finance Dir")) add("Over $5K approved without Finance Director", r, r.amount, `Approved by ${r.approver}`);
    if (!r.po) add("Approved with no PO number", r, r.amount, "Vendor can invoice with nothing to match");
  });
  state.pos.forEach((p) => {
    const r = reqById(p.request);
    if (p.po && Math.abs(p.amount - r.amount) > 0.01) add("Amount re-keyed wrong in PO log", r, Math.abs(p.amount - r.amount), `Approved ${money(r.amount)} → PO ${money(p.amount)}`);
    if (!p.gl) add("PO entered with no GL code", r, p.amount, p.po || "(no PO number)");
  });
  state.requests.forEach((d) => {
    const orig = state.requests.find((o) => o.id < d.id && o.department === d.department && o.item === d.item && o.amount === d.amount);
    if (orig) add("Duplicate resubmission", d, d.amount, `Same as ${orig.id} (${orig.status})`);
  });
  return out;
}

// ---------- shell ----------

function roleOptions() {
  const opt = (key, label) => `<option value="${key}" ${state.role === key ? "selected" : ""}>${esc(label)}</option>`;
  return [
    `<optgroup label="Requesters">${DEPTS.map((d) => opt(`requester:${d}`, `${d} staff`)).join("")}</optgroup>`,
    `<optgroup label="Department managers">${DEPTS.map((d) => opt(`manager:${d}`, `${SEED.managers[d]} · ${d} Mgr`)).join("")}</optgroup>`,
    `<optgroup label="Finance">${opt("director:", "J. Alvarez · Finance Director")}${opt("clerk:", "Finance clerk")}</optgroup>`,
  ].join("");
}

function navItems() {
  const role = parseRole();
  const items = [["dashboard", "Dashboard"], ["requests", role.type === "requester" ? "My department's requests" : "All requests"]];
  if (role.type === "requester") items.push(["new", "New request"]);
  if (role.type === "manager" || role.type === "director") items.push(["approvals", "Approvals", approvalQueue().length]);
  if (role.type === "clerk" || role.type === "director") {
    items.push(["pos", "Purchase orders"], ["invoices", "Invoices", state.invoices.filter((i) => i.status === "Open" && matchStatus(i).key !== "matched").length]);
    items.push(["exceptions", "Exceptions report", exceptions().length]);
  }
  if (role.type === "director") items.push(["settings", "Controls & settings"]);
  return items;
}

function renderNav(route) {
  $("#nav").innerHTML =
    `<div class="section">Purchasing</div>` +
    navItems()
      .map(([key, label, count]) => `<a href="#/${key}" class="${route === key ? "active" : ""}"><span>${esc(label)}</span>${count ? `<span class="count">${count}</span>` : ""}</a>`)
      .join("");
}

const VIEWS = {};

function render() {
  const route = (location.hash.replace("#/", "") || "dashboard").split("?")[0];
  const allowed = navItems().map((n) => n[0]);
  const view = allowed.includes(route) ? route : "dashboard";
  renderNav(view);
  $("#view").innerHTML = VIEWS[view]();
  if (VIEWS[view].after) VIEWS[view].after();
  save();
}

// ---------- dashboard ----------

VIEWS.dashboard = () => {
  const role = parseRole();
  const mine = role.type === "requester" || role.type === "manager" ? state.requests.filter((r) => r.department === role.dept) : state.requests;
  const open = mine.filter((r) => r.status === "Pending");
  const decided = mine.filter((r) => r.decided);
  const avg = decided.length ? decided.reduce((s, r) => s + days(r.submitted, r.decided), 0) / decided.length : 0;
  const approvedDollars = mine.filter((r) => r.status === "Approved").reduce((s, r) => s + r.amount, 0);
  const exc = exceptions().filter((e) => mine.includes(e.r));
  const scope = role.type === "requester" || role.type === "manager" ? role.dept : "All departments";

  let attention = "";
  if (role.type === "manager" || role.type === "director") {
    const q = approvalQueue();
    attention = q.length ? requestTable(q, { compact: true }) : `<div class="empty">Nothing waiting for your approval.</div>`;
  } else if (role.type === "requester") {
    attention = open.length ? requestTable(open, { compact: true }) : `<div class="empty">No open requests.</div>`;
  } else {
    const bad = state.invoices.filter((i) => i.status !== "Paid" && matchStatus(i).key !== "matched");
    attention = bad.length ? invoiceTable(bad) : `<div class="empty">All open invoices match.</div>`;
  }

  return `
    <h1>Good morning</h1>
    <p class="sub">${esc(actorName())} · ${esc(scope)} · ${fmtDate(TODAY)}</p>
    <div class="cards">
      <div class="card"><div class="label">Open requests</div><div class="value">${open.length}</div></div>
      <div class="card"><div class="label">Avg. days to decision</div><div class="value">${avg.toFixed(1)}</div></div>
      <div class="card"><div class="label">Approved spend</div><div class="value">${money0(approvedDollars)}</div></div>
      <div class="card ${exc.length ? "alert" : ""}"><div class="label">Control exceptions</div><div class="value">${exc.length}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>${role.type === "clerk" ? "Invoices needing attention" : role.type === "requester" ? "Your open requests" : "Waiting for your approval"}</h2></div>
      ${attention}
    </div>
    <div class="panel">
      <div class="panel-head"><h2>Recent activity in this session</h2></div>
      ${state.audit.length ? `<table><tbody>${state.audit.slice(0, 8).map((a) => `<tr class="clickable" data-open="${esc(a.ref)}"><td>${esc(a.ref)}</td><td>${esc(a.what)}</td><td>${esc(a.who)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No activity yet. Actions you take will show up here.</div>`}
    </div>`;
};

// ---------- requests ----------

const reqFilters = { q: "", dept: "", status: "", sort: "submitted", dir: -1 };

function requestTable(list, { compact = false } = {}) {
  if (!list.length) return `<div class="empty">No requests match these filters.</div>`;
  const cols = [
    ["id", "Request"], ["submitted", "Submitted"], ["department", "Department"], ["item", "Item"], ["vendor", "Vendor"],
    ["amount", "Amount", "num"], ["status", "Status"], ["po", "PO"], ["age", "Age (days)", "num"],
  ];
  const head = cols.map(([k, l, c]) => `<th class="${c || ""}" data-sort="${compact ? "" : k}">${l}${!compact && reqFilters.sort === k ? (reqFilters.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("");
  const rows = list
    .map((r) => {
      const age = r.status === "Pending" ? days(r.submitted, TODAY) : "";
      return `<tr class="clickable" data-open="${r.id}">
        <td><b>${r.id}</b></td><td>${fmtDate(r.submitted)}</td><td>${esc(r.department)}</td><td>${esc(r.item)}</td><td>${esc(r.vendor)}</td>
        <td class="num">${money(r.amount)}</td><td>${statusPill(r)}</td><td>${r.po ? esc(r.po) : r.status === "Approved" ? '<span class="pill bad">Missing</span>' : "—"}</td>
        <td class="num">${age !== "" && age > 5 ? `<span class="diff">${age}</span>` : age}</td></tr>`;
    })
    .join("");
  return `<div style="overflow-x:auto"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

VIEWS.requests = () => {
  const role = parseRole();
  let list = role.type === "requester" || role.type === "manager" ? state.requests.filter((r) => r.department === role.dept) : state.requests.slice();
  const q = reqFilters.q.toLowerCase();
  if (q) list = list.filter((r) => [r.id, r.item, r.vendor, r.requester, r.po].join(" ").toLowerCase().includes(q));
  if (reqFilters.dept) list = list.filter((r) => r.department === reqFilters.dept);
  if (reqFilters.status) list = list.filter((r) => r.status === reqFilters.status);
  const key = reqFilters.sort;
  list.sort((a, b) => {
    const va = key === "age" ? (a.status === "Pending" ? days(a.submitted, TODAY) : -1) : a[key];
    const vb = key === "age" ? (b.status === "Pending" ? days(b.submitted, TODAY) : -1) : b[key];
    return (va > vb ? 1 : va < vb ? -1 : 0) * reqFilters.dir;
  });
  const showDept = !(role.type === "requester" || role.type === "manager");
  return `
    <h1>${role.type === "requester" ? `${esc(role.dept)} requests` : "All purchase requests"}</h1>
    <p class="sub">${list.length} requests · click a row for details and history</p>
    <div class="panel">
      <div class="panel-head">
        <div class="toolbar">
          <input id="f-q" placeholder="Search ID, item, vendor, PO…" value="${esc(reqFilters.q)}" style="min-width:240px">
          ${showDept ? `<select id="f-dept"><option value="">All departments</option>${DEPTS.map((d) => `<option ${reqFilters.dept === d ? "selected" : ""}>${d}</option>`).join("")}</select>` : ""}
          <select id="f-status"><option value="">All statuses</option>${["Pending", "Approved", "Rejected"].map((s) => `<option ${reqFilters.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <button class="btn" id="export-req">Export CSV</button>
      </div>
      ${requestTable(list)}
    </div>`;
};
VIEWS.requests.after = () => {
  const bind = (id, k) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
      reqFilters[k] = el.value;
      const pos = el.selectionStart;
      render();
      const again = $(id);
      again.focus();
      if (again.setSelectionRange && pos != null) again.setSelectionRange(pos, pos);
    });
  };
  bind("#f-q", "q");
  bind("#f-dept", "dept");
  bind("#f-status", "status");
  $("#export-req").onclick = () => downloadCsv("purchase_requests_export.csv", state.requests, ["id", "submitted", "department", "requester", "item", "vendor", "amount", "status", "step", "approver", "decided", "po", "gl", "notes"]);
};

// ---------- new request ----------

let draft = null;

VIEWS.new = () => {
  const role = parseRole();
  draft = draft || { item: "", vendor: "", amount: "", gl: "", justification: "", errors: {} };
  const e = draft.errors;
  const field = (key, label, input, hint) =>
    `<div class="field ${e[key] ? "error" : ""} ${key === "justification" ? "full" : ""}"><label>${label}</label>${input}${e[key] ? `<div class="err">${e[key]}</div>` : hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
  return `
    <h1>New purchase request</h1>
    <p class="sub">Submitting as ${esc(actorName())}. It goes to ${esc(SEED.managers[role.dept])} for approval${state.settings.routing ? ", then the Finance Director if it's $5,000 or more" : ""}.</p>
    <div class="panel"><div class="panel-body">
      <form id="new-form" class="form" novalidate>
        ${field("department", "Department", `<input value="${esc(role.dept)}" disabled>`)}
        ${field("item", "Item / description", `<input name="item" value="${esc(draft.item)}" placeholder="e.g. Laptops">`)}
        ${field("vendor", "Vendor", `<select name="vendor"><option value="">Select a vendor…</option>${VENDORS.map((v) => `<option ${draft.vendor === v ? "selected" : ""}>${v}</option>`).join("")}</select>`)}
        ${field("amount", "Total amount (USD)", `<input name="amount" inputmode="decimal" value="${esc(draft.amount)}" placeholder="0.00">`, Number(draft.amount) >= THRESHOLD && state.settings.routing ? "Needs Finance Director approval." : "")}
        ${field("gl", `GL code${state.settings.requireGl ? " *" : " (optional)"}`, `<select name="gl"><option value="">— none —</option>${Object.entries(SEED.glCodes).map(([c, n]) => `<option value="${c}" ${draft.gl === c ? "selected" : ""}>${c} · ${n}</option>`).join("")}</select>`)}
        ${field("justification", "Business justification", `<textarea name="justification" rows="3">${esc(draft.justification)}</textarea>`)}
        <div class="full actions"><button class="btn primary" type="submit">Submit request</button><button class="btn" type="button" id="clear-form">Clear</button></div>
      </form>
    </div></div>`;
};
VIEWS.new.after = () => {
  const form = $("#new-form");
  form.addEventListener("input", (ev) => { if (ev.target.name) draft[ev.target.name] = ev.target.value; });
  $("#clear-form").onclick = () => { draft = null; render(); };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const amount = Number(String(draft.amount).replace(/[$,]/g, ""));
    const errors = {};
    if (!draft.item.trim()) errors.item = "Describe what you're buying.";
    if (!draft.vendor) errors.vendor = "Pick a vendor.";
    if (!(amount > 0)) errors.amount = "Enter an amount greater than 0.";
    if (state.settings.requireGl && !draft.gl) errors.gl = "Select a GL code.";
    draft.errors = errors;
    if (Object.keys(errors).length) return render();
    const role = parseRole();
    const candidate = { department: role.dept, item: draft.item.trim(), amount };
    const dups = state.settings.dupCheck ? findDuplicates(candidate) : [];
    if (dups.length) {
      return confirmModal(
        "Possible duplicate",
        `<p>${esc(role.dept)} already has ${dups.length === 1 ? "a request" : "requests"} for <b>${esc(candidate.item)}</b> at a similar amount:</p>
         <ul>${dups.map((d) => `<li><b>${d.id}</b>, ${money(d.amount)}, ${statusPill(d)} (submitted ${fmtDate(d.submitted)})</li>`).join("")}</ul>
         <p>Check the existing request before submitting again.</p>`,
        "Submit anyway",
        () => submitDraft(candidate, true)
      );
    }
    submitDraft(candidate, false);
  };
};

function submitDraft(candidate, overrodeDup) {
  const role = parseRole();
  const r = {
    id: nextId("REQ-", state.requests, "id"),
    submitted: TODAY, department: role.dept, requester: actorName(), item: candidate.item, vendor: draft.vendor,
    amount: candidate.amount, status: "Pending", step: "Manager", approver: "", decided: "", po: "", gl: draft.gl,
    notes: draft.justification + (overrodeDup ? " [submitted despite duplicate warning]" : ""),
  };
  state.requests.push(r);
  log(`Submitted for ${money(r.amount)}${overrodeDup ? " (duplicate warning overridden)" : ""}`, r.id);
  draft = null;
  toast(`${r.id} submitted to ${SEED.managers[role.dept]}`);
  goTo("requests", r.id);
}

// Navigate and optionally open a request's drawer once the new view has rendered.
let pendingDrawer = null;
function goTo(route, openId) {
  if (location.hash === `#/${route}`) {
    render();
    if (openId) openDrawer(openId);
    return;
  }
  pendingDrawer = openId || null;
  location.hash = `#/${route}`;
}

// ---------- approvals ----------

VIEWS.approvals = () => {
  const q = approvalQueue().sort((a, b) => a.submitted.localeCompare(b.submitted));
  return `
    <h1>Approvals</h1>
    <p class="sub">${q.length} waiting for ${esc(actorName())} · oldest first</p>
    ${!state.settings.routing && parseRole().type === "manager" ? `<div class="banner warn">Amount-based routing is off: your approval is final, whatever the amount.</div>` : ""}
    <div class="panel">
      ${q.length ? `<table><thead><tr><th>Request</th><th>Submitted</th><th>Department</th><th>Item</th><th>Vendor</th><th class="num">Amount</th><th>GL</th><th class="num">Waiting</th><th></th></tr></thead><tbody>
        ${q.map((r) => `<tr>
          <td><a href="#" data-open="${r.id}"><b>${r.id}</b></a></td><td>${fmtDate(r.submitted)}</td><td>${esc(r.department)}</td><td>${esc(r.item)}</td><td>${esc(r.vendor)}</td>
          <td class="num">${money(r.amount)}${r.amount >= THRESHOLD ? ' <span class="pill info">≥ $5K</span>' : ""}</td><td>${r.gl || '<span class="pill warn">None</span>'}</td>
          <td class="num">${days(r.submitted, TODAY) > 5 ? `<span class="diff">${days(r.submitted, TODAY)} d</span>` : days(r.submitted, TODAY) + " d"}</td>
          <td><div class="actions" style="margin:0"><button class="btn small ok" data-approve="${r.id}">Approve</button><button class="btn small danger" data-reject="${r.id}">Reject</button></div></td></tr>`).join("")}
      </tbody></table>` : `<div class="empty">You're all caught up.</div>`}
    </div>`;
};

// ---------- purchase orders ----------

VIEWS.pos = () => {
  const missing = state.requests.filter((r) => r.status === "Approved" && !r.po);
  const rows = state.pos
    .filter((p) => p.po)
    .slice()
    .sort((a, b) => b.entered.localeCompare(a.entered))
    .map((p) => {
      const r = reqById(p.request);
      const off = Math.abs(p.amount - r.amount) > 0.01;
      return `<tr>
        <td><b>${esc(p.po)}</b></td><td><a href="#" data-open="${r.id}">${r.id}</a></td><td>${esc(r.vendor)}</td>
        <td class="num">${money(r.amount)}</td><td class="num ${off ? "diff" : ""}">${money(p.amount)}${off ? " ⚠" : ""}</td>
        <td>${p.gl ? esc(p.gl) : `<button class="btn small" data-setgl="${esc(p.po)}">Add GL</button>`}</td>
        <td>${fmtDate(p.entered)}</td><td>${p.paid ? '<span class="pill ok">Paid</span>' : '<span class="pill muted">Unpaid</span>'}</td>
        <td>${off && !p.paid ? `<button class="btn small" data-fixpo="${esc(p.po)}">Correct amount</button>` : ""}</td></tr>`;
    })
    .join("");
  return `
    <h1>Purchase orders</h1>
    <p class="sub">PO log · ${state.pos.filter((p) => p.po).length} POs</p>
    ${missing.length ? `<div class="panel"><div class="panel-head"><h2>Approved requests with no PO (${missing.length})</h2><span class="pill bad">${money0(missing.reduce((s, r) => s + r.amount, 0))} at risk</span></div>
      <table><thead><tr><th>Request</th><th>Approved</th><th>Department</th><th>Vendor</th><th class="num">Approved amount</th><th></th></tr></thead><tbody>
      ${missing.map((r) => `<tr><td><a href="#" data-open="${r.id}"><b>${r.id}</b></a></td><td>${fmtDate(r.decided)}</td><td>${esc(r.department)}</td><td>${esc(r.vendor)}</td><td class="num">${money(r.amount)}</td><td><button class="btn small primary" data-createpo="${r.id}">Create PO</button></td></tr>`).join("")}
      </tbody></table></div>` : ""}
    <div class="panel"><div class="panel-head"><h2>PO log</h2><button class="btn" id="export-po">Export CSV</button></div>
      <div style="overflow-x:auto"><table><thead><tr><th>PO</th><th>Request</th><th>Vendor</th><th class="num">Approved</th><th class="num">PO amount</th><th>GL code</th><th>Entered</th><th>Payment</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
};
VIEWS.pos.after = () => {
  $("#export-po").onclick = () => downloadCsv("po_log_export.csv", state.pos, ["po", "request", "entered", "amount", "gl", "paid"]);
};

// ---------- invoices ----------

VIEWS.invoices = () => {
  const list = state.invoices.slice().sort((a, b) => {
    const rank = (i) => ({ overpaid: 0, mismatch: 1, nopo: 2, underpaid: 3, matched: 4 }[matchStatus(i).key]);
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  });
  return `
    <h1>Invoices · 3-way match</h1>
    <p class="sub">Each vendor invoice is checked against its PO and the approved request${state.settings.threeWay ? ". Payment is blocked unless they match." : "."}</p>
    ${!state.settings.threeWay ? `<div class="banner warn">3-way match is not enforced: any open invoice can be paid at the PO amount.</div>` : ""}
    <div class="panel">${invoiceTable(list)}</div>`;
};

function invoiceTable(list) {
  return `<div style="overflow-x:auto"><table><thead><tr><th>Invoice</th><th>Vendor</th><th>Request</th><th>PO</th><th class="num">Invoice</th><th class="num">PO</th><th class="num">Approved</th><th>Match</th><th>Payment</th><th></th></tr></thead><tbody>
    ${list.map((i) => {
      const r = reqById(i.request);
      const po = state.pos.find((p) => p.po && p.po === i.po);
      const m = matchStatus(i);
      const payable = i.status === "Open" && po && (!state.settings.threeWay || m.key === "matched");
      let payCell = i.status === "Paid" ? `<span class="pill ok">Paid ${money(i.paid_amount)}</span>` : i.status === "On hold" ? '<span class="pill warn">On hold</span>' : i.status === "Recovery requested" ? '<span class="pill info">Recovery requested</span>' : '<span class="pill muted">Open</span>';
      let actions = "";
      if (i.status === "Open" || i.status === "On hold") {
        actions += `<button class="btn small ok" data-pay="${i.id}" ${payable ? "" : "disabled"} title="${payable ? "" : "Blocked: invoice must match PO and approval"}">Pay</button>`;
        if (i.status === "Open") actions += `<button class="btn small" data-hold="${i.id}">Hold</button>`;
      }
      if (m.key === "overpaid" && i.status === "Paid") actions += `<button class="btn small danger" data-recover="${i.id}">Request refund</button>`;
      if (m.key === "underpaid") actions += `<button class="btn small ok" data-paybalance="${i.id}">Pay balance ${money(m.diff)}</button>`;
      return `<tr><td><b>${i.id}</b></td><td>${esc(i.vendor)}</td><td><a href="#" data-open="${r.id}">${r.id}</a></td><td>${i.po ? esc(i.po) : "—"}</td>
        <td class="num">${money(i.amount)}</td><td class="num ${po && Math.abs(po.amount - i.amount) > 0.01 ? "diff" : ""}">${po ? money(po.amount) : "—"}</td><td class="num">${money(r.amount)}</td>
        <td><span class="pill ${m.cls}">${m.label}${m.diff ? " " + money(m.diff) : ""}</span></td><td>${payCell}</td><td><div class="actions" style="margin:0">${actions}</div></td></tr>`;
    }).join("")}
  </tbody></table></div>`;
}

// ---------- exceptions ----------

VIEWS.exceptions = () => {
  const ex = exceptions();
  const groups = {};
  ex.forEach((e) => (groups[e.issue] = groups[e.issue] || []).push(e));
  const order = Object.entries(groups).sort((a, b) => b[1].reduce((s, e) => s + e.dollars, 0) - a[1].reduce((s, e) => s + e.dollars, 0));
  return `
    <h1>Exceptions report</h1>
    <p class="sub">Control failures across all departments, recalculated live as you fix them</p>
    <div class="cards">
      <div class="card alert"><div class="label">Open exceptions</div><div class="value">${ex.length}</div></div>
      <div class="card"><div class="label">Issue types</div><div class="value">${order.length}</div></div>
      <div class="card"><div class="label">Requests affected</div><div class="value">${new Set(ex.map((e) => e.r.id)).size}</div></div>
      <div class="card"><div class="label">Overpaid invoices</div><div class="value">${state.invoices.filter((i) => matchStatus(i).key === "overpaid").length}</div></div>
    </div>
    ${order.length ? order.map(([issue, items]) => `
      <div class="panel"><div class="panel-head"><h2>${esc(issue)}</h2><span><span class="pill bad">${items.length} · ${money0(items.reduce((s, e) => s + e.dollars, 0))}</span></span></div>
      <table><tbody>${items.map((e) => `<tr class="clickable" data-open="${e.r.id}"><td style="width:110px"><b>${e.r.id}</b></td><td style="width:160px">${esc(e.r.department)}</td><td>${esc(e.detail)}</td><td class="num">${money(e.dollars)}</td></tr>`).join("")}</tbody></table></div>`).join("") : `<div class="panel"><div class="empty">No exceptions. Every control is passing.</div></div>`}
    <button class="btn" id="export-ex">Export exceptions CSV</button>`;
};
VIEWS.exceptions.after = () => {
  $("#export-ex").onclick = () =>
    downloadCsv("exceptions_export.csv", exceptions().map((e) => ({ issue: e.issue, request: e.r.id, department: e.r.department, detail: e.detail, dollars: e.dollars.toFixed(2) })), ["issue", "request", "department", "detail", "dollars"]);
};

// ---------- settings ----------

VIEWS.settings = () => `
  <h1>Controls & settings</h1>
  <p class="sub">Purchasing controls for the ERP configuration. Everything starts off, the way the old email-and-Excel process works.</p>
  <div class="panel"><div class="panel-body">
    ${CONTROLS.map(([key, label, desc]) => `<div class="switch-row"><div><b>${label}</b><div class="desc">${desc}</div></div><button class="toggle ${state.settings[key] ? "on" : ""}" data-toggle="${key}" aria-pressed="${state.settings[key]}" aria-label="${esc(label)}"></button></div>`).join("")}
  </div></div>
  <div class="panel"><div class="panel-head"><h2>Demo data</h2></div><div class="panel-body">
    <p class="sub" style="margin-bottom:10px">Put every request, PO, invoice and setting back to the starting point. Do this before each new recording.</p>
    <button class="btn danger" id="reset">Reset demo data</button>
  </div></div>`;
VIEWS.settings.after = () => {
  $("#reset").onclick = () =>
    confirmModal("Reset demo data?", "<p>All changes made in this browser will be lost.</p>", "Reset", () => {
      const role = state.role;
      state = freshState();
      state.role = role;
      draft = null;
      toast("Demo data reset");
      render();
    });
};

// ---------- drawer ----------

function openDrawer(id) {
  const r = reqById(id);
  if (!r) return;
  const po = poFor(r);
  const inv = invoiceFor(r);
  const events = [{ when: r.submitted, what: `Submitted by ${r.requester}` }];
  if (r.mgrApproved) events.push({ when: r.mgrApproved, what: "Manager approved; routed to Finance Director" });
  if (r.decided && r.status === "Approved") events.push({ when: r.decided, what: `Approved by ${r.approver}` });
  if (r.decided && r.status === "Rejected") events.push({ when: r.decided, what: `Rejected by ${r.approver}${r.reason ? `: "${r.reason}"` : ""}` });
  if (po) events.push({ when: po.entered, what: `${po.po} entered at ${money(po.amount)}` });
  if (inv) events.push({ when: inv.received, what: `Invoice ${inv.id} received for ${money(inv.amount)}${inv.status === "Paid" ? `; paid ${money(inv.paid_amount)}` : ""}` });
  state.audit.filter((a) => a.ref === id).reverse().forEach((a) => events.push({ when: a.when, what: `${a.what} (${a.who})` }));
  events.sort((a, b) => a.when.localeCompare(b.when));

  const role = parseRole();
  const acts = [];
  if (canApprove(r)) acts.push(`<button class="btn ok" data-approve="${r.id}">Approve</button><button class="btn danger" data-reject="${r.id}">Reject</button>`);
  if (role.type === "clerk" && r.status === "Approved" && !r.po) acts.push(`<button class="btn primary" data-createpo="${r.id}">Create PO</button>`);
  if (role.type === "requester" && r.status === "Pending" && r.department === role.dept) acts.push(`<button class="btn" data-withdraw="${r.id}">Withdraw request</button>`);

  const issues = exceptions().filter((e) => e.r.id === r.id);
  const d = $("#drawer");
  d.innerHTML = `
    <button class="btn small close" id="close-drawer">Close ✕</button>
    <h2>${r.id} · ${esc(r.item)}</h2>
    <div>${statusPill(r)}</div>
    ${issues.map((e) => `<div class="banner bad" style="margin:12px 0 0">${esc(e.issue)}: ${esc(e.detail)}</div>`).join("")}
    <dl class="kv">
      <dt>Department</dt><dd>${esc(r.department)}</dd>
      <dt>Requester</dt><dd>${esc(r.requester)}</dd>
      <dt>Vendor</dt><dd>${esc(r.vendor)}</dd>
      <dt>Amount</dt><dd><b>${money(r.amount)}</b></dd>
      <dt>GL code</dt><dd>${r.gl ? `${esc(r.gl)} · ${esc(SEED.glCodes[r.gl] || "")}` : "—"}</dd>
      <dt>PO</dt><dd>${po ? `${esc(po.po)} · ${money(po.amount)}` : "—"}</dd>
      <dt>Invoice</dt><dd>${inv ? `${esc(inv.id)} · ${money(inv.amount)} · ${esc(inv.status)}` : "—"}</dd>
      ${r.notes ? `<dt>Notes</dt><dd>${esc(r.notes)}</dd>` : ""}
    </dl>
    <h3 style="font-size:14px;margin:0">History</h3>
    <ul class="timeline">${events.map((e) => `<li><div class="when">${fmtDate(e.when)}</div>${esc(e.what)}</li>`).join("")}</ul>
    <div class="actions">${acts.join("")}</div>`;
  d.hidden = false;
  $("#close-drawer").onclick = closeDrawer;
}

function closeDrawer() { $("#drawer").hidden = true; }

// ---------- modals ----------

function confirmModal(title, body, okLabel, onOk, { withReason = false, input = null } = {}) {
  const m = $("#modal");
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${body}
    ${withReason ? `<textarea id="modal-reason" placeholder="Reason (shared with the requester)"></textarea>` : ""}
    ${input ? `<div class="field" style="margin-top:10px"><label>${esc(input.label)}</label>${input.html}</div>` : ""}
    <div class="actions" style="justify-content:flex-end;margin-top:16px"><button class="btn" id="modal-cancel">Cancel</button><button class="btn primary" id="modal-ok">${esc(okLabel)}</button></div></div>`;
  m.hidden = false;
  const first = m.querySelector("textarea, input, select");
  if (first) first.focus();
  $("#modal-cancel").onclick = () => (m.hidden = true);
  $("#modal-ok").onclick = () => {
    const value = withReason ? $("#modal-reason").value.trim() : input ? $("#modal-input").value : null;
    if (input && input.validate) {
      const err = input.validate(value);
      if (err) return toast(err);
    }
    m.hidden = true;
    onOk(value);
  };
}

function createPoFlow(r) {
  if (state.settings.autoPo) {
    const po = createPo(r, r.amount, r.gl);
    toast(`${po} created from ${r.id}`);
    return refresh(r.id);
  }
  confirmModal(
    `Create PO for ${r.id}`,
    `<p>${esc(r.vendor)} · ${esc(r.item)} · approved by ${esc(r.approver)}.<br>Type the PO amount from the approval email.</p>`,
    "Create PO",
    (val) => {
      const amt = Number(String(val).replace(/[$,]/g, ""));
      const po = createPo(r, amt, r.gl);
      toast(`${po} created`);
      refresh(r.id);
    },
    { input: { label: "PO amount (USD)", html: `<input id="modal-input" inputmode="decimal" placeholder="0.00">`, validate: (v) => (Number(String(v).replace(/[$,]/g, "")) > 0 ? "" : "Enter an amount") } }
  );
}

function refresh(openId) {
  render();
  if (openId && !$("#drawer").hidden) openDrawer(openId);
}

// ---------- csv ----------

function downloadCsv(name, rows, cols) {
  const cell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  toast(`Downloaded ${name}`);
}

// ---------- events ----------

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-open],[data-approve],[data-reject],[data-createpo],[data-withdraw],[data-pay],[data-paybalance],[data-hold],[data-recover],[data-toggle],[data-setgl],[data-fixpo],th[data-sort]");
  if (!t) return;
  const d = t.dataset;

  if (d.sort) {
    reqFilters.dir = reqFilters.sort === d.sort ? -reqFilters.dir : 1;
    reqFilters.sort = d.sort;
    return render();
  }
  if (d.open) { ev.preventDefault(); return openDrawer(d.open); }
  if (d.approve) {
    const r = reqById(d.approve);
    const msg = approve(r);
    toast(msg);
    return refresh(r.id);
  }
  if (d.reject) {
    const r = reqById(d.reject);
    return confirmModal(`Reject ${r.id}?`, `<p>${esc(r.item)} · ${money(r.amount)} · ${esc(r.department)}</p>`, "Reject", (reason) => {
      reject(r, reason);
      toast(`${r.id} rejected`);
      refresh(r.id);
    }, { withReason: true });
  }
  if (d.createpo) return createPoFlow(reqById(d.createpo));
  if (d.withdraw) {
    const r = reqById(d.withdraw);
    r.status = "Withdrawn";
    r.step = null;
    log("Withdrawn by requester", r.id);
    toast(`${r.id} withdrawn`);
    return refresh(r.id);
  }
  if (d.pay) {
    const i = state.invoices.find((x) => x.id === d.pay);
    const po = state.pos.find((p) => p.po === i.po);
    i.status = "Paid";
    i.paid_amount = po.amount;
    po.paid = true;
    log(`${i.id} paid ${money(po.amount)}`, i.request);
    toast(`${i.id} paid ${money(po.amount)}`);
    return render();
  }
  if (d.hold) {
    const i = state.invoices.find((x) => x.id === d.hold);
    i.status = "On hold";
    log(`${i.id} put on hold`, i.request);
    toast(`${i.id} on hold`);
    return render();
  }
  if (d.paybalance) {
    const i = state.invoices.find((x) => x.id === d.paybalance);
    const balance = i.amount - i.paid_amount;
    i.paid_amount = i.amount;
    log(`Balance of ${money(balance)} paid on ${i.id}`, i.request);
    toast(`Paid remaining ${money(balance)} to ${i.vendor}`);
    return render();
  }
  if (d.recover) {
    const i = state.invoices.find((x) => x.id === d.recover);
    i.status = "Recovery requested";
    log(`Refund of ${money(i.paid_amount - i.amount)} requested from ${i.vendor}`, i.request);
    toast("Refund request logged");
    return render();
  }
  if (d.toggle) {
    state.settings[d.toggle] = !state.settings[d.toggle];
    const label = CONTROLS.find((c) => c[0] === d.toggle)[1];
    log(`${label} turned ${state.settings[d.toggle] ? "ON" : "OFF"}`, "Settings");
    toast(`${label}: ${state.settings[d.toggle] ? "on" : "off"}`);
    return render();
  }
  if (d.setgl) {
    const p = state.pos.find((x) => x.po === d.setgl);
    return confirmModal(`Add GL code to ${p.po}`, "", "Save", (gl) => {
      p.gl = gl;
      reqById(p.request).gl = gl;
      log(`GL code ${gl} added to ${p.po}`, p.request);
      toast("GL code saved");
      render();
    }, { input: { label: "GL code", html: `<select id="modal-input">${Object.entries(SEED.glCodes).map(([c, n]) => `<option value="${c}">${c} · ${n}</option>`).join("")}</select>` } });
  }
  if (d.fixpo) {
    const p = state.pos.find((x) => x.po === d.fixpo);
    const r = reqById(p.request);
    return confirmModal(`Correct ${p.po}`, `<p>PO says <b class="diff">${money(p.amount)}</b>, the approved request says <b>${money(r.amount)}</b>.</p>`, "Set to approved amount", () => {
      log(`${p.po} corrected from ${money(p.amount)} to ${money(r.amount)}`, r.id);
      p.amount = r.amount;
      toast(`${p.po} corrected`);
      render();
    });
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") { $("#modal").hidden = true; closeDrawer(); }
});

// ?as=clerk: (or manager:IT, director:, requester:Library) opens the app as that role, so each role can be bookmarked.
const asRole = new URLSearchParams(location.search).get("as");
if (asRole && /^(requester|manager):(.+)$|^(director|clerk):$/.test(asRole)) state.role = asRole;

$("#role").innerHTML = roleOptions();
$("#role").addEventListener("change", (ev) => {
  state.role = ev.target.value;
  draft = null;
  closeDrawer();
  location.hash = "#/dashboard";
  render();
  toast(`Signed in as ${actorName()}`);
});
window.addEventListener("hashchange", () => {
  closeDrawer();
  render();
  if (pendingDrawer) openDrawer(pendingDrawer);
  pendingDrawer = null;
});
render();
