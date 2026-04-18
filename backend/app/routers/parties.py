from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models.party import Party
from ..dependencies import get_current_user

router = APIRouter()


class PartyCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    party_type: str
    gstin: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_parties(party_type: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Party).filter(Party.is_active == True)
    if party_type:
        q = q.filter(Party.party_type.in_([party_type, "both"]))
    return q.order_by(Party.name).all()


@router.post("/")
def create_party(body: PartyCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    party = Party(**body.model_dump())
    db.add(party)
    db.commit()
    db.refresh(party)
    return party


@router.get("/{party_id}")
def get_party(party_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    party = db.query(Party).filter(Party.id == party_id).first()
    if not party:
        raise HTTPException(404, "Party not found")
    return party


@router.patch("/{party_id}")
def update_party(party_id: int, body: dict, db: Session = Depends(get_db), _=Depends(get_current_user)):
    party = db.query(Party).filter(Party.id == party_id).first()
    if not party:
        raise HTTPException(404, "Party not found")
    for k, v in body.items():
        if hasattr(party, k):
            setattr(party, k, v)
    db.commit()
    db.refresh(party)
    return party


@router.get("/{party_id}/transactions")
def party_transactions(party_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    from ..models.inventory import PaddyBatch
    from ..models.orders import Order, Invoice, Payment

    party = db.query(Party).filter(Party.id == party_id).first()
    if not party:
        raise HTTPException(404, "Party not found")

    result: dict = {"party_id": party_id, "party_name": party.name, "party_type": party.party_type}

    # Paddy purchases (farmer)
    batches = db.query(PaddyBatch).filter(PaddyBatch.supplier_id == party_id).order_by(PaddyBatch.received_date.desc()).all()
    result["paddy_batches"] = [
        {
            "batch_number": b.batch_number,
            "received_date": b.received_date,
            "net_weight_qtl": float(b.net_weight_qtl),
            "total_amount": float(b.total_amount),
            "amount_paid": float(b.amount_paid),
            "payment_status": b.payment_status,
        }
        for b in batches
    ]
    result["total_paddy_purchased"] = sum(float(b.net_weight_qtl) for b in batches)
    result["total_paddy_amount"] = sum(float(b.total_amount) for b in batches)
    result["total_paddy_paid"] = sum(float(b.amount_paid) for b in batches)

    # Sales orders (buyer)
    orders = db.query(Order).filter(Order.customer_id == party_id).order_by(Order.order_date.desc()).all()
    result["orders"] = [
        {
            "order_number": o.order_number,
            "order_date": o.order_date,
            "status": o.status,
            "invoice_status": o.invoice.status if o.invoice else None,
            "total_amount": float(o.invoice.total_amount) if o.invoice else 0,
            "balance_due": float(o.invoice.balance_due) if o.invoice else 0,
        }
        for o in orders
    ]
    result["total_sales_amount"] = sum(r["total_amount"] for r in result["orders"])
    result["total_sales_outstanding"] = sum(r["balance_due"] for r in result["orders"])

    return result
