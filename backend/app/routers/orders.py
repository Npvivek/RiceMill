from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal
from ..database import get_db
from ..models.orders import Order, OrderItem, Invoice, Payment
from ..models.inventory import RiceStock, StockMovement
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    rice_type: str
    grade: str = "A"
    quantity_qtl: Decimal
    bag_count: Optional[int] = None
    price_per_qtl: Decimal


class OrderCreate(BaseModel):
    customer_id: int
    order_date: date
    delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    vehicle_number: Optional[str] = None
    transport_charge: Decimal = Decimal("0")
    notes: Optional[str] = None
    items: List[OrderItemCreate]


class OrderStatusUpdate(BaseModel):
    status: str


class PaymentCreate(BaseModel):
    invoice_id: Optional[int] = None
    paddy_batch_id: Optional[int] = None
    payment_date: date
    amount: Decimal
    payment_mode: str = "cash"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


# ── Orders ────────────────────────────────────────────────────

@router.get("/orders")
def list_orders(status: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Order).order_by(Order.order_date.desc())
    if status:
        q = q.filter(Order.status == status)
    return q.limit(100).all()


@router.post("/orders")
def create_order(body: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Order must have at least one item")

    year = body.order_date.year
    count = db.query(func.count(Order.id)).scalar() + 1
    order_number = f"ORD-{year}-{count:03d}"

    order = Order(
        order_number=order_number,
        customer_id=body.customer_id,
        order_date=body.order_date,
        delivery_date=body.delivery_date,
        delivery_address=body.delivery_address,
        vehicle_number=body.vehicle_number,
        transport_charge=body.transport_charge,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(order)
    db.flush()  # get order.id before adding items

    subtotal = Decimal("0")
    for item_data in body.items:
        amount = item_data.quantity_qtl * item_data.price_per_qtl
        item = OrderItem(
            order_id=order.id,
            rice_type=item_data.rice_type,
            grade=item_data.grade,
            quantity_qtl=item_data.quantity_qtl,
            bag_count=item_data.bag_count,
            price_per_qtl=item_data.price_per_qtl,
            amount=amount,
        )
        db.add(item)
        subtotal += amount

    # Auto-create invoice
    inv_count = db.query(func.count(Invoice.id)).scalar() + 1
    invoice_number = f"INV-{year}-{inv_count:03d}"
    total = subtotal + body.transport_charge
    invoice = Invoice(
        invoice_number=invoice_number,
        order_id=order.id,
        invoice_date=body.order_date,
        subtotal=subtotal,
        transport_charge=body.transport_charge,
        total_amount=total,
        balance_due=total,
    )
    db.add(invoice)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, body: OrderStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    valid_statuses = {"pending", "confirmed", "dispatched", "delivered", "cancelled"}
    if body.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    # Deduct stock when dispatched
    if body.status == "dispatched" and order.status != "dispatched":
        for item in order.items:
            stock = db.query(RiceStock).filter(
                RiceStock.rice_type == item.rice_type,
                RiceStock.grade == item.grade,
            ).first()
            if not stock or stock.quantity_qtl < item.quantity_qtl:
                raise HTTPException(400, f"Insufficient stock for {item.rice_type} grade {item.grade}")
            stock.quantity_qtl -= item.quantity_qtl
            db.add(StockMovement(
                movement_type="sale_out",
                reference_type="order",
                reference_id=order.id,
                item_type=item.rice_type,
                grade=item.grade,
                quantity_qtl=item.quantity_qtl,
                movement_date=date.today(),
                created_by=current_user.id,
            ))

    order.status = body.status
    db.commit()
    db.refresh(order)
    return order


# ── Invoices ──────────────────────────────────────────────────

@router.get("/invoices")
def list_invoices(status: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Invoice).order_by(Invoice.invoice_date.desc())
    if status:
        q = q.filter(Invoice.status == status)
    return q.limit(100).all()


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return invoice


# ── Payments ──────────────────────────────────────────────────

@router.get("/payments")
def list_payments(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Payment).order_by(Payment.payment_date.desc()).limit(100).all()


@router.post("/payments")
def record_payment(body: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not body.invoice_id and not body.paddy_batch_id:
        raise HTTPException(400, "Payment must reference an invoice or paddy batch")

    payment = Payment(
        invoice_id=body.invoice_id,
        paddy_batch_id=body.paddy_batch_id,
        payment_date=body.payment_date,
        amount=body.amount,
        payment_mode=body.payment_mode,
        reference_number=body.reference_number,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(payment)

    # Update invoice balance if this is a customer payment
    if body.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == body.invoice_id).first()
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        invoice.amount_paid += body.amount
        invoice.balance_due = invoice.total_amount - invoice.amount_paid
        if invoice.balance_due <= 0:
            invoice.status = "paid"
            invoice.balance_due = Decimal("0")
        else:
            invoice.status = "partial"

    db.commit()
    db.refresh(payment)
    return payment
