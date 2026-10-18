import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
export const repository='Ch0m1n/Air-Armament-Reticle';
const execute=promisify(execFile);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_]+$/.test(value);
function validateVersion(version){
  if(typeof version!=='string'||version.length>64||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(version)||version.endsWith('.'))throw Error('Invalid version name. Use letters, digits, dots, hyphens or underscores (up to 64 characters).');
}
function engine(){
  const core=vm.createContext({});
  const source=fs.readFileSync(path.join(root,'src/viewer-source.html'),'utf8');
  vm.runInContext(source.match(/<script>([\s\S]*?)<\/script>/)[1].split('// UI')[0],core);return core;
}
function resolveSource(source,version){
  const complete=folder=>[['Ships','Ship'],['Aircraft'],['Projectiles','Projectile']].every(names=>names.some(name=>fs.existsSync(path.join(folder,name))&&fs.statSync(path.join(folder,name)).isDirectory()));
  if(complete(source))return source;
  const versionFolder=path.join(source,version);if(fs.existsSync(versionFolder)&&complete(versionFolder))return fs.realpathSync(versionFolder);
  const base=version.replace(/-(test|live)$/i,''),compact=base.replace(/[._-]/g,'');
  const matches=[...new Set([base,compact])].map(name=>path.join(source,name)).filter(folder=>fs.existsSync(folder)&&complete(folder));
  if(matches.length===1)return fs.realpathSync(matches[0]);
  if(matches.length>1)throw Error('Several source version folders match. Select the intended version folder directly.');
  throw Error('Missing Ships/Ship, Aircraft or Projectiles/Projectile folders. Select a data folder, or a parent containing the entered version (for example 15.10 or 1510).');
}
export function collectDataset({source,game,version}){
  if(!['WOWS','KORABLI'].includes(game))throw Error('Select WOWS or KORABLI.');validateVersion(version);
  if(!source||!fs.existsSync(source)||!fs.statSync(source).isDirectory())throw Error('Select an existing version folder containing Ship(s), Aircraft and Projectile(s).');
  source=resolveSource(fs.realpathSync(source),version);const core=engine();
  const folders=Object.fromEntries([['Ships',['Ships','Ship']],['Aircraft',['Aircraft']],['Projectiles',['Projectiles','Projectile']]].map(([type,names])=>{
    const folder=names.map(name=>path.join(source,name)).find(file=>fs.existsSync(file)&&fs.statSync(file).isDirectory());
    if(!folder)throw Error('Missing '+type+' folder. Select a single extracted game-version folder, not the game installation or a folder containing many versions.');
    return [type,folder];
  }));
  const files=new Map(),cache=new Map(),warnings=[];let skippedShips=0,skippedAircraft=0,configurations=0;
  const read=(type,id)=>{
    if(!validId(id))throw Error('Invalid internal ID');const key=type+'/'+id;
    if(!cache.has(key)){
      const file=path.join(folders[type],id+'.json');if(fs.statSync(file).size>50*1024*1024)throw Error('JSON file exceeds 50 MB');
      const raw=core.parseAircraftJson(fs.readFileSync(file,'utf8')).data;
      if(raw?.name!==id||raw.typeinfo?.type!==({Ships:'Ship',Aircraft:'Aircraft',Projectiles:'Projectile'})[type])throw Error('Internal identity/type mismatch');
      cache.set(key,raw);
    }return cache.get(key);
  };
  const add=(type,raw)=>files.set(type+'/'+raw.name+'.json',Buffer.from(JSON.stringify(raw)+'\n'));
  const shipFiles=fs.readdirSync(folders.Ships,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.json')).map(entry=>entry.name).sort();
  if(!shipFiles.length)throw Error('No Ship JSON files found.');
  for(const filename of shipFiles){
    let ship,manifest;
    try{ship=read('Ships',filename.slice(0,-5));manifest=core.shipManifest(ship,filename);}
    catch(error){throw Error(filename+': '+error.message);}
    let supported=0;
    for(const reference of manifest.aircraft){
      try{
        const plane=read('Aircraft',reference.id),result=core.analyze(plane,reference.id+'.json');
        if(!validId(result.projectile)||!['bomb','torpedo','airstrike'].includes(result.kind))throw Error('Unsupported geometry');
        const weapon=read('Projectiles',result.projectile);
        if(weapon.planeAmmoType==='rocket'||weapon.typeinfo?.species==='Rocket')throw Error('Rocket aircraft geometry is not supported yet');
        if(['DC','depthcharge'].includes(weapon.ammoType)||weapon.planeAmmoType==='depthcharge'||weapon.typeinfo?.species==='DepthCharge')throw Error('ASW/DC excluded');
        if(result.kind==='airstrike'){core.attachAirstrikeWeapon(result,weapon);if(!result.weaponVerified)throw Error('Unverified airstrike weapon');}
        if(result.kind==='torpedo'&&weapon.ammoType!=='torpedo'&&weapon.planeAmmoType!=='torpedo')throw Error('Torpedo weapon mismatch');
        if(core.referenceOnlyReason(result,[manifest],new Map(),new Map([[weapon.name,weapon]])))throw Error('Unsupported air-support reference');
        add('Aircraft',plane);add('Projectiles',weapon);supported++;configurations++;
      }catch(error){skippedAircraft++;if(warnings.length<20)warnings.push(reference.id+': '+error.message);}
    }
    if(supported)add('Ships',ship);else skippedShips++;
  }
  if(!configurations)throw Error('No supported ship-aircraft-projectile connections found. Nothing will be uploaded.');
  const hash=crypto.createHash('sha256').update(game+'\n'+version+'\n');
  for(const [file,bytes]of [...files].sort(([a],[b])=>a.localeCompare(b)))hash.update(file+'\n').update(bytes);
  const counts=Object.fromEntries(['Ships','Aircraft','Projectiles'].map(type=>[type,[...files.keys()].filter(file=>file.startsWith(type+'/')).length]));
  return {source,game,version,files,summary:{source,game,version,counts,configurations,skippedShips,skippedAircraft,warnings,totalBytes:[...files.values()].reduce((sum,bytes)=>sum+bytes.length,0),manifestHash:hash.digest('hex'),repository,destination:`GAME/${game}/${version}`}};
}
function versionTarget(checkout,game,version){
  validateVersion(version);if(!['WOWS','KORABLI'].includes(game))throw Error('Invalid game');
  const absolute=fs.realpathSync(checkout),target=path.resolve(absolute,'GAME',game,version);
  if(!target.startsWith(absolute+path.sep)||path.relative(absolute,target)!==path.join('GAME',game,version))throw Error('Unsafe destination');
  for(const relative of ['GAME',path.join('GAME',game),path.join('GAME',game,version)]){
    const file=path.join(absolute,relative);if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Destination symlinks are not allowed');
  }return target;
}
export function writeDataset(checkout,plan,{replace=false}={}){
  for(const relative of plan.files.keys())if(!/^(Ships|Aircraft|Projectiles)\/[A-Za-z0-9_]+\.json$/.test(relative))throw Error('Unsafe dataset filename');
  const target=versionTarget(checkout,plan.game,plan.version);
  if(fs.existsSync(target)&&!replace)throw Error('This game/version already exists on GitHub. Enable Replace existing version only if you intend to replace it.');
  const previous=fs.existsSync(path.join(target,'dataset.json'))?JSON.parse(fs.readFileSync(path.join(target,'dataset.json'),'utf8')):{};
  if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
  for(const folder of ['Ships','Aircraft','Projectiles'])fs.mkdirSync(path.join(target,folder),{recursive:true});
  for(const [relative,bytes]of plan.files){
    if(!/^(Ships|Aircraft|Projectiles)\/[A-Za-z0-9_]+\.json$/.test(relative))throw Error('Unsafe dataset filename');
    fs.writeFileSync(path.join(target,relative),bytes);
  }
  const metadata={dataset:(plan.game==='WOWS'?'World of Warships':'Korabli')+' '+plan.version,snapshot:null};
  if(previous.default===true)metadata.default=true;
  fs.writeFileSync(path.join(target,'dataset.json'),JSON.stringify(metadata,null,2)+'\n');
  return target;
}
async function run(command,args,cwd){
  try{return (await execute(command,args,{cwd,env:{...process.env,GH_HOST:'github.com',GIT_TERMINAL_PROMPT:'0'},windowsHide:true,maxBuffer:16*1024*1024,timeout:180000})).stdout.trim();}
  catch(error){throw Error(command+' failed: '+(error.stderr||error.message).trim());}
}
export async function publishDataset(options){
  if(!/^[a-f0-9]{64}$/.test(options.expectedHash||''))throw Error('Run Preview first.');
  const plan=collectDataset(options);if(plan.summary.manifestHash!==options.expectedHash)throw Error('Source files or settings changed after Preview. Run Preview again.');
  await run('gh',['auth','status'],root);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'air-reticle-publisher-')),checkout=path.join(temporary,'checkout');
  let committed=false,finished=false;
  try{
    await run('gh',['repo','clone',repository,checkout,'--','--branch','main','--single-branch'],root);
    const identity=JSON.parse(await run('gh',['api','user'],root));
    await run('git',['config','user.name',identity.login],checkout);
    await run('git',['config','user.email',`${identity.id}+${identity.login}@users.noreply.github.com`],checkout);
    const before=await run('git',['rev-parse','HEAD'],checkout);
    writeDataset(checkout,plan,{replace:options.replace});
    for(const args of [['tools/reindex.mjs'],['--test','tests/core.test.mjs'],['tools/build.mjs']])await run(process.execPath,args,checkout);
    const prefix=`GAME/${plan.game}/${plan.version}/`;
    await run('git',['add','--',prefix],checkout);
    const changed=(await run('git',['diff','--cached','--name-only','-z'],checkout)).split('\0').filter(Boolean);
    if(changed.some(file=>!file.startsWith(prefix)))throw Error('Changes outside selected dataset were blocked.');
    if(!changed.length)return {...plan.summary,status:'unchanged',commit:before,url:`https://github.com/${repository}`};
    await run('git',['commit','-m',`Update ${plan.game} ${plan.version} aircraft armament data`],checkout);committed=true;
    const commit=await run('git',['rev-parse','HEAD'],checkout);
    await run('git',['push','origin','HEAD:main'],checkout);
    finished=true;
    return {...plan.summary,status:'published',commit,previousCommit:before,url:`https://github.com/${repository}/commit/${commit}`,actions:`https://github.com/${repository}/actions`};
  }catch(error){
    if(committed)throw Error(error.message+'\nLocal recovery checkout (push may be uncertain): '+checkout);
    throw error;
  }finally{
    // Preserve committed work if a push failed; remove only our own disposable clone otherwise.
    if((!committed||finished)&&temporary.startsWith(path.join(os.tmpdir(),'air-reticle-publisher-')))fs.rmSync(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}
async function main(){
  const [mode,...args]=process.argv.slice(2),values={};
  for(let i=0;i<args.length;i++){if(args[i]==='--replace')values.replace=true;else {if(!['--source','--game','--version','--expected-hash'].includes(args[i])||!args[i+1])throw Error('Invalid arguments');values[args[i].slice(2)]=args[++i];}}
  if(!['preview','publish'].includes(mode))throw Error('Usage: node tools/data-publisher.mjs preview|publish --source <folder> --game WOWS|KORABLI --version <version> [--expected-hash <preview hash>] [--replace]');
  const options={source:values.source,game:values.game,version:values.version,expectedHash:values['expected-hash'],replace:values.replace};
  const result=mode==='preview'?collectDataset(options).summary:await publishDataset(options);
  process.stdout.write(JSON.stringify({ok:true,...result})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{process.stderr.write(JSON.stringify({ok:false,error:error.message})+'\n');process.exitCode=1;});
