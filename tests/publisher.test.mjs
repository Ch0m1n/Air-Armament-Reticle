import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {writeFixtureDataset} from './fixtures.mjs';
import {collectDataset,collectDatasetParallel,collectBatch,writeDataset,publishDataset,repository} from '../tools/data-publisher.mjs';
const project=path.resolve(import.meta.dirname,'..'),parent=path.join(project,'test-artifacts');fs.mkdirSync(parent,{recursive:true});
const temporary=fs.mkdtempSync(path.join(parent,'publisher-fixture-'));
after(()=>{if(!temporary.startsWith(parent+path.sep))throw Error('Invalid cleanup path');fs.rmSync(temporary,{recursive:true,force:true});});
function sourceFixture(name){const folder=path.join(temporary,name);writeFixtureDataset(folder);return path.join(folder,'GAME/KORABLI/fixture-A');}
const input=sourceFixture('input');
const options={source:input,game:'KORABLI',version:'1.0-test'};

test('parallel scans match sequential bytes, summaries and hashes and reread changed files',async()=>{
  const folder=sourceFixture('parallel');
  const original=JSON.parse(fs.readFileSync(path.join(folder,'Ships/TST001_Synthetic_Carrier.json')));
  for(let i=0;i<12;i++){
    const name='TEST_PARALLEL_'+String(i).padStart(2,'0');
    fs.writeFileSync(path.join(folder,'Ships',name+'.json'),JSON.stringify({...original,name,...(i%3===0?{group:'preserved'}:{})}));
  }
  fs.writeFileSync(path.join(folder,'Ships/TEST_DISABLED.json'),'excluded invalid JSON');
  const args={...options,source:folder},sequential=collectDataset(args);
  for(const concurrency of [1,2,4]){
    const events=[],parallel=await collectDatasetParallel({...args,concurrency,onProgress:event=>events.push(event)});
    assert.deepEqual(parallel.summary,sequential.summary);
    assert.equal(parallel.files.size,sequential.files.size);
    for(const [file,bytes]of sequential.files)assert(parallel.files.get(file).equals(bytes),file);
    const scans=events.filter(e=>e.phase==='scan');
    assert(scans.every((e,i)=>i===0||e.completed>=scans[i-1].completed));
  }
  const planeFile=path.join(folder,'Aircraft/TEST_BOMBER.json'),plane=JSON.parse(fs.readFileSync(planeFile));
  plane.outerSalvoSize[0]+=1;fs.writeFileSync(planeFile,JSON.stringify(plane));
  assert.notEqual((await collectDatasetParallel({...args,concurrency:2})).summary.manifestHash,sequential.summary.manifestHash);
  await assert.rejects(collectDatasetParallel({...args,concurrency:8}),/between 1 and 4/);
  fs.writeFileSync(path.join(folder,'Ships/TEST_PARALLEL_99.json'),'{broken');
  await assert.rejects(collectDatasetParallel({...args,concurrency:4}),/TEST_PARALLEL_99/);
});

test('both mode uses separate versions, a combined preview hash and scoped progress',async()=>{
  const datasets=[{source:input,game:'WOWS',version:'15.10'},{source:input,game:'KORABLI',version:'26.11'}],events=[];
  const batch=collectBatch({datasets,onProgress:event=>events.push(event)});
  assert.equal(batch.plans.length,2);
  assert.deepEqual(batch.summary.datasets.map(s=>s.destination),['GAME/WOWS/15.10','GAME/KORABLI/26.11']);
  assert.equal(batch.summary.counts.Ships,2*collectDataset(options).summary.counts.Ships);
  assert(events.some(e=>e.game==='WOWS'&&e.datasetIndex===1));assert(events.some(e=>e.game==='KORABLI'&&e.datasetIndex===2));
  assert.notEqual(collectBatch({datasets:[datasets[0],{...datasets[1],version:'26.12'}]}).summary.manifestHash,batch.summary.manifestHash);
  assert.throws(()=>collectBatch({datasets:[datasets[0],datasets[0]]}),/one WOWS/);
  assert.throws(()=>collectBatch({datasets:[datasets[0],{...datasets[1],source:path.join(temporary,'missing')}]}),/existing/);
  await assert.rejects(publishDataset({datasets,expectedHash:'0'.repeat(64)}),/changed after Preview/);
  const batchFile=path.join(temporary,'batch.json');fs.writeFileSync(batchFile,JSON.stringify({datasets}));
  const result=spawnSync(process.execPath,['tools/data-publisher.mjs','preview','--batch-file',batchFile],{cwd:project,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).manifestHash,batch.summary.manifestHash);
});

test('DISABLED and PRESERVED ship codes are skipped without reading their JSON or dependencies',()=>{
  const folder=sourceFixture('disabled');
  fs.writeFileSync(path.join(folder,'Ships/TEST_DISABLED_Carrier.json'),'not even valid JSON');
  fs.writeFileSync(path.join(folder,'Ships/TEST_preserved_Carrier.json'),'not even valid JSON');
  for(const group of ['disabled','preserved']){
    const name='TEST_GROUP_'+group;
    fs.writeFileSync(path.join(folder,'Ships',name+'.json'),JSON.stringify({name,typeinfo:{type:'Ship'},group,planes:['MISSING_PLANE']}));
  }
  const plan=collectDataset({...options,source:folder});
  assert.equal(plan.summary.skippedShips,4);
  for(const group of ['disabled','preserved'])assert.equal(plan.summary.shipDecisions.find(ship=>ship.ship==='TEST_GROUP_'+group).reason,group);
  assert.equal(plan.summary.shipDecisions.find(ship=>ship.ship==='TEST_DISABLED_Carrier').reason,'disabled');
  assert.equal(plan.summary.shipDecisions.find(ship=>ship.ship==='TEST_preserved_Carrier').reason,'preserved');
  assert(![...plan.files.keys()].some(file=>/DISABLED|PRESERVED/i.test(file)));
  assert.deepEqual(plan.summary.counts,collectDataset(options).summary.counts);
});

test('scan progress reports real ship totals and CLI preserves its JSON result',()=>{
  const folder=sourceFixture('progress');
  const ship=JSON.parse(fs.readFileSync(path.join(folder,'Ships/TST001_Synthetic_Carrier.json')));
  for(let i=0;i<3;i++){
    const name='TEST_PROGRESS_'+i;
    fs.writeFileSync(path.join(folder,'Ships',name+'.json'),JSON.stringify({...ship,name}));
  }
  const events=[];
  const plan=collectDataset({...options,source:folder,onProgress:event=>events.push(event)});
  assert.equal(events[0].remainingSeconds,null);
  const lastScan=events.filter(event=>event.phase==='scan').at(-1);
  assert.equal(lastScan.completed,4);assert.equal(lastScan.total,4);
  assert.equal(lastScan.remainingSeconds,0);assert(lastScan.elapsedSeconds>=0);
  assert.equal(events.at(-1).phase,'finalize');
  const progressFile=path.join(temporary,'progress.json');
  const result=spawnSync(process.execPath,['tools/data-publisher.mjs','preview','--source',folder,'--game','KORABLI','--version',options.version,'--progress-file',progressFile],{cwd:project,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).manifestHash,plan.summary.manifestHash);
  assert.equal(JSON.parse(fs.readFileSync(progressFile)).phase,'finalize');
});
test('preview selects only connected supported JSON and excludes ASW and unrelated files',()=>{
  const folder=sourceFixture('filtering');
  fs.writeFileSync(path.join(folder,'credentials.json'),'not an upload candidate');
  const aircraft=JSON.parse(fs.readFileSync(path.join(folder,'Aircraft/TEST_BOMBER.json')));
  fs.writeFileSync(path.join(folder,'Aircraft/TEST_UNREFERENCED.json'),JSON.stringify({...aircraft,name:'TEST_UNREFERENCED'}));
  const shipFile=path.join(folder,'Ships/TST001_Synthetic_Carrier.json'),ship=JSON.parse(fs.readFileSync(shipFile));ship.A_ASW={planes:['TEST_ASW']};ship.A_Rocket={planes:['TEST_ROCKET_PLANE']};fs.writeFileSync(shipFile,JSON.stringify(ship));
  fs.writeFileSync(path.join(folder,'Aircraft/TEST_ASW.json'),JSON.stringify({...aircraft,name:'TEST_ASW',bombName:'TEST_DC'}));
  fs.writeFileSync(path.join(folder,'Projectiles/TEST_DC.json'),JSON.stringify({name:'TEST_DC',typeinfo:{type:'Projectile'},ammoType:'DC'}));
  fs.writeFileSync(path.join(folder,'Aircraft/TEST_ROCKET_PLANE.json'),JSON.stringify({...aircraft,name:'TEST_ROCKET_PLANE',bombName:'TEST_ROCKET'}));
  fs.writeFileSync(path.join(folder,'Projectiles/TEST_ROCKET.json'),JSON.stringify({name:'TEST_ROCKET',typeinfo:{type:'Projectile',species:'Rocket'},ammoType:'HE',planeAmmoType:'rocket'}));
  const plan=collectDataset({...options,source:folder});
  assert.deepEqual(plan.summary.counts,{Ships:1,Aircraft:5,Projectiles:3});assert.equal(plan.summary.configurations,5);
  assert.equal(plan.summary.skippedAircraft,1);assert(plan.summary.warnings.some(w=>w.includes('ASW/DC')));
  assert.equal(plan.files.size,9);assert(![...plan.files.keys()].some(file=>/UNREFERENCED|credentials|TEST_DC|TEST_ASW/.test(file)));
  assert.equal(plan.summary.repository,repository);
});
test('source folders may use singular names; traversal and reserved versions are rejected',()=>{
  const folder=sourceFixture('singular');fs.renameSync(path.join(folder,'Ships'),path.join(folder,'Ship'));fs.renameSync(path.join(folder,'Projectiles'),path.join(folder,'Projectile'));
  assert.equal(collectDataset({...options,source:folder}).summary.counts.Ships,1);
  for(const version of ['../bad','x/y','x\\y','CON','NUL.txt','version.',''])assert.throws(()=>collectDataset({...options,version}),/version/i);
  assert.throws(()=>collectDataset({...options,game:'OTHER'}),/WOWS/);
  assert.throws(()=>collectDataset({...options,source:temporary}),/Missing Ships/);
});
test('ASW-only and no-aircraft ships are excluded; mixed HE/ASW ships retain HE dependencies only',()=>{
  const folder=sourceFixture('mixed-support');
  const store=(type,raw)=>fs.writeFileSync(path.join(folder,type,raw.name+'.json'),JSON.stringify(raw));
  // Deliberately no reticle inputs: weapon classification must happen before geometry.
  store('Aircraft',{name:'TEST_DC_PLANE',typeinfo:{type:'Aircraft'},isAirSupportPlane:true,bombName:'TEST_DC_PAYLOAD'});
  store('Projectiles',{name:'TEST_DC_PAYLOAD',typeinfo:{type:'Projectile',species:'DepthCharge'},ammoType:'DC',planeAmmoType:'depthcharge'});
  const ship=(name,planes)=>({name,typeinfo:{type:'Ship',nation:'TestNation',species:'Cruiser'},level:1,A_AirSupport:{ammoList:planes}});
  store('Ships',ship('TEST002_ASW_Only',['TEST_DC_PLANE']));
  store('Ships',ship('TEST003_No_Aircraft',[]));
  store('Ships',ship('TEST004_Mixed_Support',['TEST_DC_PLANE','TEST_AIRSTRIKE']));
  store('Ships',ship('TEST005_Mixed_Support',['TEST_AIRSTRIKE','TEST_DC_PLANE']));
  const plan=collectDataset({...options,source:folder});
  assert.deepEqual(plan.summary.counts,{Ships:3,Aircraft:4,Projectiles:2});assert.equal(plan.summary.configurations,6);
  assert.equal(plan.summary.aswOnlyShips,1);assert.equal(plan.summary.mixedShips,2);assert.equal(plan.summary.skippedShips,2);
  assert(!plan.files.has('Ships/TEST002_ASW_Only.json'));assert(!plan.files.has('Ships/TEST003_No_Aircraft.json'));
  for(const name of ['TEST004_Mixed_Support','TEST005_Mixed_Support']){
    assert(plan.files.has('Ships/'+name+'.json'));
    const decision=plan.summary.shipDecisions.find(entry=>entry.ship===name);
    assert(decision.included);assert.deepEqual(decision.aircraft,['TEST_AIRSTRIKE']);assert.equal(decision.excludedAsw,1);
  }
  assert(!plan.files.has('Aircraft/TEST_DC_PLANE.json'));assert(!plan.files.has('Projectiles/TEST_DC_PAYLOAD.json'));
  assert.equal(plan.summary.shipDecisions.find(entry=>entry.ship==='TEST002_ASW_Only').reason,'asw-only');
  assert.equal(plan.summary.shipDecisions.find(entry=>entry.ship==='TEST003_No_Aircraft').reason,'no-aircraft');
});
test('manifest identifies preview contents and changed settings/files',()=>{
  const plan=collectDataset(options);assert.equal(plan.summary.manifestHash,collectDataset(options).summary.manifestHash);
  assert.notEqual(plan.summary.manifestHash,collectDataset({...options,version:'1.1'}).summary.manifestHash);
});
test('saved root paths locate version subfolders, including compact version names',()=>{
  const folder=sourceFixture('version-parent'),parent=path.dirname(folder);
  assert.equal(collectDataset({...options,source:parent,version:'fixture-A'}).source,fs.realpathSync(folder));
  fs.renameSync(folder,path.join(parent,'1510'));
  assert.equal(collectDataset({...options,source:parent,version:'15.10'}).source,fs.realpathSync(path.join(parent,'1510')));
});
test('writing requires overwrite acknowledgement and preserves unrelated versions and local source',()=>{
  const checkout=path.join(temporary,'checkout');fs.mkdirSync(checkout);
  const plan=collectDataset(options),sourceBefore=fs.readFileSync(path.join(input,'Ships/TST001_Synthetic_Carrier.json'),'utf8');
  const target=writeDataset(checkout,plan);assert(fs.existsSync(path.join(target,'Ships/TST001_Synthetic_Carrier.json')));
  assert.throws(()=>writeDataset(checkout,plan),/already exists/);
  const other=writeDataset(checkout,collectDataset({...options,version:'2.0'}));
  fs.writeFileSync(path.join(target,'stale.json'),'{}');writeDataset(checkout,plan,{replace:true});
  assert(!fs.existsSync(path.join(target,'stale.json')));assert(fs.existsSync(other));assert.equal(fs.readFileSync(path.join(input,'Ships/TST001_Synthetic_Carrier.json'),'utf8'),sourceBefore);
  assert.throws(()=>writeDataset(checkout,{...plan,version:'../bad'},{replace:true}),/version/);
  assert.throws(()=>writeDataset(checkout,{...plan,files:new Map([['../outside','bad']])},{replace:true}),/Unsafe dataset filename/);
  assert(fs.existsSync(path.join(target,'dataset.json')));
});
test('publish refuses changed preview contents before any network operations',async()=>{
  await assert.rejects(publishDataset({...options,expectedHash:'0'.repeat(64)}),/changed after Preview/);
  await assert.rejects(publishDataset(options),/Preview first/);
});
test('preview CLI returns structured output without upload or Git changes',()=>{
  const result=spawnSync(process.execPath,[path.join(project,'tools/data-publisher.mjs'),'preview','--source',input,'--game','WOWS','--version','test-1'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const summary=JSON.parse(result.stdout);assert(summary.ok);assert.equal(summary.game,'WOWS');assert.equal(summary.counts.Aircraft,4);
});
