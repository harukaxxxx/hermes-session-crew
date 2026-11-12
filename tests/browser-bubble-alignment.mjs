import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.HERMES_CHECKOUT+'/package.json')('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900},reducedMotion:'reduce'});
 await page.goto(pathToFileURL(path.resolve('tests/sdk-preview.html')).href+'?gallery&office');
 await page.waitForFunction(()=>document.querySelectorAll('[data-working-bubble]').length===2);
 for(const zoom of [1,1.5]){
  await page.evaluate(z=>{document.body.style.zoom=z;window.dispatchEvent(new Event('resize'))},zoom);
  await page.waitForTimeout(150);
  const rows=await page.locator('[data-working-bubble]').evaluateAll(bs=>bs.map(b=>{const row=b.parentElement,a=row.getBoundingClientRect(),stack=row.querySelector('[data-avatar-stack]').getBoundingClientRect(),r=b.getBoundingClientRect(),spans=[...b.querySelectorAll('span > span')].map(x=>x.getBoundingClientRect());return {a:a.toJSON(),stack:stack.toJSON(),bubble:r.toJSON(),spans:spans.map(x=>x.toJSON()),text:b.textContent}}));
  assert.equal(rows.length,2);
  for(const {a,stack,bubble,spans,text} of rows){assert.ok(Math.abs(bubble.left-stack.right-6*zoom)<2,`zoom ${zoom} gap: ${JSON.stringify({stack,bubble})}`);assert.ok(Math.abs(bubble.top-a.top-6*zoom)<2,`zoom ${zoom} vertical: ${JSON.stringify({a,bubble})}`);assert.ok(text.trim());for(const s of spans)assert.ok(s.top>=bubble.top&&s.bottom<=bubble.bottom&&s.left>=bubble.left&&s.right<=bubble.right,`zoom ${zoom} clipped text ${JSON.stringify({s,bubble,text})}`)}
  const inkFits=await page.locator('[data-working-bubble]').first().evaluate(b=>{const face=b.querySelector('span > span'),css=getComputedStyle(face),ctx=document.createElement('canvas').getContext('2d');ctx.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;return ['(｡•́︿•̀｡)','(◔_◔)','(¬‿¬)','( •_•)>⌐■-■','(⌐■_■)','(´･_･`)','◉_◉','(°ロ°)','( ˘⌣˘)♡','ヽ(>∀<☆)☆','٩(๑❛ᴗ❛๑)۶','(⊙_⊙)','(¬_¬)','( ͡° ͜ʖ ͡°)','ಠ_ಠ'].every(t=>{const m=ctx.measureText(t);return m.actualBoundingBoxAscent+m.actualBoundingBoxDescent<=b.clientHeight-6})});assert.ok(inkFits,`zoom ${zoom} all face ink heights fit padded bubble`);
 }

 console.log('PASS plugin bubble anchor and text bounds at 100% and 150% CSS zoom');
}finally{await browser.close()}
