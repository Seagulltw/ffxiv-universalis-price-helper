# Changelog / 更新紀錄

> EN: All notable changes to this project will be documented in this file.  
> 中文：本專案所有重要變更都會記錄於此檔案。

> EN: Format based on *Keep a Changelog*.  
> 中文：格式參考 *Keep a Changelog*（依 Added/Changed/Fixed/Removed 分類）。

---

## [Unreleased] / 未發布
### Added / 新增
- 

### Changed / 調整
- 

### Fixed / 修正
- 

### Removed / 移除
- 

---

## [0.1.4] - 2026-01-14
### Added / 新增
- EN: Added “All Materials Flatten” sheet (`攤平全材料 - 自動導入`) and refresh it together with the main price update.  
  中文：加入「攤平全材料」表（`攤平全材料 - 自動導入`），並在主更新時同步刷新。

### Changed / 調整
- EN: Reduced flicker when editing `calculator!C1` / `calculator!C2` by waiting for the item list to stabilize before writing prices.  
  中文：改善編輯 `calculator!C1` / `calculator!C2` 時的閃爍：改為清單穩定後再寫入價格。
- EN: Support price queries by CN/JP servers via World/DC scope resolved from `參數!E:F`.  
  中文：支援中國／日本伺服器查價：World/DC scope 由 `參數!E:F` 解析取得。

### Fixed / 修正
- EN: Fixed missing sub-material pricing formula (column D) issue after refresh.  
  中文：修正更新後子材料 D 欄計價公式消失的問題。
- EN: Fixed liquidity stars; it now writes correctly to `calculator!G2`.  
  中文：修復流動性星星，現在可正確寫入 `calculator!G2`。

---

## [0.1.3] - 2026-01-11
### Changed / 調整
- EN: Fallback to recent sales history when there are no active market listings (limited to the last few hours).  
  中文：市場當下無掛單時，改用近期成交價作為 fallback（仍受限於近幾小時內）。
- EN: Slightly improved stability of auto-refresh when item names change.  
  中文：讓「改名字就更新」的觸發稍微穩定一點。

### Added / 新增
- EN: Added a manual “Update Prices” menu item to reduce frequent manual clicking in the sheet.  
  中文：新增手動更新價格按鈕（選單功能），減少一直手動點選更新的負擔。

---

## [0.1.0] - 2026-01-10
### Fixed / 修正
- EN: Avoided CacheService "Argument too large" by hashing cache keys (MD5) and skipping oversized values.  
  中文：以 MD5 hash 縮短 cache key，並略過過大的 value，避免 CacheService「Argument too large」錯誤。
