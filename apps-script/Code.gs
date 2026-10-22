// Receives survey answers from the GitHub Pages form, adds a row to this sheet,
// and emails the sheet's owner. Deploy as a web app: Execute as "Me", access "Anyone".

const RESPONSES = "Responses";
const RESULTS = "Results";
const COLUMNS = [
  ["Received", r => new Date()],
  ["Name", r => r.name],
  ["Agency and branch", r => r.agency],
  ["1. Last quote away from desk", r => r.g1],
  ["2. Who sends quotes today", r => r.g2who],
  ["3. Would send them in 3 minutes", r => r.g2self],
  ["4. App or web page", r => r.g3],
  ["4. Why", r => r.g3why],
  ["5. Alerts they'd act on", r => r.g4],
  ["6. Change referral fee", r => r.g5],
  ["6. When and how much", r => r.g5how],
  ["Anything else", r => r.notes],
  ["G1 pass", r => r.g1Pass === true ? "Yes" : "No"],
  ["G2 pass", r => r.g2Pass === true ? "Yes" : "No"],
  ["G3 pass", r => r.g3Pass === true ? "Yes" : "No"],
  ["G4 pass", r => r.g4Pass === true ? "Yes" : "No"],
  // Kept last so the G columns the Results formulas read stay at M–P.
  ["Email", r => r.email],
  ["Wants updates", r => r.updates === true ? "Yes" : "No"],
];
const GATES = [
  ["G1", "Needed a quote away from the desk in the last 2 weeks", "M"],
  ["G2", "Would send the quotes themselves", "N"],
  ["G3", "Would install the app", "O"],
  ["G4", "Would act on opened or instructed", "P"],
];

// Run once from the editor: creates the Responses and Results tabs.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responses = ss.getSheetByName(RESPONSES) || ss.getSheets()[0].setName(RESPONSES);
  responses.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS.map(c => c[0])]).setFontWeight("bold");
  responses.setFrozenRows(1);

  const results = ss.getSheetByName(RESULTS) || ss.insertSheet(RESULTS);
  results.clear();
  results.appendRow(["Gate", "Question", "Yes", "Responses", "Result"]);
  GATES.forEach(([id, label, col], i) => {
    const row = i + 2;
    results.appendRow([
      id,
      label,
      `=COUNTIF(${RESPONSES}!${col}2:${col},"Yes")`,
      `=COUNTA(${RESPONSES}!B2:B)`,
      `=IF(C${row}>=5,"Pass",IF(C${row}+MAX(8-D${row},0)<5,"Fail","Open"))`,
    ]);
  });
  results.getRange(GATES.length + 3, 2).setValue("Pass is 5 of 8.");
  results.getRange(1, 1, 1, 5).setFontWeight("bold");
  results.setFrozenRows(1);
  results.autoResizeColumns(1, 5);
}

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    if (r.website) return reply({ ok: true }); // spam trap filled in
    if (!clean(r.name)) return reply({ ok: false, error: "missing name" });

    Object.keys(r).forEach(k => { if (typeof r[k] === "string") r[k] = clean(r[k]); });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSES);
      sheet.appendRow(COLUMNS.map(([, value]) => value(r)));
    } finally {
      lock.releaseLock();
    }

    notify(r);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function notify(r) {
  const me = Session.getEffectiveUser().getEmail();
  const lines = COLUMNS
    .filter(([label]) => label !== "Received" && !/^G\d pass$/.test(label))
    .map(([label, value]) => `${label}: ${value(r) || "-"}`);
  lines.push("", SpreadsheetApp.getActiveSpreadsheet().getUrl());
  MailApp.sendEmail(me, `Agent survey: ${r.name}${r.agency ? ` (${r.agency})` : ""}`, lines.join("\n"));
}

// Strips leading characters a spreadsheet would read as a formula, and caps length.
function clean(value) {
  const s = String(value || "").trim().slice(0, 1000);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
