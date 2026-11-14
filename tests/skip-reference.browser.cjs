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
 await page.goto(process.env.RETICLE_REFERENCE_URL||pathToFileURL(path.resolve(__dirname,'../dist/skip-bombers/index.html')).href);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#linked').dataset.sideTarget||'{}').mode==='front');
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 async function heading(n){await page.locator('#heading').evaluate((e,n)=>{e.value=n;e.dispatchEvent(new Event('input',{bubbles:true}))},n);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return page.locator('#linked').evaluate(c=>({target:JSON.parse(c.dataset.sideTarget),exaggeration:Number(c.dataset.sideVerticalExaggeration)}))}
 for(const angle of [0,180]){
  const {target:t,exaggeration}=await heading(angle);
  assert.equal(t.mode,'front');assert.equal(exaggeration,1);
  near(t.height/t.width,front.crop.height/front.crop.width);
  near((t.imageBottomY-t.waterlineY)/t.width,(front.crop.y+front.crop.height-642)/front.crop.width);
  near((t.waterlineY-t.top)/t.height,(642-front.crop.y)/front.crop.height);
  near(t.keelY,t.imageBottomY);
  await page.locator('#single').screenshot({path:path.join(artifacts,`skip-reference-${angle}-proportions.png`)});
 }
 for(const angle of [1,179]){
  const {target:t}=await heading(angle);assert.equal(t.mode,'schematic');assert.equal(t.profileModel,'front-side-top intersection');
  await page.locator('#single').screenshot({path:path.join(artifacts,`skip-reference-${angle}-profile.png`)});
 }
 const {target:s,exaggeration}=await heading(90);assert.equal(s.mode,'side');assert.equal(exaggeration,1);near(s.height/s.width,side.crop.height/side.crop.width);
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
 console.log('PASS: unmodified front/side aspect ratios, user-marked submerged boundary at 0/180, matching keel, equal XY trajectory marker and no page errors.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
