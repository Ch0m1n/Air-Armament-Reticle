const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
test('editing aircraft inputs preserves view/aim preferences while invalidating old samples',async()=>{
 const engine=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0];
 const site=fs.readFileSync(path.join(root,'src/site.js'),'utf8'),add=site.slice(site.indexOf('function attachData('),site.indexOf('async function switchDataset('));
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/rocket-inputs.json'),'utf8'))[0].raw;
 const plane={...raw,bombName:'TEST_ROCKET'},weapon={name:'TEST_ROCKET',planeAmmoType:'rocket'},ship={name:'TEST_SHIP',typeinfo:{type:'Ship'}};
 const entry={id:'entry',datasetId:'korabli:1',shipId:ship.name,aircraft:plane.name,files:['ship','plane','weapon']};
 const slot={id:9,modifiers:{}},old={id:7,slotId:9,catalogId:'entry',reference:false,rotation:90,aimMode:'immediate',envelopeView:'swept',attack:{points:[{x:99}]}};
 const c=vm.createContext({structuredClone,catalog:{entries:[entry],datasets:[{id:'korabli:1',game:'korabli',version:'1'}]},activeGame:'korabli',gameNames:{korabli:'Korabli'},selections:[old],shipSlots:[slot],nextSelection:8,selectionSources:new Map(),slotGame:()=> 'korabli',comparisonShipLabel:()=> 'Test ship',repositoryJson:async name=>({ship,plane,weapon})[name]});
 slot.version='1';vm.runInContext(engine+'\n'+fs.readFileSync(path.join(root,'src/modifiers.js'),'utf8')+'\n'+add,c);
 await c.addEntry('entry',slot);const item=c.selections[0];
 assert.equal(item.rotation,90);assert.equal(item.aimMode,'immediate');assert.equal(item.envelopeView,'swept');assert.equal(item.reference,false);
 assert.equal(item.id,7);assert.equal(item.attack,undefined);
});
test('rocket modifier help describes the current game-distance scale and model',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'src/modifiers.js'),'utf8'),c);
 const help=c.modifierHelp('attack',{key:'minSpread',index:0});assert.match(help,/60 x/);assert.match(help,/inner quota/);assert.doesNotMatch(help,/fitted to two|30 x|inner allocation are not modeled/);
});
