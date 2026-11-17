function rocketReleasePlan(r) {
  const raw=r.raw,pair=v=>Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(n=>Number.isFinite(n)&&n>0);
  const values=[raw.attackerSize,raw.projectilesPerAttack,raw.attackCount];
  if(!values.every(n=>Number.isInteger(n)&&n>0)||values.reduce((a,b)=>a*b,1)>512||!pair(raw.outerSalvoSize)||!pair(raw.innerSalvoSize)||!pair(raw.minSpread)||!pair(raw.maxSpread)||raw.minSpread.some((n,i)=>n>raw.maxSpread[i])||!Number.isFinite(raw.attackInterval)||raw.attackInterval<0)return null;
  const formation=raw.formations?.attack?.[1];
  if(!Array.isArray(formation)||formation.length<values[0]||!formation.slice(0,values[0]).every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))return null;
  const percentage=raw.innerBombsPercentage;
  if(!Number.isFinite(percentage)||percentage<0||percentage>100)return null;
  const spread=r.aimMode==='immediate'?raw.maxSpread:raw.minSpread;
  const region=salvo=>({width:60*salvo[0]*spread[0],height:60*salvo[1]*spread[1]});
  const outer=region(raw.outerSalvoSize),inner=region(raw.innerSalvoSize);
  if(inner.width>outer.width||inner.height>outer.height||((inner.width===outer.width&&inner.height===outer.height)&&percentage<100))return null;
  return {aircraft:values[0],projectilesPerRelease:values[1],releases:values[2],interval:raw.attackInterval,duration:(values[2]-1)*raw.attackInterval,outer,inner,percentage,
    planeOrder:Array.from({length:values[0]},(_,i)=>i).sort((a,b)=>formation[a][0]-formation[b][0]||a-b)};
}
function buildRocketSalvo(r,seed) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Rocket seed must be uint32');
  const plan=rocketReleasePlan(r);if(!plan)return null;
  let state=seed;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const sample=d=>{const radius=Math.sqrt(random()),angle=random()*Math.PI*2;return {x:Math.cos(angle)*radius*d.width/2,y:Math.sin(angle)*radius*d.height/2}};
  const count=plan.aircraft*plan.projectilesPerRelease,points=[],releases=[];
  for(let release=0;release<plan.releases;release++){
    // Candidate cumulative quota, supported by these replays; native rounding remains unverified.
    const quota=Math.round((release+1)*count*plan.percentage/100)-Math.round(release*count*plan.percentage/100),batch=[];
    for(let i=0;i<count;i++){
      let point=null;
      if(i<quota)point=sample(plan.inner);
      else for(let attempt=0;attempt<10000;attempt++){
        const p=sample(plan.outer);
        if((p.x/(plan.inner.width/2))**2+(p.y/(plan.inner.height/2))**2>1){point=p;break;}
      }
      if(!point)return null;
      batch.push({...point,inner:i<quota});
    }
    batch.sort((a,b)=>a.x-b.x);
    const time=release*plan.interval;
    batch.forEach((p,i)=>points.push({...p,planeIndex:plan.planeOrder[Math.floor(i/plan.projectilesPerRelease)],projectileIndex:i%plan.projectilesPerRelease,releaseIndex:release,releaseTime:time,releaseCenter:0}));
    releases.push({index:release,time,center:0,inner:quota,count});
  }
  return {model:'rocket-release-v1',seed,aim:r.aimMode||'fully',attackGroup:{aircraft:plan.aircraft,projectilesPerRelease:plan.projectilesPerRelease,releases:plan.releases},duration:plan.duration,points,releases};
}
