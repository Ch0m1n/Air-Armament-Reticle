const {test}=require('node:test');
const assert=require('node:assert/strict');
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
