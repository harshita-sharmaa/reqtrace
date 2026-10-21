"""Load the two purchasing sheets into SQLite, run the SQL in sql/, publish results.

Writes one CSV per query plus two charts to outputs/, and prints a summary.
The CSVs can be loaded straight into Excel or Google Sheets.
"""
import sqlite3
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SQL_DIR = ROOT / "sql"
OUT_DIR = ROOT / "outputs"

BLUE, RED, INK, MUTED, GRID, SURFACE = "#2a78d6", "#d03b3b", "#0b0b0b", "#898781", "#e1e0d9", "#fcfcfb"
plt.rcParams.update(
    {
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "axes.edgecolor": "#c3c2b7",
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": GRID,
        "axes.axisbelow": True,
        "text.color": INK,
        "axes.labelcolor": MUTED,
        "xtick.color": MUTED,
        "ytick.color": INK,
        "font.size": 10,
    }
)


def load_database() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    for name in ("purchase_requests", "finance_po_log"):
        pd.read_csv(DATA_DIR / f"{name}.csv", dtype={"gl_code": str}).to_sql(name, con, index=False)
    return con


def run(con: sqlite3.Connection, sql_file: str) -> pd.DataFrame:
    df = pd.read_sql_query((SQL_DIR / sql_file).read_text(), con)
    df.to_csv(OUT_DIR / sql_file.replace(".sql", ".csv"), index=False)
    return df


def chart_issues(issues: pd.DataFrame) -> None:
    df = issues.sort_values("dollars")
    fig, ax = plt.subplots(figsize=(8, 3.6))
    ax.barh(df["issue"], df["dollars"], color=BLUE, height=0.6)
    for y, (d, n) in enumerate(zip(df["dollars"], df["requests"])):
        ax.text(d, y, f"  ${d:,.0f}  ({n} req.)", va="center", color=INK)
    ax.xaxis.set_major_formatter(lambda x, _: f"${x / 1000:,.0f}K")
    ax.set_xlabel("Dollars affected")
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, df["dollars"].max() * 1.45)
    ax.set_title("Where the purchasing process leaks", loc="left", fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "issue_log.png", dpi=160)


def chart_cycle(cycle: pd.DataFrame) -> None:
    df = cycle.sort_values("pct_over_5_days")
    fig, ax = plt.subplots(figsize=(8, 3.2))
    colors = [RED if p >= 40 else BLUE for p in df["pct_over_5_days"]]
    ax.barh(df["department"], df["pct_over_5_days"], color=colors, height=0.6)
    for y, p in enumerate(df["pct_over_5_days"]):
        ax.text(p, y, f"  {p:.0f}%", va="center", color=INK)
    ax.set_xlabel("% of decided requests taking more than 5 days")
    ax.grid(axis="y", visible=False)
    ax.set_xlim(0, 100)
    ax.set_title("Approval delays by department", loc="left", fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT_DIR / "approval_cycle.png", dpi=160)


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    con = load_database()
    issues = run(con, "01_issue_log.sql")
    cycle = run(con, "02_approval_cycle.sql")
    rekey = run(con, "03_rekey_mismatches.sql")
    chart_issues(issues)
    chart_cycle(cycle)

    pd.set_option("display.width", 200, "display.max_colwidth", 60)
    print(issues, "\n")
    print(cycle, "\n")
    print(rekey)


if __name__ == "__main__":
    main()
