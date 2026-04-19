from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..database import get_db
from ..models.misc import PriceList, ContactSubmission
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class ContactForm(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    message: str


def _send_contact_email(form: ContactForm):
    try:
        smtp_host = getattr(settings, "SMTP_HOST", None)
        smtp_port = int(getattr(settings, "SMTP_PORT", 587))
        smtp_user = getattr(settings, "SMTP_USER", None)
        smtp_pass = getattr(settings, "SMTP_PASS", None)
        if not all([smtp_host, smtp_user, smtp_pass]):
            logger.warning("SMTP not configured — skipping contact email")
            return

        body = (
            f"New contact form submission from Panduranga Rice Mill website\n\n"
            f"Name:    {form.name}\n"
            f"Phone:   {form.phone or '—'}\n"
            f"Email:   {form.email or '—'}\n\n"
            f"Message:\n{form.message}\n"
        )

        msg = MIMEMultipart()
        msg["Subject"] = f"Rice Mill Contact: {form.name}"
        msg["From"] = smtp_user
        msg["To"] = "n_nehru@gmail.com"
        msg["Cc"] = "npvivek01@gmail.com"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, ["n_nehru@gmail.com", "npvivek01@gmail.com"], msg.as_string())

        logger.info("Contact email sent for %s", form.name)
    except Exception:
        logger.exception("Failed to send contact email")


@router.get("/pricing")
def get_pricing(db: Session = Depends(get_db)):
    return db.query(PriceList).filter(PriceList.is_current == True).order_by(PriceList.rice_type).all()


@router.post("/contact")
def submit_contact(body: ContactForm, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    submission = ContactSubmission(**body.model_dump())
    db.add(submission)
    db.commit()
    background_tasks.add_task(_send_contact_email, body)
    return {"ok": True, "message": "Thank you! We will get back to you shortly."}
