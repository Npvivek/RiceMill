# Panduranga Rice Mill

Marketing website and private, browser-based Excel analysis workspace for a family rice mill in Hanuman Junction, Eluru district, Andhra Pradesh.

**Live frontend:** [rice-mill-steel.vercel.app](https://rice-mill-steel.vercel.app/)

## What is active

- Public marketing pages for mill by-products and paddy procurement
- Products page with direct call/WhatsApp pricing
- Contact enquiries sent through WhatsApp
- Personal dashboard at `/dashboard` for analyzing rice-mill `.xlsx` account workbooks

The Excel analyzer runs completely in the browser. Workbooks are not uploaded, stored, or sent to an API. It detects transaction tables across multiple sheets and reports:

- income, expenses, and net cash flow
- monthly movement
- rice-mill categories such as bran, husk, broken rice, paddy, transport, labour, and repairs
- the largest entries
- per-sheet classification and data-quality warnings

## Current architecture

```text
Browser
├── Public marketing site
└── Private-use dashboard
    └── Local .xlsx parsing and analysis (no upload)

Next.js 16 + React 19 → Vercel
```

The previous FastAPI/PostgreSQL application remains in `backend/` as legacy code for now, but the deployed frontend no longer needs it. Its old CRUD dashboard and login routes have been removed from the active Next.js application so Vercel serves only the marketing pages and workbook analyzer.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No database or backend service is required for the active experience.

## Private local data

`Data/` and `license/` are intentionally ignored by Git. Store private account workbooks and operating documents there only on trusted local machines.

The license files were committed once before being ignored. Removing them from the current branch does not erase copies from existing Git history; history rewriting and a coordinated force-push are required if those old objects must be purged from GitHub entirely.

## Useful commands

```bash
cd frontend
npm run lint
npm run build
```
