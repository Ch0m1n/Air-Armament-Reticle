// Measure the existing transparent bitmap; do not edit its pixels.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../src/skip-bombers/assets');
 const file=path.join(root,'yamato-front-reference.json'),reference=JSON.parse(fs.readFileSync(file));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MK_CHROME_PATH});
 try{
  const page=await browser.newPage();
  reference.widths=await page.evaluate(async({src,crop})=>{
   const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data;
   return Array.from({length:crop.height},(_,j)=>{
    const y=crop.y+j;let left=Infinity,right=-Infinity;
    for(let x=crop.x;x<crop.x+crop.width;x++)if(data[(y*image.width+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x+1)}
    return Number.isFinite(left)?[(left-crop.x)/crop.width-.5,(right-crop.x)/crop.width-.5]:null;
   });
  },{src:'data:image/png;base64,'+fs.readFileSync(path.join(root,'yamato-front.png')).toString('base64'),crop:reference.crop});
  const metadata=JSON.stringify({...reference,widths:undefined},null,2).replace(/\n}$/,'');
  fs.writeFileSync(file,metadata+',\n  "widths": [\n'+reference.widths.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]\n}\n');
  console.log('Registered front silhouette rows:',reference.widths.length);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
