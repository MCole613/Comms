// Renders the real UI in headless Chromium, with google.script.run wired to
// the app's server code running against mocked Google services.
// Usage: node tests/preview.js [outDir] [seedModule]   (env PREVIEW_USER picks who is signed in)
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createContext } = require('./gas-mock');

(async () => {
  const out = path.resolve(process.argv[2] || 'preview');
  fs.mkdirSync(out, { recursive: true });
  const seed = require(path.resolve(process.argv[3] || path.join(__dirname, 'fixtures/seed.js')));
  const g = createContext({ userEmail: 'admin@church.test', now: new Date(2026, 10, 20, 9, 0), owner: 'admin@church.test' });
  g.setup();
  const who = seed(g);
  g.__setUser(process.env.PREVIEW_USER || who.ADMIN);

  const src = path.join(__dirname, '..', 'src');
  const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
  const scope = { brand: g.brandOf_(g.readSettings_()), include: (n) => render(read(n + '.html')), formLogicSource: () => g.formLogicSource() };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function render(tpl) {
    return tpl.replace(/<\?(!?)=\s*([\s\S]*?)\s*;?\s*\?>/g, (_, raw, expr) => {
      const v = Function(...Object.keys(scope), 'return (' + expr + ');')(...Object.values(scope));
      return raw ? String(v) : esc(v);
    });
  }
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
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  page.on('dialog', d => d.accept());
  await page.setContent(render(read('Index.html')).replace('<head>', '<head>' + stub));
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
  const tab = async (v, sel) => { await page.click(`.tab[data-view=${v}]`); await page.waitForSelector(sel); };

  // Each step is independent so a preview with different data still captures what it can.
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('skipped ' + name + ': ' + e.message.split('\n')[0]); } };
  await step('screens', async () => {
  await page.waitForSelector('.stat');
    await shot('1-home');
    await tab('new', '#newRequest form');
    await page.check('input[value^="Promoting an event"]');
    await page.waitForSelector('legend:has-text("Audience")');
    await shot('2-new-request');
    await page.click('.tab[data-view=home]');
    await page.waitForSelector('.stat');
    await page.click('text=Easter Egg Hunt');
    await page.waitForSelector('#detail .panel');
    await shot('3-review');
    await tab('calendar', '.cal');
    await page.click('.cal-head button:has-text("›")');
    await page.waitForSelector('.cal .ev');
    await shot('4-calendar');
    await tab('design', '#designList .item');
    await shot('5-design-queue');
    await tab('admin', 'table.people');
    await shot('6-admin');

    // The requester's view of a draft waiting for review.
    g.__setUser(who.KARA);
    await page.setContent(render(read('Index.html')).replace('<head>', '<head>' + stub));
    await page.waitForSelector('.stat');
    await shot('7-requester-home');
    await page.click('text=CK Movie Night graphic');
    await page.waitForSelector('#detail .panel.attn');
    await shot('8-design-review');
    await page.click('button:has-text("Request changes")');
    await page.waitForSelector('#modalBody form');
    await page.screenshot({ path: path.join(out, '9-feedback.png') });
    await page.click('#modalClose');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('#menuBtn');
    await page.click('.tab[data-view=tasks]');
    await page.waitForSelector('#taskList .item, #taskList .empty');
    await shot('10-mobile-tasks');
  });
  await browser.close();
  console.log('Screenshots in', out);
})();
