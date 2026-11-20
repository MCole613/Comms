// Minimal in-memory stand-ins for the Apps Script services the hub uses,
// so the server code can be exercised end-to-end in Node.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function pad(n) { return String(n).padStart(2, '0'); }

function makeSheet(name) {
  const data = []; // array of rows (arrays of strings)
  const sheet = {
    name, data,
    getName: () => name,
    getLastRow: () => data.length,
    getDataRange: () => ({
      getValues: () => data.map(r => r.slice()),
      getDisplayValues: () => data.map(r => r.map(v => String(v ?? '')))
    }),
    getRange: (row, col, nr = 1, nc = 1) => {
      const range = {
        setValues(vals) {
          for (let i = 0; i < nr; i++) {
            while (data.length < row + i) data.push([]);
            for (let j = 0; j < nc; j++) data[row - 1 + i][col - 1 + j] = vals[i][j];
          }
          return range;
        },
        setValue(v) { return range.setValues([[v]]); },
        setNumberFormat: () => range, setFontWeight: () => range, setBackground: () => range, setFontColor: () => range
      };
      return range;
    },
    appendRow: (r) => data.push(r.slice()),
    setFrozenRows() {}, autoResizeColumns() {}
  };
  return sheet;
}

function createContext({ userEmail, now }) {
  const sheets = {};
  const sentMail = [];
  const folders = [];
  let currentUser = userEmail;

  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    getSheets: () => Object.values(sheets),
    deleteSheet: (s) => delete sheets[s.name]
  };

  function makeFolder(name) {
    const f = {
      id: 'folder' + folders.length, name, files: [], editors: [],
      getId: () => f.id, getUrl: () => 'https://drive.example/' + f.id,
      createFolder: (n) => makeFolder(n),
      createFile: (blob) => { f.files.push(blob); return { getName: () => blob.name, getUrl: () => 'https://drive.example/file/' + blob.name }; },
      addEditor: (e) => f.editors.push(e)
    };
    folders.push(f);
    return f;
  }

  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => currentUser }),
      getEffectiveUser: () => ({ getEmail: () => 'owner@church.org' }),
      getScriptTimeZone: () => 'America/New_York'
    },
    Utilities: {
      formatDate(d, tz, fmt) {
        const map = { yyyy: d.getFullYear(), yy: String(d.getFullYear()).slice(2), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()) };
        if (fmt === 'EEE, MMM d') return d.toDateString().slice(0, 10);
        return fmt.replace(/yyyy|yy|MM|dd|HH|mm/g, (k) => map[k]);
      },
      base64Decode: (s) => Buffer.from(s, 'base64'),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => sentMail.push(m) },
    DriveApp: { createFolder: makeFolder, getFolderById: (id) => folders.find(f => f.id === id) || (() => { throw new Error('nope'); })() },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.example/exec' }),
      getProjectTriggers: () => [],
      newTrigger: () => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create() {} }) }) }) }),
      WeekDay: { MONDAY: 'MONDAY' }
    },
    Logger: { log() {} },
    HtmlService: {}
  };

  // Freeze "today" so results are deterministic.
  const RealDate = Date;
  ctx.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(now.getTime()); else super(...a); }
    static now() { return now.getTime(); }
  };

  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'src');
  for (const f of ['Timeline.gs', 'Config.gs', 'Db.gs', 'Setup.gs', 'Code.gs', 'Notify.gs']) {
    vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
  }
  ctx.__sheets = sheets;
  ctx.__mail = sentMail;
  ctx.__folders = folders;
  ctx.__setUser = (e) => { currentUser = e; };
  return ctx;
}

module.exports = { createContext };
