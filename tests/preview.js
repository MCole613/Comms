// Renders the real UI in headless Chromium, with google.script.run wired to the
// mocked backend. Usage: node tests/preview.js <outDir> [tabsModule]
//   tabsModule (optional) exports hubTabs() returning real-shaped tab data.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createContext } = require('./gas-mock');

(async () => {
  const out = path.resolve(process.argv[2] || 'preview');
  fs.mkdirSync(out, { recursive: true });
  const tabsMod = process.argv[3] ? require(path.resolve(process.argv[3])) : require('./fixtures/hub');
  const user = process.env.PREVIEW_USER || 'admin@example.org';
  const now = process.env.PREVIEW_NOW ? new Date(process.env.PREVIEW_NOW) : new Date(2026, 10, 20, 9, 0);
  const g = createContext({ tabs: tabsMod.hubTabs(), userEmail: user, now });

  // Evaluate the HtmlService template the way Apps Script would.
  const src = path.join(__dirname, '..', 'src');
  const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
  const brand = g.brandOf_(g.readConfig_());
  const scope = { brand, include: (n) => render(read(n + '.html')), formLogicSource: () => g.formLogicSource() };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function render(tpl) {
    return tpl.replace(/<\?(!?)=\s*([\s\S]*?)\s*;?\s*\?>/g, (_, raw, expr) => {
      const v = Function(...Object.keys(scope), 'return (' + expr + ');')(...Object.values(scope));
      return raw ? String(v) : esc(v);
    });
  }
  const html = render(read('Index.html'));
  const stub = `<script>
    window.google = { script: {
      url: { getLocation: cb => cb({ parameter: {} }) },
      get run() { let ok, bad; const p = new Proxy({}, { get: (_, name) => {
        if (name === 'withSuccessHandler') return f => (ok = f, p);
        if (name === 'withFailureHandler') return f => (bad = f, p);
        return (...args) => window.__gas(name, args).then(r => r.error ? bad(new Error(r.error)) : ok(r.value));
      }}); return p; }
    }};</script>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.exposeFunction('__gas', (name, args) => {
    try { return { value: g.__call(name, ...args) }; } catch (e) { return { error: e.message }; }
  });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.setContent(html.replace('<head>', '<head>' + stub));
  await page.waitForSelector('.stat');
  await page.screenshot({ path: path.join(out, '1-home.png'), fullPage: true });

  await page.click('.tab[data-view=new]');
  await page.waitForSelector('#requestForm form');
  await page.check('input[value^="Promoting an event"]');
  await page.waitForSelector('legend:has-text("Audience")');
  const q = (text) => page.locator('fieldset:not([hidden]) .q', { hasText: text });
  await q('Event or initiative name').locator('input').fill('Spring Kids Camp');
  await q('Who is this for?').locator('input[value^="A specific age group"]').check();
  await q('How much of the church').locator('input[value="25-49%"]').check();
  await q('Event / launch date').locator('input').fill('2027-01-29');
  await q('Do you need graphic design').locator('input[value="Yes"]').check();
  await q('What needs to be designed?').locator('input[value="Social graphics"]').check();
  await page.screenshot({ path: path.join(out, '2-new-request.png'), fullPage: true });

  await page.click('.tab[data-view=design]');
  await page.waitForSelector('#designList .item, #designList .empty');
  await page.screenshot({ path: path.join(out, '3-design-queue.png'), fullPage: true });

  await page.click('#designList .item');
  await page.waitForSelector('#detail .tl');
  await page.screenshot({ path: path.join(out, '4-request-detail.png'), fullPage: true });

  const fb = await page.$('text=Request design changes');
  if (fb) {
    await fb.click();
    await page.waitForSelector('#modalBody form');
    await page.screenshot({ path: path.join(out, '5-feedback-modal.png') });
    await page.click('#modalClose');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#menuBtn');
  await page.click('.tab[data-view=tasks]');
  await page.waitForSelector('#taskList .item, #taskList .empty');
  await page.screenshot({ path: path.join(out, '6-mobile-tasks.png'), fullPage: true });
  await browser.close();
  console.log('Screenshots in', out);
})();
