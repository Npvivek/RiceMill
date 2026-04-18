from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(30), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("parties.id"), nullable=False)
    order_date = Column(Date, nullable=False)
    delivery_date = Column(Date)
    order_type = Column(String(20), nullable=False, default="sale")
    status = Column(String(20), nullable=False, default="pending")
    # pending | confirmed | dispatched | delivered | cancelled
    delivery_address = Column(Text)
    vehicle_number = Column(String(20))
    transport_charge = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("Party", foreign_keys=[customer_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    invoice = relationship("Invoice", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    rice_type = Column(String(30), nullable=False)
    grade = Column(String(10), nullable=False, default="A")
    quantity_qtl = Column(Numeric(10, 3), nullable=False)
    bag_count = Column(Integer)
    price_per_qtl = Column(Numeric(10, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(30), unique=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    invoice_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    transport_charge = Column(Numeric(10, 2), default=0)
    gst_pct = Column(Numeric(5, 2), default=0)
    gst_amount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)
    balance_due = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="unpaid")
    # unpaid | partial | paid
    due_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("Order", back_populates="invoice")
    payments = relationship("Payment", back_populates="invoice")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    paddy_batch_id = Column(Integer, ForeignKey("paddy_batches.id"))
    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_mode = Column(String(20), nullable=False, default="cash")
    # cash | bank_transfer | upi | cheque
    reference_number = Column(String(50))
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("Invoice", back_populates="payments")
