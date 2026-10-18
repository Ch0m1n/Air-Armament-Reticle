import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
const core=vm.createContext({});vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0],core);
const entries=[],datasets=[],hashes={};
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
for(const [folder,game]of [['WOWS','wows'],['KORABLI','korabli']]) {
  const parent=path.join(root,'GAME',folder);if(!fs.existsSync(parent))continue;
  const versions=fs.readdirSync(parent,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink()).map(entry=>entry.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));
  for(const version of versions) {
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version))throw Error('Invalid version folder: '+version);
    const base=`GAME/${folder}/${version}`;
    for(const type of ['Ships','Aircraft','Projectiles'])if(!fs.existsSync(path.join(root,base,type)))throw Error('Missing data folder: '+base+'/'+type);
    const metadata=fs.existsSync(path.join(root,base,'dataset.json'))?read(base+'/dataset.json'):{};
    const dataset={id:game+':'+version,game,version,dataset:metadata.dataset||(game==='wows'?'World of Warships':'Korabli')+' '+version,snapshot:metadata.snapshot||null,default:metadata.default===true,defaults:[]};
    const fileFor=(type,id)=>{
      if(!/^[A-Za-z0-9_]+$/.test(id))return null;
      const file=`${base}/${type}/${id}.json`;return fs.existsSync(path.join(root,file))?file:null;
    };
    const datasetEntries=[];
    for(const filename of fs.readdirSync(path.join(root,base,'Ships')).filter(name=>name.endsWith('.json')).sort()) {
      if(/DISABLED|PRESERVED/i.test(filename))continue;
      const shipFile=base+'/Ships/'+filename,ship=read(shipFile),code=ship.name.split('_')[0];
      if(/DISABLED|PRESERVED/i.test(ship.name))continue;
      if(['disabled','preserved'].includes(String(ship.group||'').toLowerCase()))continue;
      for(const ref of core.shipManifest(ship,filename).aircraft) {
        const planeFile=fileFor('Aircraft',ref.id);if(!planeFile)continue;
        const plane=read(planeFile),weaponId=plane.torpedoName||plane.bombName||plane.rocketName||plane.shellName;
        const weaponFile=fileFor('Projectiles',weaponId);if(!weaponFile)continue;
        const weapon=read(weaponFile);let result;try{result=core.analyze(plane,ref.id+'.json',weapon);}catch{continue;}
        if(!['bomb','torpedo','airstrike','attack'].includes(result.kind))continue;
        if(weapon.name!==result.projectile||plane.name!==ref.id)throw Error('Internal ID mismatch: '+planeFile);
        if(result.kind==='airstrike'){core.attachAirstrikeWeapon(result,weapon);if(!result.weaponVerified)continue;}
        const files=[shipFile,planeFile,weaponFile],legacyId=code+'--'+plane.name;
        for(const file of files)hashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
        const components=[...new Set(ref.contexts.map(context=>context.split(' / ')[0]))];
        const modules=components.map(component=>{
          const links=(ref.modules||[]).filter(link=>ship.ShipUpgradeInfo?.[link.id]?.components?.[link.role]?.includes(component));
          const stages=links.map(link=>{
            const upgrade=ship.ShipUpgradeInfo[link.id],seen=new Set([link.id]);let depth=0,prev=upgrade.prev;
            while(prev&&ship.ShipUpgradeInfo[prev]&&!seen.has(prev)){seen.add(prev);depth++;prev=ship.ShipUpgradeInfo[prev].prev;}
            const hasResearch=Object.values(ship.ShipUpgradeInfo).some(value=>value?.prev===link.id);
            return {id:link.id,role:link.role,stage:depth>0?'Research '+depth:hasResearch?'Stock':'Standard',order:depth};
          });
          return {id:component,upgrades:stages};
        });
        datasetEntries.push({id:dataset.id+'::'+legacyId,legacyId,datasetId:dataset.id,ship:ship.name.split('_').slice(1).join(' '),shipId:ship.name,nation:ship.typeinfo?.nation||'Unknown',shipClass:ship.typeinfo?.species||'Unknown',tier:ship.level??null,modules,aircraft:plane.name,role:result.kind,files});
      }
    }
    for(const id of metadata.defaults||[]) {
      const entry=datasetEntries.find(entry=>entry.id===id||entry.legacyId===id);if(!entry)throw Error('Default comparison has incomplete JSON: '+dataset.id+' / '+id);
      dataset.defaults.push(entry.id);
    }
    if(!metadata.defaults)dataset.defaults=datasetEntries.slice(0,3).map(entry=>entry.id);
    entries.push(...datasetEntries);datasets.push(dataset);
  }
}
const initial=datasets.find(dataset=>dataset.default)||datasets.find(dataset=>dataset.game==='korabli')||datasets[0];
fs.writeFileSync(path.join(root,'GAME/catalog.json'),JSON.stringify({schema:2,defaultDataset:initial?.id||null,datasets,entries,hashes},null,2)+'\n');
console.log(`Indexed ${entries.length} configurations across ${datasets.length} game versions`);
