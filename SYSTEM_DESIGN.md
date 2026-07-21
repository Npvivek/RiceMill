# Rice Mill — System Design Document

> **Living document.** Update this file in the same commit as any schema migration or core logic change.

> **Status (July 2026): historical backend design.** The Railway backend is no longer deployed. The active Vercel application is the public marketing site plus a browser-only Excel analysis dashboard; see `README.md`. The FastAPI/PostgreSQL material below is retained as a reference until the legacy backend is deliberately archived or removed.

---

## 1. Business Overview

**Business:** Panduranga Rice Mill — family-run, Hanuman Junction, Eluru District, Andhra Pradesh
**Owner:** Uses this system for tracking; day-to-day data entry replaces Excel

### What the mill does

- Receives **paddy from government** (APSCSCL/civil supplies) as custom milling jobs
- Mills the paddy → produces milled rice (returned to govt) + **by-products kept by mill**
- **By-products the mill sells:** Broken Rice, Rice Husk, Rice Bran
- **By-products the mill does NOT sell:** BPT 5204, MTU 1010, Boiled Rice (these are output for govt, not for sale)
- **Paddy procurement:** Also procuring paddy directly from private farmers/traders (replacing govt-only dependency)

### Core Workflows

**1. Government Custom Milling (primary workflow)**
```
Govt issues paddy lot (lot number + quantity)
  → Paddy arrives at mill, weighed & recorded
  → Milling run — converts paddy → milled rice + broken rice + bran + husk
  → Milled rice delivered to designated godowns (PDS drop points)
  → Dispatch challan recorded per godown delivery
  → By-products (broken rice, husk, bran) retained by mill as payment-in-kind
```

**2. Private By-product Sales (revenue workflow)**
```
By-products accumulate in stock after milling
  → Buyer places order (flour mill, oil extraction unit, boiler operator)
  → Order recorded → Invoice generated → Payment collected
```

**3. Private Paddy Procurement (growing workflow)**
```
Farmer/trader brings paddy to mill
  → Weighed, graded, recorded as private paddy batch
  → Milling run → by-products go to stock, milled rice to private buyer
  → Farmer paid (cash/UPI)
```

### Domain Glossary

| Term | Meaning |
|------|---------|
| Paddy | Raw unhusked rice grain |
| Quintal (qtl) | 100 kg — standard weight unit in AP rice trade |
| Milling run | One processing batch: paddy → rice + by-products |
| Yield % | `milled_rice_output / paddy_input × 100` |
| Broken rice | Milling by-product — sold to flour mills / poultry feed |
| Bran | Outer layer by-product — sold to oil extraction units |
| Husk | Hull by-product — sold as biomass fuel |
| Govt lot | A paddy consignment issued by APSCSCL/civil supplies for custom milling |
| Godown | Delivery destination — civil supplies warehouse or FPS store |
| Drop point | Same as godown — PDS delivery destination |
| Challan | Dispatch document per godown delivery |
| Party | Unified term for farmer (supplier) or buyer (customer) |
| APSCSCL | AP State Civil Supplies Corp — issues govt paddy lots |
| FCI | Food Corporation of India — central govt procurement body |
| PDS | Public Distribution System — govt subsidised rice distribution |
| FPS | Fair Price Shop — retail outlet in PDS network |

---

## 2. What Is NOT in This System

| Removed | Reason |
|---------|--------|
| Labor / Attendance / Wages | Owner manages this in Excel; not needed in app |
| Paddy batch sub-pages | Merged into milling run entry — no separate paddy tracking page |
| GST invoicing complexity | Small mill — basic invoice sufficient for now |

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend | FastAPI (Python) | Fast CRUD; easy PDF/Excel exports later |
| Frontend | Next.js (App Router) | Public marketing site + protected dashboard in one repo |
| UI | shadcn/ui + Tailwind v4 | Pre-built accessible components; mobile-first |
| Database | PostgreSQL | Relational — lots → runs → stock → orders all linked |
| Auth | httpOnly cookies | JWT in httpOnly cookie; XSS-safe |
| Weight unit | Quintals | Industry standard in AP |
| Money type | NUMERIC(12,2) | No float rounding errors |
| Deletes | Soft (is_active flag) | Financial audit trail |
| IDs | PREFIX-YYYY-NNN | Human-readable (GL-2025-001, CH-2025-001) |
| Theme | Light + Dark via next-themes | Toggle on all pages |

---

## 4. System Architecture

```
Browser
├── Public pages (/, /products, /contact)   — marketing + lead capture
└── Dashboard (/dashboard/*)                — protected, staff only

Next.js (Vercel)
└── REST calls → FastAPI (Railway) → PostgreSQL
```

### Auth Flow
```
POST /api/auth/login → JWT in httpOnly cookie (15min access + 7d refresh)
Next.js middleware: GET /api/auth/me on every /dashboard/* → 401 = redirect /login
```

---

## 5. Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Staff logins (owner / manager / accountant) |
| `parties` | Farmers (suppliers) + buyers (customers) |
| `government_lots` | Each govt paddy consignment issued to the mill |
| `godowns` | Fixed list of delivery destinations (civil supplies warehouses, FPS stores) |
| `godown_deliveries` | Each challan — lot → godown, quantity delivered, date |
| `milling_runs` | Paddy→rice conversion batch; records outputs + yield% |
| `rice_stock` | Current by-product inventory (broken_rice / husk / bran) |
| `stock_movements` | Immutable ledger of all stock changes |
| `orders` | By-product sales orders |
| `order_items` | Line items per order |
| `invoices` | One per order; balance due |
| `payments` | Customer payments (→invoice) or farmer payments (→lot/batch) |
| `price_list` | Current selling prices — served to public /products page |
| `contact_submissions` | From public contact form |

### Key Relationships
```
government_seasons ──< government_lots ──< milling_runs ──> rice_stock (broken_rice / husk / bran)
government_lots ──< godown_deliveries ──> godowns (vary per lot)

parties (buyer) ──< orders ──< order_items ──> rice_stock
orders ──> invoices ──< payments
```

### `government_seasons` table
```sql
id                          SERIAL PRIMARY KEY
name                        TEXT NOT NULL UNIQUE   -- e.g. "Kharif 2025", "Rabi 2025-26"
season_type                 TEXT NOT NULL          -- Kharif | Rabi
year                        TEXT NOT NULL          -- "2025", "2025-26"
-- APSCSCL rates (₹ per quintal) for this season
milling_charge_qtl          NUMERIC(8,2) NOT NULL
sortex_charge_qtl           NUMERIC(8,2) NOT NULL
paddy_transport_charge_qtl  NUMERIC(8,2) NOT NULL
rice_transport_charge_qtl   NUMERIC(8,2) NOT NULL
blending_charge_qtl         NUMERIC(8,2) NOT NULL
gunny_charge_qtl            NUMERIC(8,2) NOT NULL
-- computed helper
total_charge_qtl            NUMERIC(8,2) GENERATED ALWAYS AS (
                              milling_charge_qtl + sortex_charge_qtl +
                              paddy_transport_charge_qtl + rice_transport_charge_qtl +
                              blending_charge_qtl + gunny_charge_qtl
                            ) STORED
is_active                   BOOLEAN DEFAULT true
created_at                  TIMESTAMPTZ DEFAULT now()
```

### `government_lots` table
```sql
id              SERIAL PRIMARY KEY
lot_number      TEXT NOT NULL UNIQUE        -- APSCSCL-issued reference
season_id       INT REFERENCES government_seasons(id)
paddy_variety   TEXT                        -- BPT 5204 | MTU 1010 | etc.
quantity_qtl    NUMERIC(10,2) NOT NULL      -- paddy received from APSCSCL
received_date   DATE NOT NULL
status          TEXT DEFAULT 'received'     -- received | milling | milled | delivered | closed
-- computed revenue (quantity × season total rate)
expected_revenue NUMERIC(12,2) GENERATED ALWAYS AS (quantity_qtl * 0) STORED  -- placeholder; app calculates
notes           TEXT
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

### `godowns` table
```sql
id          SERIAL PRIMARY KEY
name        TEXT NOT NULL         -- e.g. "Hanuman Junction FPS", "Gudivada Warehouse"
location    TEXT
type        TEXT                  -- fps | civil_supplies | pds_warehouse
is_active   BOOLEAN DEFAULT true  -- can be deactivated if no longer used
```

### `godown_deliveries` table
```sql
id              SERIAL PRIMARY KEY
challan_number  TEXT NOT NULL UNIQUE        -- CH-2025-001
lot_id          INT REFERENCES government_lots(id)
godown_id       INT REFERENCES godowns(id)
quantity_qtl    NUMERIC(10,2) NOT NULL      -- milled rice delivered
delivery_date   DATE NOT NULL
vehicle_number  TEXT
driver_name     TEXT
notes           TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

### `milling_runs` table
```sql
id                  SERIAL PRIMARY KEY
run_number          TEXT NOT NULL UNIQUE     -- MR-2025-001
lot_id              INT REFERENCES government_lots(id)  -- NULL if private
paddy_input_qtl     NUMERIC(10,2) NOT NULL
milled_rice_qtl     NUMERIC(10,2)            -- output to govt (via godown deliveries)
broken_rice_qtl     NUMERIC(10,2)            -- retained by mill → rice_stock
husk_qtl            NUMERIC(10,2)            -- retained by mill → rice_stock
bran_qtl            NUMERIC(10,2)            -- retained by mill → rice_stock
yield_pct           NUMERIC(5,2) GENERATED ALWAYS AS (milled_rice_qtl / paddy_input_qtl * 100) STORED
run_date            DATE NOT NULL
status              TEXT DEFAULT 'pending'   -- pending | complete
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT now()
```

---

## 6. API Reference

All routes prefixed `/api/`. Protected routes require valid JWT cookie.

### Auth
```
POST  /auth/login
GET   /auth/me
POST  /auth/logout
POST  /auth/change-password
```

### Government Module
```
GET|POST   /government/lots                          -- list / create lot
GET|PATCH  /government/lots/{id}                     -- detail / update status
GET        /government/lots/{id}/deliveries          -- all deliveries for this lot
GET        /government/lots/{id}/summary             -- qtl received, milled, delivered, balance

GET|POST   /government/godowns                       -- list / create godown
GET|PATCH  /government/godowns/{id}

GET|POST   /government/deliveries                    -- list / create challan
GET        /government/deliveries/{id}
GET        /government/deliveries/{id}/pdf           -- printable challan
```

### Inventory
```
GET|POST   /inventory/milling/runs
GET|PATCH  /inventory/milling/runs/{id}
PATCH      /inventory/milling/runs/{id}/complete     -- triggers stock_movements insert
GET        /inventory/stock                          -- current by-product levels
GET        /inventory/stock/movements                -- audit ledger
POST       /inventory/stock/adjustment               -- manual correction with reason
```

### Parties
```
GET|POST   /parties/
GET|PATCH  /parties/{id}
GET        /parties/{id}/transactions
```

### Orders & Billing (by-product sales)
```
GET|POST   /orders/
GET        /orders/{id}
PATCH      /orders/{id}/status
GET|POST   /orders/payments
GET        /orders/invoices
GET        /orders/invoices/{id}/pdf
```

### Reports
```
GET  /reports/dashboard          -- stats cards: stock, dues, revenue, active lots
GET  /reports/yield-analysis     -- milling efficiency over time
GET  /reports/revenue-summary    -- monthly by-product sales
GET  /reports/govt-lot-status    -- lot-by-lot delivery completion
```

### Public (no auth)
```
GET   /public/pricing            -- by-product price list for /products page
POST  /public/contact            -- contact form submission
```

---

## 7. Dashboard Pages (Frontend)

| Route | Purpose |
|-------|---------|
| `/dashboard` | Overview: active govt lots, by-product stock, recent orders |
| `/dashboard/government/lots` | List + create government paddy lots |
| `/dashboard/government/deliveries` | List + create godown delivery challans |
| `/dashboard/inventory/milling` | Milling runs — input paddy, record outputs |
| `/dashboard/inventory/stock` | Current by-product stock breakdown |
| `/dashboard/parties` | Buyers and private farmers |
| `/dashboard/orders` | By-product sales orders + invoicing |
| `/dashboard/reports` | Yield analysis, revenue, govt lot completion |

---

## 8. Business Context (confirmed)

- **Agency:** APSCSCL (AP State Civil Supplies Corporation)
- **Seasons:** Both Kharif (Oct–Feb) and Rabi (Apr–Jun)
- **Licences:** 5 licences required to operate (exact list TBD with owner)
- **Godowns:** Vary per lot/season — not a fixed list
- **Bank guarantee:** Lodged with APSCSCL as security for paddy entrusted to mill
- **Private procurement:** Not yet. Goal is to attract farmers via marketing website.
- **Excel data:** Owner tracks in Excel currently. Future: import → DB → analytics.

### Government Revenue Model

APSCSCL pays the mill **6 separate charges per season**, all calculated per quintal of paddy processed:

| Charge | Description |
|--------|-------------|
| **Milling charge** | Core processing fee — paddy → milled rice |
| **Sortex charge** | Sortex machine cleaning/grading of rice |
| **Paddy transport charge** | Transporting paddy from procurement center to mill |
| **Rice transport charge** | Transporting milled rice from mill to godowns/FPS |
| **Blending charge** | Blending different paddy varieties |
| **Gunny usage charge** | Gunny bags/sacks used for packaging |

Rates are fixed per season by APSCSCL. Total govt income per lot:
```
Revenue = paddy_qty_qtl × (milling_rate + sortex_rate + paddy_transport_rate +
          rice_transport_rate + blending_rate + gunny_rate)
```

## 9. Open Questions (still need owner input)

- [ ] **Lot number format** — what does the APSCSCL-issued reference number look like?
- [ ] **Godown assignment** — are godowns assigned by APSCSCL per lot, or does the mill choose?
- [ ] **Current season rates** — ₹ per quintal for each of the 6 charge types?
- [ ] **Challan format** — need to print from app, or just record digitally?
- [ ] **Payment cycle** — does APSCSCL pay per lot after delivery, or consolidated per season?
- [ ] **5 licences** — exact list?

## 10. Future: Analytics / Excel Import

> Build after core govt milling module is live. Needs backend support.

- Owner sends Excel files (procurement records, delivery logs, payment sheets)
- Backend parses and ingests into DB
- Analytics section in dashboard:
  - Season-over-season yield comparison
  - Godown-wise delivery completion %
  - By-product revenue trend
  - Lot cycle time (received → fully delivered)
- Keep `/dashboard/reports` route as the placeholder; flesh out once data flows in

---

## 9. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-15 | Initial schema design (19 tables) | Project kickoff |
| 2026-04-15 | Government module stubbed | Requirements not confirmed |
| 2026-04-19 | Removed labor/attendance/wages module | Owner uses Excel; not needed in app |
| 2026-04-19 | Redesigned core workflow around govt lot → godown delivery | This is the primary business operation |
| 2026-04-19 | Products corrected: only broken rice, husk, bran for sale | BPT/MTU/Boiled are govt output, not mill sales |
| 2026-04-19 | Confirmed: both Kharif + Rabi seasons, 5 licences, bank guarantee model | Owner input |
| 2026-04-19 | Added future Excel import + analytics section | Owner tracks data in Excel currently |
| 2026-04-19 | Confirmed APSCSCL as agency; 6 govt charge types per season; godowns vary per lot | Owner input |
| 2026-04-19 | Added government_seasons table with all 6 charge rate columns | Revenue model now correct |
