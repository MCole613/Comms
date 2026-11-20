// Renders the real UI in Chromium with google.script.run wired to the mocked backend.
// Usage: node tests/preview.js <outDir>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createContext } = require('./gas-mock');

(async () => {
  const out = process.argv[2] || '.';
  const g = createContext({ userEmail: 'students@church.org', now: new Date(2027, 0, 4, 9, 0) });
  g.setup();
  const team = g.__sheets['Team'].data; team.length = 1;
  [['Comms Director','comms@church.org','Communications Director','Communications','','','Yes'],
   ['Dana Designer','design@church.org','Designer','Communications','','','Yes'],
   ['Sam Social','social@church.org','Social Media','Communications','','','Yes'],
   ['Pat Student Pastor','students@church.org','Leadership','Students','asst@church.org','xp@church.org','Yes'],
   ['Alex Assistant','asst@church.org','Ministry Assistant','Students','','','Yes'],
   ['Jordan XP','xp@church.org','Leadership','Executive','','','Yes']].forEach(r => team.push(r));

  const src = path.join(__dirname, '..', 'src');
  const html = fs.readFileSync(path.join(src, 'Index.html'), 'utf8')
    .replace(/<\?!= include\('(\w+)'\); \?>/g, (_, f) => fs.readFileSync(path.join(src, f + '.html'), 'utf8'));
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
    try { return { value: JSON.parse(JSON.stringify(g[name](...args) ?? null)) }; }
    catch (e) { return { error: e.message }; }
  });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.setContent(html.replace('<head>', '<head>' + stub));
  await page.waitForSelector('.check');

  await page.fill('[name=title]', 'Winter Retreat');
  await page.fill('[name=eventDate]', '2027-02-05');
  await page.dispatchEvent('[name=eventDate]', 'change');
  await page.fill('[name=location]', 'Camp Pinewood');
  await page.fill('[name=description]', 'Our annual student winter retreat — three days of worship, games and snow.');
  for (const d of ['Graphic Design', 'Social Media', 'Stage Announcement']) await page.check(`input[value="${d}"]`);
  await page.waitForSelector('.tl li');
  await page.screenshot({ path: path.join(out, '1-new-request.png'), fullPage: true });

  await page.click('#submitBtn');
  await page.waitForSelector('#view-detail.active .tl li');
  await page.screenshot({ path: path.join(out, '2-request-detail.png'), fullPage: true });

  await page.click('.tab[data-view=timeline]');
  await page.waitForSelector('#timelineList .item');
  await page.screenshot({ path: path.join(out, '3-team-timeline.png'), fullPage: true });

  const brief = g.__mail.find(m => m.to === 'design@church.org');
  fs.writeFileSync(path.join(out, 'designer-brief.html'), brief.htmlBody);
  const p2 = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await p2.setContent(brief.htmlBody);
  await p2.screenshot({ path: path.join(out, '4-designer-brief-email.png'), fullPage: true });
  console.log('emails sent:', g.__mail.map(m => m.to + ' | ' + m.subject).join('\n  '));
  await browser.close();
})();
