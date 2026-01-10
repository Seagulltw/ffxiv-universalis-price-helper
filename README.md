# FFXIV Universalis Price Helper (Google Sheets + Apps Script)

A Google Sheets template (container-bound Apps Script) that:
- Fetches min listing unit prices from Universalis (HQ/NQ logic)
- Writes time-series history to `趨勢圖data` for charting
- Supports lightweight “single-cell refresh” when toggling HQ checkboxes

No secrets/tokens are included. Do NOT hardcode private keys into the sheet or code.

---

## 60-second Quick Start (End users)

### 0) Make your own copy (required)
1. Open the template (view-only): [**(paste your template link here)**](https://docs.google.com/spreadsheets/d/14F5JXRo2ntdVOzyn7vrxh80rQrYJWqJ37GSZdX8B6Sw/)
2. Google Sheets: `File → Make a copy`

### 1) Fill 2 cells
In `calculator`:
- `C1`: World/DC/Region (e.g., `Garuda` / `Chocobo` or localized alias like `迦樓羅` / `陸行鳥`)
- `C2`: Target item name (for the trend chart)

### 2) Check mapping (first time only)
In `idmappingtableTW`:
- Column A: Item name (ZH)
- Column B: Universalis `itemId`

### 3) Use the menu (FFXIV)
- `FFXIV → Update prices (full table)`
- `FFXIV → Update trend (days from config)`

Optional (auto-refresh on HQ toggle):
- `FFXIV → Install onEdit trigger`
- Note: installable triggers do NOT automatically come with “Make a copy”.
  Each user must install it in their own copy.

---

## HQ Pricing Logic
- HQ = TRUE → HQ min listing
- HQ = FALSE → min(HQ min listing, NQ min listing)

---

## Required sheets
- `calculator`
- `idmappingtableTW`
- `趨勢圖data`

## Optional (one-click init)
Run `FFXIV → Init (Config/Alias/README)` to create:
- `FFXIV_Config`
- `FFXIV_Alias`
- `README` (in-sheet quick guide)

---

## Credits
- Market data from Universalis API (please respect their guidelines / rate limits)
- Recipe/item metadata may come from a user-prepared local database (e.g., `xiv.db`).
  This repository does NOT distribute `xiv.db`.
See: ATTRIBUTIONS.md

---

## Cloud deployment (Vercel + Supabase, free tier)
This repo ships a Next.js app under `web/` plus Prisma schema for PostgreSQL. The steps below
describe a minimal free-tier deployment flow using Vercel and Supabase.

### 1) Create a Supabase project (Postgres)
1. Create a new Supabase project and note the database password.
2. In Supabase → Project Settings → Database, copy the connection string.

### 2) Prepare Vercel project
1. Import this repo into Vercel.
2. In the Vercel project settings, set the **Root Directory** to `web/` (or keep `vercel.json`).
3. Add the environment variables:
   - `DATABASE_URL` (from Supabase)
   - `NEXT_PUBLIC_UNIVERSALIS_BASE_URL` (default: `https://universalis.app`)

### 3) Run Prisma migrate + seed (once)
From your local machine (or a CI job), run:
```bash
cd web
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### 4) Deploy
Trigger a Vercel deploy (push to main or manual deploy). The app will build from `web/`.
