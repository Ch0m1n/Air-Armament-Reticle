const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/viewer-source.html'),'utf8'),ctx=vm.createContext({});
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0],ctx);
test('airstrike with equal inner and outer regions still creates its complete payload',()=>{
 const r={weaponVerified:true,payload:{releases:2,aircraft:3,perRelease:2,interval:0.5},outer:{width:100,baseHeight:60,drop:10},inner:{width:100,baseHeight:60},innerPercentage:0};
 const points=ctx.simulateAirstrike(r,()=>0.5);assert.equal(points.length,12);assert.equal(points[6].time,0.5);
});
