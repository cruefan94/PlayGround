import { chromium } from 'playwright-core';
import path from 'path';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + path.resolve('index.html'));
await page.waitForTimeout(600);

// raid panel opens
await page.click('#b-raid');
await page.waitForTimeout(200);
const open = await page.$eval('#raidPanel', p => p.classList.contains('on'));
const goReady = await page.$eval('#b-raidGo', b => !b.disabled);
await page.click('#b-raidGo');
await page.waitForTimeout(400);
const resTxt = await page.$eval('#raidRes', el => el.textContent);
const cdTxt = await page.$eval('#raidCd', el => el.textContent);
const btnLbl = await page.$eval('#raidTimer', el => el.textContent);
const ownedMates = await page.evaluate(() => S.ownedMates.length);
// cooldown blocks second raid even after faking time
const secondDisabled = await page.$eval('#b-raidGo', b => b.disabled);
await page.screenshot({ path: '/tmp/opencode/raid.jpg', quality: 55, type: 'jpeg' });
// simulate 12h passing → ready again
await page.evaluate(() => { S.raidLast = Date.now() - 12 * 3600 * 1000 - 1000; save(); });
await page.waitForTimeout(1100);
const readyAfter12h = await page.$eval('#b-raidGo', b => !b.disabled);
console.log(JSON.stringify({ open, goReady, secondDisabled, readyAfter12h, ownedMates, cdTxt, btnLbl, resLines: resTxt.split(/\n|(?=Gear:|Troop:|Duplicate|Armor|Clothing|Roster)/).length, errors }, null, 1));
await browser.close();
