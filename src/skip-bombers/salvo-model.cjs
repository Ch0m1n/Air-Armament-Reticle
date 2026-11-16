'use strict';

function buildSalvo(row, aim, seed) {
 const r=row.result,n=row.bombs,group=row.attackGroup;
 if(!group||![group.aircraft,group.projectilesPerRelease,group.releases].every(v=>Number.isInteger(v)&&v>0)||group.aircraft*group.projectilesPerRelease*group.releases!==n)throw Error('Skip-bomber aircraft grouping is unavailable');
 const perAircraft=group.projectilesPerRelease*group.releases;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const width=c=>(aim==='max'?c.maxWidthMeters:c.fullWidthMeters);
 const depth=c=>(aim==='max'?c.maxLengthMeters:c.fullLengthMeters);
 // Replays support stable aircraft groups, not fixed ranks for every bomb.
 // Each aircraft retains its lateral stratum; its bombs get fresh stage jitter.
 // Equal strata and uniform within-stratum RNG are still empirical assumptions.
 const ranks=Array.from({length:group.aircraft},(_,i)=>i);
 for(let i=ranks.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ranks[i],ranks[j]]=[ranks[j],ranks[i]]}
 const stages=r.contacts.map(c=>Array.from({length:n},(_,i)=>({
  x:c.distanceMeters+(random()*2-1)*depth(c)/2,
  z:((ranks[Math.floor(i/perAircraft)]+random())/group.aircraft*2-1)*width(c)/2
 })));
 const initialTime=r.initialTime,referenceDistance=r.contacts[0].distanceMeters;
 // The client uses the shared pack's squadronToTarget/fallTime for every bounce.
 // Per-bomb impact dispersion changes the initial fall path, not this reference.
 const initialSpeed=Math.hypot(referenceDistance,r.heightMeters)/initialTime;
 const initialAngle=Math.min(Math.atan2(r.heightMeters,referenceDistance),row.maxSkipAngleDeg*Math.PI/180);
 return Array.from({length:n},(_,i)=>{
  const contacts=stages.map(stage=>stage[i]),first=contacts[0],points=[];
  for(let k=0;k<=50;k++){const q=k/50;points.push({x:first.x*q,z:first.z*q,y:r.heightMeters*(1-q*q),t:initialTime*q})}
  const arcs=[];let elapsed=initialTime;
  for(let j=0;j<contacts.length-1;j++){
   const a=contacts[j],b=contacts[j+1],s=row.skips[j],length=Math.hypot(b.x-a.x,b.z-a.z);
   const angle=Math.min(initialAngle*s[4],row.maxSkipAngleDeg*Math.PI/180);
   const vx=initialSpeed*s[2]*Math.cos(angle),time=length/vx;
   // Same visual path helper as calculateBombTrajParams / calculateBombPosition.
   const vy=Math.tan(angle)*length*.5,g=-2*vy/time;
   arcs.push({length,time,vy,g,angle,vx,startTime:elapsed,peak:vy*time/4});
   for(let k=1;k<=80;k++){
    const q=k/80,t=time*q;
    points.push({x:a.x+(b.x-a.x)*q,z:a.z+(b.z-a.z)*q,y:Math.max(0,vy*t+.5*g*t*t),t:elapsed+t});
   }
   elapsed+=time;
  }
  return {planeIndex:Math.floor(i/perAircraft),releaseIndex:Math.floor(i%perAircraft/group.projectilesPerRelease),projectileIndex:i%group.projectilesPerRelease,contacts,points,arcs,duration:elapsed};
 });
}

module.exports={buildSalvo};
