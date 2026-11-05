import { chromium } from 'playwright-core';
import path from 'path';
const out = process.argv[2] || '/tmp/opencode';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
await page.goto('file://' + path.resolve('index.html'));
await page.waitForTimeout(700);
const grab = n => page.screenshot({ path: path.join(out, n + '.jpg'), quality: 55, type: 'jpeg' });
const tabClick = async (sel, i) => { await page.click(`${sel} .tab >> nth=${i}`); await page.waitForTimeout(250); };
const clickIf = async (sel) => { const disabled = await page.$eval(sel, b => b.disabled); if (!disabled) await page.click(sel); };

// 1. title — forest + Huey backdrop
await grab('shot1-title');

// 2. barracks
await page.click('#b-char');
await page.waitForTimeout(400);
await page.fill('#inName', 'SGT. BLOODWORTH');
await grab('shot2-barracks');

// 3. loadout — owned weapons list + selection detail
await page.click('#b-toLoadout');
await page.waitForTimeout(300);
await page.click('#lo-list .witem >> nth=0');
await page.waitForTimeout(200);
await grab('shot3-loadout');

// 4. S-4 store — pistols, buy first unowned
await page.click('#lo-back');            // → title
await page.click('#b-store');
await page.waitForTimeout(300);
await tabClick('#st-tabs', 6);           // PISTOLS
await page.click('#st-list .witem >> nth=4');
await page.waitForTimeout(200);
await page.evaluate(() => { if (S.req < 400) { S.req += 400; save(); refreshTop(); } }); // test funds
await page.click('#st-buy');
await page.waitForTimeout(250);
await grab('shot4-store-pistols');

// 5. squad — process FIELD package, assign troops
await page.click('#st-back');
await page.click('#b-squad');
await page.waitForTimeout(300);
await tabClick('#sq-tabs', 1);           // REINFORCEMENT OFFICE
await page.click('#sq-list .witem >> nth=0');
await page.waitForTimeout(200);
await page.click('#sq-buy');
await page.waitForTimeout(400);
await grab('shot5-crate-result');
await tabClick('#sq-tabs', 0);           // roster
const n = await page.$$eval('#sq-list .witem', a => a.length);
let eq = 0;
for (let i = 0; i < n; i++) {
  if (eq >= 3) break;
  await page.click(`#sq-list .witem >> nth=${i}`); await page.waitForTimeout(40);
  if (!(await page.$eval('#sq-set1', b => b.disabled))) { await page.click(`#sq-set${eq + 1}`); eq++; await page.waitForTimeout(40); }
}
await grab('shot5b-squad-equipped');

// 6. deploy from squad screen — village round 1
await page.click('#sq-deploy');
await page.waitForTimeout(2000);
await grab('shot6-village');
await page.mouse.move(640, 320);
await page.mouse.down();
await page.waitForTimeout(1400);
await page.keyboard.down('d'); await page.waitForTimeout(700); await page.keyboard.up('d');
await page.mouse.up();
await grab('shot7-combat');

// 7. force clear → inter screen   (R/G are top-level `let` — reference lexically, not via window)
await page.evaluate(() => { if (typeof R !== 'undefined' && R && G.scene === 'game') { R.run.enemies.forEach(e => e.dead = true); R.run.toSpawn = 0; } });
await page.waitForTimeout(700);
const interOn = await page.$eval('#scr-inter', s => s.classList.contains('on'));
await grab('shot8-inter');

// 8. back to title, START button begins a fresh run (round 1 village)
if (interOn) {
  await page.click('#b-inter-store');
  await page.waitForTimeout(200);
  await grab('shot8b-store-from-inter');
  await page.evaluate(() => gotoTitle());
}
await page.waitForTimeout(300);
await grab('shot9-title-before-start');
const startVisible = await page.$eval('#b-start', b => {
  const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden';
}).catch(() => 'gone');
await page.click('#b-start');
await page.waitForTimeout(2200);
const inGame = await page.evaluate(() => typeof G !== 'undefined' ? G.scene : 'no-G');
const roundTxt = await page.evaluate(() => typeof R !== 'undefined' && R ? R.run.biome.n + ' r' + R.run.round : 'no-R');
await grab('shot10-start-village');
console.log(JSON.stringify({ startVisible, inGame, roundTxt, errors: errors.slice(0, 8), shots: out }));
await browser.close();
