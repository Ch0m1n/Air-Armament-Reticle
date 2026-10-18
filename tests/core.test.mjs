import test,{after} from 'node:test';
import {writeFixtureDataset} from './fixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const publishedCatalog=JSON.parse(fs.readFileSync(path.join(root,'GAME/catalog.json'),'utf8'));
const artifactRoot=path.join(root,'test-artifacts');fs.mkdirSync(artifactRoot,{recursive:true});
const dataRoot=fs.mkdtempSync(path.join(artifactRoot,'synthetic-core-'));
for(const folder of ['src','tools'])fs.mkdirSync(path.join(dataRoot,folder));
for(const file of ['src/viewer-source.html','tools/reindex.mjs'])fs.copyFileSync(path.join(root,file),path.join(dataRoot,file));
writeFixtureDataset(dataRoot);
fs.writeFileSync(path.join(dataRoot,'GAME/KORABLI/fixture-A/Ships/TEST_DISABLED_Carrier.json'),'invalid excluded data');
fs.writeFileSync(path.join(dataRoot,'GAME/KORABLI/fixture-A/Ships/TEST_preserved_Carrier.json'),'invalid excluded data');
for(const group of ['disabled','preserved']){
  const name='TEST_GROUP_'+(group==='disabled'?'A':'B');
  fs.writeFileSync(path.join(dataRoot,'GAME/KORABLI/fixture-A/Ships',name+'.json'),JSON.stringify({name,group,typeinfo:{type:'Ship'},planes:['MISSING']}));
}
const indexed=spawnSync(process.execPath,[path.join(dataRoot,'tools/reindex.mjs')],{encoding:'utf8'});assert.equal(indexed.status,0,indexed.stderr);
const catalog=JSON.parse(fs.readFileSync(path.join(dataRoot,'GAME/catalog.json'),'utf8'));
after(()=>{if(!dataRoot.startsWith(artifactRoot+path.sep))throw Error('Invalid fixture cleanup');fs.rmSync(dataRoot,{recursive:true,force:true});});
const defaultDataset=catalog.datasets.find(dataset=>dataset.id===catalog.defaultDataset);
const html=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const core=vm.createContext({});vm.runInContext(script.split('// UI')[0],core);
core.structuredClone=structuredClone;vm.runInContext(fs.readFileSync(path.join(root,'src/modifiers.js'),'utf8'),core);
const read=file=>JSON.parse(fs.readFileSync(path.join(dataRoot,file),'utf8'));

test('published catalog supports an empty skeleton without test data',()=>{
  assert.equal(publishedCatalog.schema,2);
  if(!publishedCatalog.datasets.length){assert.equal(publishedCatalog.defaultDataset,null);assert.deepEqual(publishedCatalog.entries,[]);assert.deepEqual(publishedCatalog.hashes,{});}
  assert(publishedCatalog.entries.every(entry=>!entry.datasetId.includes('fixture-')));
});
test('catalog paths, identities, hashes and default references are complete',()=>{
  assert.equal(catalog.schema,2);assert(catalog.entries.length>0);
  assert(!catalog.entries.some(entry=>/DISABLED|PRESERVED/i.test(entry.shipId)));
  assert(!Object.keys(catalog.hashes).some(file=>/DISABLED|PRESERVED/i.test(file)));
  assert(!catalog.entries.some(entry=>entry.shipId.startsWith('TEST_GROUP_')));
  assert(['korabli','wows'].includes(defaultDataset.game));assert.match(defaultDataset.version,/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
  assert.equal(new Set(catalog.entries.map(e=>e.id)).size,catalog.entries.length);
  for(const dataset of catalog.datasets)for(const id of dataset.defaults)assert(catalog.entries.some(e=>e.id===id&&e.datasetId===dataset.id));
  for(const entry of catalog.entries) {
    assert.equal(entry.files.length,3);
    for(const file of entry.files) {
      assert.match(file,/^GAME\/(WOWS|KORABLI)\/[A-Za-z0-9][A-Za-z0-9._-]*\/(Ships|Aircraft|Projectiles)\/[A-Za-z0-9_]+\.json$/);
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dataRoot,file))).digest('hex'),catalog.hashes[file]);
    }
    const [ship,plane,weapon]=entry.files.map(read);
    assert.equal(ship.typeinfo.type,'Ship');assert.equal(plane.name,entry.aircraft);
    assert(core.aircraftReferences(ship).some(r=>r.id===plane.name));
    const result=core.analyze(plane,plane.name+'.json');assert.equal(result.kind,entry.role);
    assert.equal(result.projectile,weapon.name);
    if(result.kind==='airstrike') {
      core.attachAirstrikeWeapon(result,weapon);assert(result.weaponVerified);
      assert.equal(core.simulateAirstrike(result).length,result.payload.count);
      const ranges=core.airstrikeTimingRanges(result,[core.shipManifest(ship,ship.name+'.json')],weapon);
      assert(ranges.length>0);assert(ranges.every(r=>Number.isFinite(r.min)&&r.min<=r.max));
    }
  }
});
test('shared metric scale is identical for bomber and airstrike diagrams',()=>{
  const items=defaultDataset.defaults.map(id=>catalog.entries.find(e=>e.id===id)).map(e=>core.analyze(read(e.files[1]),e.aircraft+'.json'));
  const airstrike=items.find(r=>r.kind==='airstrike'),entry=catalog.entries.find(e=>e.aircraft===airstrike.name);
  core.attachAirstrikeWeapon(airstrike,read(entry.files[2]));
  for(const item of items)item.reference=true;
  const extent=core.commonMetricExtent(items);
  const bomb=core.bombDrawing(items.find(r=>r.kind==='bomb'),extent),air=core.airstrikeDrawing(airstrike,extent);
  assert.equal(bomb.match(/data-metric-scale="([^"]+)"/)[1],air.match(/data-metric-scale="([^"]+)"/)[1]);
});
test('viewer script parses; private imports cannot be shared as catalog entries',()=>{
  new Function(script);new Function(fs.readFileSync(path.join(root,'src/site.js'),'utf8'));
  assert(fs.readFileSync(path.join(root,'src/site.js'),'utf8').includes('selections.some(item=>!item.catalogId)'));
});

test('reserved aircraft types cannot use generic bomb or torpedo estimates',()=>{
  const entry=catalog.entries.find(entry=>entry.role==='bomb'),plane=read(entry.files[1]);
  assert.throws(()=>core.analyze({...plane,rocketName:'TEST_ROCKET'},'attack.json'),/Attack aircraft/);
  assert.throws(()=>core.analyze({...plane,typeinfo:{...plane.typeinfo,species:'Skip'}},'skip.json'),/Skip-bomber/);
});

test('modifiers use a numeric allowlist and never mutate repository inputs',()=>{
  const entry=catalog.entries.find(entry=>entry.role==='bomb'),plane=read(entry.files[1]),weapon=read(entry.files[2]);
  const before=JSON.stringify({plane,weapon}),base=core.analyze(plane,plane.name+'.json');
  const modified=core.modifiedInputs('bomb',plane,weapon,{'aircraft:outerSalvoSize:0':plane.outerSalvoSize[0]*2});
  assert.equal(core.analyze(modified.aircraft,plane.name+'.json').outer.width,base.outer.width*2);
  assert.equal(JSON.stringify({plane,weapon}),before);
  assert.throws(()=>core.modifiedInputs('bomb',plane,weapon,{'aircraft:name':2}),/Unsupported/);
  assert.throws(()=>core.modifiedInputs('bomb',plane,weapon,{'aircraft:attackCount':1.5}),/Invalid/);
  assert.throws(()=>core.modifiedInputs('bomb',plane,weapon,{'aircraft:innerBombsPercentage':101}),/Invalid/);
  assert.throws(()=>core.modifiedInputs('bomb',plane,weapon,{'aircraft:outerSalvoSize:0':Infinity}),/Invalid/);
  assert.throws(()=>core.modifiedInputs('bomb',plane,weapon,{'aircraft:minSpread:0':plane.maxSpread[0]+1}),/Minimum spread/);
  const reset=core.modifiedInputs('bomb',plane,weapon,{});assert.deepEqual(JSON.parse(JSON.stringify(reset.aircraft)),plane);
  const torpedo=catalog.entries.find(entry=>entry.role==='torpedo'),p=read(torpedo.files[1]),w=read(torpedo.files[2]);
  const torp=core.modifiedInputs('torpedo',p,w,{'projectile:armingTime':w.armingTime*2}),result=core.analyze(torp.aircraft,p.name+'.json');
  core.attachTorpedoWeapon(result,torp.projectile);assert.equal(result.armingDistance,w.speed*w.armingTime*2*2.686);
  const air=catalog.entries.find(entry=>entry.role==='airstrike'),ap=read(air.files[1]),aw=read(air.files[2]);
  const changed=core.modifiedInputs('airstrike',ap,aw,{'aircraft:outerSalvoSize:0':ap.outerSalvoSize[0]*2});
  assert.equal(core.analyze(changed.aircraft,ap.name+'.json').outer.width,core.analyze(ap,ap.name+'.json').outer.width*2);
  for(const entry of catalog.entries){
    const aircraft=read(entry.files[1]),projectile=read(entry.files[2]);
    assert(core.modifierFields(entry.role,aircraft,projectile).every(field=>field.value>=field.min&&field.value<=field.max));
    for(const field of core.modifierFields(entry.role,aircraft,projectile))assert(core.modifierHelp(entry.role,field).length>30,entry.role+' / '+field.key);
  }
  assert.match(core.modifierHelp('torpedo',{key:'maxSpread'}),/does not draw/);
  assert.match(core.modifierHelp('airstrike',{key:'flightHeight'}),/Does not change the drawn drop area/);
});
test('web application shell is separate from the offline file viewer UI',()=>{
  const shell=fs.readFileSync(path.join(root,'src/shell.html'),'utf8');
  assert(shell.includes('class="workbench"'));assert(shell.includes('id="ship-editors"'));assert(shell.includes('id="add-ship"'));
  assert(!shell.includes('{{viewer.css}}'));
  assert(fs.readFileSync(path.join(root,'tools/build.mjs'),'utf8').includes("split('// UI')[0]"));
});
test('default light theme and original animated maintenance asset are included',()=>{
  const shell=fs.readFileSync(path.join(root,'src/shell.html'),'utf8');
  assert(shell.includes('data-theme="light"'));assert(shell.includes('id="theme-toggle"'));
  const animation=fs.readFileSync(path.join(root,'src/assets/maintenance.webp'));
  assert.equal(animation.toString('ascii',0,4),'RIFF');assert(animation.includes(Buffer.from('ANIM')));
  assert(animation.toString('latin1').split('ANMF').length>2);
});

test('ship filters and module stages come from ship metadata and research links',()=>{
  const midway=catalog.entries.filter(entry=>entry.shipId==='TST001_Synthetic_Carrier'&&entry.role==='torpedo');
  assert.equal(midway.length,2);
  assert(midway.every(entry=>entry.nation==='TestNation'&&entry.shipClass==='AirCarrier'&&entry.tier===1));
  assert.equal(midway.find(entry=>entry.aircraft==='TEST_TORPEDO_STOCK').modules[0].upgrades[0].stage,'Stock');
  assert.equal(midway.find(entry=>entry.aircraft==='TEST_TORPEDO_TOP').modules[0].upgrades[0].stage,'Research 1');
});
test('GAME discovery isolates identical IDs by game and version',()=>{
  const parent=path.join(root,'test-artifacts');fs.mkdirSync(parent,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(parent,'version-fixture-'));
  try {
    fs.mkdirSync(path.join(fixture,'tools'));fs.mkdirSync(path.join(fixture,'src'));
    fs.copyFileSync(path.join(root,'tools/reindex.mjs'),path.join(fixture,'tools/reindex.mjs'));
    fs.copyFileSync(path.join(root,'src/viewer-source.html'),path.join(fixture,'src/viewer-source.html'));
    const entry=catalog.entries.find(entry=>entry.role==='airstrike');
    for(const [game,version]of [['KORABLI','fixture-A'],['KORABLI','fixture-B'],['WOWS','fixture-A']]) {
      const base=path.join(fixture,'GAME',game,version);
      for(const [i,type]of ['Ships','Aircraft','Projectiles'].entries()) {
        const folder=path.join(base,type);fs.mkdirSync(folder,{recursive:true});
        fs.copyFileSync(path.join(dataRoot,entry.files[i]),path.join(folder,path.basename(entry.files[i])));
      }
    }
    const result=spawnSync(process.execPath,[path.join(fixture,'tools/reindex.mjs')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const generated=JSON.parse(fs.readFileSync(path.join(fixture,'GAME/catalog.json'),'utf8'));
    assert.equal(generated.datasets.length,3);assert.equal(generated.entries.length,3);
    assert.equal(new Set(generated.entries.map(e=>e.id)).size,3);
    for(const e of generated.entries) {
      const dataset=generated.datasets.find(d=>d.id===e.datasetId);
      assert(e.files.every(file=>file.startsWith(`GAME/${dataset.game==='wows'?'WOWS':'KORABLI'}/${dataset.version}/`)));
    }
  }finally {
    if(!fixture.startsWith(path.resolve(parent)+path.sep))throw Error('Invalid fixture cleanup path');
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
