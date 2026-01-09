function appendRecipeToDB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName('寫入配方');
  const dst = ss.getSheetByName('配方表');
  if (!src) throw new Error('找不到工作表：寫入配方');
  if (!dst) throw new Error('找不到工作表：配方表');

  // 1) 讀取 key / amount
  const key = String(src.getRange('B1').getDisplayValue() || '').trim();
  const keyamount = String(src.getRange('B2').getDisplayValue() || '').trim();
  if (!key) throw new Error('寫入配方!B1 為空，請先輸入要寫入的識別值/名稱。');
  if (!keyamount) throw new Error('寫入配方!B2 為空，請先輸入要寫入的單次製作數量。');

  // 2) 若配方表已存在相同 key → 刪除該整行（覆蓋策略）
  const dstLastRowBefore = dst.getLastRow();
  if (dstLastRowBefore >= 1) {
    const colA = dst.getRange(1, 1, dstLastRowBefore, 1).getValues(); // A1:A(last)
    const existIdx = colA.findIndex(r => String(r[0] || '').trim() === key);
    if (existIdx !== -1) {
      const existRow = existIdx + 1; // 1-based
      dst.deleteRow(existRow);
    }
  }

  // 3) 刪除後，再找配方表 A 欄第一個空白列（用來新增）
  const dstLastRow = Math.max(dst.getLastRow(), 1);
  const colA2 = dst.getRange(1, 1, dstLastRow, 1).getValues();
  let targetRow = colA2.findIndex(r => String(r[0] || '').trim() === '') + 1;
  if (targetRow === 0) targetRow = dstLastRow + 1;

  // 4) 讀取 A4:B 並扁平化成 [A4,B4,A5,B5,...]
  const srcLastRow = src.getLastRow();
  let flat = [];
  if (srcLastRow >= 4) {
    const numRows = srcLastRow - 3; // 從第4列開始，總列數 = lastRow - 3
    const values = src.getRange(4, 1, numRows, 2).getValues(); // A4:B(last)
    for (const [a, b] of values) {
      const aStr = String(a ?? '').trim();
      const bStr = String(b ?? '').trim();
      if (!aStr && !bStr) continue;
      flat.push(a, b);
    }
  }

  // 5) 寫入：A=key, B=amount, C 開始=flat
  dst.getRange(targetRow, 1).setValue(key);
  dst.getRange(targetRow, 2).setValue(keyamount);
  if (flat.length > 0) {
    dst.getRange(targetRow, 3, 1, flat.length).setValues([flat]);
  }

  // 6) 寫入後清空：B1, B2, A4:B
  src.getRange('B1').clearContent();
  src.getRange('B2').clearContent();
  if (srcLastRow >= 4) {
    const numRows = srcLastRow - 3;
    src.getRange(4, 1, numRows, 2).clearContent();
  }
}
