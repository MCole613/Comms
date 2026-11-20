// In-memory stand-ins for the Apps Script services the app uses, so the server
// code can run end-to-end in Node. The hub's own automation is simulated by
// `onSubmit` hooks that add rows the way the real onFormSubmit trigger would.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FORMS = require('./fixtures/forms.json');

function pad(n) { return String(n).padStart(2, '0'); }

function makeSheet(rows) {
  const data = rows.map(r => r.slice());
  return {
    data,
    getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }),
    getRange() { throw new Error('The app must never write to the hub spreadsheet.'); },
    appendRow() { throw new Error('The app must never write to the hub spreadsheet.'); }
  };
}

const NAV = { CONTINUE: 'CONTINUE', GO_TO_PAGE: 'GO_TO_PAGE', RESTART: 'RESTART', SUBMIT: 'SUBMIT' };

function makeForm(kind, onSubmit) {
  const spec = FORMS[kind];
  const byId = {};
  const items = spec.items.map(raw => {
    const choice = (c) => ({
      getValue: () => c.value,
      getPageNavigationType: () => c.nav.type,
      getGotoPage: () => (c.nav.type === 'GO_TO_PAGE' ? byId[c.nav.page] : null)
    });
    const typed = {
      isRequired: () => raw.required,
      getChoices: () => raw.choices.map(choice),
      hasOtherOption: () => raw.other,
      getPageNavigationType: () => raw.nav.type,
      getGoToPage: () => (raw.nav.type === 'GO_TO_PAGE' ? byId[raw.nav.page] : null),
      createResponse: (value) => ({ item: raw, value })
    };
    const item = {
      raw,
      getId: () => Number(raw.id), getTitle: () => raw.title, getHelpText: () => raw.help, getType: () => raw.type,
      asTextItem: () => typed, asParagraphTextItem: () => typed, asDateItem: () => typed,
      asMultipleChoiceItem: () => typed, asListItem: () => typed, asCheckboxItem: () => typed, asPageBreakItem: () => typed
    };
    byId[raw.id] = item;
    return item;
  });
  return {
    kind,
    getTitle: () => spec.title,
    getDescription: () => spec.description,
    getItems: () => items,
    createResponse() {
      const answers = [];
      const resp = {
        withItemResponse(r) { answers.push(r); return resp; },
        submit() {
          const byTitle = {};
          answers.forEach(a => { byTitle[a.item.title] = a.value; });
          onSubmit(kind, byTitle);
        }
      };
      return resp;
    }
  };
}

function makeDrive() {
  const folders = {};
  let n = 0;
  function folder(name) {
    const id = 'fold' + String(++n).padStart(10, '0');
    const f = {
      id, name, files: [], children: [], sharing: null,
      getId: () => id, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      getFoldersByName: (nm) => { const hits = f.children.filter(c => c.name === nm); let i = 0; return { hasNext: () => i < hits.length, next: () => hits[i++] }; },
      createFolder: (nm) => { const c = folder(nm); f.children.push(c); return c; },
      createFile: (blob) => { f.files.push(blob); return blob; },
      setSharing: (a, p) => { f.sharing = [a, p]; }
    };
    folders[id] = f;
    return f;
  }
  const root = folder('My Drive');
  return {
    folders, folder,
    api: {
      getFolderById: (id) => { if (!folders[id]) throw new Error('No folder ' + id); return folders[id]; },
      getRootFolder: () => root,
      Access: { DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
    }
  };
}

/**
 * tabs: { Config: [[k, v], …], Requests: [[headers…], …], Timeline: [[headers…], …] }
 */
function createContext({ tabs, userEmail, now, formIds = {} }) {
  const drive = makeDrive();
  const sheets = {};
  Object.keys(tabs).forEach(name => { sheets[name] = makeSheet(tabs[name]); });
  const submissions = [];
  let currentUser = userEmail;

  // Simulated hub automation: a request submission adds a Requests row.
  function onSubmit(kind, byTitle) {
    submissions.push({ kind, answers: byTitle, by: currentUser });
    if (kind !== 'request') return;
    const req = sheets.Requests.data;
    const h = req[0];
    const row = h.map(() => '');
    const set = (col, v) => { const i = h.indexOf(col); if (i >= 0) row[i] = v; };
    const count = req.length;
    set('Request ID', 'REQ-2026-' + String(100 + count));
    set('Submitted', new Date(now.getTime()));
    set('Requester', byTitle['Your name']);
    set('Requester Email', byTitle['Your email']);
    set('Ministry', byTitle['Ministry / department']);
    set('Event / Initiative', byTitle['Event or initiative name'] || byTitle['Series title (working title is fine)'] || byTitle['What are we making? (example: youth camp t-shirt)']);
    set('Status', 'Needs Review');
    req.push(row);
  }

  const forms = {};
  ['request', 'feedback', 'change'].forEach(k => { forms[formIds[k] || ('FORM_' + k.toUpperCase() + '_ID_0000000000')] = makeForm(k, onSubmit); });

  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(now.getTime()); else super(...a); }
    static now() { return now.getTime(); }
  }

  const ctx = {
    console,
    Date: FakeDate,
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] || null }) },
    FormApp: {
      openById: (id) => { if (!forms[id]) throw new Error('No form ' + id); return forms[id]; },
      ItemType: { TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', DATE: 'DATE', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE', LIST: 'LIST', CHECKBOX: 'CHECKBOX', SECTION_HEADER: 'SECTION_HEADER', PAGE_BREAK: 'PAGE_BREAK' },
      PageNavigationType: NAV
    },
    Session: { getActiveUser: () => ({ getEmail: () => currentUser }), getScriptTimeZone: () => 'America/New_York' },
    Utilities: {
      formatDate(d, tz, fmt) {
        const m = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()) };
        return fmt.replace(/yyyy|MM|dd|HH|mm/g, k => m[k]);
      },
      base64Decode: (s) => Buffer.from(s, 'base64'),
      newBlob: (bytes, mimeType, name) => ({ bytes, mimeType, name }),
      sleep() {}
    },
    DriveApp: drive.api,
    HtmlService: {}
  };
  vm.createContext(ctx);
  const src = path.join(__dirname, '..', 'src');
  for (const f of ['Config.gs', 'FormLogic.gs', 'Data.gs', 'Forms.gs', 'Code.gs']) {
    vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
  }
  ctx.__sheets = sheets;
  ctx.__drive = drive;
  ctx.__submissions = submissions;
  ctx.__setUser = (e) => { currentUser = e; };
  ctx.__call = (name, ...args) => JSON.parse(JSON.stringify(ctx[name](...args)));
  return ctx;
}

module.exports = { createContext, FORMS };
