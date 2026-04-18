from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal
from ..database import get_db
from ..models.labor import Employee, AttendanceRecord, WagePayment
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter()


class EmployeeCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    role: Optional[str] = None
    wage_type: str = "daily"
    wage_rate: Decimal
    join_date: Optional[date] = None


class AttendanceEntry(BaseModel):
    employee_id: int
    status: str = "present"
    shift: str = "day"
    overtime_hours: Decimal = Decimal("0")
    notes: Optional[str] = None


class BulkAttendanceRequest(BaseModel):
    attendance_date: date
    entries: List[AttendanceEntry]


@router.get("/employees")
def list_employees(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Employee).filter(Employee.is_active == True).order_by(Employee.name).all()


@router.post("/employees")
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    emp = Employee(**body.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/employees/{emp_id}")
def get_employee(emp_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    return emp


@router.get("/attendance")
def get_attendance(attendance_date: date, db: Session = Depends(get_db), _=Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(AttendanceRecord.attendance_date == attendance_date).all()
    return records


@router.post("/attendance/bulk")
def bulk_attendance(body: BulkAttendanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = []
    for entry in body.entries:
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == entry.employee_id,
            AttendanceRecord.attendance_date == body.attendance_date,
        ).first()
        if existing:
            existing.status = entry.status
            existing.shift = entry.shift
            existing.overtime_hours = entry.overtime_hours
            existing.notes = entry.notes
            results.append(existing)
        else:
            record = AttendanceRecord(
                employee_id=entry.employee_id,
                attendance_date=body.attendance_date,
                status=entry.status,
                shift=entry.shift,
                overtime_hours=entry.overtime_hours,
                notes=entry.notes,
                marked_by=current_user.id,
            )
            db.add(record)
            results.append(record)
    db.commit()
    return {"saved": len(results)}


@router.get("/attendance/summary")
def attendance_summary(period_from: date, period_to: date, db: Session = Depends(get_db), _=Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.attendance_date >= period_from,
        AttendanceRecord.attendance_date <= period_to,
    ).all()
    summary: dict = {}
    for r in records:
        eid = r.employee_id
        if eid not in summary:
            summary[eid] = {"employee_id": eid, "present": 0, "absent": 0, "half_day": 0, "total_overtime_hours": Decimal("0")}
        if r.status == "present":
            summary[eid]["present"] += 1
        elif r.status == "absent":
            summary[eid]["absent"] += 1
        elif r.status == "half_day":
            summary[eid]["half_day"] += 1
        summary[eid]["total_overtime_hours"] += r.overtime_hours or Decimal("0")
    return list(summary.values())


class WageCalculateRequest(BaseModel):
    period_from: date
    period_to: date
    employee_ids: Optional[List[int]] = None  # None = all active employees
    overtime_rate_multiplier: Decimal = Decimal("1.5")


class WagePayRequest(BaseModel):
    wage_payment_ids: List[int]
    payment_date: date
    payment_mode: str = "cash"


@router.post("/wages/calculate")
def calculate_wages(body: WageCalculateRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    emp_query = db.query(Employee).filter(Employee.is_active == True)
    if body.employee_ids:
        emp_query = emp_query.filter(Employee.id.in_(body.employee_ids))
    employees = emp_query.all()

    previews = []
    for emp in employees:
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.attendance_date >= body.period_from,
            AttendanceRecord.attendance_date <= body.period_to,
        ).all()

        days_worked = Decimal("0")
        total_overtime = Decimal("0")
        for r in records:
            if r.status == "present":
                days_worked += Decimal("1")
            elif r.status == "half_day":
                days_worked += Decimal("0.5")
            total_overtime += r.overtime_hours or Decimal("0")

        basic = days_worked * emp.wage_rate
        overtime_pay = (total_overtime / 8) * emp.wage_rate * body.overtime_rate_multiplier
        net = basic + overtime_pay

        previews.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "period_from": body.period_from,
            "period_to": body.period_to,
            "days_worked": float(days_worked),
            "basic_amount": float(basic),
            "overtime_hours": float(total_overtime),
            "overtime_amount": float(overtime_pay),
            "net_amount": float(net),
        })
    return previews


@router.post("/wages/pay")
def pay_wages(body: WagePayRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wage_payments = db.query(WagePayment).filter(WagePayment.id.in_(body.wage_payment_ids)).all()
    if not wage_payments:
        raise HTTPException(404, "No wage payment records found")
    for wp in wage_payments:
        if wp.is_paid:
            raise HTTPException(400, f"Wage payment {wp.id} is already paid")
        wp.is_paid = True
        wp.payment_date = body.payment_date
        wp.payment_mode = body.payment_mode
    db.commit()
    return {"paid": len(wage_payments)}


@router.post("/wages/create")
def create_wage_payments(body: WageCalculateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Save calculated wages as WagePayment records (unpaid) ready for approval."""
    emp_query = db.query(Employee).filter(Employee.is_active == True)
    if body.employee_ids:
        emp_query = emp_query.filter(Employee.id.in_(body.employee_ids))
    employees = emp_query.all()

    created = []
    for emp in employees:
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.attendance_date >= body.period_from,
            AttendanceRecord.attendance_date <= body.period_to,
        ).all()

        days_worked = Decimal("0")
        total_overtime = Decimal("0")
        for r in records:
            if r.status == "present":
                days_worked += Decimal("1")
            elif r.status == "half_day":
                days_worked += Decimal("0.5")
            total_overtime += r.overtime_hours or Decimal("0")

        basic = days_worked * emp.wage_rate
        overtime_pay = (total_overtime / 8) * emp.wage_rate * body.overtime_rate_multiplier
        net = basic + overtime_pay

        wp = WagePayment(
            employee_id=emp.id,
            period_from=body.period_from,
            period_to=body.period_to,
            days_worked=days_worked,
            basic_amount=basic,
            overtime_amount=overtime_pay,
            net_amount=net,
            is_paid=False,
            created_by=current_user.id,
        )
        db.add(wp)
        created.append(wp)

    db.commit()
    return {"created": len(created)}


@router.get("/wages")
def list_wages(is_paid: Optional[bool] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(WagePayment).order_by(WagePayment.period_to.desc())
    if is_paid is not None:
        q = q.filter(WagePayment.is_paid == is_paid)
    return q.limit(100).all()
