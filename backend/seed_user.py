"""
Create the first admin user in the database.

Usage:
    python seed_user.py

Set DATABASE_URL env var (or use .env) before running.
The script is idempotent — running it twice won't create a duplicate.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password

USERNAME = "vivek"
PASSWORD = "admin123"  # change after first login
NAME = "Vivek"
ROLE = "owner"

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    existing = db.query(User).filter(User.email == USERNAME).first()
    if existing:
        print(f"User '{USERNAME}' already exists (id={existing.id}). Nothing changed.")
    else:
        user = User(
            name=NAME,
            email=USERNAME,
            hashed_password=hash_password(PASSWORD),
            role=ROLE,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created user '{USERNAME}' with role '{ROLE}' (id={user.id}).")
        print("IMPORTANT: Change the password after first login.")
finally:
    db.close()
