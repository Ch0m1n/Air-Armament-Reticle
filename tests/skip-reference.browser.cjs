const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const front=require('../src/skip-bombers/assets/yamato-front-reference.json');
const side=require('../src/skip-bombers/assets/yamato-hull-reference.json');
const artifacts=path.resolve(__dirname,'../test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.MK_CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await require('./static-preview.cjs').installStaticPreview(page);
 await page.goto(process.env.RETICLE_REFERENCE_URL||pathToFileURL(path.resolve(__dirname,'../dist/skip-bombers/index.html')).href);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#linked').dataset.sideTarget||'{}').mode==='image-morph');
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 async function heading(n){
  await page.locator('#heading').evaluate((e,n)=>{e.value=n;e.dispatchEvent(new Event('input',{bubbles:true}))},n);
  await page.waitForFunction(n=>JSON.parse(document.querySelector('#linked').dataset.sideTarget||'{}').heading===n,n);
  return page.locator('#linked').evaluate(c=>({target:JSON.parse(c.dataset.sideTarget),exaggeration:Number(c.dataset.sideVerticalExaggeration)}));
 }
 const baseline=(await heading(0)).target,images=[];
 for(const angle of [0,1,7.3,9.9,10.1,37.4,45,75,89.9,90,90.1,123.4,179,180]){
  const {target:t,exaggeration}=await heading(angle);
  assert.equal(t.mode,'image-morph');assert.equal(t.ready,true);assert.equal(t.frameCount,21);assert.equal(exaggeration,1);
  for(const key of ['left','top','width','height','waterlineY','pixelsPerMapMeter'])near(t[key],baseline[key]);
  near(t.height/t.width,120/560);near((t.waterlineY-t.top)/t.height,.8);
  images.push(await page.evaluate(a=>MKYamatoRotation.frame(a).src,angle));
 }
 assert.equal(new Set(images).size,images.length,'No nearest-angle snapping');
 await heading(37.4);await page.locator('#single').screenshot({path:path.join(artifacts,'skip-reference-continuous-37-4.png')});

 // The new display remains draggable without changing the salvo sample.
 const before=await page.evaluate(()=>({target:previewState.target,seed:previewState.salvoSeed}));
 await page.locator('#linked').scrollIntoViewIfNeeded();
 const rect=await page.locator('#linked').boundingBox(),point=await page.locator('#linked').evaluate(c=>({x:Number(c.dataset.targetSideX),y:JSON.parse(c.dataset.sideTarget).waterlineY-5}));
 await page.mouse.move(rect.x+point.x,rect.y+point.y);await page.mouse.down();await page.mouse.move(rect.x+point.x+70,rect.y+point.y,{steps:5});await page.mouse.up();
 assert.ok(await page.evaluate(old=>previewState.target>old,before.target));assert.equal(await page.evaluate(()=>previewState.salvoSeed),before.seed);
 await page.locator('#targetPosition').fill(String(before.target));await page.locator('#targetPosition').press('Tab');
 await heading(90);
 // A real moving bomb's vertical offset must use exactly the horizontal scale.
 await page.locator('#time').evaluate(e=>{e.value=400;e.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(50);
 const marker=await page.locator('#linked').evaluate(c=>{
  const b=JSON.parse(c.dataset.bombs).find(p=>!p.hit&&p.y>0),t=JSON.parse(c.dataset.sideTarget),scale=Number(c.dataset.sidePixelsPerMapMeter);
  if(!b)return null;const dx=b.x-Number(c.dataset.targetPosition),x=Number(c.dataset.targetSideX)+dx*scale,y=t.waterlineY-b.y*scale;
  if(x<0||x>=c.clientWidth||y<0||y>=c.clientHeight)return null;
  const dpr=c.width/c.getBoundingClientRect().width;return Array.from(c.getContext('2d').getImageData(Math.floor(x*dpr),Math.floor(y*dpr),1,1).data);
 });
 assert.ok(marker,'Moving marker is visible for equal-scale pixel check');assert.ok(marker[0]>150&&marker[1]>60&&marker[3]>0);
 assert.deepEqual(errors,[]);
 console.log('PASS: 21 image-based angle samples, continuous fractional rotation, fixed scale/center/waterline, dragging, equal XY marker and no page errors.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
