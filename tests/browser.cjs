const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
  const fixture=fs.mkdtempSync(path.join(artifacts,'synthetic-browser-')),servers=[];let browser;
  async function serve(cwd){
    const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
    const base='/WoWS-Korabli-Air-Armament-Reticle/',url=`http://127.0.0.1:${port}${base}`;servers.push(spawn(process.execPath,['tools/preview.mjs',String(port),base],{cwd,stdio:'ignore'}));
    for(let i=0;i<40;i++){try{if((await fetch(url)).ok)return url;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Preview did not start');
  }
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.MK_CHROME_PATH});
    const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(await serve(root));await page.waitForFunction(()=>typeof busy!=='undefined'&&!busy);
    assert.equal(await page.locator('#results article').count(),0);assert.equal(await page.locator('.ship-editor').count(),1);
    assert((await page.locator('#dataset').innerText()).includes('No bundled dataset'));await page.locator('#add-ship').click();assert.equal(await page.locator('.ship-editor').count(),2);
    await page.locator('[data-game="wows"]').click();await page.waitForFunction(()=>!busy&&activeGame==='wows');assert(await page.locator('.ship-editor [data-field="ship"]').isDisabled());
    await page.screenshot({path:path.join(artifacts,'empty-site.png'),fullPage:true});
    // Fixtures are invented values, generated only in an ignored temporary test site.
    fs.cpSync(path.join(root,'src'),path.join(fixture,'src'),{recursive:true});fs.mkdirSync(path.join(fixture,'tools'));
    for(const name of ['build.mjs','reindex.mjs','preview.mjs'])fs.copyFileSync(path.join(root,'tools',name),path.join(fixture,'tools',name));
    const {writeFixtureDataset}=await import('./fixtures.mjs');for(const [game,version]of [['KORABLI','fixture-A'],['KORABLI','fixture-B'],['WOWS','fixture-A']])writeFixtureDataset(fixture,game,version);
    for(const tool of ['reindex.mjs','build.mjs']){const result=spawnSync(process.execPath,[path.join(fixture,'tools',tool)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
    const origin=await serve(fixture);await page.goto(origin+'?game=korabli&version=fixture-A');await page.waitForFunction(()=>!busy&&selections.length===3);
    assert.equal(await page.locator('.ship-editor').count(),3);assert.equal(await page.locator('[role="tab"]').count(),5);
    const first=page.locator('.ship-editor').first(),second=page.locator('.ship-editor').nth(1);
    await first.locator('[data-field="version"]').selectOption('fixture-B');await page.waitForFunction(()=>!busy&&selections.length===2);
    await first.locator('[data-field="ship"]').selectOption('TST001_Synthetic_Carrier');await page.waitForFunction(()=>!busy&&selections.length===3);
    assert.equal(await second.locator('[data-field="version"]').inputValue(),'fixture-A');
    await first.getByRole('textbox',{name:'Ship name',exact:true}).fill('Custom test ship');await first.getByRole('textbox',{name:'Ship name',exact:true}).press('Tab');
    await second.locator('[data-field="module"]').selectOption('A1_TorpedoBomber');await page.waitForFunction(()=>!busy);assert((await second.locator('[data-field="entryId"]').inputValue()).endsWith('TEST_TORPEDO_STOCK'));
    await first.locator('[data-slot-action="modifiers"]').click();const help=page.getByRole('button',{name:'Help: Outer salvo size X',exact:true});await help.hover();assert(await page.getByRole('tooltip').isVisible());
    await help.focus();await page.keyboard.press('Escape');assert(await page.getByRole('tooltip').isHidden());assert(await page.locator('#modifiers-dialog').isVisible());
    const width=page.getByRole('spinbutton',{name:'Outer salvo size X',exact:true});await width.fill('3');assert.equal(await page.locator('.modifier-original').first().innerText(),'2');
    await page.locator('#modifiers-form button[type="submit"]').click();await page.waitForFunction(()=>!busy&&!document.querySelector('#modifiers-dialog').open);assert.equal(await page.evaluate(()=>selections.find(item=>item.kind==='bomb').outer.width),180);
    await first.locator('[data-slot-action="modifiers"]').click();await page.getByRole('spinbutton',{name:'Minimum spread X',exact:true}).fill('9999');await page.locator('#modifiers-form button[type="submit"]').click();await page.waitForFunction(()=>!busy);assert((await page.locator('#modifier-error').innerText()).includes('Minimum spread'));
    await page.locator('#reset-modifiers').click();await page.waitForFunction(()=>!busy);assert.equal(await width.inputValue(),'2');await width.fill('3');await page.locator('#modifiers-form button[type="submit"]').click();await page.waitForFunction(()=>!busy&&!document.querySelector('#modifiers-dialog').open);
    await first.locator('[data-slot-action="clone"]').click();await page.waitForFunction(()=>!busy&&selections.length===4);await page.locator('#add-ship').click();
    await page.locator('#share').click();const shared=await page.evaluate(()=>navigator.clipboard.readText());await page.goto(shared);await page.waitForFunction(()=>!busy&&selections.length===4);
    assert.equal(await page.locator('.ship-editor').count(),5);assert.equal(await first.getByRole('textbox',{name:'Ship name',exact:true}).inputValue(),'Custom test ship');assert.equal(await first.locator('[data-field="version"]').inputValue(),'fixture-B');assert(Object.keys(await page.evaluate(()=>shipSlots[0].modifiers)).length>0);
    await page.locator('.ship-editor').last().locator('[data-slot-action="remove"]').click();await page.locator('#comparison-tab-airstrike').click();await page.locator('#comparison-airstrike [data-action="play"]').click();assert.equal(await page.locator('.airstrike-drop').count(),6);
    await page.locator('#list-view').click();await page.locator('#cards-view').click();
    for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844],['tablet',768,1024]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true});}
    await page.setViewportSize({width:390,height:844});await first.locator('[data-slot-action="modifiers"]').click();await help.click();const box=await page.getByRole('tooltip').boundingBox();assert(box.x>=0&&box.x+box.width<=390);await page.keyboard.press('Escape');await page.locator('[data-close="modifiers-dialog"]').click();
    await page.locator('#clear').click();assert.equal(await page.locator('#results article').count(),0);
    const catalog=JSON.parse(fs.readFileSync(path.join(fixture,'GAME/catalog.json'))),entry=catalog.entries.find(e=>e.role==='bomb');await page.locator('#open').click();await page.locator('#files').setInputFiles(entry.files.map(file=>path.join(fixture,file)));await page.waitForFunction(()=>!busy&&selections.length===1);
    await page.locator('#share').click();assert((await page.locator('#status').innerText()).includes('Uploaded JSON'));const download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(path.join(artifacts,'results.json'));
    assert.deepEqual(errors,[]);console.log('PASS empty production site; isolated synthetic comparison, modifiers, share, mobile and import tests');
  }finally{
    if(browser)await browser.close();
    for(const server of servers)if(server.exitCode===null){const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;}
    if(!fixture.startsWith(artifacts+path.sep))throw Error('Invalid fixture cleanup');
    fs.rmSync(fixture,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
