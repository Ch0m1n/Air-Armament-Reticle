import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {writeFixtureDataset} from './fixtures.mjs';
import {collectDataset,writeDataset,publishDataset,repository} from '../tools/data-publisher.mjs';
const project=path.resolve(import.meta.dirname,'..'),parent=path.join(project,'test-artifacts');fs.mkdirSync(parent,{recursive:true});
const temporary=fs.mkdtempSync(path.join(parent,'publisher-fixture-'));
after(()=>{if(!temporary.startsWith(parent+path.sep))throw Error('Invalid cleanup path');fs.rmSync(temporary,{recursive:true,force:true});});
function sourceFixture(name){const folder=path.join(temporary,name);writeFixtureDataset(folder);return path.join(folder,'GAME/KORABLI/fixture-A');}
const input=sourceFixture('input');
const options={source:input,game:'KORABLI',version:'1.0-test'};
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
  assert.deepEqual(plan.summary.counts,{Ships:1,Aircraft:4,Projectiles:2});assert.equal(plan.summary.configurations,4);
  assert.equal(plan.summary.skippedAircraft,2);assert(plan.summary.warnings.some(w=>w.includes('ASW/DC')));assert(plan.summary.warnings.some(w=>w.includes('Rocket aircraft')));
  assert.equal(plan.files.size,7);assert(![...plan.files.keys()].some(file=>/UNREFERENCED|credentials|TEST_DC|TEST_ASW/.test(file)));
  assert.equal(plan.summary.repository,repository);
});
test('source folders may use singular names; traversal and reserved versions are rejected',()=>{
  const folder=sourceFixture('singular');fs.renameSync(path.join(folder,'Ships'),path.join(folder,'Ship'));fs.renameSync(path.join(folder,'Projectiles'),path.join(folder,'Projectile'));
  assert.equal(collectDataset({...options,source:folder}).summary.counts.Ships,1);
  for(const version of ['../bad','x/y','x\\y','CON','NUL.txt','version.',''])assert.throws(()=>collectDataset({...options,version}),/version/i);
  assert.throws(()=>collectDataset({...options,game:'OTHER'}),/WOWS/);
  assert.throws(()=>collectDataset({...options,source:temporary}),/Missing Ships/);
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
