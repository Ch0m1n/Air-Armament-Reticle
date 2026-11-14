'use strict';

// Intersection against a solid height envelope, not armor, damage or probability.
function createHullContact(reference, hullScale=2) {
 const length=reference.lengthMeters*hullScale,beam=reference.beamMeters*hullScale;
 function surface(x,z,target,heading){
  const angle=heading*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const dx=x-target,u=dx*c+z*s,v=-dx*s+z*c;
  if(Math.abs(v)>length/2||Math.abs(u)>beam/2)return null;
  const row=reference.widths[Math.min(reference.widths.length-1,Math.floor((v/length+.5)*reference.widths.length))];
  if(!row||u<row[0]*beam||u>row[1]*beam)return null;
  const j=Math.min(reference.heights.length-1,Math.max(0,Math.round((.5-v/length)*(reference.heights.length-1))));
  return reference.heights[j]*hullScale;
 }
 const mix=(a,b,q)=>({x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q,z:a.z+(b.z-a.z)*q,t:a.t+(b.t-a.t)*q});
 function firstContact(points,target,heading,origin=0){
  const angle=heading*Math.PI/180;
  const halfX=(length*Math.abs(Math.sin(angle))+beam*Math.abs(Math.cos(angle)))/2;
  const halfZ=(length*Math.abs(Math.cos(angle))+beam*Math.abs(Math.sin(angle)))/2;
  const inside=p=>{const h=surface(origin+p.x,p.z,target,heading);return h!==null&&p.y>=0&&p.y<=h};
  if(inside(points[0]))return {...points[0]};
  // Sample each path segment at <=0.25 map meter, including fast side entry.
  // Bisect the first outside->inside interval for a stable contact timestamp.
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];
   if(Math.max(a.x,b.x)+origin<target-halfX||Math.min(a.x,b.x)+origin>target+halfX||Math.max(a.z,b.z)<-halfZ||Math.min(a.z,b.z)>halfZ)continue;
   const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/.25));
   let previous=0;
   for(let k=1;k<=steps;k++){
    const q=k/steps,p=mix(a,b,q);
    if(inside(p)){
     let lo=previous,hi=q;for(let n=0;n<18;n++){const mid=(lo+hi)/2;if(inside(mix(a,b,mid)))hi=mid;else lo=mid}
     return mix(a,b,hi);
    }
    previous=q;
   }
  }
  return null;
 }
 return {surface,firstContact};
}
module.exports={createHullContact};
