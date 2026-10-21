// Recording guide: sits in its own window next to the app. Shows the one action to take and what to
// say, and moves on by itself once the app's saved state shows the action was done.

const STORE_KEY = "westbridge-purchasing-v1";
const CMD_KEY = "westbridge-command";
const GUIDE_KEY = "westbridge-guide";

const ALL_OFF = { routing: false, requireGl: false, dupCheck: false, autoPo: false, threeWay: false };
const ALL_ON = { routing: true, requireGl: true, dupCheck: true, autoPo: true, threeWay: true };

// ---------- state helpers (read the app's saved state) ----------
const req = (S, id) => S.requests.find((r) => r.id === id);
const inv = (S, reqId) => S.invoices.find((i) => i.request === reqId);
const visited = (S, route) => S.ui && S.ui.visited.includes(route);
const seen = (S, id) => S.ui && S.ui.seen.includes(id);
const newReq = (S, item, amount) => S.requests.find((r) => r.id > "REQ-063" && r.item.toLowerCase() === item && r.amount === amount);

// Steps every clip starts with.
const startStep = (clipNo, who) => ({
  do: `Click <b>▶ Start Clip ${clipNo}</b> above.`,
  say: [],
  why: `Resets the demo data and signs you in as ${who}, with the right controls set.`,
  done: (S, g) => S.ui && S.ui.cmd === g.cmdId,
});
const recordStep = {
  do: "Start recording: <b>⌘ ⇧ 5</b> → <b>Options</b> → Microphone: <b>MacBook Air Microphone</b> → <b>Record Selected Portion</b> → drag the box over the app window only → <b>Record</b>.",
  say: [],
  why: "Keep this guide outside the recorded box. Then click below.",
  manual: "I'm recording ›",
};

const CLIPS = [
  {
    title: "Clip 1 · Vendors are calling about payments",
    sub: "Finance clerk · about 9 min · investigate, act, explain",
    start: { role: "clerk:", route: "dashboard", settings: ALL_OFF },
    who: "the Finance clerk",
    steps: [
      {
        do: "Click <b>Invoices</b> in the left menu.",
        say: [
          "Finance flagged that vendors are calling about payments.",
          "The dashboard shows 33 control exceptions, so something's off.",
          "My goal is to find where money is actually at risk.",
          "I'll start on Invoices, because the invoice, the PO and the approval sit side by side there.",
        ],
        done: (S) => visited(S, "invoices"),
      },
      {
        do: "Click <b>REQ-023</b> in the INV-5019 row (top row).",
        say: [
          "The banner says 3-way match isn't enforced, so anyone can pay any open invoice.",
          "Most rows match. I'll work by money at risk, not top to bottom.",
          "INV-5019: invoice $7,336, PO $73,363, and we paid $73,363.",
          "That's exactly 10x, which looks like a decimal slip. Let me check the history before assuming.",
        ],
        done: (S) => seen(S, "REQ-023"),
      },
      {
        do: "Read the History, click <b>Close ✕</b>, then <b>Request refund</b> on INV-5019.",
        say: [
          "History: approved at $7,336, PO entered at $73,363, paid at $73,363.",
          "The approval was right; the error came in when finance re-typed the PO.",
          "That's about a $66K overpayment, so recovering the cash comes first.",
        ],
        done: (S) => inv(S, "REQ-023").status === "Recovery requested",
      },
      {
        do: "Click <b>Hold</b> on INV-5040 (second row).",
        say: [
          "Refund logged; the payment now shows Refund requested.",
          "INV-5040, Office Depot: an $8,706 invoice against an $87,062 PO. Same pattern.",
          "It's not paid yet, and Pay is clickable. Nothing stops an $87K payment.",
          "I'll hold it rather than fix the PO on the fly, because changing a PO should be a deliberate step.",
        ],
        done: (S) => ["On hold", "Paid"].includes(inv(S, "REQ-057").status),
      },
      {
        do: "Click <b>REQ-037</b> in the CDW row (No PO, $13,604.70).",
        say: [
          "Two 10x errors in a small sample means it's the process, not one person.",
          "Now the No PO rows; there are seven.",
          "Vendors shipped and invoiced, but the approval never became a PO, so AP can't match it. That's probably why they're calling.",
        ],
        done: (S) => seen(S, "REQ-037"),
      },
      {
        do: "Click <b>Close ✕</b>, then <b>Pay balance $71.01</b> on INV-5027.",
        say: [
          "REQ-037: $13,600, approved by the Library manager only, and no PO.",
          "Two failures: it skipped the Finance Director, who's needed for $5K and over, and it never got a PO.",
          "I'll flag it; creating POs is the next job, on the Purchase orders screen.",
          "INV-5027: billed $78.90 and we paid $7.89. A decimal slip the other way, and safe to pay the balance.",
        ],
        done: (S) => inv(S, "REQ-033").paid_amount >= inv(S, "REQ-033").amount - 0.01,
      },
      {
        do: "Click <b>Exceptions report</b> in the left menu.",
        say: ["Balance paid, so that vendor's sorted.", "Let me step back and look at the overall picture."],
        done: (S) => visited(S, "exceptions"),
      },
      {
        do: "Say the wrap-up, then <b>stop recording</b> (⏹ in the menu bar).",
        say: [
          "The biggest issue by dollars is amounts re-typed wrong in the PO log: about $144K across 3 POs.",
          "Then 12 approvals over $5K that skipped the Director, plus missing POs and GL codes.",
          "Today I requested the refund, held the bad payment and paid the small balance.",
          "The real fix is to stop manual re-entry: auto-created POs and a 3-way match before payment.",
          "I'd take that to the Finance Director next.",
        ],
        manual: "Finished ✓",
      },
    ],
  },
  {
    title: "Clip 2 · Turn on the controls",
    sub: "Finance Director · about 10 min · evidence → configure → test",
    start: { role: "director:", route: "dashboard", settings: ALL_OFF },
    who: "J. Alvarez, Finance Director",
    steps: [
      {
        do: "Click <b>Exceptions report</b> in the left menu.",
        say: [
          "I'm the Finance Director, and I've been told our purchasing controls aren't working.",
          "Before I change any settings I want evidence, so I'll start with the Exceptions report.",
        ],
        done: (S) => visited(S, "exceptions"),
      },
      {
        do: "In <b>Over $5K approved without Finance Director</b>, click <b>REQ-002</b>.",
        say: [
          "12 requests over $5K were approved by department managers alone: about $111K.",
          "Policy says those need my sign-off. Let me look at the biggest one.",
        ],
        done: (S) => seen(S, "REQ-002"),
      },
      {
        do: "Click <b>Close ✕</b>, then <b>Controls & settings</b> in the left menu.",
        say: [
          "REQ-002: $13,527, approved by S. Kim only, and no PO either.",
          "Two control failures on one request. The policy exists, but nothing enforces it.",
        ],
        done: (S) => visited(S, "settings"),
      },
      {
        do: "Turn ON <b>Amount-based approval routing</b>.",
        say: [
          "Every control is off. That's how the old email process behaves.",
          "Routing first: the system enforces the $5K rule, so nobody has to remember it.",
        ],
        done: (S) => S.settings.routing,
      },
      {
        do: "Turn ON <b>Require GL code on submission</b>.",
        say: ["8 POs have no GL code, so the spend can't be charged to a budget. Fix it at the source."],
        done: (S) => S.settings.requireGl,
      },
      {
        do: "Turn ON <b>Duplicate request warning</b>.",
        say: ["Two duplicates were of requests that were already approved. People resubmit because they can't see status."],
        done: (S) => S.settings.dupCheck,
      },
      {
        do: "Turn ON <b>Auto-create PO on final approval</b>.",
        say: ["This removes the re-typing step that caused the 10x errors."],
        done: (S) => S.settings.autoPo,
      },
      {
        do: "Turn ON <b>3-way match before payment</b>.",
        say: ["Last line of defence: no payment unless the invoice, PO and approval agree."],
        done: (S) => S.settings.threeWay,
      },
      {
        do: "Top right <b>Signed in as</b> → <b>S. Kim · Admissions Mgr</b>.",
        say: ["Now I'll test that routing actually works, from a manager's view."],
        done: (S) => S.role === "manager:Admissions",
      },
      {
        do: "Click <b>Approvals</b>, then <b>Approve</b> on REQ-048.",
        say: [
          "REQ-048 is $5,440, just over the threshold, so it's a good test case.",
          "(after the click) The message says it was routed to the Finance Director. That's the control working.",
        ],
        done: (S) => req(S, "REQ-048").step === "Director" || req(S, "REQ-048").status === "Approved",
      },
      {
        do: "<b>Signed in as</b> → <b>J. Alvarez · Finance Director</b>.",
        say: ["Switching back to the Director to finish the approval."],
        done: (S) => S.role === "director:",
      },
      {
        do: "Click <b>Approvals</b> → <b>Approve</b> REQ-048, then click <b>All requests</b> and open <b>REQ-048</b>.",
        say: [
          "It's in my queue now. I'll approve it.",
          "History: manager approved, routed to me, I approved, and a PO was created automatically for exactly $5,440.79.",
        ],
        done: (S) => req(S, "REQ-048").status === "Approved" && !!req(S, "REQ-048").po,
      },
      {
        do: "Say the wrap-up, then <b>stop recording</b>.",
        say: [
          "Each control maps to a finding in the data.",
          "Routing closes the $111K policy gap. Auto-PO and 3-way match stop the re-keying errors. GL and duplicate checks fix data quality.",
          "That's the case I'd bring to the VP for the ERP configuration.",
        ],
        manual: "Finished ✓",
      },
    ],
  },
  {
    title: "Clip 3 · Submit and approve properly",
    sub: "Requester → Manager → Director · about 8 min · controls ON",
    start: { role: "requester:Facilities", route: "new", settings: ALL_ON },
    who: "Facilities staff, with all controls on",
    steps: [
      {
        do: "Fill in <b>Toner cartridges</b> · vendor <b>Dell</b> · amount <b>368.20</b>. Leave GL empty. Click <b>Submit request</b>.",
        say: [
          "I'm Facilities staff and I need to order toner.",
          "I'll leave the GL code blank on purpose, to check the new control.",
        ],
        done: (S) => S.ui.formErrors.includes("gl"),
      },
      {
        do: "Pick GL <b>6100 · Supplies & materials</b>, then click <b>Submit request</b> again.",
        say: [
          "It's blocked: 'Select a GL code.' The system stops incomplete requests at the source.",
          "Toner is supplies, so 6100.",
        ],
        done: (S) => S.ui.dupWarned,
      },
      {
        do: "Read the warning, click <b>Cancel</b>. Then click <b>Clear</b> and fill in: <b>Network switch</b> · <b>CDW</b> · <b>9000</b> · GL <b>6200</b> · justification <b>Replace failing switch in Building C</b> → <b>Submit request</b>.",
        say: [
          "Duplicate warning: REQ-034 was rejected, and REQ-063 is still pending for the same toner.",
          "That's the resubmission pattern from the data. I'd follow up on REQ-063, not create a third request.",
          "Instead I'll submit the request I actually need: a network switch.",
        ],
        done: (S) => !!newReq(S, "network switch", 9000),
      },
      {
        do: "<b>Signed in as</b> → <b>R. Ortiz · Facilities Mgr</b>.",
        say: ["It's submitted, and the panel shows it's waiting on the manager.", "Now I'll switch to the manager to approve it."],
        done: (S) => S.role === "manager:Facilities",
      },
      {
        do: "Click <b>Approvals</b> → <b>Approve</b> the $9,000 network switch.",
        say: [
          "$9,000 for a network switch, with a GL code and a justification: everything I need to decide.",
          "(after the click) It went to the Finance Director automatically because it's over $5K.",
        ],
        done: (S) => { const r = newReq(S, "network switch", 9000); return r && (r.step === "Director" || r.status === "Approved"); },
      },
      {
        do: "<b>Signed in as</b> → <b>J. Alvarez · Finance Director</b> → <b>Approvals</b> → <b>Approve</b>. Then open the request from <b>All requests</b>.",
        say: [
          "It's in the Director's queue, so I'll approve it.",
          "A PO was created automatically for exactly $9,000.00, so the PO can't drift from the approval.",
        ],
        done: (S) => { const r = newReq(S, "network switch", 9000); return r && r.status === "Approved" && !!r.po; },
      },
      {
        do: "Say the wrap-up, then <b>stop recording</b>.",
        say: [
          "End to end: it blocked incomplete input, caught a duplicate, routed by amount, and created the PO with no re-typing.",
          "Every one of those was a manual failure in the old process.",
        ],
        manual: "Finished ✓",
      },
    ],
  },
  {
    title: "Clip 4 · Clean up the backlog",
    sub: "Finance clerk · about 10 min · old way vs new way",
    start: { role: "clerk:", route: "pos", settings: ALL_OFF },
    who: "the Finance clerk, with all controls off",
    steps: [
      {
        do: "In <b>Approved requests with no PO</b>, click <b>Create PO</b> on <b>REQ-002</b>, type <b>13527.05</b>, click <b>Create PO</b>.",
        say: [
          "I'm clearing the backlog: 7 approved requests never got a PO, about $41.6K.",
          "Auto-PO is off, so I'll do the first one the old way.",
          "I have to type the amount from the approval: $13,527.05. This manual step is exactly where the 10x errors came from.",
        ],
        done: (S) => !!req(S, "REQ-002").po,
      },
      {
        do: "<b>Signed in as</b> → <b>J. Alvarez</b> → <b>Controls & settings</b> → turn ON <b>Auto-create PO</b>.",
        say: ["Rather than type six more, I'll have the Director switch on auto-PO, so the amount is never re-typed."],
        done: (S) => S.settings.autoPo,
      },
      {
        do: "<b>Signed in as</b> → <b>Finance clerk</b> → <b>Purchase orders</b>.",
        say: ["Back to the clerk view."],
        done: (S) => S.role === "clerk:",
      },
      {
        do: "Click <b>Create PO</b> on each of the remaining 6 requests.",
        say: ["Now it's one click each: the amount is copied from the approval, with nothing to type and nothing to get wrong."],
        done: (S) => !S.requests.some((r) => r.status === "Approved" && !r.po),
      },
      {
        do: "In the PO log, click <b>Add GL</b> on at least 3 POs and pick a sensible code.",
        say: [
          "These POs have no GL code, so the spend can't hit a budget line.",
          "Toner and paper go to 6100 supplies. Laptops, switches and software go to 6200 IT. Chairs, cleaning and lamps go to 6310 facilities.",
        ],
        done: (S) => S.audit.filter((a) => /^GL code \d+ added to/.test(a.what)).length >= 3,
      },
      {
        do: "Find <b>PO-261057</b> → <b>Correct amount</b> → <b>Set to approved amount</b>.",
        say: ["PO-261057 was keyed at $87,062, but the approval says $8,706.29. It isn't paid yet, so I can correct it."],
        done: (S) => { const p = S.pos.find((x) => x.po === "PO-261057"); return p && Math.abs(p.amount - req(S, "REQ-057").amount) < 0.01; },
      },
      {
        do: "Click <b>Invoices</b>, then <b>Pay</b> on INV-5040.",
        say: ["INV-5040 now shows Matched: the invoice, PO and approval agree.", "Now it's safe to pay."],
        done: (S) => inv(S, "REQ-057").status === "Paid",
      },
      {
        do: "Click <b>Exceptions report</b> → <b>Export exceptions CSV</b>.",
        say: ["Let me see where we've ended up."],
        done: (S) => visited(S, "exceptions"),
      },
      {
        do: "Say the wrap-up, then <b>stop recording</b>.",
        say: [
          "Exceptions went from 33 to (read the number on screen).",
          "What's left can't be fixed in the system: the overpaid PO needs the vendor refund, and approvals that already bypassed the Director need review.",
          "I'd send this export to the Director with those notes.",
        ],
        manual: "Finished ✓",
      },
    ],
  },
];

// ---------- guide state ----------
let g = loadGuide();

function loadGuide() {
  try { return JSON.parse(localStorage.getItem(GUIDE_KEY)) || { clip: 0, idx: 0, cmdId: null }; } catch (e) { return { clip: 0, idx: 0, cmdId: null }; }
}
function saveGuide() {
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ }
}
function appState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
}
const stepsFor = (c) => [startStep(c + 1, CLIPS[c].who), recordStep, ...CLIPS[c].steps];

function startClip() {
  const c = CLIPS[g.clip];
  g.cmdId = "c" + Date.now();
  g.idx = 0;
  saveGuide();
  localStorage.setItem(CMD_KEY, JSON.stringify({ id: g.cmdId, ...c.start }));
  render();
}

function selectClip(i) {
  g = { clip: i, idx: 0, cmdId: null };
  saveGuide();
  render();
}

function advanceManual() {
  g.idx += 1;
  saveGuide();
  render(true);
}

function back() {
  g.idx = Math.max(0, g.idx - 1);
  saveGuide();
  render();
}

// Steps latch: once done, the guide never moves back on its own, even if the app changes later.
function tick() {
  const S = appState();
  const steps = stepsFor(g.clip);
  let moved = false;
  while (S && g.idx < steps.length && steps[g.idx].done && safeDone(steps[g.idx], S)) {
    g.idx += 1;
    moved = true;
  }
  if (moved) {
    saveGuide();
    render(true);
  }
}
function safeDone(step, S) {
  try { return step.done(S, g); } catch (e) { return false; }
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render(flash = false) {
  $("#tabs").innerHTML = CLIPS.map((c, i) => `<button class="${i === g.clip ? "on" : ""}" data-clip="${i}">Clip ${i + 1}</button>`).join("");
  const clip = CLIPS[g.clip];
  const steps = stepsFor(g.clip);
  const total = steps.length;
  const cur = steps[g.idx];
  const upNext = steps[g.idx + 1];
  const pct = Math.round((Math.min(g.idx, total) / total) * 100);

  let body = `
    <div class="clip-title">${clip.title}</div>
    <div class="clip-sub">${clip.sub}</div>
    <button class="start" id="start">▶ Start Clip ${g.clip + 1}${g.cmdId ? " (restart)" : ""}</button>
    <div class="progress"><div style="width:${pct}%"></div></div>
    <div class="count"><span>Step ${Math.min(g.idx + 1, total)} of ${total}</span><span>${g.idx >= total ? "Done" : "Moves on by itself"}</span></div>`;

  if (!cur) {
    body += `<div class="card done-card"><div class="label do">Clip complete</div><div class="do-text">Nice. Stop the recording if it's still running, then watch the first minute back with headphones.</div>
      <ul class="muted" style="margin-top:10px"><li>Any silence over 5 seconds?</li><li>Did every click have a <i>why</i>?</li></ul>
      ${g.clip < CLIPS.length - 1 ? `<div class="next"><button class="primary" data-clip="${g.clip + 1}">Go to Clip ${g.clip + 2} ›</button></div>` : ""}</div>`;
  } else {
    body += `
      <div class="card now ${flash ? "flash" : ""}">
        ${cur.say.length ? `<div class="label say">Say (in your own words)</div><ul class="say-list">${cur.say.map((s) => `<li>${s}</li>`).join("")}</ul><div style="height:12px"></div>` : ""}
        <div class="label do">Then do</div>
        <div class="do-text">${cur.do}</div>
        ${cur.why ? `<div class="why">${cur.why}</div>` : ""}
        <div class="next">
          ${g.idx > 0 ? `<button id="back">‹ Back</button>` : ""}
          ${cur.manual ? `<button class="primary" id="manual">${cur.manual}</button>` : `<button id="skip">Skip ›</button>`}
        </div>
      </div>
      ${upNext ? `<div class="card upnext"><div class="label do">Up next</div><div class="do-text" style="font-size:14px">${upNext.do}</div></div>` : ""}`;
  }
  body += `<div class="tip">Glance, then say it your way: don't read word for word. Pause and say what you notice before each click. If you make a mistake, say so and fix it on camera; that's good data.</div>`;
  $("#main").innerHTML = body;

  $("#start").onclick = startClip;
  if ($("#manual")) $("#manual").onclick = advanceManual;
  if ($("#skip")) $("#skip").onclick = advanceManual;
  if ($("#back")) $("#back").onclick = back;
}

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-clip]");
  if (t) selectClip(Number(t.dataset.clip));
});
window.addEventListener("storage", (ev) => { if (ev.key === STORE_KEY) tick(); });
setInterval(tick, 400);
render();
