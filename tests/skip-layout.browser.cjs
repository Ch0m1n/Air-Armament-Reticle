const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');const fs=require('node:fs');const artifacts=path.resolve(__dirname,'../test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.MK_CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.RETICLE_SITE_URL||'http://127.0.0.1:8776/';
 await page.goto(base);await page.waitForFunction(()=>typeof catalog!=='undefined'&&catalog&&!busy);
 const entries=await page.evaluate(()=>['PFAL501_Bearn_stock','PRAL902_A_NAKHIMOV_TOP'].map(name=>catalog.entries.find(e=>e.aircraft===name&&e.datasetId.startsWith('korabli'))));
 const url=new URL(base);url.searchParams.set('game','korabli');url.searchParams.set('version',entries[0].datasetId.split(':')[1]);url.searchParams.set('aircraft',entries.map(e=>e.id).join(','));url.searchParams.set('type','skip');
 await page.goto(url.href);await page.waitForFunction(()=>!busy&&selections.length===2);
 const frames=async()=>{
  const nodes=await page.locator('#comparison-skip iframe').elementHandles();assert.equal(nodes.length,2);
  const result=[];
  for(const node of nodes){await node.waitForElementState('visible');const f=await node.contentFrame();await f.waitForFunction(()=>window.setSkipSharedScale&&document.querySelector(previewState.view==='compare'?'#reference':'#linked').dataset.bombs);result.push(f)}
  return result;
 };
 const scales=()=>page.evaluate(()=>Array.from(document.querySelectorAll('#comparison-skip iframe')).flatMap(frame=>{
  const d=frame.contentDocument;return Array.from(d.querySelectorAll('canvas')).filter(c=>c.getBoundingClientRect().width>0).map(c=>({top:Number(c.dataset.topPixelsPerMapMeter),side:Number(c.dataset.sidePixelsPerMapMeter),hull:Number(c.dataset.yamatoLengthPixels),enabled:c.dataset.sharedScale}));
 }));
 const equal=async()=>{
  await page.waitForFunction(()=>{
   const fs=Array.from(document.querySelectorAll('#comparison-skip iframe'));
   const cs=fs.flatMap(f=>Array.from(f.contentDocument.querySelectorAll('canvas')).filter(c=>c.getBoundingClientRect().width>0));
   return cs.length>=2&&cs.every(c=>c.dataset.sharedScale==='true'&&Number(c.dataset.topPixelsPerMapMeter)>0&&Math.abs(Number(c.dataset.topPixelsPerMapMeter)-Number(cs[0].dataset.topPixelsPerMapMeter))<1e-10&&Math.abs(Number(c.dataset.sidePixelsPerMapMeter)-Number(cs[0].dataset.sidePixelsPerMapMeter))<1e-10);
  });
  const values=await scales();values.forEach(s=>assert.ok(Math.abs(s.hull/s.top-526)<1e-8));return values;
 };
 const snapshots=async()=>{const fs=await frames();return Promise.all(fs.map(f=>f.evaluate(()=>{const c=document.querySelector(previewState.view==='compare'?'#reference':'#linked');return {seed:c.dataset.salvoSeed,bombs:JSON.parse(c.dataset.bombs)}})))};
 let fs=await frames();await equal();
 assert.equal(await page.locator('#shared-scale').isEnabled(),true);
 const cards=await page.locator('#comparison-skip .skip-card').evaluateAll(cs=>cs.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}));
 assert.ok(cards[1].x>cards[0].x+cards[0].width*.9&&Math.abs(cards[0].y-cards[1].y)<1,'Card view places ships side by side');
 await fs[0].getByRole('button',{name:'New salvo',exact:true}).click();await page.waitForTimeout(60);
 const saved=await snapshots();
 await page.screenshot({path:path.join(artifacts,'T-skip-card-shared.png'),fullPage:true});
 await page.getByRole('button',{name:'List view',exact:true}).click();fs=await frames();await equal();
 assert.deepEqual(await snapshots(),saved,'Changing layout retains samples and playback');
 const list=await page.locator('#comparison-skip .skip-card').evaluateAll(cs=>cs.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}));
 assert.ok(Math.abs(list[0].x-list[1].x)<1&&list[1].y>list[0].y&&list[0].width>cards[0].width*1.5,'List view uses full-width rows');
 // Unequal individual ranges must still have identical physical pixel scales.
 await fs[0].locator('#topRange').selectOption('all');await fs[0].locator('#sideRange').selectOption('all');
 await fs[1].locator('#topRange').selectOption('all');await fs[1].locator('#sideRange').selectOption('all');
 await equal();const settled=await scales();await page.waitForTimeout(350);assert.deepEqual(await scales(),settled,'Scale coordination converges without shrinking feedback');
 await page.locator('#shared-scale').uncheck();fs=await frames();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#comparison-skip iframe')).every(f=>f.contentDocument.querySelector('#linked').dataset.sharedScale==='false'));
 const independent=await scales();assert.ok(Math.abs(independent[0].top-independent[1].top)>1e-4,'Independent ranges use independent scales');
 assert.deepEqual(await snapshots(),saved,'Scale toggles keep the selected salvo');
 await page.locator('#shared-scale').check();fs=await frames();await equal();
 // Timing comparison may have narrower canvases, but all compared ships stay to scale.
 await fs[0].getByRole('button',{name:'Timing comparison',exact:true}).click();await equal();
 assert.equal((await scales()).length,4);
 await page.screenshot({path:path.join(artifacts,'T-skip-list-shared.png'),fullPage:true});
 await page.getByRole('button',{name:'Card view',exact:true}).click();await frames();await equal();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);fs=await frames();await equal();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const f of fs)assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'List view',exact:true}).click();await frames();await equal();
 await page.locator('#comparison-skip').screenshot({path:path.join(artifacts,'T-skip-mobile-shared.png')});
 assert.deepEqual(errors,[]);
 console.log('PASS: card/list geometry, shared top and side meters-to-pixels across ships and timing scenarios, independent scales, stable coordination, preserved salvos and mobile.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});

