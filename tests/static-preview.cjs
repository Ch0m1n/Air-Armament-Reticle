// Optional filesystem-backed HTTP interception for browser tests in isolated environments.
const fs=require('node:fs'),path=require('node:path');
async function installStaticPreview(page){
 if(!process.env.RETICLE_STATIC_ROOT)return;
 const root=path.resolve(process.env.RETICLE_STATIC_ROOT),prefix='/Air-Armament-Reticle/';
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='reticle.test')return route.abort();
  let pathname=decodeURIComponent(url.pathname);if(pathname.startsWith(prefix))pathname=pathname.slice(prefix.length);else pathname=pathname.replace(/^\//,'');
  if(!pathname||pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Not found'});
  return route.fulfill({path:file});
 });
}
module.exports={installStaticPreview};
