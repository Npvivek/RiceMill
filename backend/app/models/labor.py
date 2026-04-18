from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15))
    address = Column(Text)
    role = Column(String(50))
    # mill_operator | loader | cleaner | driver | supervisor
    wage_type = Column(String(20), nullable=False, default="daily")
    # daily | monthly | piece_rate
    wage_rate = Column(Numeric(10, 2), nullable=False)
    join_date = Column(Date)
    aadhar_number = Column(String(12))
    bank_account = Column(String(20))
    ifsc_code = Column(String(11))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="present")
    # present | absent | half_day | paid_leave
    shift = Column(String(10), default="day")
    overtime_hours = Column(Numeric(4, 2), default=0)
    notes = Column(Text)
    marked_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])

    from sqlalchemy import UniqueConstraint
    __table_args__ = (UniqueConstraint("employee_id", "attendance_date", name="uq_attendance"),)


class WagePayment(Base):
    __tablename__ = "wage_payments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)
    days_worked = Column(Numeric(5, 2), nullable=False)
    basic_amount = Column(Numeric(12, 2), nullable=False)
    overtime_amount = Column(Numeric(12, 2), default=0)
    deductions = Column(Numeric(12, 2), default=0)
    net_amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date)
    payment_mode = Column(String(20), default="cash")
    is_paid = Column(Boolean, nullable=False, default=False)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("Employee", foreign_keys=[employee_id])
