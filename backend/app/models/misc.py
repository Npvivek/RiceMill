from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, Date
from sqlalchemy.sql import func
from ..database import Base


class PriceList(Base):
    __tablename__ = "price_list"

    id = Column(Integer, primary_key=True, index=True)
    rice_type = Column(String(30), nullable=False)
    grade = Column(String(10), nullable=False)
    price_per_qtl = Column(Numeric(10, 2), nullable=False)
    effective_date = Column(Date, nullable=False)
    is_current = Column(Boolean, nullable=False, default=True)


class ContactSubmission(Base):
    __tablename__ = "contact_submissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15))
    email = Column(String(150))
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
