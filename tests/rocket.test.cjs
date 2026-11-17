const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),kernel=fs.readFileSync(path.join(root,'src/rockets/model.js'),'utf8'),context=vm.createContext({});
vm.runInContext(kernel+';globalThis.build=buildRocketSalvo;globalThis.plan=rocketReleasePlan;',context);
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/rocket-inputs.json'),'utf8'));
const plain=o=>JSON.parse(JSON.stringify(o));
test('shared kernel is identical to the standalone viewer kernel',()=>{
 const viewer=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
 assert.equal(viewer.slice(viewer.indexOf('function rocketReleasePlan('),viewer.indexOf('function analyzeAttack(')),kernel);
});
test('three replay configurations preserve quotas, payload, nominal timing and lateral rank',()=>{
 for(const {raw,count,quotas}of fixtures)for(const aimMode of ['fully','immediate'])for(let seed=0;seed<30;seed++){
  const sample=plain(context.build({raw,aimMode},seed)),plan=plain(context.plan({raw,aimMode}));
  assert.equal(sample.points.length,count);assert.deepEqual(sample.releases.map(r=>r.inner),quotas);
  for(let j=0;j<raw.attackCount;j++){
   const batch=sample.points.filter(p=>p.releaseIndex===j);assert.deepEqual(batch.map(p=>p.planeIndex),plan.planeOrder);
   for(const p of batch){assert.ok((p.x/(plan.outer.width/2))**2+(p.y/(plan.outer.height/2))**2<=1+1e-12);assert.equal((p.x/(plan.inner.width/2))**2+(p.y/(plan.inner.height/2))**2<=1+1e-12,p.inner);assert.equal(p.releaseTime,j*raw.attackInterval);}
  }
 }
});
test('seeded samples replay exactly; new seeds and releases generate fresh positions',()=>{
 const row={raw:fixtures[0].raw};const a=plain(context.build(row,7));assert.deepEqual(a,plain(context.build(row,7)));assert.notDeepEqual(a.points,plain(context.build(row,8)).points);
 assert.notDeepEqual(a.points.filter(p=>p.releaseIndex===0).map(p=>p.x),a.points.filter(p=>p.releaseIndex===1).map(p=>p.x));
});
test('unsupported and malformed inputs do not fabricate a distribution',()=>{
 const raw=fixtures[0].raw;
 for(const patch of [{formations:null},{innerBombsPercentage:NaN},{attackerSize:0},{attackInterval:-1},{innerSalvoSize:[100,100]}])assert.equal(context.build({raw:{...raw,...patch}},0),null);
 assert.throws(()=>context.build({raw},-1));
});
