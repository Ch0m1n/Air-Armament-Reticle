'use strict';

// Port of the client-checked baseline reconstruction; all inputs come from
// the selected aircraft and its matching projectile, never a ship-name list.
function reconstructSkip(aircraft,weapon,name=aircraft.name){
 const positive=n=>Number.isFinite(n)&&n>0;
 for(const key of ['aimingHeight','speedMoveWithBomb','attackerSize','projectilesPerAttack','attackCount'])if(!positive(aircraft[key]))throw Error('Missing or invalid skip-bomber input: '+key);
 for(const key of ['outerSalvoSize','minSpread','maxSpread'])if(!Array.isArray(aircraft[key])||aircraft[key].length!==2||!aircraft[key].every(positive))throw Error('Missing or invalid skip-bomber input: '+key);
 if(!Array.isArray(weapon.projectileVelocityBoost)||!positive(weapon.projectileVelocityBoost[0])||!positive(weapon.fallingTimeCoef)||!positive(weapon.maxSkipAngle))throw Error('Skip projectile trajectory inputs are unavailable');
 const sequence=weapon.SkipsSequence;
 const skips=weapon.skips||(Array.isArray(sequence?.order)?sequence.order.map(key=>{const s=sequence[key]||{};return [s.xSalvo,s.zSalvo,s.horizontalSpeedMultiplier,s.verticalSpeedMultiplier,s.angleMultiplier]}):null);
 if(!Array.isArray(skips)||!skips.length||skips.length>10||!skips.every(row=>Array.isArray(row)&&row.length===5&&row.every(positive)))throw Error('Skip projectile bounce inputs are unavailable');
 for(const key of ['attackerSize','projectilesPerAttack','attackCount'])if(!Number.isInteger(aircraft[key]))throw Error('Invalid skip-bomber payload count: '+key);
 const bombs=aircraft.attackerSize*aircraft.projectilesPerAttack*aircraft.attackCount;
 if(!Number.isInteger(bombs)||bombs>4096)throw Error('Skip-bomber payload exceeds the supported limit');
 const gravity=10,toMap=30,height=aircraft.aimingHeight;
 const speed=aircraft.speedMoveWithBomb*(1.852/3.6)*0.06666667014360428*2.61;
 const initialTime=Math.sqrt(2*height/gravity)*weapon.fallingTimeCoef;
 const initialDistance=speed*weapon.projectileVelocityBoost[0]*Math.sqrt(2*height/gravity);
 const initialSpeed=Math.hypot(initialDistance,height)/initialTime;
 const angle=Math.min(Math.atan2(height,initialDistance),weapon.maxSkipAngle*Math.PI/180);
 const baselineVX=initialSpeed*Math.cos(Math.atan2(height,initialDistance)),baselineVY=initialSpeed*Math.sin(angle);
 function contact(distance,stage,fx=1,fz=1){
  return {stage,distanceBW:distance,distanceMeters:distance*toMap,
   fullWidthMeters:2*aircraft.outerSalvoSize[0]*aircraft.minSpread[0]*fx*toMap,
   fullLengthMeters:2*aircraft.outerSalvoSize[1]*aircraft.minSpread[1]*fz*toMap,
   maxWidthMeters:2*aircraft.outerSalvoSize[0]*aircraft.maxSpread[0]*fx*toMap,
   maxLengthMeters:2*aircraft.outerSalvoSize[1]*aircraft.maxSpread[1]*fz*toMap};
 }
 const contacts=[contact(initialDistance,0)],arcs=[];let distance=initialDistance;
 for(const [i,[fx,fz,horizontal,vertical,visualAngle]]of skips.entries()){
  const next=distance+baselineVX*horizontal*(2*baselineVY*vertical/gravity);
  const pitch=Math.min(angle*visualAngle,weapon.maxSkipAngle*Math.PI/180);
  const vx=initialSpeed*horizontal*Math.cos(pitch),renderTime=(next-distance)/vx;
  const vy=Math.tan(pitch)*(next-distance)/2,g=-2*vy/renderTime;
  const points=Array.from({length:81},(_,k)=>{const t=renderTime*k/80;return [distance+vx*t,vy*t+g*t*t/2]});
  arcs.push({startBW:distance,endBW:next,renderTime,renderPeakBW:vy*renderTime/4,points});
  distance=next;contacts.push(contact(distance,i+1,fx,fz));
 }
 const row={id:aircraft.name,name,aircraft:aircraft.name,bombs,attackGroup:{aircraft:aircraft.attackerSize,projectilesPerRelease:aircraft.projectilesPerAttack,releases:aircraft.attackCount},skips,maxSkipAngleDeg:weapon.maxSkipAngle,
  result:{heightBW:height,heightMeters:height*toMap,speedKn:aircraft.speedMoveWithBomb,initialTime,initialAngleDeg:angle*180/Math.PI,contacts,arcs}};
 if(!Number.isFinite(distance)||arcs.some(a=>!positive(a.renderTime)||!Number.isFinite(a.renderPeakBW)))throw Error('Skip-bomber trajectory cannot be calculated');
 return row;
}
module.exports={reconstructSkip};
