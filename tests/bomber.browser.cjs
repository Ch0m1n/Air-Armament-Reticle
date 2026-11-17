const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MK_CHROME_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await require('./static-preview.cjs').installStaticPreview(page);
  const base=process.env.RETICLE_SITE_URL||'http://127.0.0.1:8776/';
  await page.goto(base);await page.waitForFunction(()=>typeof catalog!=='undefined'&&catalog&&!busy);
  const entries=await page.evaluate(()=>['PAAD210_Midway_top','PJAD110_Hakuryu_stock','PBAD210_Audacious_top'].map(name=>catalog.entries.find(e=>e.aircraft===name&&e.datasetId==='wows:15.10')));
  const url=new URL(base);url.searchParams.set('game','wows');url.searchParams.set('version','15.10');url.searchParams.set('aircraft',entries.map(e=>e.id).join(','));url.searchParams.set('type','bomb');
  await page.goto(url.href);await page.waitForFunction(()=>!busy&&selections.length===3);
  const cards=page.locator('#comparison-bomb article');assert.equal(await cards.count(),3);
  for(let i=0;i<3;i++){
   await cards.nth(i).getByRole('button',{name:'New salvo',exact:true}).click();
   const slider=cards.nth(i).locator('[data-bomber-time]');
   await slider.evaluate(e=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}))});
  }
  const snapshot=()=>page.evaluate(()=>selections.filter(r=>r.kind==='bomb').map(r=>({name:r.name,seed:r.attack.seed,points:r.attack.points,elapsed:r.attack.elapsed,duration:r.attack.duration})));
  const first=await snapshot();assert.deepEqual(first.map(r=>r.points.length),[6,3,18]);
  assert.equal(await cards.nth(2).locator('ellipse.ellipse-maximum').count(),1);
  const beforeView=await snapshot();
  await cards.nth(2).getByRole('button',{name:'Combined releases',exact:true}).click();
  assert.equal(await cards.nth(2).locator('path.ellipse-maximum').count(),1);
  assert.deepEqual((await snapshot()).map(r=>r.points),beforeView.map(r=>r.points));
  await cards.nth(2).getByRole('button',{name:'Aiming outline',exact:true}).click();

  assert.equal(first[2].duration,.875);
  assert.equal(new Set(await cards.nth(2).locator('.bomber-drop').evaluateAll(es=>es.map(e=>getComputedStyle(e).fill))).size,3);
  for(const row of first)assert.equal(row.elapsed,row.duration);
  await cards.nth(2).getByRole('button',{name:'Replay',exact:true}).click();
  await page.waitForFunction(()=>selections.find(r=>r.name==='PBAD210_Audacious_top').attack.elapsed===.875);
  const replay=await snapshot();assert.deepEqual(replay.map(r=>r.points),first.map(r=>r.points));assert.deepEqual(replay.map(r=>r.seed),first.map(r=>r.seed));
  await cards.nth(2).locator('[data-bomber-time]').evaluate(e=>{e.value='.175';e.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await cards.nth(2).locator('.bomber-drop').evaluateAll(es=>es.filter(e=>e.style.visibility==='visible').length),6);
  await page.getByRole('button',{name:'List view',exact:true}).click();
  assert.deepEqual((await snapshot()).map(r=>r.points),first.map(r=>r.points));
  await page.locator('#shared-scale').uncheck();assert.deepEqual((await snapshot()).map(r=>r.points),first.map(r=>r.points));
  await cards.nth(2).getByRole('button',{name:'Enlarge chart',exact:true}).click();
  const dialog=page.locator('#drawing-dialog');await dialog.getByRole('button',{name:'Replay',exact:true}).click();
  await page.waitForFunction(()=>selections.find(r=>r.name==='PBAD210_Audacious_top').attack.elapsed===.875);
  assert.equal(await dialog.locator('.bomber-drop').evaluateAll(es=>es.filter(e=>e.style.visibility==='visible').length),18);
  await page.keyboard.press('Escape');
  await cards.nth(2).getByRole('button',{name:'New salvo',exact:true}).click();
  const next=await snapshot();assert.notEqual(next[2].seed,first[2].seed);assert.notDeepEqual(next[2].points,first[2].points);
  await cards.nth(2).getByRole('button',{name:'Immediate drop',exact:true}).click();assert.equal(await cards.nth(2).locator('.bomber-drop').count(),0);
  await cards.nth(2).getByRole('button',{name:'New salvo',exact:true}).click();
  await page.waitForTimeout(1000);
  await page.locator('#cards-view').click();
  await page.locator('#comparison-bomb').screenshot({path:path.resolve(__dirname,'../test-artifacts/bomber-model-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await cards.nth(2).screenshot({path:path.resolve(__dirname,'../test-artifacts/bomber-model-mobile.png')});
  const gz=await page.evaluate(()=>catalog.entries.find(e=>e.datasetId==='wows:15.10'&&e.ship==='Graf Zeppelin'&&e.role==='bomb').id);
  const gzUrl=new URL(base);gzUrl.searchParams.set('game','wows');gzUrl.searchParams.set('version','15.10');gzUrl.searchParams.set('type','bomb');gzUrl.searchParams.set('aircraft',gz);
  await page.goto(gzUrl.href);await page.waitForFunction(()=>!busy&&selections.length===1);
  const gzCard=page.locator('#comparison-bomb article');await gzCard.getByRole('button',{name:'New salvo',exact:true}).click();
  assert.equal(await gzCard.locator('.bomber-drop').count(),2);
  assert.deepEqual(await page.evaluate(()=>({duration:selections[0].attack.duration,releases:selections[0].attack.releases.length})),{duration:0,releases:1});
  await gzCard.screenshot({path:path.resolve(__dirname,'../test-artifacts/graf-zeppelin-model-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: actual replay aircraft payloads, release clock, same-sample Replay, fresh New salvo, scrub, layouts/scale, enlarged view and mobile');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
