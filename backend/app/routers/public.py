from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models.misc import PriceList, ContactSubmission

router = APIRouter()


class ContactForm(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    message: str


@router.get("/pricing")
def get_pricing(db: Session = Depends(get_db)):
    return db.query(PriceList).filter(PriceList.is_current == True).order_by(PriceList.rice_type).all()


@router.post("/contact")
def submit_contact(body: ContactForm, db: Session = Depends(get_db)):
    submission = ContactSubmission(**body.model_dump())
    db.add(submission)
    db.commit()
    return {"ok": True, "message": "Thank you! We will get back to you shortly."}
