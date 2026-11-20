// Builds demo/index.html: the real app (dist/) running entirely in the browser
// with sample data, for trying it out on a phone before deploying.
// Run: npm run demo
const fs = require('node:fs');
const path = require('node:path');
const { createContext } = require('../tests/gas-mock');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Render the page template the way Apps Script would.
const g = createContext({ userEmail: 'admin@church.test', now: new Date(), owner: 'admin@church.test' });
g.setup();
const scope = { brand: g.brandOf_(g.readSettings_()), formLogicSource: () => g.formLogicSource() };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let page = read('dist/Index.html').replace(/<\?(!?)=\s*([\s\S]*?)\s*;?\s*\?>/g, (_, raw, expr) => {
  const v = Function(...Object.keys(scope), 'return (' + expr + ');')(...Object.values(scope));
  return raw ? String(v) : esc(v);
});
const head = /<head>([\s\S]*?)<\/head>/.exec(page)[1].replace(/<base[^>]*>/, '');
const body = /<body>([\s\S]*?)<\/body>/.exec(page)[1];

const seedSource = read('tests/fixtures/seed.js');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const demoBar = `
<div class="demo-bar" id="demoBar">
  <div><b>Demo with sample data.</b> Nothing is saved or emailed; reloading starts over. Sign in as:</div>
  <div class="demo-people">
    <button type="button" data-email="admin@church.test">Michael · admin</button>
    <button type="button" data-email="designer@church.test">Jamie · designer</button>
    <button type="button" data-email="kara@church.test">Kara · staff</button>
    <button type="button" data-email="volunteer@gmail.com">Vera · outside volunteer</button>
  </div>
</div>
<div class="demo-toast" id="demoToast" hidden></div>
<style>
  .demo-bar { background: #1d2733; color: #fff; font: 13px/1.4 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center;
    padding: 8px max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px)); }
  .demo-people { display: flex; flex-wrap: wrap; gap: 6px; }
  .demo-people button { background: #2d3b47; color: #fff; border: 1px solid #4a5b68; border-radius: 14px; padding: 4px 10px; font: 600 12px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; cursor: pointer; }
  .demo-toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 50; background: #1d2733; color: #fff;
    padding: 12px 16px; border-radius: 10px; font: 14px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.25); max-width: calc(100% - 32px); }
  .demo-toast button { margin-left: 10px; background: #00b5e2; color: #fff; border: 0; border-radius: 6px; padding: 6px 10px; font-weight: 600; cursor: pointer; }
</style>`;

const demoGlue = `
<script>
  window.DEMO_SERVER_CODE = ${json(read('dist/Code.gs'))};
  window.__seedDemo = function (g) {
    var module = {};
    ${seedSource}
    var who = module.exports(g);
    g.__setUser(who.ADMIN);
    g.__api('apiSavePerson', { email: 'volunteer@gmail.com', name: 'Vera Volunteer', role: 'Staff', ministry: 'Calvary Kids' });
  };
  window.__demoShowCode = function (email, code) {
    var t = document.getElementById('demoToast');
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(document.createTextNode(code ? 'Demo inbox for ' + email + ': code ' + code : 'No code sent: ' + email + ' is not on the People list.'));
    if (code) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Fill it in';
      b.onclick = function () { var c = document.getElementById('loginCode'); if (c) { c.value = code; c.form.requestSubmit(); } t.hidden = true; };
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(window.__demoT); window.__demoT = setTimeout(function () { t.hidden = true; }, 15000);
  };
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-email]');
    if (chip) {
      var out = document.getElementById('signOut');
      if (!document.body.classList.contains('signed-out') && out) out.click();
      setTimeout(function () {
        var input = document.getElementById('loginEmail');
        if (!input) return;
        var again = Array.prototype.find.call(document.querySelectorAll('#login button.link'), function (x) { return !x.hidden; });
        if (again) again.click();
        input.value = chip.dataset.email;
        input.form.requestSubmit();
      }, 50);
      return;
    }
    var a = e.target.closest('a[href*="drive.google.com"], a[href*="docs.google.com"]');
    if (a) { e.preventDefault(); window.__demoShowCode('', ''); document.getElementById('demoToast').textContent = 'In the real app this opens the request\\'s Google Drive folder.'; }
  }, true);
</script>
<script>${read('scripts/demo-runtime.js').replace(/<\/script/gi, '<\\/script')}</script>`;

const out = `<title>Comms App Demo</title>
${head}
${demoBar}
${demoGlue}
${body}`;

fs.mkdirSync(path.join(root, 'demo'), { recursive: true });
fs.writeFileSync(path.join(root, 'demo', 'index.html'), out);
console.log('Wrote demo/index.html (' + Math.round(out.length / 1024) + ' KB)');
