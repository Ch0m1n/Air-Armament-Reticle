import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
let engine=source.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0];
const image=engine.match(/const YAMATO_IMAGE = 'data:image\/png;base64,([^']+)'/);
if(!image)throw Error('Missing reference image');
engine=engine.replace(image[0],"const YAMATO_IMAGE = './assets/yamato.png'");
const out=path.resolve(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Invalid build output');
if(fs.existsSync(out)) {
  if(fs.lstatSync(out).isSymbolicLink())throw Error('Build output must not be a symlink');
  fs.rmSync(out,{recursive:true,force:true});
}
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
fs.writeFileSync(path.join(out,'assets/yamato.png'),Buffer.from(image[1],'base64'));
fs.copyFileSync(path.join(root,'src/vendor/lucide-LICENSE'),path.join(out,'assets/lucide-LICENSE.txt'));
const assets={};
for(const [name,text]of Object.entries({'viewer.js':engine,'icons.js':'globalThis.RETICLE_ICONS='+fs.readFileSync(path.join(root,'src/vendor/icons.json'),'utf8')+';','site.css':fs.readFileSync(path.join(root,'src/site.css'),'utf8'),'site.js':fs.readFileSync(path.join(root,'src/site.js'),'utf8')})) {
  const bundled=name==='site.js'?fs.readFileSync(path.join(root,'src/modifiers.js'),'utf8')+'\n'+text:text;
  const hash=crypto.createHash('sha256').update(bundled).digest('hex').slice(0,12);
  const filename=name.replace('.',`-${hash}.`);assets[name]=filename;fs.writeFileSync(path.join(out,'assets',filename),bundled);
}
const catalog=fs.readFileSync(path.join(root,'GAME/catalog.json'),'utf8');
assets.catalog='catalog-'+crypto.createHash('sha256').update(catalog).digest('hex').slice(0,12)+'.json';
fs.writeFileSync(path.join(out,'assets',assets.catalog),catalog);
for(const dataset of JSON.parse(catalog).datasets) {
  const folder=dataset.game==='wows'?'WOWS':'KORABLI';
  for(const type of ['Ships','Aircraft','Projectiles']) {
    const relative=`GAME/${folder}/${dataset.version}/${type}`;
    fs.cpSync(path.join(root,relative),path.join(out,relative),{recursive:true});
  }
}
let html=fs.readFileSync(path.join(root,'src/shell.html'),'utf8');
for(const [name,filename]of Object.entries(assets))html=html.replaceAll('{{'+name+'}}',filename);
fs.writeFileSync(path.join(out,'index.html'),html);
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Built static site in dist/');
