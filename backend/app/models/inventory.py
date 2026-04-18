from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class PaddyVariety(Base):
    __tablename__ = "paddy_varieties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)

    batches = relationship("PaddyBatch", back_populates="variety")


class PaddyBatch(Base):
    __tablename__ = "paddy_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(30), unique=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("parties.id"), nullable=False)
    variety_id = Column(Integer, ForeignKey("paddy_varieties.id"), nullable=False)
    source_type = Column(String(20), nullable=False, default="private")
    # private | government
    received_date = Column(Date, nullable=False)
    gross_weight_qtl = Column(Numeric(10, 3), nullable=False)
    tare_weight_qtl = Column(Numeric(10, 3), nullable=False, default=0)
    net_weight_qtl = Column(Numeric(10, 3), nullable=False)
    moisture_pct = Column(Numeric(5, 2))
    grade = Column(String(10), nullable=False, default="A")
    purchase_price_per_qtl = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_status = Column(String(20), nullable=False, default="unpaid")
    # unpaid | partial | paid
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)
    vehicle_number = Column(String(20))
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    variety = relationship("PaddyVariety", back_populates="batches")
    supplier = relationship("Party", foreign_keys=[supplier_id])
    milling_runs = relationship("MillingRun", back_populates="paddy_batch")


class MillingRun(Base):
    __tablename__ = "milling_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_number = Column(String(30), unique=True, nullable=False)
    run_date = Column(Date, nullable=False)
    shift = Column(String(10), nullable=False, default="day")
    operator_id = Column(Integer, ForeignKey("users.id"))
    paddy_batch_id = Column(Integer, ForeignKey("paddy_batches.id"), nullable=False)
    paddy_used_qtl = Column(Numeric(10, 3), nullable=False)
    milled_rice_qtl = Column(Numeric(10, 3))
    broken_rice_qtl = Column(Numeric(10, 3))
    bran_qtl = Column(Numeric(10, 3))
    husk_qtl = Column(Numeric(10, 3))
    milling_yield_pct = Column(Numeric(5, 2))
    rice_type = Column(String(20), nullable=False, default="raw_rice")
    # raw_rice | boiled_rice | sona_masoori
    run_status = Column(String(20), nullable=False, default="planned")
    # planned | in_progress | completed
    machine_hours = Column(Numeric(6, 2))
    electricity_units = Column(Numeric(8, 2))
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    paddy_batch = relationship("PaddyBatch", back_populates="milling_runs")


class RiceStock(Base):
    __tablename__ = "rice_stock"

    id = Column(Integer, primary_key=True, index=True)
    rice_type = Column(String(30), nullable=False)
    grade = Column(String(10), nullable=False, default="A")
    quantity_qtl = Column(Numeric(10, 3), nullable=False, default=0)
    bag_size_kg = Column(Numeric(6, 2))
    bag_count = Column(Integer)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    movement_type = Column(String(20), nullable=False)
    # paddy_in | milling_out | sales_out | adjustment
    reference_type = Column(String(30))
    reference_id = Column(Integer)
    item_type = Column(String(30), nullable=False)
    grade = Column(String(10))
    quantity_qtl = Column(Numeric(10, 3), nullable=False)
    movement_date = Column(Date, nullable=False)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
