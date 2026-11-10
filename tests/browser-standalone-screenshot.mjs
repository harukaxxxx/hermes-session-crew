import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=createRequire((process.env.HERMES_CHECKOUT||process.env.HERMES_AGENT_ROOT||(()=>{throw Error('Set HERMES_CHECKOUT or HERMES_AGENT_ROOT')})())+'/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:(process.env.CHROME_PATH||(()=>{throw Error('Set CHROME_PATH')})())});
try {
 const page=await browser.newPage({viewport:{width:900,height:650}});
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?office&gallery');
 // Explicit fixture palette for shipped token names, not a live Desktop stylesheet.
 await page.addStyleTag({content:':root{--ui-green:#86c6ac;--ui-yellow:#e6c37a}'});
 await page.getByRole('button',{name:'Aster · 狀態 工作中'}).waitFor();
 await page.evaluate(()=>{
  const states=['working','waiting','idle','offline','unknown'];
  window.officeClient.setQueryData(['profile-rail','status','fixture','Aster',1],window.fixtureProfiles.map((p,i)=>({profile:p.name,online:i%5!==3,state:states[i%5],idle_since:i%5===2?100+i:null})));
 });
 await page.getByRole('button',{name:'Mika · 狀態 等待中'}).waitFor();
 const rings=await page.locator('[data-state-name]').evaluateAll(es=>es.map(e=>{
  const face=e.querySelector('[data-avatar]'), outline=e.closest('[data-avatar-stack]').querySelector('[data-avatar-outline]')||face, css=getComputedStyle(outline);
  return {state:e.dataset.stateName,color:css.outlineColor,style:css.outlineStyle,width:css.outlineWidth,size:face.getBoundingClientRect().width};
 }));
 assert.deepEqual(rings.map(r=>r.state),['working','working','working','waiting','waiting','waiting','idle','idle','unknown','unknown','offline','offline']);
 const expected={working:'rgb(134, 198, 172)',waiting:'rgb(230, 195, 122)',idle:'rgb(170, 166, 175)',offline:'rgb(113, 109, 120)',unknown:'rgb(87, 87, 97)'};
 for(const ring of rings){assert.equal(ring.color,expected[ring.state]);assert.equal(ring.style,'solid');assert.equal(ring.width,'2px');assert.equal(ring.size,34);}
 await page.screenshot({path:'evidence/standalone-fixture-rail.png'});
 await page.getByRole('button',{name:'Mika · 狀態 等待中'}).click();
 await page.waitForSelector('[data-recent-row]');
 assert.equal(await page.locator('[data-slot="popover-content"]').first().locator('strong').first().textContent(),'Mika');
 await page.screenshot({path:'evidence/standalone-fixture-popup.png'});
 console.log('PASS controlled all-state computed rings, sorted fixture rail and owner popup screenshots');
} finally {await browser.close()}
