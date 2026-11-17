const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/site.js'),'utf8');
const start=source.indexOf('function handleReticleClick('),code=source.slice(start,source.indexOf('\nfunction handleReticleReset(',start));
test('card removal cannot race an in-flight selection update',()=>{
 let removed=0;
 const context=vm.createContext({busy:true,selections:[{id:1,slotId:2}],removeSlot:()=>removed++,renderLibrary(){},renderComparison(){}});
 vm.runInContext(code,context);
 context.handleReticleClick({target:{closest:()=>({dataset:{id:'1',action:'remove'},disabled:false})}});
 assert.equal(removed,0);
});
