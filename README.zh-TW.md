# FFXIV Universalis 價格助手（範本）

這是一份 Google Sheets 範本 + 綁定（container-bound）的 Apps Script，功能包含：

* 從 Universalis 市場 **listings** 抓取「最低單價」並更新單價欄位
* 支援 HQ 勾選邏輯（只看 HQ vs 取 min(HQ, NQ)）
* 將近 7 天價格歷史寫入後台表 `趨勢圖data` 供趨勢圖使用

---
## 範本連結（Google Sheets）

- 範本（只讀）：
  https://docs.google.com/spreadsheets/d/14F5JXRo2ntdVOzyn7vrxh80rQrYJWqJ37GSZdX8B6Sw/

- 一鍵建立副本（最推薦）：
  https://docs.google.com/spreadsheets/d/14F5JXRo2ntdVOzyn7vrxh80rQrYJWqJ37GSZdX8B6Sw/copy

## 60 秒快速開始（最懶人包）

1. 打開範本連結（只讀）
2. **檔案 → 建立副本（Make a copy）**
3. 在 **`calculator`**：

   * `C1` 填 World / DC / Region（例如：`迦樓羅` 或 `陸行鳥`）
   * （可選）`C2` 填你要做趨勢圖的目標物品名稱
4. 確認 **`idmappingtableTW`** 對照正確：

   * A 欄 = 物品名稱（繁中）
   * B 欄 = Universalis 的 `itemId`
5. 選單 **FFXIV**：

   * `更新：單價(全表)`
   * `更新：趨勢(7天)`（可選）
6. （可選但建議）`安裝 onEdit 觸發器`

   * 之後你只要勾 HQ，就會「只更新那一列」單價，不卡、也更省 API

---

## 必要工作表

* `calculator`（前台 UI）
* `idmappingtableTW`（A=物品名稱、B=itemId）
* `趨勢圖data`（趨勢輸出）

---

## HQ 單價規則

* HQ 勾選 = **TRUE** → 使用 **HQ 最低掛單價**
* HQ 勾選 = **FALSE** → 使用 **min(HQ 最低掛單價, NQ 最低掛單價)**

> 備註：若該物品沒有 HQ 版本，HQ 最低價可能為空，腳本會依情況回退處理。

---

## 選配設定（若你有建立/啟用）

* `FFXIV_Config`
  可調整快取秒數、listings 取樣數、趨勢天數/抽樣上限、安全開關等
* `FFXIV_Alias`
  可自行新增 DC / WORLD_ID 對照，不用改程式碼

---

## 常見問題排查

* **抓不到單價**

  * 先確認 `idmappingtableTW` A:B 名稱對得到（注意空格、全形空白、同名不同字）
* **Make a copy 後觸發器沒作用**

  * 每個副本都需要在自己的檔案內再跑一次：`FFXIV → 安裝 onEdit 觸發器`
* **太慢 / 被限流**

  * 把快取時間調長、降低 `LISTINGS_LIMIT`，或降低趨勢抽樣

---

## 安全與隱私

* 本範本 **不包含任何 secrets**
* 請勿在表格或程式碼中硬寫 token / key
* 每個人 Make a copy 都是獨立副本，不會互相影響

---

## 資料來源與致謝

* 市場掛單/成交歷史：**Universalis API**
* 配方/物品等中繼資料可能來自使用者自行準備的本機資料庫（例如 `xiv.db`），本範本/Repo **不提供**該資料庫。詳見 `ATTRIBUTIONS.md`。
