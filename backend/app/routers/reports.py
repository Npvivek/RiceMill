from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import date, timedelta
from ..database import get_db
from ..models.inventory import RiceStock, MillingRun, PaddyBatch
from ..models.orders import Invoice, Order, Payment
from ..models.labor import AttendanceRecord, Employee, WagePayment
from ..models.party import Party
from ..dependencies import require_role

router = APIRouter()

_REPORT_ROLES = ("owner", "manager", "accountant", "staff")


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), _=Depends(require_role(*_REPORT_ROLES))):
    today = date.today()

    stock = db.query(RiceStock).all()
    total_stock_qtl = sum(float(s.quantity_qtl) for s in stock)

    pending_invoices = db.query(func.count(Invoice.id), func.sum(Invoice.balance_due)).filter(
        Invoice.status.in_(["unpaid", "partial"])
    ).first()

    present_today = db.query(func.count(AttendanceRecord.id)).filter(
        AttendanceRecord.attendance_date == today,
        AttendanceRecord.status.in_(["present", "half_day"]),
    ).scalar()

    first_of_month = today.replace(day=1)
    month_revenue = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.invoice_date >= first_of_month,
    ).scalar()

    recent_orders = db.query(Order).order_by(Order.created_at.desc()).limit(5).all()

    return {
        "total_stock_qtl": total_stock_qtl,
        "stock_breakdown": [
            {"rice_type": s.rice_type, "grade": s.grade, "quantity_qtl": float(s.quantity_qtl)}
            for s in stock
        ],
        "pending_invoices_count": pending_invoices[0] or 0,
        "pending_invoices_amount": float(pending_invoices[1] or 0),
        "present_today": present_today or 0,
        "month_revenue": float(month_revenue or 0),
        "recent_orders": [
            {"id": o.id, "order_number": o.order_number, "status": o.status, "created_at": str(o.created_at)}
            for o in recent_orders
        ],
    }


@router.get("/yield-analysis")
def yield_analysis(
    date_from: date = None,
    date_to: date = None,
    db: Session = Depends(get_db),
    _=Depends(require_role(*_REPORT_ROLES)),
):
    today = date.today()
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today

    runs = db.query(MillingRun).filter(
        MillingRun.run_status == "completed",
        MillingRun.run_date >= date_from,
        MillingRun.run_date <= date_to,
    ).all()

    if not runs:
        return {"period_from": date_from, "period_to": date_to, "runs": [], "summary": {}}

    total_paddy = sum(float(r.paddy_used_qtl) for r in runs)
    total_milled = sum(float(r.milled_rice_qtl or 0) for r in runs)
    total_broken = sum(float(r.broken_rice_qtl or 0) for r in runs)
    total_bran = sum(float(r.bran_qtl or 0) for r in runs)
    total_husk = sum(float(r.husk_qtl or 0) for r in runs)
    avg_yield = (total_milled / total_paddy * 100) if total_paddy else 0

    return {
        "period_from": date_from,
        "period_to": date_to,
        "summary": {
            "total_runs": len(runs),
            "total_paddy_qtl": total_paddy,
            "total_milled_rice_qtl": total_milled,
            "total_broken_rice_qtl": total_broken,
            "total_bran_qtl": total_bran,
            "total_husk_qtl": total_husk,
            "avg_yield_pct": round(avg_yield, 2),
        },
        "runs": [
            {
                "run_number": r.run_number,
                "run_date": r.run_date,
                "paddy_used_qtl": float(r.paddy_used_qtl),
                "milled_rice_qtl": float(r.milled_rice_qtl or 0),
                "yield_pct": float(r.milling_yield_pct or 0),
            }
            for r in runs
        ],
    }


@router.get("/revenue-summary")
def revenue_summary(
    date_from: date = None,
    date_to: date = None,
    db: Session = Depends(get_db),
    _=Depends(require_role(*_REPORT_ROLES)),
):
    today = date.today()
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today

    invoices = db.query(Invoice).filter(
        Invoice.invoice_date >= date_from,
        Invoice.invoice_date <= date_to,
    ).all()

    total_billed = sum(float(i.total_amount) for i in invoices)
    total_collected = sum(float(i.amount_paid) for i in invoices)
    total_outstanding = sum(float(i.balance_due) for i in invoices)
    paid_count = sum(1 for i in invoices if i.status == "paid")
    partial_count = sum(1 for i in invoices if i.status == "partial")
    unpaid_count = sum(1 for i in invoices if i.status == "unpaid")

    return {
        "period_from": date_from,
        "period_to": date_to,
        "total_invoices": len(invoices),
        "total_billed": total_billed,
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "paid_count": paid_count,
        "partial_count": partial_count,
        "unpaid_count": unpaid_count,
    }


@router.get("/pending-dues")
def pending_dues(db: Session = Depends(get_db), _=Depends(require_role(*_REPORT_ROLES))):
    """Outstanding balances from customers (buyer dues)."""
    invoices = db.query(Invoice).filter(
        Invoice.status.in_(["unpaid", "partial"])
    ).order_by(Invoice.invoice_date).all()

    rows = []
    for inv in invoices:
        order = inv.order
        customer = order.customer if order else None
        rows.append({
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date,
            "customer_name": customer.name if customer else None,
            "customer_id": order.customer_id if order else None,
            "total_amount": float(inv.total_amount),
            "amount_paid": float(inv.amount_paid),
            "balance_due": float(inv.balance_due),
            "status": inv.status,
            "days_overdue": (date.today() - inv.invoice_date).days if inv.invoice_date else 0,
        })

    return {
        "total_outstanding": sum(r["balance_due"] for r in rows),
        "count": len(rows),
        "dues": rows,
    }


@router.get("/farmer-dues")
def farmer_dues(db: Session = Depends(get_db), _=Depends(require_role(*_REPORT_ROLES))):
    """Amounts owed to farmers for paddy purchases."""
    batches = db.query(PaddyBatch).filter(
        PaddyBatch.payment_status.in_(["unpaid", "partial"])
    ).order_by(PaddyBatch.received_date).all()

    rows = []
    for b in batches:
        supplier = b.supplier
        outstanding = float(b.total_amount) - float(b.amount_paid)
        rows.append({
            "batch_number": b.batch_number,
            "received_date": b.received_date,
            "farmer_name": supplier.name if supplier else None,
            "farmer_id": b.supplier_id,
            "total_amount": float(b.total_amount),
            "amount_paid": float(b.amount_paid),
            "outstanding": outstanding,
            "payment_status": b.payment_status,
        })

    return {
        "total_outstanding": sum(r["outstanding"] for r in rows),
        "count": len(rows),
        "dues": rows,
    }


@router.get("/labor-cost")
def labor_cost(
    date_from: date = None,
    date_to: date = None,
    db: Session = Depends(get_db),
    _=Depends(require_role(*_REPORT_ROLES)),
):
    today = date.today()
    date_from = date_from or today.replace(day=1)
    date_to = date_to or today

    wage_payments = db.query(WagePayment).filter(
        WagePayment.period_from >= date_from,
        WagePayment.period_to <= date_to,
    ).all()

    total_paid = sum(float(w.net_amount) for w in wage_payments if w.is_paid)
    total_pending = sum(float(w.net_amount) for w in wage_payments if not w.is_paid)

    by_employee = {}
    for w in wage_payments:
        eid = w.employee_id
        if eid not in by_employee:
            by_employee[eid] = {"employee_id": eid, "total_amount": 0.0, "paid": 0.0, "pending": 0.0}
        by_employee[eid]["total_amount"] += float(w.net_amount)
        if w.is_paid:
            by_employee[eid]["paid"] += float(w.net_amount)
        else:
            by_employee[eid]["pending"] += float(w.net_amount)

    return {
        "period_from": date_from,
        "period_to": date_to,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "total_labor_cost": total_paid + total_pending,
        "by_employee": list(by_employee.values()),
    }
