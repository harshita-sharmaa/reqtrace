import csv, random, datetime as dt
random.seed(7)
import os; out=os.path.join(os.path.dirname(__file__),"..","data")+"/"
depts=["Facilities","IT","Student Services","Athletics","Admissions","Library"]
mgr={"Facilities":"R. Ortiz","IT":"K. Nguyen","Student Services":"L. Patel","Athletics":"D. Brooks","Admissions":"S. Kim","Library":"M. Chen"}
vendors=["Staples","CDW","Grainger","Amazon Business","Dell","Home Depot Pro","Office Depot","B&H Photo"]
items=["Laptops","Toner cartridges","Projector bulbs","Folding chairs","Cleaning supplies","Network switch","Printer paper","Microphones","Desk lamps","Software licenses","Whiteboards","Extension cords"]
reqs=[];fin=[]
start=dt.date(2026,7,1)
for i in range(1,61):
    d=random.choice(depts); sub=start+dt.timedelta(days=random.randint(0,85))
    amt=round(random.choice([random.uniform(40,900),random.uniform(900,4800),random.uniform(5000,14000)]),2)
    appr_days=random.choice([1,1,2,2,3,3,4,6,9,14])
    appr=sub+dt.timedelta(days=appr_days)
    approver=mgr[d]
    if amt>=5000: approver=random.choice([mgr[d],mgr[d],"J. Alvarez (Finance Dir.)"])
    status=random.choice(["Approved"]*7+["Pending","Rejected"])
    po=f"PO-26{1000+i}" if status=="Approved" and random.random()>0.12 else ""
    r=dict(request_id=f"REQ-{i:03d}",submitted=sub.isoformat(),department=d,requester=f"Staff {random.randint(10,99)}",item=random.choice(items),vendor=random.choice(vendors),amount_usd=amt,approver=approver if status!="Pending" else "",approved_on=appr.isoformat() if status!="Pending" else "",status=status,po_number=po,notes="")
    reqs.append(r)
    if status=="Approved":
        famt=amt
        if random.random()<0.1: famt=round(amt*random.choice([10,0.1,1.05]),2)  # re-keying error
        fin.append(dict(po_number=po,request_id=r["request_id"],entered_by="Finance clerk",entered_on=(appr+dt.timedelta(days=random.randint(1,7))).isoformat(),amount_usd=famt,gl_code=random.choice(["6100","6200","6310",""]),paid=random.choice(["Y","N"])))
# duplicates
for src in random.sample(reqs[:50],3):
    dup=dict(src); dup["request_id"]=f"REQ-{len(reqs)+1:03d}"; dup["notes"]="resubmitted - no reply on first one"; dup["po_number"]=""; dup["status"]="Pending"; dup["approver"]=""; dup["approved_on"]=""
    reqs.append(dup)
for f,rows in [("purchase_requests.csv",reqs),("finance_po_log.csv",fin)]:
    with open(out+f,"w",newline="") as fh:
        w=csv.DictWriter(fh,fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
print(len(reqs),len(fin))
