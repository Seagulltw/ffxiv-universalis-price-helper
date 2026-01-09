# FFXIV Universalis 價格助手（Google Sheets + Apps Script）

Google Sheets 範本 + 綁定（container-bound）的 Apps Script，功能包含：
- 透過 Universalis market listings 更新單價（HQ/NQ 邏輯）。
- 將 history 寫入 `趨勢圖data` 供圖表使用。
- 勾選 HQ 時只更新對應單格，降低 API 呼叫與卡頓。

## 必要工作表
- `calculator`：前台 UI
- `idmappingtableTW`：A=物品名稱（繁中/中文），B=Universalis itemId
- `趨勢圖data`：趨勢資料輸出

## HQ 單價規則
- HQ=TRUE：使用 HQ 最低掛單價
- HQ=FALSE：使用 min(HQ 最低掛單, NQ 最低掛單)

## 授權
MIT（或你選擇的授權；以 repo 根目錄 LICENSE 為準）
