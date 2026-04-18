# Rice Mill — System Design Document

> **Living document.** Update this file in the same commit as any schema migration or core logic change.

---

## 1. Business Overview

**Business:** Family-run rice mill in Hanuman Junction, Andhra Pradesh, India  
**Purpose:** Process paddy (raw rice grain) into milled rice for sale to wholesale buyers and local customers

### Core Workflows

**Private Commercial Milling:**
```
Farmer delivers paddy
  → Weigh & grade → Record paddy batch (purchase price, payment to farmer)
  → Milling run → Output: milled rice + broken rice + bran + husk
  → Package into bags → Update stock
  → Sell to buyer → Order → Invoice → Payment
```

**Government Custom Milling (APSCSCL / FCI — details TBD):**
```
Government issues paddy lot (lot number / procurement order)
  → Mill receives & stores paddy (tagged as government source)
  → Milling run against lot
  → Deliver output to designated drop points (FPS / PDS warehouses)
  → Record dispatch challan per drop point
```

### Domain Glossary

| Term | Meaning |
|------|---------|
| Paddy | Raw unhusked rice grain delivered by farmers |
| Quintal (qtl) | 100 kg — standard weight unit in AP rice trade |
| Milling run | One processing batch converting paddy → rice |
| Yield % | `milled_rice_output / paddy_input × 100` — key efficiency metric |
| BPT 5204 | Sona Masoori — premium variety, highest demand |
| MTU 1010 | Rajanna — common variety |
| Broken rice | Byproduct of milling — sold cheaper to flour mills |
| Bran | Outer layer removed — sold to oil extraction units |
| Husk | Outermost hull — sold as fuel / biomass |
| Party | Unified term for farmer (supplier) or buyer (customer) |
| APSCSCL | AP State Civil Supplies Corp — issues govt paddy lots |
| FCI | Food Corporation of India — central govt procurement |
| Drop point | FPS (Fair Price Shop) or PDS warehouse for govt rice delivery |
| PDS | Public Distribution System — govt subsidised rice scheme |
| FPS | Fair Price Shop — retail outlet in PDS network |

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | FastAPI (Python) | Fast to build CRUD APIs; Python ecosystem strong for PDF/Excel exports later |
| Frontend framework | Next.js 15 (App Router) | Built-in routing; server components for public pages; one repo for public site + dashboard |
| UI components | shadcn/ui + Tailwind | Pre-built accessible tables/forms/dialogs; mobile-friendly out of box |
| Database | PostgreSQL 15 | Relational complexity (paddy→milling→stock→orders all linked); generated columns reduce bugs |
| Auth tokens | httpOnly cookies | Prevents XSS token theft vs localStorage; 15min access + 7d refresh |
| Weight unit | Quintals | Industry standard in AP rice trade; avoid confusion with kg |
| Money type | NUMERIC(12,2) | No floating-point rounding errors on INR values |
| Deletes | Soft (is_active flag) | Financial audit trail — never hard-delete paddy batches, invoices, payments |
| Number sequences | PREFIX-YYYY-NNN | Human-readable IDs (PB-2025-001, INV-2025-001) reset per year |
| State management | React Query (@tanstack) | Server state caching; avoids redundant API calls on re-navigation |
| Charts | Recharts | Lightweight, composable, works well with React |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│  ┌─────────────┐          ┌───────────────────────┐  │
│  │ Public pages│          │ Dashboard (/dashboard)│  │
│  │ /, /products│          │ Protected by middleware│  │
│  │ /contact    │          │ Reads JWT cookie       │  │
│  └──────┬──────┘          └──────────┬────────────┘  │
└─────────┼────────────────────────────┼───────────────┘
          │ HTTP                        │ HTTP + cookie
          ▼                             ▼
┌─────────────────────────────────────────────────────┐
│              Next.js 15 (port 3000)                  │
│  App Router — server + client components             │
│  middleware.ts — redirects /dashboard if no cookie   │
└──────────────────────┬──────────────────────────────┘
                       │ REST API calls
                       ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI (port 8000)                     │
│  /api/auth  /api/inventory  /api/orders              │
│  /api/labor /api/parties    /api/reports             │
│  /api/government            /api/public (no auth)    │
└──────────────────────┬──────────────────────────────┘
                       │ SQLAlchemy ORM
                       ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL 15 (port 5432)               │
│  19 tables — see Section 4                           │
└─────────────────────────────────────────────────────┘
```

### Auth Flow
```
1. POST /api/auth/login (email + password)
2. FastAPI verifies password hash, issues JWT
3. Sets httpOnly cookie: access_token (15min) + refresh_token (7d)
4. Next.js middleware: GET /api/auth/me on every /dashboard/* request
5. 401 → redirect to /login | 200 → render page
6. Axios instance uses withCredentials: true so cookies auto-sent
```

---

## 4. Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts with roles (owner/manager/accountant/staff) |
| `parties` | Farmers (suppliers) + buyers (customers), unified with party_type |
| `paddy_varieties` | Rice varieties: BPT 5204, MTU 1010, etc. |
| `paddy_batches` | Each paddy delivery — weight, grade, price, payment status |
| `milling_runs` | Paddy→rice conversion batch; records all outputs + yield% |
| `rice_stock` | Current inventory per rice_type + grade; upserted after milling |
| `stock_movements` | Immutable ledger of all inventory changes (audit trail) |
| `orders` | Customer sales orders |
| `order_items` | Line items per order (rice type, qty, price) |
| `invoices` | One per order; tracks totals, GST, balance due |
| `payments` | Customer payments (→invoice) OR farmer payments (→paddy_batch) |
| `employees` | Daily/monthly/piece-rate workers |
| `attendance_records` | Per-employee per-day; unique constraint on (employee, date) |
| `wage_payments` | Calculated pay periods; marked paid/unpaid |
| `price_list` | Current selling prices — served to public /products page |
| `contact_submissions` | From public contact form |
| `government_lots` | ❓ Govt paddy lots — details TBD |
| `drop_points` | ❓ PDS delivery destinations — details TBD |
| `government_deliveries` | ❓ Dispatch records per lot→drop point — details TBD |

### Key Relationships
```
parties (supplier) ──< paddy_batches ──< milling_runs
                                              │
                                              ▼
                                         rice_stock
                                              │
parties (customer) ──< orders ──< order_items (draws from rice_stock)
                          │
                          └──> invoices ──< payments
                                              │
paddy_batches <─────────────────────────────┘ (farmer payment)

employees ──< attendance_records
employees ──< wage_payments

government_lots ──< government_deliveries ──> drop_points
```

---

## 5. API Reference

All routes prefixed `/api/`. Protected routes require valid JWT cookie.

### Auth
```
POST  /auth/login          — email+password → sets httpOnly cookies
GET   /auth/me             — returns current user from cookie
POST  /auth/logout         — clears cookies
POST  /auth/change-password
```

### Inventory
```
GET|POST  /inventory/paddy/varieties
GET|POST  /inventory/paddy/batches
GET|PATCH /inventory/paddy/batches/{id}
GET|POST  /inventory/milling/runs
PATCH     /inventory/milling/runs/{id}/complete   ← core transaction
GET       /inventory/stock
GET       /inventory/stock/movements
POST      /inventory/stock/adjustment
```

### Parties
```
GET|POST  /parties/
GET|PATCH /parties/{id}
GET       /parties/{id}/transactions
```

### Orders & Billing
```
GET|POST  /orders/orders
GET       /orders/orders/{id}
PATCH     /orders/orders/{id}/status
GET|POST  /orders/payments
GET       /orders/invoices
GET       /orders/invoices/{id}
GET       /orders/invoices/{id}/pdf
```

### Labor
```
GET|POST  /labor/employees
GET|PATCH /labor/employees/{id}
GET       /labor/attendance           — ?date=YYYY-MM-DD
POST      /labor/attendance/bulk      — submit full day at once
GET       /labor/attendance/summary
GET       /labor/wages
POST      /labor/wages/calculate      — preview before paying
POST      /labor/wages/pay
```

### Reports (owner/manager/accountant only)
```
GET  /reports/dashboard        — stats cards for home page
GET  /reports/yield-analysis
GET  /reports/revenue-summary
GET  /reports/pending-dues
GET  /reports/farmer-dues
GET  /reports/labor-cost
```

### Government Module (❓ TBD)
```
GET|POST  /government/drop-points
GET|POST  /government/lots
PATCH     /government/lots/{id}/complete-milling
GET|POST  /government/deliveries
GET       /government/lots/{id}/delivery-summary
```

### Public (no auth)
```
GET   /public/pricing
POST  /public/contact
```

---

## 6. Government Rice Module — Open Questions

> ❓ All items below need confirmation from business owner before implementation.

- [ ] Which authority issues paddy lots? APSCSCL / FCI / District Civil Supplies?
- [ ] Are lots identified by "lot number", "procurement order number", or both?
- [ ] How many drop points does the mill serve? Are they fixed annually?
- [ ] Current acknowledgement process — paper challan, WhatsApp, phone?
- [ ] Milling charge rate (INR per quintal) paid by government to mill?
- [ ] Seasonal pattern — Kharif (Oct-Nov) / Rabi (Apr-May) lot cycles?
- [ ] Does mill do parboiling or raw milling only?

**Schema is stubbed in migration 001 with nullable/flexible fields. Do not add UI until confirmed.**

---

## 7. UI/UX Decisions

- **Mobile-first:** Owner and supervisor use phone on the mill floor. All forms need large tap targets and `inputmode="numeric"` for weight/price fields.
- **Cash-heavy:** Default `payment_mode = 'cash'` everywhere. UPI second option.
- **INR formatting:** All currency shown as `₹1,23,456.00` (Indian number system via `Intl.NumberFormat('en-IN')`).
- **shadcn/ui:** Used for all tables, dialogs, forms, badges — not built from scratch.
- **WhatsApp CTA:** Public contact page includes WhatsApp link — critical for Indian SMB customers.

---

## 8. Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-15 | Initial schema design (19 tables) | Project kickoff |
| 2026-04-15 | Government module stubbed, not implemented | Requirements not yet confirmed with business owner |
