# Panduranga Rice Mill

Full-stack management system for a family rice mill in Hanuman Junction, Krishna District, Andhra Pradesh. Handles government custom milling operations (APSCSCL), by-product inventory, godown delivery tracking, and a public-facing marketing site for wholesale buyers and paddy suppliers.

**Live:**
- Frontend → [rice-mill-steel.vercel.app](https://rice-mill-steel.vercel.app/)
- Backend → [ricemill-production.up.railway.app](https://ricemill-production.up.railway.app)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 15 |
| ORM / Migrations | SQLAlchemy 2.0, Alembic |
| Auth | JWT via httpOnly cookies (access 15min, refresh 7d) |
| Frontend Deploy | Vercel |
| Backend Deploy | Railway |
| Local Dev DB | Docker Compose |

---

## Project Structure

```
rice-mill/
├── frontend/                  # Next.js app
│   └── src/
│       ├── app/
│       │   ├── page.tsx               # Public landing page
│       │   ├── products/              # Public products & pricing
│       │   ├── contact/               # Public contact form
│       │   ├── login/                 # Staff login
│       │   └── dashboard/            # Protected staff dashboard
│       │       ├── page.tsx           # Overview stats
│       │       ├── government/
│       │       │   ├── lots/          # APSCSCL paddy lots
│       │       │   └── deliveries/    # Godown delivery challans
│       │       ├── inventory/
│       │       │   ├── milling/       # Milling runs
│       │       │   └── stock/         # By-product stock
│       │       ├── parties/           # Buyers & suppliers
│       │       ├── orders/            # Sales orders & invoicing
│       │       └── reports/           # Analytics
│       ├── components/
│       │   ├── ui/                    # shadcn/ui components
│       │   └── dashboard/sidebar.tsx  # Nav sidebar
│       └── lib/
│           ├── api.ts                 # Axios client + formatters
│           └── providers.tsx          # React Query + Theme provider
│
├── backend/                   # FastAPI app
│   ├── app/
│   │   ├── main.py            # App entrypoint, CORS, router registration
│   │   ├── config.py          # Settings via pydantic-settings
│   │   ├── database.py        # SQLAlchemy engine + session
│   │   ├── dependencies.py    # Auth middleware, get_current_user
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routers/           # Route handlers
│   │   │   ├── auth.py        # Login, logout, /me
│   │   │   ├── inventory.py   # Milling runs, stock
│   │   │   ├── parties.py     # Farmers & buyers
│   │   │   ├── orders.py      # Sales orders, invoices, payments
│   │   │   ├── reports.py     # Dashboard stats, analytics
│   │   │   └── public.py      # /pricing, /contact (no auth)
│   │   └── services/          # Business logic layer
│   ├── alembic/               # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml         # Local PostgreSQL + pgAdmin
├── SYSTEM_DESIGN.md           # Architecture & schema reference
└── license/                   # Mill operating licences (FSSAI, GST, etc.)
```

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker (for local PostgreSQL)

### 1. Start the database

```bash
docker compose up -d
# PostgreSQL on localhost:5432
# pgAdmin on localhost:5050 (admin@mill.local / admin)
```

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create .env
cp .env.example .env   # fill in DATABASE_URL and SECRET_KEY

# Run migrations
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Frontend runs at `http://localhost:3000`

---

## Environment Variables

### Backend `.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret (keep long & random) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

### Frontend `.env.local`

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL |

---

## Deployment

### Frontend — Vercel

Connects to the `main` branch. Every push auto-deploys.

Set `NEXT_PUBLIC_API_URL` in Vercel project settings → Environment Variables.

### Backend — Railway

Deployed via `Dockerfile` in `backend/`. Set all env vars in Railway service variables.

Database is a separate Railway PostgreSQL service. Run migrations after deploy:

```bash
railway run alembic upgrade head
```

---

## Key Features

**Public site**
- Marketing landing page targeting wholesale buyers and paddy suppliers
- Products & live pricing page (broken rice, husk, bran)
- Contact form + WhatsApp direct link
- 6 active licence/certification badges (FSSAI, GST, WeighBridge, DCSO, Factory, Udyam)
- Full dark mode

**Staff dashboard**
- Government milling: APSCSCL season rates (6 charge types), paddy lots, godown delivery challans
- Inventory: milling runs, by-product stock ledger
- Parties: buyers and private farmers
- Orders & invoicing
- Reports & analytics

---

## Design Document

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for full schema, API reference, architecture decisions, and the government milling revenue model.
