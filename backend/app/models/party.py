from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric
from sqlalchemy.sql import func
from ..database import Base


class Party(Base):
    __tablename__ = "parties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(15))
    alternate_phone = Column(String(15))
    address = Column(Text)
    village = Column(String(100))
    district = Column(String(100))
    party_type = Column(String(20), nullable=False)
    # supplier (farmer), customer (buyer), both
    gstin = Column(String(15))
    opening_balance = Column(Numeric(12, 2), default=0)
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
