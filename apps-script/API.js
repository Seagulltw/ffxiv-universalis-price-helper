/************************************************************
 * FFXIV Universalis Price Helper (Open-source friendly)
 * - Bound to Google Sheet (recommended)
 * - Safe defaults: no secrets, no external writes (except Universalis fetch)
 *
 * Sheets used:
 *   - calculator (front UI)
 *   - idmappingtableTW (A=name, B=itemId)
 *   - 趨勢圖data (trend output)
 *
 * Optional sheets (created by initProject):
 *   - FFXIV_Config (A=key, B=value) for overrides
 *   - FFXIV_Alias  (A=type, B=zhName, C=value) for DC/WORLD mapping
 *   - README       (in-sheet quick guide)
 ************************************************************/

/***********************
 * 固定設定（依你目前版面）
 ***********************/
const FRONT_SHEET_NAME = 'calculator';
const MAP_SHEET_NAME   = 'idmappingtableTW';
const BACK_SHEET_NAME  = '趨勢圖data';

// Optional sheets
const CONFIG_SHEET_NAME = 'FFXIV_Config';
const ALIAS_SHEET_NAME  = 'FFXIV_Alias';
const README_SHEET_NAME = 'README';

const WORLD_CELL  = 'C1'; // 世界/資料中心/Region
const TARGET_CELL = 'C2'; // 目標產物（趨勢用）

const LIST_START_ROW = 5;
const LIST_END_ROW   = 17; // 5..17 共13列

// HQ / 名稱 / 數量 / 單價 / 總價（你的 layout）
// 主：  C D E F G
// A：  J K L M N
// B：  Q R S Y Z
// C：  X Y Z AA AB
// D：  AE AF AG AH AI
// E：  AL AM AN AO AP
const BLOCKS = [
  { key: 'MAIN', hqCol: 3,  itemCol: 4,  priceCol: 6  },  // C D F
  { key: 'A',    hqCol: 10, itemCol: 11, priceCol: 13 }, // J K M
  { key: 'B',    hqCol: 17, itemCol: 18, priceCol: 20 }, // Q R T
  { key: 'C',    hqCol: 24, itemCol: 25, priceCol: 27 }, // X Y AA
  { key: 'D',    hqCol: 31, itemCol: 32, priceCol: 34 }, // AE AF AH
  { key: 'E',    hqCol: 38, itemCol: 39, priceCol: 41 }, // AL AM AO
];

/***********************
 * Default (can be overridden by FFXIV_Config)
 ***********************/
const DEFAULT_CONFIG = {
  // Safety switch
  ALLOW_EXTERNAL_FETCH: 'TRUE',

  // Cache seconds
  CACHE_SECONDS_MARKET: '5',   // market(listings)
  CACHE_SECONDS_HIS:    '15',  // history

  // listings limit
  LISTINGS_LIMIT: '50',

  // Trend controls
  DAYS: '7',
  MAX_TREND_ROWS_TOTAL: '2500',
  MAX_TREND_PER_DAY: '250',
};

// Fallback aliases (can be overridden/extended by FFXIV_Alias)
const DEFAULT_DC_ALIAS = {
  '陸行鳥': 'Chocobo',
};

const DEFAULT_WORLD_ID_ALIAS = {
  '伊弗利特': 4028,
  '迦樓羅':   4029,
  '利維坦':   4030,
  '鳳凰':     4031,
  '奧汀':     4032,
  '巴哈姆特': 4033,
  '拉姆':     4034,
  '泰坦':     4035,
};

/***********************
 * UI：選單 + 安裝型觸發器
 ***********************/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('FFXIV')
    .addItem('初始化（建立 Config/Alias/README）', 'initProject')
    .addSeparator()
    .addItem('更新：單價(全表)', 'updatePricesNow')
    .addItem('更新：趨勢(天數依設定)', 'updateTrendNow')
    .addSeparator()
    .addItem('安裝 onEdit 觸發器(需授權)', 'setupTriggers')
    .addItem('移除 onEdit 觸發器', 'removeTriggers')
    .addSeparator()
    .addItem('模板發布前整理（移除trigger/清單價）', 'prepareForTemplate')
    .addSeparator()
    .addItem('DEBUG：測 D5 抓價(用 market listings)', 'debugOneRowD5')
    .addToUi();
}

function setupTriggers() {
  removeTriggers();
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  SpreadsheetApp.getActive().toast('Installed onEditInstalled trigger', 'FFXIV', 5);
}

function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  }
}

/***********************
 * One-click init: create optional Config/Alias/README sheets
 ***********************/
function initProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Config
  let cfgSh = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!cfgSh) cfgSh = ss.insertSheet(CONFIG_SHEET_NAME);
  cfgSh.clearContents();
  cfgSh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);

  const cfgRows = Object.keys(DEFAULT_CONFIG).map(k => [k, DEFAULT_CONFIG[k]]);
  cfgSh.getRange(2, 1, cfgRows.length, 2).setValues(cfgRows);
  cfgSh.autoResizeColumns(1, 2);

  // Alias
  let aliasSh = ss.getSheetByName(ALIAS_SHEET_NAME);
  if (!aliasSh) aliasSh = ss.insertSheet(ALIAS_SHEET_NAME);
  aliasSh.clearContents();
  aliasSh.getRange(1, 1, 1, 3).setValues([['Type', 'Name(ZH)', 'Value']]);
  aliasSh.getRange(2, 1, 1, 3).setValues([['DC', '陸行鳥', 'Chocobo']]);
  aliasSh.getRange(3, 1, 1, 3).setValues([['WORLD_ID', '迦樓羅', '4029']]);
  aliasSh.getRange(5, 1, 1, 3).setValues([['(Notes)', 'Type=DC or WORLD_ID', 'Value: DC English name or worldId number']]);
  aliasSh.autoResizeColumns(1, 3);

  // README sheet (quick guide)
  let readmeSh = ss.getSheetByName(README_SHEET_NAME);
  if (!readmeSh) readmeSh = ss.insertSheet(README_SHEET_NAME);
  readmeSh.clearContents();

  const lines = [
    'FFXIV Universalis Price Helper (Template)',
    '',
    'Quick start:',
    '1) Fill C1 (World/DC/Region) in "calculator". Example: 迦樓羅 or 陸行鳥',
    '2) Ensure idmappingtableTW: Col A = Item Name (ZH), Col B = ItemId',
    '3) Menu: FFXIV -> Install onEdit trigger (optional)',
    '4) Use: FFXIV -> Update prices / Update trend',
    '',
    'Optional:',
    '- Edit FFXIV_Config to change cache/listings/trend settings',
    '- Edit FFXIV_Alias to add DC/WORLD_ID mappings without changing code',
    '',
    'Safety:',
    '- No secrets are stored in this template. Do not hardcode tokens/keys.',
  ];
  readmeSh.getRange(1, 1, lines.length, 1).setValues(lines.map(x => [x]));
  readmeSh.autoResizeColumn(1);

  SpreadsheetApp.getActive().toast('Initialized Config/Alias/README', 'FFXIV', 6);
}

/***********************
 * Template prep: remove triggers + clear unit price columns + reset HQ defaults
 ***********************/
function prepareForTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  removeTriggers();

  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  if (front) {
    resetHQDefaults_(front);
  }

  SpreadsheetApp.getActive().toast('Template prepared (triggers removed, prices cleared)', 'FFXIV', 6);
}

/***********************
 * onEdit：
 * - 世界/目標改變 → resetHQ（只保留 C5=TRUE）→ flush 等公式 → 全表更新 → 趨勢
 * - 只改 HQ 勾選 → 只更新該格單價（不全表）
 ***********************/
function onEditInstalled(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== FRONT_SHEET_NAME) return;

    const ss = e.source;
    const front = ss.getSheetByName(FRONT_SHEET_NAME);
    if (!front) return;

    const r1 = e.range.getRow();
    const r2 = r1 + e.range.getNumRows() - 1;
    const c1 = e.range.getColumn();
    const c2 = c1 + e.range.getNumColumns() - 1;

    const touchedWorld  = rangeIntersectsA1_(front, r1, r2, c1, c2, WORLD_CELL);
    const touchedTarget = rangeIntersectsA1_(front, r1, r2, c1, c2, TARGET_CELL);

    const lock = LockService.getDocumentLock();
    if (!lock.tryLock(10000)) return;

    if (touchedWorld || touchedTarget) {
      resetHQDefaults_(front);

      // 等公式把名稱/數量等算出來
      SpreadsheetApp.flush();
      Utilities.sleep(400);
      SpreadsheetApp.flush();

      updateAllPrices_(ss);
      updateTrendData_(ss);

      lock.releaseLock();
      return;
    }

    // 只改 HQ → 單格更新
    const targets = detectHQEdits_(r1, r2, c1, c2);
    if (targets.length === 0) { lock.releaseLock(); return; }

    // 節流：避免連續點擊造成頻繁打 API
    const props = PropertiesService.getDocumentProperties();
    const now = Date.now();
    const last = Number(props.getProperty('LAST_RUN_MS') || '0');
    if (now - last < 250) { lock.releaseLock(); return; }
    props.setProperty('LAST_RUN_MS', String(now));

    updateSinglePrices_(ss, targets);
    lock.releaseLock();
  } catch (err) {
    Logger.log('[onEditInstalled] %s', err && err.stack ? err.stack : err);
    try {
      SpreadsheetApp.getActive().toast(
        'FFXIV script error: ' + (err && err.message ? err.message : String(err)),
        'FFXIV',
        6
      );
    } catch (_) {}
  }
}

/***********************
 * 手動按鈕
 ***********************/
function updatePricesNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getActive().toast('Updating prices...', 'FFXIV', 3);
  updateAllPrices_(ss);
  SpreadsheetApp.getActive().toast('Done', 'FFXIV', 2);
}

function updateTrendNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getActive().toast('Updating trend...', 'FFXIV', 3);
  updateTrendData_(ss);
  SpreadsheetApp.getActive().toast('Done', 'FFXIV', 2);
}

/***********************
 * Config helpers (DocumentProperties > Config sheet > defaults)
 ***********************/
function getConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getDocumentProperties();

  // from sheet (optional)
  const sheetMap = {};
  const sh = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sh && sh.getLastRow() >= 2) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues();
    for (const [k, v] of vals) {
      const kk = String(k || '').trim();
      if (!kk) continue;
      sheetMap[kk] = String(v || '').trim();
    }
  }

  // merge
  const out = {};
  for (const k of Object.keys(DEFAULT_CONFIG)) {
    out[k] =
      (props.getProperty(k) != null ? props.getProperty(k) :
       (sheetMap[k] != null ? sheetMap[k] : DEFAULT_CONFIG[k]));
  }

  // typed getters
  return {
    allowExternalFetch: String(out.ALLOW_EXTERNAL_FETCH).toUpperCase() === 'TRUE',
    cacheMarket: toInt_(out.CACHE_SECONDS_MARKET, 5),
    cacheHis: toInt_(out.CACHE_SECONDS_HIS, 15),
    listingsLimit: toInt_(out.LISTINGS_LIMIT, 50),
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
 * Alias loaders (defaults + optional ALIAS sheet)
 ***********************/
function loadAliases_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dc = Object.assign({}, DEFAULT_DC_ALIAS);
  const world = Object.assign({}, DEFAULT_WORLD_ID_ALIAS);

  const sh = ss.getSheetByName(ALIAS_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return { dc, world };

  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues();
  for (const [typeRaw, nameRaw, valRaw] of vals) {
    const type = String(typeRaw || '').trim().toUpperCase();
    const name = String(nameRaw || '').trim();
    const val  = String(valRaw || '').trim();
    if (!type || !name || !val) continue;

    if (type === 'DC') dc[name] = val;
    if (type === 'WORLD_ID') world[name] = Number(val);
  }
  return { dc, world };
}

function normalizeScope_(scopeRaw) {
  const s = String(scopeRaw || '').trim();
  if (!s) return '';

  const { dc, world } = loadAliases_();

  if (dc[s]) return dc[s];                    // DC
  if (world[s]) return String(world[s]);      // worldId
  if (/^\d+$/.test(s)) return s;              // already worldId
  return s;                                   // allow user input english world/dc/region
}

/***********************
 * reset HQ：清所有 HQ，只保留 C5 = TRUE
 * ✅ 不清 物品名稱/數量/總價（那些是公式）
 * ✅ 只清單價欄，避免殘留
 ***********************/
function resetHQDefaults_(front) {
  const rows = LIST_END_ROW - LIST_START_ROW + 1;
  for (const b of BLOCKS) {
    front.getRange(LIST_START_ROW, b.hqCol, rows, 1).setValues(
      Array.from({ length: rows }, () => [false])
    );
  }
  front.getRange(LIST_START_ROW, BLOCKS[0].hqCol).setValue(true); // only keep C5
  clearPriceCols_(front);
}

function clearPriceCols_(front) {
  const rows = LIST_END_ROW - LIST_START_ROW + 1;
  for (const b of BLOCKS) {
    front.getRange(LIST_START_ROW, b.priceCol, rows, 1).clearContent();
  }
}

/***********************
 * 價格策略
 * True  → HQ minListing
 * False → min(HQ minListing, NQ minListing)
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

/***********************
 * 全表更新：用 market(listings) 批次抓最低掛單
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
  if (ids.length === 0) {
    SpreadsheetApp.getActive().toast('No IDs to query. Check idmappingtableTW A:B mapping.', 'FFXIV', 6);
    return;
  }

  const marketById = fetchMinListingsFromMarket_(scope, ids, cfg);

  for (let bi = 0; bi < BLOCKS.length; bi++) {
    const b = BLOCKS[bi];
    const names = blockNames[bi];
    const hqs = blockHQs[bi];

    const out = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (!name) { out.push(['']); continue; }

      const id = String(nameToId[name] || '').trim();
      if (!id) { out.push(['']); continue; }

      const obj = marketById[id] || {};
      const price = computePriceByHQ_(obj, hqs[i]);
      out.push([price == null ? '' : Math.ceil(price)]);
    }

    front.getRange(LIST_START_ROW, b.priceCol, rowCount, 1).setValues(out);
  }
}

/***********************
 * 只更新被改到 HQ 勾選的那幾列（單格更新）
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
  if (ids.length === 0) return;

  const marketById = fetchMinListingsFromMarket_(scope, ids, cfg);

  for (const x of need) {
    const obj = marketById[x.id] || {};
    const price = computePriceByHQ_(obj, x.isHQ);
    front.getRange(x.row, x.b.priceCol).setValue(price == null ? '' : Math.ceil(price));
  }
}

/***********************
 * market(listings)：批次抓最低掛單
 * - from listings to match UI
 * - cache per URL
 ***********************/
function fetchMinListingsFromMarket_(scope, ids, cfg) {
  const out = {}; // id -> { hqMin, nqMin }
  const cache = CacheService.getDocumentCache();

  if (!cfg.allowExternalFetch) return out;

  const reqs = [];
  const meta = [];

  for (const id of ids) {
    const url =
      "https://universalis.app/api/v2/" +
      encodeURIComponent(scope) + "/" +
      encodeURIComponent(id) +
      "?listings=" + cfg.listingsLimit +
      "&entries=0";

    const cacheKey = 'm_' + Utilities.base64EncodeWebSafe(url);
    const cached = cache.get(cacheKey);

    if (cached) {
      try { ingestMarket_(out, JSON.parse(cached)); } catch (_) {}
      continue;
    }

    reqs.push({ url, muteHttpExceptions: true });
    meta.push({ url, cacheKey });
  }

  if (reqs.length) {
    const resps = UrlFetchApp.fetchAll(reqs);
    for (let i = 0; i < resps.length; i++) {
      const resp = resps[i];
      const { url, cacheKey } = meta[i];
      const code = resp.getResponseCode();

      if (code !== 200) {
        Logger.log('[market] code=%s url=%s body=%s', code, url, resp.getContentText().slice(0, 200));
        continue;
      }

      const txt = resp.getContentText();
      try {
        const data = JSON.parse(txt);
        cache.put(cacheKey, txt, cfg.cacheMarket);
        ingestMarket_(out, data);
      } catch (err) {
        Logger.log('[market] json parse fail url=%s err=%s', url, err);
      }
    }
  }

  return out;
}

function ingestMarket_(out, data) {
  const itemId = String(data?.itemId ?? data?.itemID ?? '');
  if (!itemId) return;

  let hqMin = null;
  let nqMin = null;

  const listings = Array.isArray(data?.listings) ? data.listings : [];
  for (const l of listings) {
    const p = Number(l?.pricePerUnit);
    if (!isFinite(p)) continue;

    const isHQ = !!l?.hq;
    if (isHQ) hqMin = (hqMin == null) ? p : Math.min(hqMin, p);
    else      nqMin = (nqMin == null) ? p : Math.min(nqMin, p);
  }

  out[itemId] = { hqMin, nqMin };
}

/***********************
 * 趨勢：天數依設定（預設 7 天），每天抽樣
 ***********************/
function updateTrendData_(ss) {
  const cfg = getConfig_();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  if (!front || !mapSh) return;

  const scope = normalizeScope_(front.getRange(WORLD_CELL).getDisplayValue());
  const itemName = normalizeName_(front.getRange(TARGET_CELL).getDisplayValue() || '');

  if (!scope || !itemName) {
    writeTrend_(ss, [], { scope, itemName, itemId: '' });
    return;
  }

  const nameToId = buildNameToIdMap_(mapSh);
  const itemId = String(nameToId[itemName] || '').trim();

  if (!itemId) {
    writeTrend_(ss, [], { scope, itemName, itemId: '' });
    return;
  }

  if (!cfg.allowExternalFetch) {
    writeTrend_(ss, [], { scope, itemName, itemId });
    return;
  }

  const seconds = cfg.days * 86400;
  const url = "https://universalis.app/api/v2/history/" +
    encodeURIComponent(scope) + "/" +
    encodeURIComponent(itemId) +
    "?entriesWithin=" + seconds;

  const data = fetchJsonWithRetry_(url, cfg.cacheHis, cfg.allowExternalFetch);
  let hist = normalizeHistory_(data);
  hist.sort((a, b) => a.timestampMs - b.timestampMs);

  hist = downsampleHistoryByDay_(hist, cfg.maxTrendPerDay);

  if (hist.length > cfg.maxTrendRowsTotal) {
    const step = Math.ceil(hist.length / cfg.maxTrendRowsTotal);
    const slim = [];
    for (let i = 0; i < hist.length; i += step) slim.push(hist[i]);
    hist = slim;
  }

  writeTrend_(ss, hist, { scope, itemName, itemId });
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
    if (arr.length <= perDayLimit) {
      out.push(...arr);
    } else {
      const step = Math.ceil(arr.length / perDayLimit);
      for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
    }
  }
  return out;
}

/***********************
 * mapping：idmappingtableTW A=名稱, B=ID
 ***********************/
function buildNameToIdMap_(mapSh) {
  const last = mapSh.getLastRow();
  if (last < 1) return {};
  const vals = mapSh.getRange(1, 1, last, 2).getDisplayValues(); // A:B
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
 * 偵測 HQ checkbox 被改到哪些列
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
 * fetch json（含快取 + 退避重試）
 ***********************/
function fetchJsonWithRetry_(url, cacheSeconds, allowExternalFetch) {
  if (!allowExternalFetch) return {};
  const cache = CacheService.getDocumentCache();
  const key = 'u_' + Utilities.base64EncodeWebSafe(url);
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const waits = [400, 900, 1800];
  for (let i = 0; i < waits.length; i++) {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = res.getResponseCode();

    if (code === 200) {
      const data = JSON.parse(res.getContentText());
      cache.put(key, JSON.stringify(data), cacheSeconds);
      return data;
    }

    if (code === 429 || (code >= 500 && code <= 599)) {
      Utilities.sleep(waits[i]);
      continue;
    }

    Logger.log('[fetch] code=%s url=%s body=%s', code, url, res.getContentText().slice(0, 200));
    return {};
  }
  return {};
}

/***********************
 * history 解析 + 寫入趨勢表
 ***********************/
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
 * DEBUG：直接用 D5 的品名測一筆
 ***********************/
function debugOneRowD5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig_();
  const front = ss.getSheetByName(FRONT_SHEET_NAME);
  const mapSh = ss.getSheetByName(MAP_SHEET_NAME);
  if (!front || !mapSh) throw new Error('Missing sheets');

  const scopeRaw = front.getRange(WORLD_CELL).getDisplayValue();
  const scope = normalizeScope_(scopeRaw);

  const nameToId = buildNameToIdMap_(mapSh);
  const name = normalizeName_(front.getRange(5, 4).getDisplayValue()); // D5
  const id = String(nameToId[name] || '').trim();

  Logger.log('scopeRaw=%s scope=%s', scopeRaw, scope);
  Logger.log('D5 name=%s => id=%s', name, id);

  if (!scope) throw new Error('C1 scope empty');
  if (!name) throw new Error('D5 name empty');
  if (!id) throw new Error('No mapping for D5 name');

  const r = fetchMinListingsFromMarket_(scope, [id], cfg)[id] || {};
  Logger.log('RESULT id=%s hqMin=%s nqMin=%s', id, r.hqMin, r.nqMin);

  SpreadsheetApp.getActive().toast(
    `DEBUG D5: scope=${scope} id=${id} HQmin=${r.hqMin ?? '-'} NQmin=${r.nqMin ?? '-'}`,
    'FFXIV',
    8
  );
}
