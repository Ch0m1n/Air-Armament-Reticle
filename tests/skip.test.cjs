const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHullContact}=require('../src/skip-bombers/hull-contact.cjs');
const {reconstructSkip}=require('../src/skip-bombers/reconstruct.cjs');
const golden=require('../src/skip-bombers/data.json').rows[0];
const plane={name:'Any_Selected_Aircraft',aimingHeight:6,speedMoveWithBomb:123,attackerSize:2,projectilesPerAttack:2,attackCount:1,outerSalvoSize:[3,2.2],minSpread:[1,1],maxSpread:[2.5,2.5]};
const weapon={projectileVelocityBoost:[1.7,1],fallingTimeCoef:1,maxSkipAngle:20,skips:[[1,.9,.9,1.2,.6],[.7,.6,.8,1.6,.5]]};
test('selected-aircraft reconstruction matches the client-checked baseline',()=>{
 const r=reconstructSkip(plane,weapon).result;
 assert.equal(r.initialTime,golden.result.initialTime);
 r.contacts.forEach((c,i)=>{for(const key of ['distanceMeters','fullWidthMeters','fullLengthMeters','maxWidthMeters','maxLengthMeters'])assert.ok(Math.abs(c[key]-golden.result.contacts[i][key])<1e-8,key)});
 r.arcs.forEach((a,i)=>{assert.ok(Math.abs(a.renderTime-golden.result.arcs[i].renderTime)<1e-10);a.points.forEach((p,j)=>p.forEach((n,k)=>assert.ok(Math.abs(n-golden.result.arcs[i].points[j][k])<1e-8)))});
});
test('ordered WoWS skip sequence and legacy skip rows produce the same geometry',()=>{
 const modern={...weapon,skips:undefined,SkipsSequence:{order:['second','first'],second:{xSalvo:1,zSalvo:.9,horizontalSpeedMultiplier:.9,verticalSpeedMultiplier:1.2,angleMultiplier:.6},first:{xSalvo:.7,zSalvo:.6,horizontalSpeedMultiplier:.8,verticalSpeedMultiplier:1.6,angleMultiplier:.5}}};
 assert.deepEqual(reconstructSkip(plane,modern),reconstructSkip(plane,weapon));
});
test('selection changes affect geometry without a ship-name whitelist or fallback',()=>{
 const original=JSON.stringify([plane,weapon]);
 assert.equal(reconstructSkip({...plane,attackerSize:3},weapon).bombs,6);
 assert.notEqual(reconstructSkip({...plane,speedMoveWithBomb:180},weapon).result.contacts[0].distanceMeters,reconstructSkip(plane,weapon).result.contacts[0].distanceMeters);
 assert.throws(()=>reconstructSkip(plane,{...weapon,skips:null}),/unavailable/);
 assert.throws(()=>reconstructSkip({...plane,aimingHeight:0},weapon),/invalid/);
 assert.equal(JSON.stringify([plane,weapon]),original);
});
test('upper structures use the narrow front silhouette for drawing and contact',()=>{
 const reference={lengthMeters:10,beamMeters:4,heights:[3,3,3],widths:[[-.5,.5],[-.5,.5],[-.5,.5]]};
 const front={beamMeters:4,crop:{x:0,y:0,width:4,height:5},waterlineSourceY:3,widths:[[-.125,.125],[-.125,.125],[-.5,.5],[-.5,.5],[-.5,.5]]};
 const hull=createHullContact(reference,1,front);
 assert.equal(hull.contains(1.5,2.5,0,0,0),false,'Upper structure must not fill the whole beam');
 assert.equal(hull.contains(0,2.5,0,0,0),true);
 assert.equal(hull.contains(1.5,.5,0,0,0),true,'Lower hull keeps its full width');
 const profile=hull.projectProfile(0);
 assert.equal(profile.find(r=>r.height===2.5).right-profile.find(r=>r.height===2.5).left,1);
 assert.equal(profile.find(r=>r.height===.5).right-profile.find(r=>r.height===.5).left,4);
 const hit=hull.firstContact([{x:-3,y:2.5,z:0,t:0},{x:3,y:2.5,z:0,t:6}],0,0);
 assert.ok(Math.abs(hit.x+.5)<1e-5,'Contact occurs at the narrow structure, not the full-beam box');
 assert.equal(hull.projectProfile(90).find(r=>r.height===2.5).right-hull.projectProfile(90).find(r=>r.height===2.5).left,10);
});


test('dispersion preserves the shared pack bounce speed and angle across bombs and rerolls',()=>{
 const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
 for(const row of require('../src/skip-bombers/data.json').rows){
  const r=row.result,reference=r.contacts[0].distanceMeters;
  const speed=Math.hypot(reference,r.heightMeters)/r.initialTime;
  const angle=Math.min(Math.atan2(r.heightMeters,reference),row.maxSkipAngleDeg*Math.PI/180);
  for(const aim of ['full','max'])for(const seed of [19,20,11317,4294967295]){
   const salvo=buildSalvo(row,aim,seed);
   assert.deepEqual(salvo,buildSalvo(row,aim,seed),'replay keeps its sampled paths');
   assert.notDeepEqual(salvo,buildSalvo(row,aim,(seed+1)>>>0),'new salvo rerolls');
   assert.ok(new Set(salvo.map(b=>b.contacts[0].x)).size>1,'initial impacts remain dispersed');
   row.skips.forEach((stage,j)=>{
    const pitch=Math.min(angle*stage[4],row.maxSkipAngleDeg*Math.PI/180);
    const expected=speed*stage[2]*Math.cos(pitch);
    for(const bomb of salvo){
     const arc=bomb.arcs[j];
     assert.ok(Math.abs(arc.vx-expected)<1e-9,'same stage uses the shared reference speed');
     assert.ok(Math.abs(arc.angle-pitch)<1e-12);
     assert.ok(Math.abs(arc.time*arc.vx-arc.length)<1e-8,'duration still follows individual segment length');
     assert.ok(Math.abs(arc.vy*arc.time+.5*arc.g*arc.time**2)<1e-8,'bounce returns to water');
    }
   });
   assert.ok(salvo.every(b=>b.points.every((p,i,a)=>Number.isFinite(p.t)&&p.y>=0&&(!i||p.t>a[i-1].t))));
  }
 }
});


test('aircraft groups stay ordered while multi-bomb aircraft can exchange bomb order',()=>{
 const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
 let exchanges=0;
 for(const source of require('../src/skip-bombers/data.json').rows)for(const aim of ['full','max'])for(let seed=1;seed<=50;seed++){
  const row={...source,attackGroup:{...source.attackGroup}},salvo=buildSalvo(row,aim,seed),r=row.result;
  const planeOrder=j=>Array.from({length:row.attackGroup.aircraft},(_,plane)=>({plane,z:salvo.filter(b=>b.planeIndex===plane).reduce((sum,b)=>sum+b.contacts[j].z,0)/(row.attackGroup.projectilesPerRelease*row.attackGroup.releases)})).sort((a,b)=>a.z-b.z).map(p=>p.plane);
  const first=planeOrder(0);
  for(let j=0;j<r.contacts.length;j++){
   assert.deepEqual(planeOrder(j),first);
   const c=r.contacts[j],w=aim==='max'?c.maxWidthMeters:c.fullWidthMeters;
   first.forEach((plane,rank)=>{
    const bombs=salvo.filter(b=>b.planeIndex===plane);
    assert.equal(bombs.length,row.attackGroup.projectilesPerRelease*row.attackGroup.releases);
    for(const b of bombs){const q=(b.contacts[j].z/w+.5)*first.length;assert.ok(q>=rank-1e-12&&q<rank+1+1e-12)}
   });
  }
  const order=j=>salvo.map((b,i)=>({i,z:b.contacts[j].z})).sort((a,b)=>a.z-b.z).map(p=>p.i).join(',');
  if(row.attackGroup.projectilesPerRelease>1&&order(0)!==order(1))exchanges++;
 }
 assert.ok(exchanges>20,'multi-bomb aircraft are not locked into separate per-bomb strata');
 const row=reconstructSkip({...plane,attackCount:2},weapon),salvo=buildSalvo(row,'full',19);
 assert.equal(salvo.length,8);
 for(let i=0;i<2;i++)assert.equal(new Set(salvo.filter(b=>b.planeIndex===i).map(b=>b.releaseIndex+':'+b.projectileIndex)).size,4);
 assert.throws(()=>reconstructSkip({...plane,attackerSize:1.5},weapon),/payload count/);
 assert.throws(()=>buildSalvo({...row,attackGroup:null},'full',1),/grouping/);
});


test('aircraft grouping reproduces the main patterns of four independent replay sets',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
 const observations=require('./fixtures/skip-dispersion-observations.json').cases;
 const results=[];
 for(const observed of observations){
  const root=path.resolve(__dirname,'../GAME',observed.game,observed.version);
  const plane=JSON.parse(fs.readFileSync(path.join(root,'Aircraft',observed.aircraft+'.json')));
  const weapon=JSON.parse(fs.readFileSync(path.join(root,'Projectiles',observed.weapon+'.json')));
  const row=reconstructSkip(plane,weapon),xs=[[],[]];let exchanges=0;
  assert.equal(row.attackGroup.aircraft,observed.planes);
  assert.equal(row.attackGroup.projectilesPerRelease*row.attackGroup.releases,observed.bombsPerPlane);
  for(let seed=1;seed<=500;seed++){
   const salvo=buildSalvo(row,'full',seed),last=row.result.contacts.length-1;
   const bombOrder=j=>salvo.map((b,i)=>({i,z:b.contacts[j].z})).sort((a,b)=>a.z-b.z).map(b=>b.i).join(',');
   if(bombOrder(0)!==bombOrder(last))exchanges++;
   for(const [k,j]of [0,last].entries()){
    const mean=salvo.reduce((s,b)=>s+b.contacts[j].z,0)/salvo.length;
    xs[k].push(...salvo.map(b=>b.contacts[j].z-mean));
   }
  }
  const [a,b]=xs,r=a.reduce((s,x,i)=>s+x*b[i],0)/Math.sqrt(a.reduce((s,x)=>s+x*x,0)*b.reduce((s,x)=>s+x*x,0));
  assert.ok(Math.abs(r-observed.lateralCorrelation)<.12,'matches the broad observed persistence without per-ship fit coefficients');
  if(observed.bombsPerPlane===1)assert.equal(exchanges,0);
  else assert.ok(exchanges>250,'same-plane bombs can exchange order');
  results.push({name:observed.name,observed:observed.lateralCorrelation,simulated:r,exchanges});
 }
 console.log('Replay aggregate comparison:',JSON.stringify(results));
});
