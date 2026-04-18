from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from decimal import Decimal
from ..database import get_db
from ..models.inventory import PaddyVariety, PaddyBatch, MillingRun, RiceStock, StockMovement
from ..dependencies import get_current_user
from ..models.user import User

router = APIRouter()


# ── Paddy Varieties ──────────────────────────────────────────
@router.get("/paddy/varieties")
def list_varieties(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(PaddyVariety).filter(PaddyVariety.is_active == True).all()


@router.post("/paddy/varieties")
def create_variety(name: str, description: Optional[str] = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    v = PaddyVariety(name=name, description=description)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


# ── Paddy Batches ─────────────────────────────────────────────
class PaddyBatchCreate(BaseModel):
    supplier_id: int
    variety_id: int
    received_date: date
    gross_weight_qtl: Decimal
    tare_weight_qtl: Decimal = Decimal("0")
    moisture_pct: Optional[Decimal] = None
    grade: str = "A"
    purchase_price_per_qtl: Decimal
    vehicle_number: Optional[str] = None
    notes: Optional[str] = None


@router.get("/paddy/batches")
def list_batches(db: Session = Depends(get_db), _=Depends(get_current_user)):
    batches = db.query(PaddyBatch).order_by(PaddyBatch.received_date.desc()).limit(100).all()
    return batches


@router.post("/paddy/batches")
def create_batch(body: PaddyBatchCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Auto-generate batch number
    year = body.received_date.year
    count = db.query(func.count(PaddyBatch.id)).scalar() + 1
    batch_number = f"PB-{year}-{count:03d}"

    net = body.gross_weight_qtl - body.tare_weight_qtl
    total = net * body.purchase_price_per_qtl

    batch = PaddyBatch(
        batch_number=batch_number,
        supplier_id=body.supplier_id,
        variety_id=body.variety_id,
        received_date=body.received_date,
        gross_weight_qtl=body.gross_weight_qtl,
        tare_weight_qtl=body.tare_weight_qtl,
        net_weight_qtl=net,
        moisture_pct=body.moisture_pct,
        grade=body.grade,
        purchase_price_per_qtl=body.purchase_price_per_qtl,
        total_amount=total,
        vehicle_number=body.vehicle_number,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/paddy/batches/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    batch = db.query(PaddyBatch).filter(PaddyBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(404, "Batch not found")
    return batch


# ── Stock ─────────────────────────────────────────────────────
@router.get("/stock")
def get_stock(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(RiceStock).all()


@router.get("/stock/movements")
def get_movements(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(StockMovement).order_by(StockMovement.movement_date.desc()).limit(100).all()


# ── Milling Runs ──────────────────────────────────────────────
class MillingRunCreate(BaseModel):
    paddy_batch_id: int
    run_date: date
    paddy_used_qtl: Decimal
    rice_type: str = "raw_rice"
    shift: str = "day"


class CompleteMillingRun(BaseModel):
    milled_rice_qtl: Decimal
    broken_rice_qtl: Decimal = Decimal("0")
    bran_qtl: Decimal = Decimal("0")
    husk_qtl: Decimal = Decimal("0")
    machine_hours: Optional[Decimal] = None
    electricity_units: Optional[Decimal] = None
    notes: Optional[str] = None


@router.get("/milling/runs")
def list_runs(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(MillingRun).order_by(MillingRun.run_date.desc()).limit(100).all()


@router.post("/milling/runs")
def create_run(body: MillingRunCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    year = body.run_date.year
    count = db.query(func.count(MillingRun.id)).scalar() + 1
    run_number = f"MR-{year}-{count:03d}"

    run = MillingRun(
        run_number=run_number,
        run_date=body.run_date,
        paddy_batch_id=body.paddy_batch_id,
        paddy_used_qtl=body.paddy_used_qtl,
        rice_type=body.rice_type,
        shift=body.shift,
        run_status="planned",
        created_by=current_user.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.patch("/milling/runs/{run_id}/complete")
def complete_run(run_id: int, body: CompleteMillingRun, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    run = db.query(MillingRun).filter(MillingRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Run not found")
    if run.run_status == "completed":
        raise HTTPException(400, "Run already completed")

    # Compute yield
    yield_pct = (body.milled_rice_qtl / run.paddy_used_qtl * 100) if run.paddy_used_qtl else Decimal("0")

    run.milled_rice_qtl = body.milled_rice_qtl
    run.broken_rice_qtl = body.broken_rice_qtl
    run.bran_qtl = body.bran_qtl
    run.husk_qtl = body.husk_qtl
    run.milling_yield_pct = yield_pct
    run.machine_hours = body.machine_hours
    run.electricity_units = body.electricity_units
    run.notes = body.notes
    run.run_status = "completed"

    # Update rice stock (upsert)
    outputs = [
        (run.rice_type, body.milled_rice_qtl),
        ("broken_rice", body.broken_rice_qtl),
        ("bran", body.bran_qtl),
        ("husk", body.husk_qtl),
    ]
    for rtype, qty in outputs:
        if qty and qty > 0:
            stock = db.query(RiceStock).filter(RiceStock.rice_type == rtype, RiceStock.grade == "A").first()
            if stock:
                stock.quantity_qtl += qty
            else:
                db.add(RiceStock(rice_type=rtype, grade="A", quantity_qtl=qty))
            db.add(StockMovement(
                movement_type="milling_out",
                reference_type="milling_run",
                reference_id=run.id,
                item_type=rtype,
                grade="A",
                quantity_qtl=qty,
                movement_date=run.run_date,
                created_by=current_user.id,
            ))

    db.commit()
    db.refresh(run)
    return run
