/************************************************************
 * FFXIV Universalis Price Helper (Final Integrated)
 *
 * ✅ C1/C2 變更：自動全更新（主表單價 + 攤平表單價 + 趨勢）
 * ✅ HQ 勾選：只更新被勾到的單格（快速）
 * ✅ C1 下拉來源=參數!E2:E，script 以 E 找 F
 *    - F 可為 worldId(數字) 或 DC name(例如 Gaia)
 * ✅ onEdit 偶發不觸發：加 onChange(EDIT) 保險補跑
 * ✅ Cache key 過大：用 MD5 hash；cache.put value 過大則跳過快取
 ************************************************************/

/***********************
 * 固定設定（依你目前版面）
 ***********************/
const FRONT_SHEET_NAME = 'calculator';
const MAP_SHEET_NAME   = 'idmappingtableTW';
const BACK_SHEET_NAME  = '趨勢圖data';

// 攤平表
const FLAT_SHEET_NAME  = '攤平全材料 - 自動導入';

// 參數表：E=顯示名稱（C1下拉值），F=scope（worldId 或 DC 字串）
const PARAM_SHEET_NAME = '參數';
const PARAM_WORLD_NAME_COL = 5; // E
const PARAM_WORLD_SCOPE_COL = 6; // F
const PARAM_WORLD_START_ROW = 2;

const WORLD_CELL  = 'C1';
const TARGET_CELL = 'C2';

const LIST_START_ROW = 5;
const LIST_END_ROW   = 17; // 5..17 共13列

// HQ / 名稱 / 單價欄位（依你 layout）
// 主：  C D E F G => HQ=C(3), 名稱=D(4), 單價=F(6)
const BLOCKS = [
  { key: 'MAIN', hqCol: 3,  itemCol: 4,  priceCol: 6  },  // C D F
  { key: 'A',    hqCol: 10, itemCol: 11, priceCol: 13 }, // J K M
  { key: 'B',    hqCol: 17, itemCol: 18, priceCol: 20 }, // Q R T
  { key: 'C',    hqCol: 24, itemCol: 25, priceCol: 27 }, // X Y AA
  { key: 'D',    hqCol: 31, itemCol: 32, priceCol: 34 }, // AE AF AH
  { key: 'E',    hqCol: 38, itemCol: 39, priceCol: 41 }, // AL AM AO
];

// 流動性星星要寫入的位置
const LIQ_CELL = 'G2';

// 星星門檻：沿用你貼的
function liquidityStars_(v) {
  if (v >= 17) return '⭐⭐⭐⭐⭐';
  if (v >= 10)  return '⭐⭐⭐⭐';
  if (v >= 5)  return '⭐⭐⭐';
  if (v >= 1) return '⭐⭐';
  return '⭐';
}

/**
 * 用 history 計算「速度」(velocity)：平均每天成交筆數
 * - 若有 HQ 成交：用 HQ count/days
 * - 若沒有 HQ 成交（常見於無HQ物品）：用 total count/days
 * - days 用 cfg.days（觀測窗），避免單筆且時間差很小造成暴衝
 */
function computeVelocityFromHistory_(hist, days) {
  const d = Math.max(1, Number(days) || 1);

  const totalCount = Array.isArray(hist) ? hist.length : 0;
  const hqCount = Array.isArray(hist) ? hist.filter(x => !!x.hq).length : 0;

  // 有 HQ 紀錄就用 HQ，不然用總成交（讓無 HQ 版本也能合理評分）
  const usedCount = (hqCount > 0) ? hqCount : totalCount;
  const vel = usedCount / d;

  return { vel, usedCount, hqCount, totalCount, days: d };
}

/***********************
 * Default config
 ***********************/
const DEFAULT_CONFIG = {
  ALLOW_EXTERNAL_FETCH: 'TRUE',

  CACHE_SECONDS_MARKET: '6',    // market compact cache
  CACHE_SECONDS_HIS_FB: '10',   // history fallback compact cache
  CACHE_SECONDS_HIS:    '15',   // trend history

  LISTINGS_LIMIT: '50',

  // batching（太大容易 504；太小則慢）
  MARKET_BATCH_SIZE: '40',      // 建議 30~60
  HISTORY_BATCH_SIZE: '80',     // up to 100
  REQUEST_PAUSE_MS:  '60',

  // retry
  RETRY_MAX_ATTEMPTS: '4',
  RETRY_BASE_MS:      '300',

  // history fallback window
  HISTORY_FALLBACK_HOURS: '72',

  // trend
  DAYS: '7',
  MAX_TREND_ROWS_TOTAL: '2500',
  MAX_TREND_PER_DAY: '250',
};

/***********************
 * Menu
 ***********************/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('FFXIV')
    .addItem('更新：單價(全表+攤平)', 'updatePricesNow')
    .addItem('更新：趨勢(天數依設定)', 'updateTrendNow')
    .addSeparator()
    .addItem('安裝 triggers（onEdit+onChange保險）', 'setupTriggers')
    .addItem('移除 triggers', 'removeTriggers')
    .addItem('診斷：trigger狀態/最後觸發', 'diagnoseTriggers')
    .addToUi();
}

/***********************
 * Trigger install/remove/diagnose
 ***********************/
function setupTriggers() {
  removeTriggers();

  const ss = SpreadsheetApp.getActive();

  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // 保險：有時 onEdit 偶發沒觸發，onChange(EDIT) 仍會觸發
  ScriptApp.newTrigger('onChangeInstalled')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  PropertiesService.getDocumentProperties().setProperty('TRIGGER_INSTALLED_AT', new Date().toISOString());
  SpreadsheetApp.getActive().toast('Triggers installed ✅ (onEdit + onChange)', 'FFXIV', 6);
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const fn = t.getHandlerFunction();
    if (fn === 'onEditInstalled' || fn === 'onChangeInstalled') ScriptApp.deleteTrigger(t);
  }
}

function diagnoseTriggers() {
  const ts = ScriptApp.getProjectTriggers()
    .filter(t => ['onEditInstalled', 'onChangeInstalled'].includes(t.getHandlerFunction()))
    .map(t => `${t.getHandlerFunction()} / ${t.getEventType()}`);

  const props = PropertiesService.getDocumentProperties();
  const lastEdit = props.getProperty('LAST_ONEDIT_AT') || '(none)';
  const lastChg  = props.getProperty('LAST_ONCHANGE_AT') || '(none)';
  const lastFull = props.getProperty('LAST_FULLRUN_AT') || '(none)';

  SpreadsheetApp.getActive().toast(
    `Triggers: ${ts.length ? ts.join(', ') : 'NOT FOUND'} | onEdit=${lastEdit} | onChange=${lastChg} | fullRun=${lastFull}`,
    'FFXIV',
    10
  );
}

/***********************
 * Installed triggers
 ***********************/
function onEditInstalled(e) {
  const lock = LockService.getDocumentLock();
  try {
    if (!e || !e.range || !e.source) return;
    PropertiesService.getDocumentProperties().setProperty('LAST_ONEDIT_AT', new Date().toISOString());

    const sh = e.range.getSheet();
    if (!sh || sh.getName() !== FRONT_SHEET_NAME) return;

    // ✅ 不要 tryLock 丟事件；改 waitLock
    lock.waitLock(20000);

    const ss = e.source;
    const front = ss.getSheetByName(FRONT_SHEET_NAME);
    if (!front) return;

    const r1 = e.range.getRow();
    const r2 = r1 + e.range.getNumRows() - 1;
    const c1 = e.range.getColumn();
    const c2 = c1 + e.range.getNumColumns() - 1;

    const touchedWorld  = rangeIntersectsA1_(front, r1, r2, c1, c2, WORLD_CELL);
    const touchedTarget = rangeIntersectsA1_(front, r1, r2, c1, c2, TARGET_CELL);

    if (touchedWorld || touchedTarget) {
      runFullRefresh_(ss, 'onEdit:C1/C2');
      return;
    }

    // HQ checkbox edits => fast path
    const targets = detectHQEdits_(r1, r2, c1, c2);
    if (targets.length === 0) return;

    updateSinglePrices_(ss, targets);
  } catch (err) {
    Logger.log('[onEditInstalled] %s', err && err.stack ? err.stack : err);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// 保險：若 onEdit 偶發沒跑，onChange(EDIT) 仍可抓到 C1/C2 變更
function onChangeInstalled(e) {
  const lock = LockService.getDocumentLock();
  try {
    PropertiesService.getDocumentProperties().setProperty('LAST_ONCHANGE_AT', new Date().toISOString());

    // 只處理 EDIT 類型（避免插入列/刪欄造成亂跑）
    if (e && e.changeType && String(e.changeType).toUpperCase() !== 'EDIT') return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const front = ss.getSheetByName(FRONT_SHEET_NAME);
    if (!front) return;

    const props = PropertiesService.getDocumentProperties();
    const now = Date.now();
    const lastFullMs = Number(props.getProperty('LAST_FULLRUN_MS') || '0');
    if (now - lastFullMs < 1200) return; // 避免 onEdit 已經跑完又被 onChange 重複跑

    const rawC1 = String(front.getRange(WORLD_CELL).getDisplayValue() || '').trim();
    const rawC2 = String(front.getRange(TARGET_CELL).getDisplayValue() || '').trim();

    const lastC1 = props.getProperty('LAST_SEEN_C1') || '';
    const lastC2 = props.getProperty('LAST_SEEN_C2') || '';

    // 若 C1/C2 沒變，就不做事（避免 onChange 太吵）
    if (rawC1 === lastC1 && rawC2 === lastC2) return;

    lock.waitLock(20000);
    runFullRefresh_(ss, 'onChange:guard');
  } catch (err) {
    Logger.log('[onChangeInstalled] %s', err && err.stack ? err.stack : err);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/***********************
 * Manual actions
 ***********************/
function updatePricesNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  if (front) waitForStableFrontList_(front, { maxMs: 7000, stableHitsNeeded: 2, sleepMs: 250 });
  runFullRefresh_(ss, 'manual:updatePricesNow');
}

function updateTrendNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateTrendData_(ss);
}

/***********************
 * Full refresh pipeline (C1/C2 change)
 * - reset HQ defaults (only keep C5=TRUE)
 * - wait formulas ready
 * - update main prices
 * - update flat prices (same run)
 * - update trend
 ***********************/
function runFullRefresh_(ss, reason) {
  const props = PropertiesService.getDocumentProperties();
  props.setProperty('LAST_FULLRUN_AT', new Date().toISOString());
  props.setProperty('LAST_FULLRUN_REASON', String(reason || ''));
  props.setProperty('LAST_FULLRUN_MS', String(Date.now()));

  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  if (front) {
    // 記住最新 C1/C2（給 onChange guard）
    props.setProperty('LAST_SEEN_C1', String(front.getRange(WORLD_CELL).getDisplayValue() || '').trim());
    props.setProperty('LAST_SEEN_C2', String(front.getRange(TARGET_CELL).getDisplayValue() || '').trim());

    resetHQDefaults_(front, { clearPrices: false });
    SpreadsheetApp.flush();

    // ✅ 改成等整段清單穩定（避免價格錯位）
    waitForStableFrontList_(front, { maxMs: 7000, stableHitsNeeded: 2, sleepMs: 250 });

    // 再 flush 一次，確保最後狀態
    SpreadsheetApp.flush();
  }

  updateAllPrices_(ss);
  updateFlatRecipePrices_(ss);
  updateTrendData_(ss);
}

/***********************
 * Config
 ***********************/
function getConfig_() {
  const props = PropertiesService.getDocumentProperties();
  const out = {};
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    out[k] = (props.getProperty(k) != null) ? props.getProperty(k) : DEFAULT_CONFIG[k];
  }
  return {
    allowExternalFetch: String(out.ALLOW_EXTERNAL_FETCH).toUpperCase() === 'TRUE',
    cacheMarket: toInt_(out.CACHE_SECONDS_MARKET, 6),
    cacheHisFb: toInt_(out.CACHE_SECONDS_HIS_FB, 10),
    cacheHis: toInt_(out.CACHE_SECONDS_HIS, 15),
    listingsLimit: toInt_(out.LISTINGS_LIMIT, 50),
    marketBatchSize: toInt_(out.MARKET_BATCH_SIZE, 40),
    historyBatchSize: Math.min(100, toInt_(out.HISTORY_BATCH_SIZE, 80)),
    requestPauseMs: toInt_(out.REQUEST_PAUSE_MS, 60),
    retryMaxAttempts: toInt_(out.RETRY_MAX_ATTEMPTS, 4),
    retryBaseMs: toInt_(out.RETRY_BASE_MS, 300),
    historyFallbackHours: toInt_(out.HISTORY_FALLBACK_HOURS, 72),
    days: toInt_(out.DAYS, 7),
    maxTrendRowsTotal: toInt_(out.MAX_TREND_ROWS_TOTAL, 2500),
    maxTrendPerDay: toInt_(out.MAX_TREND_PER_DAY, 250),
  };
}

function toInt_(v, fallback) {
  const n = parseInt(String(v || '').trim(), 10);
  return isFinite(n) ? n : fallback;
}

/***********************
 * 參數!E:F mapping（E=dropdown name, F=scope worldId/DC）
 ***********************/
function loadScopeMapFromParams_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(PARAM_SHEET_NAME);
  if (!sh) return {};

  const last = sh.getLastRow();
  if (last < PARAM_WORLD_START_ROW) return {};

  const vals = sh.getRange(
    PARAM_WORLD_START_ROW,
    PARAM_WORLD_NAME_COL,
    last - PARAM_WORLD_START_ROW + 1,
    2
  ).getDisplayValues();

  const map = {};
  for (const [name, scope] of vals) {
    const n = String(name || '').trim();
    const s = String(scope || '').trim();
    if (n && s && map[n] == null) map[n] = s;
  }
  return map;
}
function snapshotFrontItemNames_(front) {
  const rowCount = LIST_END_ROW - LIST_START_ROW + 1;
  const parts = [];
  for (const b of BLOCKS) {
    const v = front.getRange(LIST_START_ROW, b.itemCol, rowCount, 1).getDisplayValues();
    // 用 \u0001 分隔避免碰到正常字元
    parts.push(v.map(r => String(r[0] || '').trim()).join('\u0001'));
  }
  return parts.join('\u0002'); // block 分隔
}

/**
 * 等待清單穩定：同一份快照連續一致 N 次才放行
 */
function waitForStableFrontList_(front, opts) {
  const maxMs = (opts && opts.maxMs) || 6000;
  const stableHitsNeeded = (opts && opts.stableHitsNeeded) || 2; // 連續一致 2 次
  const sleepMs = (opts && opts.sleepMs) || 250;

  const start = Date.now();
  let last = '';
  let hits = 0;

  while (Date.now() - start < maxMs) {
    SpreadsheetApp.flush();
    const snap = snapshotFrontItemNames_(front);

    // 空白快照通常代表還在算，不算穩定
    const hasAny = snap.replace(/\u0001|\u0002/g, '').trim().length > 0;

    if (hasAny && snap === last) {
      hits++;
      if (hits >= stableHitsNeeded) return true;
    } else {
      hits = 0;
      last = snap;
    }
    Utilities.sleep(sleepMs);
  }
  return false; // 超時也不要卡死，後面仍會跑，只是比較可能寫錯位
}

function normalizeScope_(scopeRaw) {
  const s = String(scopeRaw || '').trim();
  if (!s) return '';

  // ✅ 先用 參數!E:F 映射：E(下拉文字) -> F(scope)
  const m = loadScopeMapFromParams_();
  if (m[s]) return String(m[s]).trim(); // F 可以是 worldId 或 Gaia

  // 如果你直接在 C1 輸入 worldId / Gaia 也放行
  return s;
}

/***********************
 * reset HQ + clear prices
 ***********************/
function resetHQDefaults_(front, opt) {
  const rows = LIST_END_ROW - LIST_START_ROW + 1;
  for (const b of BLOCKS) {
    front.getRange(LIST_START_ROW, b.hqCol, rows, 1).setValues(
      Array.from({ length: rows }, () => [false])
    );
  }
  front.getRange(LIST_START_ROW, BLOCKS[0].hqCol).setValue(true); // only keep C5

  // ✅ 只有在 template cleanup 才清單價；平常更新不清，避免閃爍
  if (opt && opt.clearPrices) clearPriceCols_(front);
}


/***********************
 * mapping table A=名稱, B=ID
 ***********************/
function buildNameToIdMap_(mapSh) {
  const last = mapSh.getLastRow();
  if (last < 1) return {};
  const vals = mapSh.getRange(1, 1, last, 2).getDisplayValues();
  const map = {};
  for (const [name, id] of vals) {
    const n = normalizeName_(name);
    const i = String(id || '').trim();
    if (n && i && map[n] == null) map[n] = i;
  }
  return map;
}

function normalizeName_(s) {
  return String(s || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/***********************
 * HQ checkbox edit detect
 ***********************/
function detectHQEdits_(r1, r2, c1, c2) {
  const out = [];
  const rowLo = Math.max(LIST_START_ROW, r1);
  const rowHi = Math.min(LIST_END_ROW, r2);
  if (rowLo > rowHi) return out;

  for (let bi = 0; bi < BLOCKS.length; bi++) {
    const hqCol = BLOCKS[bi].hqCol;
    if (hqCol < c1 || hqCol > c2) continue;
    for (let r = rowLo; r <= rowHi; r++) out.push({ row: r, blockIndex: bi });
  }
  return out;
}

function rangeIntersectsA1_(sheet, r1, r2, c1, c2, a1) {
  const rg = sheet.getRange(a1);
  const rr = rg.getRow();
  const cc = rg.getColumn();
  return (rr >= r1 && rr <= r2 && cc >= c1 && cc <= c2);
}

/***********************
 * Price strategy
 ***********************/
function computePriceByHQ_(obj, isHQ) {
  const h = (obj?.hqMin == null ? null : Number(obj.hqMin));
  const n = (obj?.nqMin == null ? null : Number(obj.nqMin));
  const okH = (h != null && isFinite(h));
  const okN = (n != null && isFinite(n));

  if (isHQ) return okH ? h : null;

  if (!okH && !okN) return null;
  if (okH && !okN) return h;
  if (!okH && okN) return n;
  return Math.min(h, n);
}

function computePriceFromHistoryByHQ_(obj, isHQ) {
  const h = (obj?.hqLast == null ? null : Number(obj.hqLast));
  const n = (obj?.nqLast == null ? null : Number(obj.nqLast));
  const okH = (h != null && isFinite(h));
  const okN = (n != null && isFinite(n));

  if (isHQ) return okH ? h : null;

  if (!okH && !okN) return null;
  if (okH && !okN) return h;
  if (!okH && okN) return n;
  return Math.min(h, n);
}

/***********************
 * Update all prices (main calculator blocks)
 * - market first
 * - fallback history latest sale (if market missing/null)
 ***********************/
function updateAllPrices_(ss) {
  const cfg = getConfig_();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  if (!front || !mapSh) return;

  const scope = normalizeScope_(front.getRange(WORLD_CELL).getDisplayValue());
  if (!scope) return;

  const nameToId = buildNameToIdMap_(mapSh);
  const rowCount = LIST_END_ROW - LIST_START_ROW + 1;

  const idSet = new Set();
  const blockNames = [];
  const blockHQs = [];

  for (const b of BLOCKS) {
    const names = front.getRange(LIST_START_ROW, b.itemCol, rowCount, 1)
      .getDisplayValues().map(r => normalizeName_(r[0]));
    const hqs = front.getRange(LIST_START_ROW, b.hqCol, rowCount, 1)
      .getValues().map(r => !!r[0]);

    blockNames.push(names);
    blockHQs.push(hqs);

    for (const n of names) {
      if (!n) continue;
      const id = String(nameToId[n] || '').trim();
      if (id) idSet.add(id);
    }
  }

  const ids = Array.from(idSet);
  if (ids.length === 0) return;

  const marketById = fetchMinListingsFromMarket_(scope, ids, cfg);

  const perBlockMeta = [];
  const needHistoryIdSet = new Set();

  for (let bi = 0; bi < BLOCKS.length; bi++) {
    const b = BLOCKS[bi];
    const names = blockNames[bi];
    const hqs = blockHQs[bi];

    const oldPrices = front.getRange(LIST_START_ROW, b.priceCol, rowCount, 1).getValues();

    const metaRows = [];
    const outVals = [];

    for (let i = 0; i < rowCount; i++) {
      const name = names[i];
      const isHQ = !!hqs[i];

      if (!name) { metaRows.push({ id:'', isHQ, needHistory:false }); outVals.push(['']); continue; }

      const id = String(nameToId[name] || '').trim();
      if (!id) { metaRows.push({ id:'', isHQ, needHistory:false }); outVals.push(['']); continue; }

      const hasMarket = Object.prototype.hasOwnProperty.call(marketById, id);
      if (!hasMarket) {
        metaRows.push({ id, isHQ, needHistory:true });
        needHistoryIdSet.add(id);
        outVals.push([oldPrices[i][0]]);
        continue;
      }

      const price = computePriceByHQ_(marketById[id] || {}, isHQ);
      if (price == null) {
        metaRows.push({ id, isHQ, needHistory:true });
        needHistoryIdSet.add(id);
        outVals.push([oldPrices[i][0]]);
      } else {
        metaRows.push({ id, isHQ, needHistory:false });
        outVals.push([Math.ceil(price)]);
      }
    }

    perBlockMeta.push({ b, oldPrices, metaRows, outVals });
  }

  let hisById = {};
  const needHistoryIds = Array.from(needHistoryIdSet);
  if (needHistoryIds.length) {
    hisById = fetchLastSoldFromHistory_(scope, needHistoryIds, cfg);
  }

  for (const pack of perBlockMeta) {
    const { b, oldPrices, metaRows, outVals } = pack;

    for (let i = 0; i < outVals.length; i++) {
      const m = metaRows[i];
      if (!m.needHistory) continue;

      const id = m.id;
      if (!id) continue;

      if (Object.prototype.hasOwnProperty.call(hisById, id)) {
        const p = computePriceFromHistoryByHQ_(hisById[id] || {}, m.isHQ);
        if (p != null) outVals[i][0] = Math.ceil(p);
        else outVals[i][0] = oldPrices[i][0];
      } else {
        outVals[i][0] = oldPrices[i][0];
      }
    }

    front.getRange(LIST_START_ROW, b.priceCol, rowCount, 1).setValues(outVals);
  }
}




/***********************
 * Update single prices (HQ checkbox)
 ***********************/
function updateSinglePrices_(ss, targets) {
  const cfg = getConfig_();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  if (!front || !mapSh) return;

  const scope = normalizeScope_(front.getRange(WORLD_CELL).getDisplayValue());
  if (!scope) return;

  const nameToId = buildNameToIdMap_(mapSh);

  const need = [];
  const idSet = new Set();

  for (const t of targets) {
    const b = BLOCKS[t.blockIndex];
    const name = normalizeName_(front.getRange(t.row, b.itemCol).getDisplayValue() || '');
    if (!name) continue;

    const id = String(nameToId[name] || '').trim();
    if (!id) continue;

    const isHQ = !!front.getRange(t.row, b.hqCol).getValue();
    need.push({ row: t.row, b, id, isHQ });
    idSet.add(id);
  }

  const ids = Array.from(idSet);
  if (!ids.length) return;

  const marketById = fetchMinListingsFromMarket_(scope, ids, cfg);

  const needHis = new Set();
  for (const x of need) {
    const hasMarket = Object.prototype.hasOwnProperty.call(marketById, x.id);
    if (!hasMarket) { needHis.add(x.id); continue; }
    const p = computePriceByHQ_(marketById[x.id] || {}, x.isHQ);
    if (p == null) needHis.add(x.id);
  }

  const hisById = needHis.size ? fetchLastSoldFromHistory_(scope, Array.from(needHis), cfg) : {};

  for (const x of need) {
    const oldVal = front.getRange(x.row, x.b.priceCol).getValue();

    if (Object.prototype.hasOwnProperty.call(marketById, x.id)) {
      const pMarket = computePriceByHQ_(marketById[x.id] || {}, x.isHQ);
      if (pMarket != null) {
        front.getRange(x.row, x.b.priceCol).setValue(Math.ceil(pMarket));
        continue;
      }
    }

    if (Object.prototype.hasOwnProperty.call(hisById, x.id)) {
      const pHis = computePriceFromHistoryByHQ_(hisById[x.id] || {}, x.isHQ);
      if (pHis != null) front.getRange(x.row, x.b.priceCol).setValue(Math.ceil(pHis));
      else front.getRange(x.row, x.b.priceCol).setValue(oldVal);
    } else {
      front.getRange(x.row, x.b.priceCol).setValue(oldVal);
    }
  }
}

/***********************
 * 攤平表：單價跟主功能同時更新
 * 讀 A:G 表頭自動找 HQ/物品名稱/單價，找不到則 fallback A/B/D
 ***********************/
// ✅ 你攤平表 sheet 名稱（請確認完全一致）

// 攤平表固定 layout（跟 calculator 一樣：HQ=C, 名稱=D, 單價=F）
const FLAT_LIST_START_ROW = 5;  // 想只抓材料就改 6
const FLAT_LIST_END_ROW   = 17;
const FLAT_HQ_COL   = 3;  // C
const FLAT_ITEM_COL = 4;  // D
const FLAT_PRICE_COL= 6;  // F

function updateFlatRecipePrices_(ss) {
  const cfg = getConfig_();

  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  const flat  = ss.getSheetByName(FLAT_SHEET_NAME);
  if (!front || !mapSh || !flat) return;

  const scope = normalizeScope_(front.getRange(WORLD_CELL).getDisplayValue());
  if (!scope) return;

  const nameToId = buildNameToIdMap_(mapSh);

  const rowCount = FLAT_LIST_END_ROW - FLAT_LIST_START_ROW + 1;
  const names = flat.getRange(FLAT_LIST_START_ROW, FLAT_ITEM_COL, rowCount, 1)
    .getDisplayValues().map(r => normalizeName_(r[0]));
  const hqs = flat.getRange(FLAT_LIST_START_ROW, FLAT_HQ_COL, rowCount, 1)
    .getValues().map(r => !!r[0]);

  const rowMeta = new Array(rowCount);
  const idSet = new Set();

  for (let i = 0; i < rowCount; i++) {
    const n = names[i];
    if (!n) { rowMeta[i] = { id: '', isHQ: hqs[i] }; continue; }
    const id = String(nameToId[n] || '').trim();
    rowMeta[i] = { id, isHQ: hqs[i] };
    if (id) idSet.add(id);
  }

  const ids = Array.from(idSet);
  if (!ids.length) return;

  const marketById = fetchMinListingsFromMarket_(scope, ids, cfg);

  // ✅ 不保留舊值：抓不到就改抓 history，再不行就空白（避免看起來像照搬）
  const out = Array.from({ length: rowCount }, () => ['']);
  const needHistory = new Set();

  for (let i = 0; i < rowCount; i++) {
    const { id, isHQ } = rowMeta[i];
    if (!id) continue;

    const m = marketById[id];
    const p = computePriceByHQ_(m || {}, isHQ);
    if (p == null) needHistory.add(id);
    else out[i][0] = Math.ceil(p);
  }

  if (needHistory.size) {
    const hisById = fetchLastSoldFromHistory_(scope, Array.from(needHistory), cfg);
    for (let i = 0; i < rowCount; i++) {
      const { id, isHQ } = rowMeta[i];
      if (!id || !needHistory.has(id)) continue;
      const p2 = computePriceFromHistoryByHQ_(hisById[id] || {}, isHQ);
      if (p2 != null) out[i][0] = Math.ceil(p2);
    }
  }

  flat.getRange(FLAT_LIST_START_ROW, FLAT_PRICE_COL, rowCount, 1).setValues(out);
}


/***********************
 * market(listings) batch + compact cache
 ***********************/
function fetchMinListingsFromMarket_(scope, ids, cfg) {
  const out = {};
  if (!cfg.allowExternalFetch) return out;

  const cache = CacheService.getDocumentCache();
  const chunks = chunkArray_(ids, Math.max(1, cfg.marketBatchSize));

  for (const batch of chunks) {
    const url =
      "https://universalis.app/api/v2/" +
      encodeURIComponent(scope) + "/" +
      batch.map(x => encodeURIComponent(String(x))).join(",") +
      "?listings=" + cfg.listingsLimit +
      "&entries=0";

    const cacheKey = cacheKeyFromUrl_('m_', url);
    const cached = cache.get(cacheKey);
    if (cached) {
      try { Object.assign(out, JSON.parse(cached)); } catch (_) {}
      continue;
    }

    const txt = fetchTextWithRetry_(url, cfg);
    if (!txt) continue;

    try {
      const data = JSON.parse(txt);
      const compact = extractMinMapFromMarketMulti_(data);
      safeCachePut_(cache, cacheKey, JSON.stringify(compact), cfg.cacheMarket);
      Object.assign(out, compact);
    } catch (err) {
      Logger.log('[market] parse fail url=%s err=%s', url, err);
    }

    if (cfg.requestPauseMs > 0) Utilities.sleep(cfg.requestPauseMs);
  }

  return out;
}

function extractMinMapFromMarketMulti_(data) {
  const out = {};

  // single
  if (data && (data.itemId != null || data.itemID != null) && Array.isArray(data.listings)) {
    const id = String(data.itemId ?? data.itemID ?? '');
    if (id) out[id] = extractMinFromListings_(data.listings);
    return out;
  }

  const items = data?.items;
  if (!items) return out;

  const ingestOne = (it) => {
    const id = String(it?.itemId ?? it?.itemID ?? '');
    if (!id) return;
    out[id] = extractMinFromListings_(it?.listings || []);
  };

  if (Array.isArray(items)) {
    for (const it of items) ingestOne(it);
  } else if (typeof items === 'object') {
    for (const k of Object.keys(items)) ingestOne(items[k]);
  }
  return out;
}

function extractMinFromListings_(listings) {
  let hqMin = null, nqMin = null;
  for (const l of (Array.isArray(listings) ? listings : [])) {
    const p = Number(l?.pricePerUnit);
    if (!isFinite(p)) continue;
    if (!!l?.hq) hqMin = (hqMin == null) ? p : Math.min(hqMin, p);
    else nqMin = (nqMin == null) ? p : Math.min(nqMin, p);
  }
  return { hqMin, nqMin };
}

/***********************
 * history fallback (latest sale) batch + compact cache
 ***********************/
function fetchLastSoldFromHistory_(scope, ids, cfg) {
  const out = {};
  if (!cfg.allowExternalFetch) return out;

  const cache = CacheService.getDocumentCache();
  const batchSize = Math.max(1, Math.min(100, cfg.historyBatchSize));
  const chunks = chunkArray_(ids, batchSize);

  const seconds = Math.max(1, cfg.historyFallbackHours) * 3600;

  for (const batch of chunks) {
    const url =
      "https://universalis.app/api/v2/history/" +
      encodeURIComponent(scope) + "/" +
      batch.map(x => encodeURIComponent(String(x))).join(",") +
      "?entriesWithin=" + seconds;

    const cacheKey = cacheKeyFromUrl_('h_', url);
    const cached = cache.get(cacheKey);
    if (cached) {
      try { Object.assign(out, JSON.parse(cached)); } catch (_) {}
      continue;
    }

    const txt = fetchTextWithRetry_(url, cfg);
    if (!txt) continue;

    try {
      const data = JSON.parse(txt);
      const compact = extractLastMapFromHistoryMulti_(data);
      safeCachePut_(cache, cacheKey, JSON.stringify(compact), cfg.cacheHisFb);
      Object.assign(out, compact);
    } catch (err) {
      Logger.log('[his-fb] parse fail url=%s err=%s', url, err);
    }

    if (cfg.requestPauseMs > 0) Utilities.sleep(cfg.requestPauseMs);
  }

  return out;
}

function extractLastMapFromHistoryMulti_(data) {
  const out = {};

  // single
  if (data && (data.itemId != null || data.itemID != null)) {
    const id = String(data.itemId ?? data.itemID ?? '');
    const entries = data?.recentHistory || data?.entries || [];
    if (id) out[id] = extractLastFromHistoryEntries_(entries);
    return out;
  }

  const items = data?.items || data?.results;
  if (!items) return out;

  const ingestOne = (it) => {
    const id = String(it?.itemId ?? it?.itemID ?? '');
    if (!id) return;
    const entries = it?.recentHistory || it?.entries || [];
    out[id] = extractLastFromHistoryEntries_(entries);
  };

  if (Array.isArray(items)) {
    for (const it of items) ingestOne(it);
  } else if (typeof items === 'object') {
    for (const k of Object.keys(items)) ingestOne(items[k]);
  }

  return out;
}

function extractLastFromHistoryEntries_(entries) {
  let hqLast = null, hqTs = -1;
  let nqLast = null, nqTs = -1;

  const arr = Array.isArray(entries) ? entries : [];
  for (const s of arr) {
    let ts = s?.timestamp ?? s?.timestampMs ?? s?.time;
    ts = Number(ts);
    if (!isFinite(ts)) continue;
    const tsMs = ts < 1e12 ? ts * 1000 : ts;

    const price = Number(s?.pricePerUnit ?? s?.price);
    if (!isFinite(price)) continue;

    if (!!s?.hq) {
      if (tsMs > hqTs) { hqTs = tsMs; hqLast = price; }
    } else {
      if (tsMs > nqTs) { nqTs = tsMs; nqLast = price; }
    }
  }

  return { hqLast, nqLast };
}

/***********************
 * Trend
 ***********************/
function updateTrendData_(ss) {
  const cfg = getConfig_();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  if (!front || !mapSh) return;

  const scope = normalizeScope_(front.getRange(WORLD_CELL).getDisplayValue());
  const itemName = normalizeName_(front.getRange(TARGET_CELL).getDisplayValue() || '');

  // 沒有 target：清掉趨勢 + 清掉流動性
  if (!scope || !itemName) {
    front.getRange(LIQ_CELL).clearContent();
    writeTrend_(ss, [], { scope, itemName, itemId: '' });
    return;
  }

  const nameToId = buildNameToIdMap_(mapSh);
  const itemId = String(nameToId[itemName] || '').trim();

  if (!itemId || !cfg.allowExternalFetch) {
    front.getRange(LIQ_CELL).clearContent();
    writeTrend_(ss, [], { scope, itemName, itemId: itemId || '' });
    return;
  }

  const seconds = cfg.days * 86400;
  const url = "https://universalis.app/api/v2/history/" +
    encodeURIComponent(scope) + "/" +
    encodeURIComponent(itemId) +
    "?entriesWithin=" + seconds;

  const data = fetchJsonWithRetry_(url, cfg.cacheHis, cfg);

  // ✅ 先用「原始 history」算流動性（不要 downsample）
  const rawHist = normalizeHistory_(data);
  rawHist.sort((a, b) => a.timestampMs - b.timestampMs);

  const liq = computeVelocityFromHistory_(rawHist, cfg.days);
  // 沒資料就清，避免顯示錯誤星星
  if (!rawHist.length) front.getRange(LIQ_CELL).clearContent();
  else front.getRange(LIQ_CELL).setValue(liquidityStars_(liq.vel));

  // ✅ 再拿 rawHist 去做 downsample & 寫趨勢表
  let hist = rawHist;
  hist = downsampleHistoryByDay_(hist, cfg.maxTrendPerDay);

  if (hist.length > cfg.maxTrendRowsTotal) {
    const step = Math.ceil(hist.length / cfg.maxTrendRowsTotal);
    const slim = [];
    for (let i = 0; i < hist.length; i += step) slim.push(hist[i]);
    hist = slim;
  }

  writeTrend_(ss, hist, { scope, itemName, itemId });
}


function fetchJsonWithRetry_(url, cacheSeconds, cfg) {
  if (!cfg || !cfg.allowExternalFetch) return {};
  const cache = CacheService.getDocumentCache();
  const key = cacheKeyFromUrl_('u_', url);
  const cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const txt = fetchTextWithRetry_(url, cfg);
  if (!txt) return {};
  try {
    const obj = JSON.parse(txt);
    safeCachePut_(cache, key, JSON.stringify(obj), cacheSeconds);
    return obj;
  } catch (_) {
    return {};
  }
}

function fetchTextWithRetry_(url, cfg) {
  if (!cfg.allowExternalFetch) return '';

  const b = Math.max(50, Number(cfg.retryBaseMs || 300));
  const waits = [b, b * 3, b * 6, b * 9].slice(0, Math.max(1, cfg.retryMaxAttempts || 4));

  for (let i = 0; i < waits.length; i++) {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'FFXIV-Price-Helper(GAS)' },
    });
    const code = res.getResponseCode();
    const body = res.getContentText();

    if (code === 200) return body;

    if (code === 429 || code === 504 || (code >= 500 && code <= 599)) {
      Utilities.sleep(waits[i]);
      continue;
    }

    Logger.log('[fetch] code=%s url=%s body=%s', code, url, body.slice(0, 200));
    return '';
  }
  return '';
}

function normalizeHistory_(data) {
  let hist =
    data?.recentHistory ||
    data?.entries ||
    (Array.isArray(data?.results) && (data.results[0]?.recentHistory || data.results[0]?.entries)) ||
    (Array.isArray(data?.items) && (data.items[0]?.recentHistory || data.items[0]?.entries)) ||
    [];
  if (!Array.isArray(hist)) hist = [];

  const out = [];
  for (const s of hist) {
    let ts = s?.timestamp ?? s?.timestampMs ?? s?.time;
    ts = Number(ts);
    if (!isFinite(ts)) continue;
    const tsMs = ts < 1e12 ? ts * 1000 : ts;

    const price = Number(s?.pricePerUnit ?? s?.price);
    if (!isFinite(price)) continue;

    const qty = Number(s?.quantity ?? 0);
    const hq = !!(s?.hq);
    out.push({ timestampMs: tsMs, pricePerUnit: price, quantity: qty, hq });
  }
  return out;
}

function downsampleHistoryByDay_(hist, perDayLimit) {
  const tz = Session.getScriptTimeZone();
  const buckets = new Map();

  for (const r of hist) {
    const dayKey = Utilities.formatDate(new Date(r.timestampMs), tz, 'yyyy-MM-dd');
    if (!buckets.has(dayKey)) buckets.set(dayKey, []);
    buckets.get(dayKey).push(r);
  }

  const out = [];
  const keys = Array.from(buckets.keys()).sort();
  for (const k of keys) {
    const arr = buckets.get(k) || [];
    if (arr.length <= perDayLimit) out.push(...arr);
    else {
      const step = Math.ceil(arr.length / perDayLimit);
      for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
    }
  }
  return out;
}

function writeTrend_(ss, rows, meta) {
  let sh = ss.getSheetByName(BACK_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(BACK_SHEET_NAME);

  sh.clearContents();
  sh.getRange(1, 1, 1, 7).setValues([[
    'Time', 'PricePerUnit', 'Qty', 'HQ', 'Scope', 'ItemId', 'ItemName'
  ]]);

  if (!rows || rows.length === 0) {
    sh.getRange(2, 5, 1, 3).setValues([[meta.scope || '', meta.itemId || '', meta.itemName || '']]);
    return;
  }

  const out = rows.map(r => [
    new Date(r.timestampMs),
    r.pricePerUnit,
    r.quantity,
    r.hq ? 'HQ' : 'NQ',
    meta.scope,
    meta.itemId,
    meta.itemName
  ]);

  sh.getRange(2, 1, out.length, 7).setValues(out);
  sh.getRange(2, 1, out.length, 1).setNumberFormat('mm-dd');
}

/***********************
 * utils: chunk, cache key, safe cache put
 ***********************/
function chunkArray_(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cacheKeyFromUrl_(prefix, url) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url, Utilities.Charset.UTF_8);
  const hex = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return prefix + hex;
}

function safeCachePut_(cache, key, value, seconds) {
  try {
    // CacheService value 有大小上限，太大就不要硬塞
    if (value && value.length > 90000) return;
    cache.put(key, value, seconds);
  } catch (_) {}
}
