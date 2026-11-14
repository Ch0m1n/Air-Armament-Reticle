/* Continuous, image-derived Yamato silhouette rotation in fixed map coordinates. */
(function(){
'use strict';
let fields=null,pending=null,canvas=null,context=null,pixels=null,surfaceAngle=null;
const dataURL=new URL('yamato-rotation-data.js',document.currentScript.src);dataURL.search=new URL(document.currentScript.src).search;
const cache=new Map();
function decode(record,size){
 const packed=atob(record.data),field=new Uint8Array(size);let cursor=0;
 if(packed.length%2)throw Error('Invalid Yamato rotation data');
 for(let i=0;i<packed.length;i+=2){const count=packed.charCodeAt(i)+1;if(cursor+count>size)throw Error('Invalid Yamato rotation field');field.fill(packed.charCodeAt(i+1),cursor,cursor+count);cursor+=count;}
 if(cursor!==size)throw Error('Incomplete Yamato rotation field');
 return {angle:record.angle,field};
}
function initialize(){
 const data=globalThis.MK_YAMATO_ROTATION_DATA;
 if(!data||data.width!==896||data.height!==192||data.frames?.length!==21)throw Error('Yamato rotation data unavailable');
 fields=data.frames.map(record=>decode(record,data.width*data.height));
 canvas=document.createElement('canvas');canvas.width=data.width;canvas.height=data.height;
 context=canvas.getContext('2d');pixels=context.createImageData(data.width,data.height);pixels.data.fill(255);
 // The decoded fields replace the larger base64 strings once the lazy load completes.
 delete globalThis.MK_YAMATO_ROTATION_DATA;
}
function surface(angle){
 if(!fields)return null;
 const heading=Math.max(0,Math.min(180,Number(angle)||0));
 if(surfaceAngle!==heading){
  let upper=fields.findIndex(record=>record.angle>=heading);if(upper<0)upper=fields.length-1;
  const high=fields[upper],low=fields[Math.max(0,upper-1)],mix=high.angle===low.angle?0:(heading-low.angle)/(high.angle-low.angle);
  const output=pixels.data,a=low.field,b=high.field;
  for(let i=0;i<a.length;i++){
   const distance=a[i]+(b[i]-a[i])*mix-128;
   output[i*4+3]=Math.max(0,Math.min(255,(distance+.5)*255));
  }
  context.putImageData(pixels,0,0);surfaceAngle=heading;
 }
 return {canvas,angle:heading,left:-280,top:96,width:560,height:120};
}
function frame(angle){
 const heading=Math.max(0,Math.min(180,Number(angle)||0)),key=Math.round(heading*1000)/1000;
 if(cache.has(key))return cache.get(key);
 const rendered=surface(heading);if(!rendered)return null;
 const result={src:canvas.toDataURL('image/png'),angle:heading,left:-280,top:96,width:560,height:120};
 if(cache.size>=12)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
globalThis.MKYamatoRotation={
 get ready(){return !!fields},frame,surface,
 prepare(){
  if(fields)return Promise.resolve(true);
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
   if(globalThis.MK_YAMATO_ROTATION_DATA){try{initialize();resolve(true)}catch(error){reject(error)}return;}
   const script=document.createElement('script');script.src=dataURL.href;script.async=true;
   script.onload=()=>{try{initialize();resolve(true)}catch(error){reject(error)}finally{script.remove()}};
   script.onerror=()=>{script.remove();reject(Error('Yamato rotation download failed'))};document.head.append(script);
  }).catch(error=>{pending=null;console.warn(error.message);return false});
  return pending;
 }
};
})();
