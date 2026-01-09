# FFXIV Universalis Price Helper (Template)

A Google Sheets template + container-bound Apps Script that:

* Updates unit prices using Universalis market **listings** (lowest price per unit).
* Supports HQ checkbox logic (HQ-only vs min(HQ, NQ)).
* Writes 7-day price history into a backend sheet for charting.

---

## Quick Start (60 seconds)

1. Open the template link (view-only).
2. **File → Make a copy**
3. In sheet **`calculator`**:

   * Set **`C1`** = World / DC / Region (e.g., `迦樓羅` or `陸行鳥`)
   * (Optional) Set **`C2`** = target item name for trend chart
4. In **`idmappingtableTW`**, confirm mapping:

   * **Col A** = Item Name (ZH)
   * **Col B** = Universalis `itemId`
5. Menu **FFXIV**:

   * **Update: Prices (Full)**
   * **Update: Trend (7d)** (optional)
6. (Optional but recommended) **Install onEdit trigger**

   * Enables “toggle HQ checkbox → refresh only that row” to reduce lag/API calls.

---

## Required Sheets

* `calculator` (front UI)
* `idmappingtableTW` (A = item name (ZH), B = itemId)
* `趨勢圖data` (trend output)

---

## HQ Pricing Logic

* HQ checkbox = **TRUE** → use **HQ min listing**
* HQ checkbox = **FALSE** → use **min(HQ min listing, NQ min listing)**

> Note: If an item has no HQ version, HQ min may be empty. The script falls back accordingly.

---

## Optional Config (if present)

* `FFXIV_Config`
  Adjust cache seconds, listings limit, trend window, downsampling, safety switches.
* `FFXIV_Alias`
  Add DC / WORLD_ID mappings without changing code.

---

## Troubleshooting

* **No price returned**

  * Check `idmappingtableTW` mapping (A name must match the name shown in `calculator`)
  * Watch for extra spaces / full-width spaces / different ZH variants
* **Trigger doesn’t work after copy**

  * Each copy must run **FFXIV → Install onEdit trigger**
* **Too slow / throttled**

  * Increase cache seconds, reduce `LISTINGS_LIMIT`, or reduce trend sampling

---

## Safety / Privacy

* This template contains **no secrets**.
* Do **NOT** hardcode tokens/keys into the sheet or script.
* Every “Make a copy” is independent and will not affect other users’ copies.

---

## Data Credits

* Market listings & sale history: **Universalis API**
* Recipe / item metadata may come from a **user-prepared local database** (e.g., `xiv.db`) and is **not distributed** with this template. See `ATTRIBUTIONS.md`.
