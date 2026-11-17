const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
const core=vm.createContext({});vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0],core);
const raw=()=>({name:'SYNTHETIC_BOMBER',typeinfo:{type:'Aircraft'},outerSalvoSize:[2,5],innerSalvoSize:[1,3],minSpread:[1,2],maxSpread:[3,4],innerBombsPercentage:60,speedMoveWithBomb:100,attackCount:4,attackInterval:.2,attackerSize:3,projectilesPerAttack:1,formations:{attack:[.1,[[0,0,0],[-1,0,1],[1,0,1]]]}});
const analyze=a=>core.analyze(a,a.name+'.json');
const plain=a=>JSON.parse(JSON.stringify(a));
const inside=(p,d,center=0)=>(p.x/(d.width/2))**2+((p.y-center)/(d.height/2))**2<=1+1e-9;

test('bomber envelopes multiply spread per axis and keep full aim independent of maximum spread',()=>{
 const a=raw(),r=analyze(a);assert.equal(r.aimMinimum.width,120);assert.equal(r.aimMinimum.baseHeight,600);
 assert.equal(r.outer.width,360);assert.equal(r.outer.baseHeight,1200);
 const changed=analyze({...a,maxSpread:[6,8]});assert.deepEqual(plain(changed.aimMinimum),plain(r.aimMinimum));
 assert.equal(changed.outer.width,r.outer.width*2);
});
test('seeded salvos retain group membership, fresh sorted releases and swept containment',()=>{
 const a=raw(),before=JSON.stringify(a),r=analyze(a),plan=core.bomberReleasePlan(r);
 const first=core.buildBomberSalvo(r,17),same=core.buildBomberSalvo(r,17),next=core.buildBomberSalvo(r,18);
 assert.deepEqual(plain(first),plain(same));assert.notDeepEqual(plain(first.points),plain(next.points));
 assert.equal(JSON.stringify(a),before);assert.equal(first.points.length,12);
 assert.deepEqual(plain(first.attackGroup),{aircraft:3,projectilesPerRelease:1,releases:4});
 assert.equal(first.duration,3*.2);assert.deepEqual(plain(first.releases.map(r=>r.time)),[0,.2,.4,3*.2]);
 assert.equal(first.releases[0].center,r.offset/2);assert.equal(first.releases.at(-1).center,-r.offset/2);
 for(const release of first.releases){
  const points=first.points.filter(p=>p.releaseIndex===release.index);
  assert.deepEqual(plain(points.map(p=>p.planeIndex)),[1,0,2]);
  for(const p of points){assert.equal(p.releaseTime,release.time);assert(inside(p,plan.outer,p.releaseCenter));}
 }
 assert.equal(first.releases[0].center-first.releases.at(-1).center,r.offset);
 const render=core.bombDrawing({...r,id:1,envelopeView:'swept',attack:{...first,elapsed:0}});
 assert(render.includes('Combined releases'));
 assert(core.bombDrawing(r).includes('<ellipse class="ellipse-maximum"'));assert(render.includes('<path class="ellipse-maximum"'));
 assert(render.includes('visibility:hidden'));
});
test('successive releases can overlap aircraft ranges without losing per-release lateral order',()=>{
 const r=analyze(raw());let overlapping=0;
 for(let seed=0;seed<100;seed++){
  const s=core.buildBomberSalvo(r,seed),by=[1,0,2].map(i=>s.points.filter(p=>p.planeIndex===i).map(p=>p.x));
  if(Math.max(...by[0])>Math.min(...by[1])||Math.max(...by[1])>Math.min(...by[2]))overlapping++;
 }
 assert(overlapping>0,'no exclusive aircraft bands across releases');
});
test('invalid formation and unsupported geometry fail closed; coincident inner regions remain usable',()=>{
 const a=raw();assert.equal(core.buildBomberSalvo(analyze({...a,formations:{}}),1),null);
 assert.equal(core.buildBomberSalvo(analyze({...a,isLineBomber:true}),1),null);
 assert.equal(core.buildBomberSalvo(analyze({...a,attackerSize:2.5}),1),null);
 assert.throws(()=>core.buildBomberSalvo(analyze(a),-1),/seed/);
 for(const pct of [0,100]){
  const r=analyze({...a,innerSalvoSize:a.outerSalvoSize,innerBombsPercentage:pct});
  assert.equal(core.buildBomberSalvo(r,1).points.length,12);
 }
});
test('replay reference aircraft use actual IDs, payloads and observed release ordering',()=>{
 const refs=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/bomber-replay-observations.json'),'utf8'));
 for(const ref of refs.cases){
  const file=path.join(root,'GAME/WOWS/15.10/Aircraft',ref.aircraft+'.json');
  const a=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(a.id,ref.aircraftParamsId);
  const r=analyze(a);const s=core.buildBomberSalvo(r,23);assert.equal(s.points.length,ref.bombsPerAttack);
  assert.equal(s.releases.length,ref.releases);
  for(const release of s.releases)assert.deepEqual(plain(s.points.filter(p=>p.releaseIndex===release.index).map(p=>p.planeIndex)),ref.lateralPlaneOrder);
 }
});

test('Graf Zeppelin uses two aircraft, one release and zero swept extension without forcing a circle',()=>{
 for(const [game,version]of [['WOWS','15.10'],['WOWS','15.11'],['KORABLI','26.11'],['KORABLI','26.12']]){
  const a=JSON.parse(fs.readFileSync(path.join(root,'GAME',game,version,'Aircraft/PGAD508_Graf_Zeppelin_stock.json'),'utf8'));
  const r=analyze(a),plan=core.bomberReleasePlan(r);assert.equal(plan.travel,0);assert.equal(plan.duration,0);
  assert.equal(plan.outer.width,112.2);assert.equal(plan.outer.height,139.8);assert.deepEqual(plain(plan.planeOrder),[1,0]);
  for(let seed=1;seed<=50;seed++){
   const s=core.buildBomberSalvo(r,seed);assert.equal(s.points.length,2);assert.equal(s.releases.length,1);
   assert(s.points.every(p=>p.releaseTime===0&&p.releaseCenter===0&&inside(p,plan.outer)));
  }
  assert.equal(core.bombDrawing(r).includes('<ellipse class="ellipse-maximum"'),true);
  const renamed=analyze({...a,name:'NOT_A_SHIP_NAME'});assert.deepEqual(plain(renamed.aimMinimum),plain(r.aimMinimum));
 }
});
