'use strict';

// Intersection against a solid height envelope, not armor, damage or probability.
function createHullContact(reference, hullScale=2,front=null) {
 const length=reference.lengthMeters*hullScale,beam=reference.beamMeters*hullScale;
 const frontStep=front?front.beamMeters/front.crop.width*hullScale:0;
 function frontBounds(height){
  if(!front?.widths)return null;
  const row=Math.floor(front.waterlineSourceY-height/frontStep-front.crop.y);
  return front.widths[row]||null;
 }
 function contains(x,y,z,target,heading){
  const roof=surface(x,z,target,heading);if(roof===null||y<0||y>roof)return false;
  if(!front?.widths)return true;
  const a=heading*Math.PI/180,u=(x-target)*Math.cos(a)+z*Math.sin(a),bounds=frontBounds(y);
  return !!bounds&&u>=bounds[0]*beam&&u<=bounds[1]*beam;
 }
 let lastHeading=null,lastProjection=[];
 const sections=reference.heights.map((height,j)=>{
  const v=(.5-j/(reference.heights.length-1))*length;
  const top=reference.widths[Math.min(reference.widths.length-1,Math.floor((v/length+.5)*reference.widths.length))];
  return top?{v,roof:height*hullScale,left:top[0]*beam,right:top[1]*beam}:null;
 }).filter(Boolean);
 function projectProfile(heading){
  if(!front?.widths)return [];
  if(lastHeading===heading)return lastProjection;
  const angle=heading*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  lastProjection=front.widths.map((bounds,j)=>{
   if(!bounds)return null;
   const height=(front.waterlineSourceY-front.crop.y-j-.5)*frontStep;
   let left=Infinity,right=-Infinity;
   for(const part of sections){
    if(height>part.roof)continue;
    const lo=Math.max(bounds[0]*beam,part.left),hi=Math.min(bounds[1]*beam,part.right);if(lo>hi)continue;
    left=Math.min(left,Math.min(lo*c,hi*c)-part.v*s);right=Math.max(right,Math.max(lo*c,hi*c)-part.v*s);
   }
   return Number.isFinite(left)?{height,left,right,step:frontStep}:null;
  }).filter(Boolean);
  lastHeading=heading;return lastProjection;
 }
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
  const inside=p=>contains(origin+p.x,p.y,p.z,target,heading);
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
 return {surface,contains,firstContact,projectProfile};
}
module.exports={createHullContact};
