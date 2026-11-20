/* Browser stand-ins for the Google services the app uses, so the real
 * server code (dist/Code.gs) runs inside a demo page. Data lives in memory
 * and resets when the page reloads. Nothing is sent anywhere. */
(function () {
  'use strict';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---- tiny synchronous SHA-256 (for Utilities.computeDigest) ---- */
  function sha256Bytes(str) {
    var bytes = new TextEncoder().encode(str);
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(withPad); m.set(bytes); m[l] = 0x80;
    var bits = l * 8; for (var i = 0; i < 4; i++) m[withPad - 1 - i] = (bits >>> (8 * i)) & 255;
    var w = new Uint32Array(64);
    for (var off = 0; off < withPad; off += 64) {
      for (var t = 0; t < 16; t++) w[t] = (m[off + 4 * t] << 24) | (m[off + 4 * t + 1] << 16) | (m[off + 4 * t + 2] << 8) | m[off + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var a0 = w[t - 15], a1 = w[t - 2];
        var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3);
        var s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    H.forEach(function (x) { for (var k = 3; k >= 0; k--) { var v = (x >>> (8 * k)) & 255; out.push(v > 127 ? v - 256 : v); } });
    return out;
  }

  /* ---- spreadsheets ---- */
  function makeSheet(name) {
    var data = [];
    var sh = {
      name: name, data: data,
      getName: function () { return name; },
      getLastRow: function () { return data.length; },
      getLastColumn: function () { return data.reduce(function (m, r) { return Math.max(m, r.length); }, 0); },
      getDataRange: function () { return { getValues: function () { return data.map(function (r) { return r.map(function (v) { return v === undefined ? '' : v; }); }); } }; },
      getRange: function (row, col, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        var range = {
          setValues: function (vals) {
            for (var i = 0; i < nr; i++) {
              while (data.length < row + i) data.push([]);
              for (var j = 0; j < nc; j++) data[row - 1 + i][col - 1 + j] = vals[i][j];
            }
            return range;
          },
          setValue: function (v) { return range.setValues([[v]]); },
          getValues: function () {
            var out = [];
            for (var i = 0; i < nr; i++) { var r = []; for (var j = 0; j < nc; j++) { var v = (data[row - 1 + i] || [])[col - 1 + j]; r.push(v === undefined ? '' : v); } out.push(r); }
            return out;
          },
          setNumberFormat: function () { return range; }, setFontWeight: function () { return range; }
        };
        return range;
      },
      appendRow: function (r) { data.push(r.slice()); },
      deleteRow: function (n) { data.splice(n - 1, 1); },
      setFrozenRows: function () {},
      protect: function () { return { setDescription: function () { return this; }, getEditors: function () { return []; }, removeEditor: function () {}, canDomainEdit: function () { return false; }, setDomainEdit: function () {} }; }
    };
    return sh;
  }
  var books = {}, bookN = 0;
  function makeBook(id) {
    var sheets = {}, order = [];
    var ss = {
      getId: function () { return id; }, getUrl: function () { return 'https://docs.google.com/spreadsheets/d/' + id; },
      getSheetByName: function (n) { return sheets[n] || null; },
      insertSheet: function (n) { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
      getSheets: function () { return order.map(function (n) { return sheets[n]; }); },
      deleteSheet: function (s) { delete sheets[s.name]; order.splice(order.indexOf(s.name), 1); }
    };
    ss.insertSheet('Sheet1');
    return ss;
  }

  /* ---- drive, calendar, mail ---- */
  var folders = {}, folderN = 0;
  function folder(name) {
    var id = 'demo' + String(++folderN).padStart(10, '0');
    var f = {
      id: id, name: name, files: [], children: [],
      getId: function () { return id; }, getUrl: function () { return 'https://drive.google.com/drive/folders/' + id; },
      createFolder: function (n) { var c = folder(n); f.children.push(c); return c; },
      createFile: function (blob) { var file = { getName: function () { return blob.name; }, getUrl: function () { return 'https://drive.google.com/file/d/' + id; } }; f.files.push(blob); return file; },
      setSharing: function () {}, addEditor: function () {}, addViewer: function () {}
    };
    folders[id] = f;
    return f;
  }
  var root = folder('My Drive');
  var events = {}, eventN = 0;
  var calendar = {
    createAllDayEvent: function (title) { var id = 'evt' + (++eventN); events[id] = title; return { getId: function () { return id; } }; },
    getEventById: function (id) { return events[id] ? { deleteEvent: function () { delete events[id]; } } : null; }
  };
  var mail = [];
  var props = {}, cache = {};
  var currentUser = '', tokens = {};

  var services = {
    SpreadsheetApp: {
      create: function () { var id = 'book' + (++bookN); books[id] = makeBook(id); return books[id]; },
      openById: function (id) { if (!books[id]) throw new Error('No spreadsheet ' + id); return books[id]; }
    },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function (k) { return props[k] || null; }, setProperty: function (k, v) { props[k] = v; } }; } },
    Session: {
      getActiveUser: function () { return { getEmail: function () { return currentUser; } }; },
      getEffectiveUser: function () { return { getEmail: function () { return 'admin@church.test'; } }; },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      formatDate: function (d, tz, fmt) {
        var map = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()) };
        return fmt.replace(/yyyy|MM|dd|HH|mm/g, function (k) { return map[k]; });
      },
      base64Decode: function (s) { var bin = atob(String(s || '')); var out = new Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; },
      newBlob: function (bytes, mimeType, name) { return { bytes: bytes, mimeType: mimeType, name: name }; },
      getUuid: function () { return crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + String(Math.random()).slice(2) + Date.now(); },
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: function (alg, s) { return sha256Bytes(String(s)); }
    },
    CacheService: { getScriptCache: function () { return {
      get: function (k) { return k in cache ? cache[k] : null; }, put: function (k, v) { cache[k] = String(v); }, remove: function (k) { delete cache[k]; }
    }; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    MailApp: { sendEmail: function (m) { mail.push(m); } },
    DriveApp: {
      getFolderById: function (id) { if (!folders[id]) throw new Error('No folder ' + id); return folders[id]; },
      getRootFolder: function () { return root; },
      Access: { DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
    },
    CalendarApp: { getCalendarById: function (id) { return id === 'master@group.calendar.google.com' ? calendar : null; } },
    ScriptApp: {
      getService: function () { return { getUrl: function () { return ''; } }; },
      getProjectTriggers: function () { return []; }, deleteTrigger: function () {},
      newTrigger: function () { return { timeBased: function () { return { onWeekDay: function () { return { atHour: function () { return { create: function () {} }; } }; } }; } }; },
      WeekDay: { MONDAY: 'MONDAY' }
    },
    Logger: { log: function () {} },
    HtmlService: {},
    console: { log: function () {}, warn: function () {}, error: function () {} }
  };

  var names = Object.keys(services);
  /* global DEMO_SERVER_CODE */
  var factory = new Function(names.join(','), DEMO_SERVER_CODE +
    '\nreturn { call: call, apiRequestCode: apiRequestCode, apiVerifyCode: apiVerifyCode, setup: setup, createSession_: createSession_ };');
  var server = factory.apply(null, names.map(function (n) { return services[n]; }));

  /* ---- seed the demo the same way the previews do ---- */
  server.setup();
  var g = {
    __drive: { folder: folder },
    __setUser: function (e) { currentUser = e; },
    __api: function (name) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (!tokens[currentUser]) tokens[currentUser] = server.createSession_(currentUser);
      return server.call(tokens[currentUser], name, args);
    }
  };
  window.__seedDemo(g);
  mail.length = 0;

  /* ---- google.script.run for the page ---- */
  function lastCodeFor(email) {
    for (var i = mail.length - 1; i >= 0; i--) {
      if (mail[i].to === email) { var m = /code: (\d{6})/.exec(mail[i].subject); if (m) return m[1]; }
    }
    return '';
  }
  window.google = { script: {
    url: { getLocation: function (cb) { cb({ parameter: {} }); } },
    get run() {
      var ok, bad;
      var p = new Proxy({}, { get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { ok = f; return p; };
        if (name === 'withFailureHandler') return function (f) { bad = f; return p; };
        return function () {
          var args = Array.prototype.slice.call(arguments);
          setTimeout(function () {
            try {
              var res = JSON.parse(JSON.stringify(server[name].apply(null, args) || null));
              if (name === 'apiRequestCode') window.__demoShowCode(String(args[0]).trim().toLowerCase(), lastCodeFor(String(args[0]).trim().toLowerCase()));
              ok(res);
            } catch (e) { bad(new Error(e.message)); }
          }, 120);
        };
      } });
      return p;
    }
  } };
})();
