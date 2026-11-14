const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
const rows=require('../src/skip-bombers/data.json').rows;
const artifacts=path.resolve(__dirname,'../test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
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
  await page.getByRole('button',{name:'Play all',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#skip-play-all').disabled);
  const result=[];for(const h of await page.locator('#comparison-skip iframe').elementHandles()){await h.waitForElementState('visible');result.push(await h.contentFrame())}return result;
 };
 let children=await frames();
 // Keep both hulls away so actual moving positions can be checked analytically.
 for(const child of children){await child.locator('#targetPosition').fill('10000');await child.locator('#targetPosition').press('Tab')}
 const seek=async(seconds)=>{await page.locator('#skip-time').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))},String(seconds));await page.waitForTimeout(60)};
 const snapshot=()=>Promise.all(children.map(f=>f.locator('#linked').evaluate(c=>({seed:Number(c.dataset.salvoSeed),bombs:JSON.parse(c.dataset.bombs)}))));
 const times=()=>Promise.all(children.map(f=>f.evaluate(()=>getSkipTime())));
 const initial=await snapshot(),durations=await Promise.all(children.map(f=>f.evaluate(()=>getSkipDuration())));
 assert.ok(Math.abs(durations[0]-durations[1])>.1,'Fixture ships have different total flight times');
 function at(points,t){const i=points.findIndex(p=>p.t>=t);if(i<=0)return i===0?points[0]:points.at(-1);const a=points[i-1],b=points[i],q=(t-a.t)/(b.t-a.t);return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q,z:a.z+(b.z-a.z)*q}}
 for(const seconds of [.5,2]){
  await seek(seconds);assert.deepEqual(await times(),[seconds,seconds]);
  const current=await snapshot();
  current.forEach((s,i)=>{
   const row=rows.find(r=>r.aircraft===entries[i].aircraft),expected=buildSalvo(row,'full',s.seed);
   s.bombs.forEach((b,j)=>{const p=at(expected[j].points,seconds);for(const key of ['x','y','z'])assert.ok(Math.abs(b[key]-p[key])<.001,`Same absolute time: ${i}/${j}/${key}`)});
  });
 }
 const atTwo=await snapshot();
 await page.getByRole('button',{name:'List view',exact:true}).click();children=await frames();
 assert.deepEqual(await times(),[2,2]);assert.deepEqual(await snapshot(),atTwo,'Layout preserves the synchronized time and positions');
 await page.locator('#shared-scale').uncheck();children=await frames();assert.deepEqual(await times(),[2,2]);assert.deepEqual(await snapshot(),atTwo);
 await page.getByRole('button',{name:'Reset all',exact:true}).click();await page.waitForTimeout(50);
 assert.deepEqual(await times(),[0,0]);assert.deepEqual((await snapshot()).map(s=>s.seed),initial.map(s=>s.seed));
 await page.getByRole('button',{name:'Play all',exact:true}).click();await page.waitForTimeout(350);
 await page.getByRole('button',{name:'Pause all',exact:true}).click();await page.waitForTimeout(50);
 const paused=await times();assert.ok(paused[0]>.15);assert.equal(paused[0],paused[1]);
 await page.waitForTimeout(120);assert.deepEqual(await times(),paused,'One pause holds every ship');
 const end=Math.max(...durations),short=durations.indexOf(Math.min(...durations));
 await seek(end);const finished=await snapshot();
 assert.deepEqual(await times(),[end,end]);
 assert.equal(await children[short].evaluate(()=>previewState.progress),1,'Shorter flight clamps its position, not the shared elapsed time');
 finished.forEach((s,i)=>{const paths=buildSalvo(rows.find(r=>r.aircraft===entries[i].aircraft),'full',s.seed);s.bombs.forEach((b,j)=>{const p=paths[j].points.at(-1);for(const key of ['x','y','z'])assert.ok(Math.abs(b[key]-p[key])<.001)})});
 await seek(end-.08);await page.getByRole('button',{name:'Play all',exact:true}).click();await page.waitForTimeout(230);
 assert.equal(await page.getByRole('button',{name:'Play all',exact:true}).count(),1,'Shared playback stops at the longest flight');assert.deepEqual(await times(),[end,end]);
 await seek(.5);await page.getByRole('button',{name:'Play all',exact:true}).click();
 await children[0].getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(100);
 assert.equal(await page.getByRole('button',{name:'Play all',exact:true}).count(),1,'An individual playback control exits shared playback');
 assert.equal(await children[0].evaluate(()=>previewState.playing),true);
 await children[0].getByRole('button',{name:'Pause',exact:true}).click();
 await seek(2);await page.getByRole('button',{name:'Card view',exact:true}).click();children=await frames();assert.deepEqual(await times(),[2,2]);
 for(let run=0;run<2;run++){
  const before=await snapshot();
  await page.evaluate(()=>document.addEventListener('click',event=>{
   if(event.target.id==='skip-new-all')window.newAllAtClick=Array.from(document.querySelectorAll('#comparison-skip iframe')).map(f=>({time:f.contentWindow.getSkipTime(),seed:f.contentWindow.previewState.salvoSeed}));
  },{once:true}));
  await page.getByRole('button',{name:'New salvo all',exact:true}).click();
  const atClick=await page.evaluate(()=>window.newAllAtClick);
  atClick.forEach((s,i)=>{assert.equal(s.time,0,'Every ship resets in the same click');assert.notEqual(s.seed,before[i].seed,'Every ship gets a fresh sample')});
  await page.waitForTimeout(130);const running=await times();assert.ok(running[0]>.04);assert.equal(running[0],running[1],'New samples start playing together');
  assert.equal(await page.getByRole('button',{name:'Pause all',exact:true}).count(),1);
  await seek(2);const after=await snapshot();
  after.forEach((s,i)=>assert.notDeepEqual(s.bombs,before[i].bombs,'Actual dispersion changes for every ship'));
  const currentEnd=await page.locator('#skip-time').getAttribute('max');
  const freshDurations=await Promise.all(children.map(f=>f.evaluate(()=>getSkipDuration())));
  assert.ok(Math.abs(Number(currentEnd)-Math.max(...freshDurations))<1e-10,'Shared timeline uses the new flight durations');
  await page.getByRole('button',{name:'Reset all',exact:true}).click();await seek(2);assert.deepEqual(await snapshot(),after,'Reset all reuses the newly generated samples');
  if(run===0)await page.getByRole('button',{name:'Play all',exact:true}).click();
 }
 await children[0].getByRole('button',{name:'Timing comparison',exact:true}).click();await page.waitForTimeout(80);
 const timing=await children[0].locator('#comparison canvas').evaluateAll(cs=>cs.map(c=>({seed:c.dataset.salvoSeed,bombs:JSON.parse(c.dataset.bombs)})));
 timing.forEach(s=>assert.deepEqual(s,timing[0],'Timing comparisons retain the new shared sample'));
 await children[0].getByRole('button',{name:'Linked views',exact:true}).click();await page.waitForTimeout(50);
 await page.locator('#comparison-skip').screenshot({path:path.join(artifacts,'skip-shared-playback-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await seek(1);assert.deepEqual(await times(),[1,1]);
 const bounds=await page.locator('.skip-transport').evaluate(e=>[...e.children].map(c=>{const r=c.getBoundingClientRect();return [r.left,r.right]}));bounds.forEach(([a,b])=>assert.ok(a>=0&&b<=390));
 await page.locator('.skip-transport').screenshot({path:path.join(artifacts,'skip-shared-playback-mobile.png')});
 assert.deepEqual(errors,[]);
 console.log('PASS: new salvo all refreshes every sample and starts together, repeated regeneration, updated durations, same-sample replay/timing, shared seconds/coordinates, play/pause/reset/seek, finish hold, layouts and mobile.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
