import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),[input,gameInput,version,...selected]=process.argv.slice(2),game=gameInput?.toUpperCase();
if(!input||!['WOWS','KORABLI'].includes(game)||!version||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)||!selected.length||selected.some(code=>!/^[A-Za-z0-9]+$/.test(code)))throw Error('Usage: node tools/import-game-data.mjs <dataset folder> WOWS|KORABLI <version> <ship-code> [ship-code...]');
const destination=path.join(root,'GAME',game,version);
const source=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
const core=vm.createContext({});vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0],core);
const folders={Ships:fs.existsSync(path.join(input,'Ships'))?'Ships':'Ship',Aircraft:'Aircraft',Projectiles:fs.existsSync(path.join(input,'Projectiles'))?'Projectiles':'Projectile'};
for(const type of Object.keys(folders))fs.mkdirSync(path.join(destination,type),{recursive:true});
const read=(type,id)=>JSON.parse(fs.readFileSync(path.join(input,folders[type],id+'.json'),'utf8').replace(/^\uFEFF/,''));
const store=(type,raw)=>{if(!/^[A-Za-z0-9_]+$/.test(raw.name))throw Error('Invalid internal ID');fs.writeFileSync(path.join(destination,type,raw.name+'.json'),JSON.stringify(raw)+'\n');};
const shipFiles=fs.readdirSync(path.join(input,folders.Ships));
for(const code of selected) {
  const filename=shipFiles.find(name=>name.startsWith(code+'_')&&name.endsWith('.json'));if(!filename)continue;
  const ship=read('Ships',filename.slice(0,-5));store('Ships',ship);
  for(const ref of core.shipManifest(ship,filename).aircraft) {
    let plane,result,weapon;
    try{plane=read('Aircraft',ref.id);weapon=read('Projectiles',core.aircraftWeaponId(plane));result=core.aircraftRecord(plane,ref.id+'.json',weapon);if(!result.projectile)continue;
      if(result.kind==='airstrike'){core.attachAirstrikeWeapon(result,weapon);if(!result.weaponVerified)continue;}
    }catch{continue;}
    store('Aircraft',plane);store('Projectiles',weapon);
  }
}
const metadata=path.join(destination,'dataset.json');
if(!fs.existsSync(metadata))fs.writeFileSync(metadata,JSON.stringify({dataset:(game==='WOWS'?'World of Warships':'Korabli')+' '+version,snapshot:null},null,2)+'\n');
const result=spawnSync(process.execPath,[path.join(root,'tools/reindex.mjs')],{stdio:'inherit'});process.exitCode=result.status??1;
