// In-memory stand-ins for the Apps Script services the app uses, so the
// server code runs end-to-end in Node.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function pad(n) { return String(n).padStart(2, '0'); }

function makeSheet(name) {
  const data = [];
  const sh = {
    name, data,
    getName: () => name,
    getLastRow: () => data.length,
    getLastColumn: () => Math.max(0, ...data.map(r => r.length)),
    getDataRange: () => ({ getValues: () => data.map(r => r.map(v => (v === undefined ? '' : v))) }),
    getRange(row, col, nr = 1, nc = 1) {
      const range = {
        setValues(vals) {
          for (let i = 0; i < nr; i++) {
            while (data.length < row + i) data.push([]);
            for (let j = 0; j < nc; j++) data[row - 1 + i][col - 1 + j] = vals[i][j];
          }
          return range;
        },
        setValue(v) { return range.setValues([[v]]); },
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[row - 1 + i] || [])[col - 1 + j] ?? '')); },
        setNumberFormat: () => range, setFontWeight: () => range
      };
      return range;
    },
    appendRow(r) { data.push(r.slice()); },
    setFrozenRows() {},
    protect: () => ({ setDescription() { return this; }, getEditors: () => [], removeEditor() {}, canDomainEdit: () => false, setDomainEdit() {} })
  };
  return sh;
}

function makeSpreadsheet(id, title) {
  const sheets = {};
  const order = [];
  const ss = {
    id, title, sheets,
    getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
    getSheets: () => order.map(n => sheets[n]),
    deleteSheet: (s) => { delete sheets[s.name]; order.splice(order.indexOf(s.name), 1); }
  };
  ss.insertSheet('Sheet1');
  return ss;
}

function makeDrive() {
  const folders = {};
  let n = 0;
  function folder(name) {
    const id = 'fold' + String(++n).padStart(10, '0');
    const f = {
      id, name, files: [], children: [], editors: [],
      getId: () => id, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      createFolder: (nm) => { const c = folder(nm); f.children.push(c); return c; },
      createFile: (blob) => { const file = { ...blob, getName: () => blob.name, getUrl: () => 'https://drive.google.com/file/d/' + blob.name }; f.files.push(file); return file; },
      setSharing() {}, addEditor: (e) => f.editors.push(e)
    };
    folders[id] = f;
    return f;
  }
  const root = folder('My Drive');
  return {
    folders, folder, root,
    api: {
      getFolderById: (id) => { if (!folders[id]) throw new Error('No folder ' + id); return folders[id]; },
      getRootFolder: () => root,
      Access: { DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
    }
  };
}

function makeCalendar() {
  const events = {};
  let n = 0;
  const cal = {
    events,
    createAllDayEvent(title, start, endOrOpts, maybeOpts) {
      const id = 'evt' + (++n) + '@google.com';
      const end = endOrOpts instanceof Date || Object.prototype.toString.call(endOrOpts) === '[object Date]' ? endOrOpts : null;
      events[id] = { title, start, end };
      return { getId: () => id };
    },
    getEventById: (id) => (events[id] ? { deleteEvent: () => delete events[id] } : null)
  };
  return cal;
}

function createContext({ userEmail, now, owner = 'admin@example.org', sources }) {
  const drive = makeDrive();
  const calendar = makeCalendar();
  const mail = [];
  const props = {};
  const spreadsheets = {};
  let ssN = 0;
  let currentUser = userEmail;
  let clock = now;

  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.getTime()); else super(...a); }
    static now() { return clock.getTime(); }
  }

  const ctx = {
    console: { log() {}, warn() {}, error: console.error },
    Date: FakeDate,
    SpreadsheetApp: {
      create: (title) => { const id = 'ss' + (++ssN); spreadsheets[id] = makeSpreadsheet(id, title); return spreadsheets[id]; },
      openById: (id) => { if (!spreadsheets[id]) throw new Error('No spreadsheet ' + id); return spreadsheets[id]; }
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => currentUser }),
      getEffectiveUser: () => ({ getEmail: () => owner }),
      getScriptTimeZone: () => 'America/New_York'
    },
    Utilities: {
      formatDate(d, tz, fmt) {
        const m = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()) };
        return fmt.replace(/yyyy|MM|dd|HH|mm/g, k => m[k]);
      },
      base64Decode: (s) => Buffer.from(s, 'base64'),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => mail.push(m) },
    DriveApp: drive.api,
    CalendarApp: { getCalendarById: (id) => (id === 'master@group.calendar.google.com' ? calendar : null) },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/a/macros/example.org/s/APP/exec' }),
      getProjectTriggers: () => [], deleteTrigger() {},
      newTrigger: () => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create() {} }) }) }) }),
      WeekDay: { MONDAY: 'MONDAY' }
    },
    Logger: { log() {} },
    HtmlService: {}
  };
  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'src');
  const files = sources || fs.readdirSync(src).filter(f => f.endsWith('.gs')).map(f => path.join(src, f));
  for (const f of files) {
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) });
  }
  Object.assign(ctx, {
    __drive: drive, __calendar: calendar, __mail: mail, __spreadsheets: spreadsheets,
    __setUser: (e) => { currentUser = e; },
    __setNow: (d) => { clock = d; },
    __call: (name, ...args) => JSON.parse(JSON.stringify(ctx[name](...args))),
    __table: (name) => ctx.readTable_(name)
  });
  return ctx;
}

module.exports = { createContext, makeSpreadsheet };
