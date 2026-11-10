import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.HERMES_CHECKOUT+'/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try {
 const page=await browser.newPage({viewport:{width:900,height:500},reducedMotion:'reduce'});
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office');
 const bubble=page.locator('[data-working-bubble]');await bubble.waitFor();
 assert.match(await bubble.innerText(),/工作中/,'working kaomoji has visible status text');
 const label=bubble.getByText('工作中',{exact:true});assert.ok(await label.isVisible());
 const bounds=await label.evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.width>0&&a.left>=b.left&&a.right<=b.right});assert.ok(bounds,'status text fits bubble');
 assert.equal(await page.locator('[data-working-bubble]').count(),1,'idle avatar has no working bubble');
 await page.screenshot({path:'evidence/floating-text.png'});
 await page.getByRole('button',{name:'Aster · state working'}).click();assert.equal(await bubble.count(),0,'selected avatar hides floating bubble');
 console.log('PASS floating working face and visible status label, idle and selected exclusion');
} finally {await browser.close()}
