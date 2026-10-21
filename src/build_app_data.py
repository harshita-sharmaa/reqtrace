"""Turn the two purchasing CSVs into seed data for the Westbridge Purchasing app.

Writes app/data.js (window.SEED = {...}) so the app opens straight from disk
with no server. Also simulates vendor invoices for 3-way matching:
the vendor always bills the true (approved) amount, and a PO that was paid
was paid at whatever amount finance typed into the PO log.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = ROOT / "app" / "data.js"

MANAGERS = {
    "Facilities": "R. Ortiz",
    "IT": "K. Nguyen",
    "Student Services": "L. Patel",
    "Athletics": "D. Brooks",
    "Admissions": "S. Kim",
    "Library": "M. Chen",
}
DIRECTOR = "J. Alvarez (Finance Dir.)"
GL_CODES = {
    "6100": "Supplies & materials",
    "6200": "IT equipment & software",
    "6310": "Facilities maintenance",
    "6400": "Events & programs",
}


def read(name: str) -> list[dict]:
    with open(DATA_DIR / name, newline="") as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    requests = read("purchase_requests.csv")
    po_log = read("finance_po_log.csv")
    by_req = {p["request_id"]: p for p in po_log}

    reqs = []
    for r in requests:
        amount = float(r["amount_usd"])
        status = r["status"]
        step = None
        if status == "Pending":
            step = "Manager"
        reqs.append(
            {
                "id": r["request_id"],
                "submitted": r["submitted"],
                "department": r["department"],
                "requester": r["requester"],
                "item": r["item"],
                "vendor": r["vendor"],
                "amount": amount,
                "status": status,
                "step": step,
                "approver": r["approver"],
                "decided": r["approved_on"],
                "po": r["po_number"],
                "gl": by_req.get(r["request_id"], {}).get("gl_code", ""),
                "notes": r["notes"],
            }
        )

    pos = [
        {
            "po": p["po_number"],
            "request": p["request_id"],
            "entered": p["entered_on"],
            "amount": float(p["amount_usd"]),
            "gl": p["gl_code"],
            "paid": p["paid"] == "Y",
        }
        for p in po_log
    ]

    # Vendor invoices: one per approved request. Vendors bill the approved amount.
    invoices = []
    n = 5001
    for r in reqs:
        if r["status"] != "Approved":
            continue
        po = by_req.get(r["id"])
        paid = bool(po) and po["paid"] == "Y" and po["po_number"] != ""
        invoices.append(
            {
                "id": f"INV-{n}",
                "vendor": r["vendor"],
                "request": r["id"],
                "po": r["po"],
                "amount": r["amount"],
                "received": r["decided"],
                "status": "Paid" if paid else "Open",
                "paid_amount": float(po["amount_usd"]) if paid else 0.0,
            }
        )
        n += 1

    seed = {
        "today": "2026-10-01",
        "managers": MANAGERS,
        "director": DIRECTOR,
        "glCodes": GL_CODES,
        "requests": reqs,
        "pos": pos,
        "invoices": invoices,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text("window.SEED = " + json.dumps(seed, indent=1) + ";\n")
    print(f"{len(reqs)} requests, {len(pos)} POs, {len(invoices)} invoices -> {OUT}")


if __name__ == "__main__":
    main()
