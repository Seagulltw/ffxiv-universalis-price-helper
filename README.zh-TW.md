# FFXIV Universalis 價格助手（Google Sheets + Apps Script）

這是一份 **Google Sheets 範本**（搭配 container-bound Apps Script），用來：
- 依 Universalis market listings 抓 **最低掛單單價**（含 HQ/NQ 規則）
- 將指定物品的 **歷史價格（history）**寫到 `趨勢圖data`，方便直接做趨勢圖
- 支援「勾 HQ 只更新該格單價」的輕量更新，減少卡頓與 API 呼叫

> 本專案不含任何 token / secret；請勿把私密金鑰寫進表格或程式碼。

---

## ✅ 一分鐘懶人包（End users）

### 0) 先複製範本（必做）
1. 打開範本（只讀）：**(https://docs.google.com/spreadsheets/d/1DJsnLF0ntC2CGWQoHAPCVh8GexL-zcHMqdeLxJzvswI/edit?gid=1550631250#gid=1550631250)**
2. Google Sheets：`File → Make a copy`

### 1) 填兩個欄位
在 `calculator`：
- `C1`：輸入 World/DC/Region（例：`迦樓羅` 或 `陸行鳥`）
- `C2`：輸入要畫趨勢圖的物品名稱（繁中/中文）

### 2) 確認 mapping（第一次使用必看）
在 `idmappingtableTW`：
- A 欄：物品名稱（繁中/中文）
- B 欄：Universalis itemId

### 3) 開始使用（選單在上方：FFXIV）
- `FFXIV → 更新：單價(全表)`
- `FFXIV → 更新：趨勢(天數依設定)`

（可選）想要「改 HQ 就自動更新單價」：
- `FFXIV → 安裝 onEdit 觸發器(需授權)`
- ⚠️ 觸發器不會隨 Make a copy 自動存在：每個人自己的 copy 都要自己裝一次

---

## HQ 單價規則
- HQ=TRUE：使用 **HQ 最低掛單價**
- HQ=FALSE：使用 **min(HQ 最低掛單, NQ 最低掛單)**

---

## 必要工作表
- `calculator`：前台 UI
- `idmappingtableTW`：A=名稱、B=itemId
- `趨勢圖data`：趨勢輸出（給圖表用）

## （可選）初始化工作表
如果你想用「不改程式碼也能調參數 / 加 world/DC 對照」：
- `FFXIV → 初始化（建立 Config/Alias/README）`
會建立：
- `FFXIV_Config`：快取秒數、listings limit、趨勢天數等
- `FFXIV_Alias`：DC / WORLD_ID 映射（繁中 → Universalis 用值）
- `README`：表內快速說明

---

## 速查：為什麼抓不到價格？
- `idmappingtableTW` 沒有對應（名稱不一致、空白、或 ID 缺）
- `C1` world/DC 寫錯（可先用 `FFXIV → DEBUG：測 D5 抓價`）
- Universalis 端暫時限流 / 429（稍等或調高快取秒數）

---

## Credits
- 市場資料來自 Universalis API（請尊重其使用規範與 rate limit）
- 配方/物品資料可能來自使用者自行準備的 `xiv.db`（本 repo 不分發資料庫）
詳見：ATTRIBUTIONS.md

---

## 雲端部署（Vercel + Supabase 免費方案）
此專案已提供 `web/` 下的 Next.js 前端與 Prisma schema（PostgreSQL）。以下為最簡化的免費部署流程。

### 1) 建立 Supabase 專案（Postgres）
1. 建立新的 Supabase 專案，記下資料庫密碼。
2. 在 Supabase → Project Settings → Database 複製連線字串。

### 2) 建立 Vercel 專案
1. 將此 repo 匯入 Vercel。
2. 設定 **Root Directory** 為 `web/`（或使用 `vercel.json`）。
3. 設定環境變數：
   - `DATABASE_URL`（Supabase 連線字串）
   - `NEXT_PUBLIC_UNIVERSALIS_BASE_URL`（預設 `https://universalis.app`）

### 3) 初始化資料庫（一次性）
在本機或 CI 執行：
```bash
cd web
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### 4) 部署
推送程式碼或手動觸發 Vercel 部署即可。
