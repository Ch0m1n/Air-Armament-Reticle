import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';

const root=path.resolve(import.meta.dirname,'..');
export const repository='Ch0m1n/Air-Armament-Reticle';
const execute=promisify(execFile);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_]+$/.test(value);
export function createProgressWriter(filename,{io=fs,now=Date.now,intervalMs=200}={}){
  const pending=filename+'.'+process.pid+'.tmp';let lastKey='',lastAttempt=-Infinity;
  return progress=>{
    const stamp=now(),key=[progress.phase,progress.game,progress.datasetIndex,progress.total].join(':');
    const complete=progress.phase==='scan'&&progress.total>0&&progress.completed>=progress.total;
    if(key===lastKey&&!complete&&stamp-lastAttempt<intervalMs)return false;
    lastKey=key;lastAttempt=stamp;
    try{
      // Progress is advisory. Publish complete JSON snapshots without blocking work on a GUI/AV lock.
      io.writeFileSync(pending,JSON.stringify(progress),'utf8');
      io.renameSync(pending,filename);
      return true;
    }catch{return false;}
    finally{try{io.unlinkSync(pending);}catch{}}
  };
}
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
export function collectDataset({source,game,version,onProgress=()=>{},shipSubset,allowEmpty=false}){
  const started=Date.now();
  onProgress({phase:'scan',completed:0,total:0,elapsedSeconds:0,remainingSeconds:null});
  if(!['WOWS','KORABLI'].includes(game))throw Error('Select WOWS or KORABLI.');validateVersion(version);
  if(!source||!fs.existsSync(source)||!fs.statSync(source).isDirectory())throw Error('Select an existing version folder containing Ship(s), Aircraft and Projectile(s).');
  source=resolveSource(fs.realpathSync(source),version);const core=engine();
  const folders=Object.fromEntries([['Ships',['Ships','Ship']],['Aircraft',['Aircraft']],['Projectiles',['Projectiles','Projectile']]].map(([type,names])=>{
    const folder=names.map(name=>path.join(source,name)).find(file=>fs.existsSync(file)&&fs.statSync(file).isDirectory());
    if(!folder)throw Error('Missing '+type+' folder. Select a single extracted game-version folder, not the game installation or a folder containing many versions.');
    return [type,folder];
  }));
  const files=new Map(),cache=new Map(),warnings=[],shipDecisions=[];let skippedShips=0,skippedAircraft=0,configurations=0;
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
  const shipFiles=(shipSubset||fs.readdirSync(folders.Ships,{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.json')).map(entry=>entry.name).sort()).filter(filename=>{
    const excluded=filename.match(/DISABLED|PRESERVED/i);
    if(!excluded)return true;
    skippedShips++;
    shipDecisions.push({ship:filename.slice(0,-5),included:false,aircraft:[],excludedAsw:0,excludedOther:0,reason:excluded[0].toLowerCase()});
    return false;
  });
  if(!shipFiles.length&&!allowEmpty)throw Error('No Ship JSON files found.');
  let completed=0,lastProgress=0;
  for(const filename of shipFiles){
    let ship,manifest,excludedGroup;
    try{
      ship=read('Ships',filename.slice(0,-5));
      const group=String(ship.group||'').toLowerCase();
      excludedGroup=['disabled','preserved'].includes(group)?group:null;
      manifest=excludedGroup?{aircraft:[]}:core.shipManifest(ship,filename);
    }
    catch(error){throw Error(filename+': '+error.message);}
    const eligibleAircraft=[];let excludedAsw=0,excludedOther=0;
    for(const reference of manifest.aircraft){
      try{
        const plane=read('Aircraft',reference.id),projectile=core.aircraftWeaponId(plane);
        if(!validId(projectile))throw Error('No supported weapon reference');
        const weapon=read('Projectiles',projectile);
        // Classify the weapon before geometry: ASW aircraft may not have bomber reticle inputs.
        if(['DC','depthcharge'].includes(weapon.ammoType)||weapon.planeAmmoType==='depthcharge'||weapon.typeinfo?.species==='DepthCharge')throw Object.assign(Error('ASW/DC excluded'),{exclusion:'asw'});
        const result=core.aircraftRecord(plane,reference.id+'.json',weapon);
        if(result.projectile!==projectile||!['bomb','torpedo','airstrike','attack','skip'].includes(result.kind))throw Error('Unsupported aircraft reference');
        if(result.kind==='airstrike'){core.attachAirstrikeWeapon(result,weapon);if(!result.weaponVerified)throw Error('Unverified airstrike weapon');}
        if(result.kind==='torpedo'&&weapon.ammoType!=='torpedo'&&weapon.planeAmmoType!=='torpedo')throw Error('Torpedo weapon mismatch');
        if(core.referenceOnlyReason(result,[manifest],new Map(),new Map([[weapon.name,weapon]])))throw Error('Unsupported air-support reference');
        add('Aircraft',plane);add('Projectiles',weapon);eligibleAircraft.push(plane.name);configurations++;
      }catch(error){
        if(error.exclusion==='asw')excludedAsw++;else excludedOther++;
        skippedAircraft++;if(warnings.length<20)warnings.push(reference.id+': '+error.message);
      }
    }
    const included=eligibleAircraft.length>0;
    if(included)add('Ships',ship);else skippedShips++;
    shipDecisions.push({ship:ship.name,included,aircraft:eligibleAircraft,excludedAsw,excludedOther,reason:excludedGroup||(included?'supported-armament':!manifest.aircraft.length?'no-aircraft':excludedAsw>0&&excludedOther===0?'asw-only':'no-supported-armament')});
    completed++;
    const now=Date.now(),elapsedSeconds=(now-started)/1000;
    if(now-lastProgress>=250||completed===shipFiles.length){
      onProgress({phase:'scan',completed,total:shipFiles.length,elapsedSeconds,remainingSeconds:completed>=3?elapsedSeconds/completed*(shipFiles.length-completed):null});
      lastProgress=now;
    }
  }
  onProgress({phase:'finalize',completed,total:shipFiles.length,remainingSeconds:null});
  if(!configurations&&!allowEmpty)throw Error('No supported ship-aircraft-projectile connections found. Nothing will be uploaded.');
  return finishDataset({source,game,version,files,configurations,skippedShips,skippedAircraft,shipDecisions,warnings});
}
function finishDataset({source,game,version,files,configurations,skippedShips,skippedAircraft,shipDecisions,warnings}){
  const hash=crypto.createHash('sha256').update(game+'\n'+version+'\n');
  for(const [file,bytes]of [...files].sort(([a],[b])=>a.localeCompare(b)))hash.update(file+'\n').update(bytes);
  const counts=Object.fromEntries(['Ships','Aircraft','Projectiles'].map(type=>[type,[...files.keys()].filter(file=>file.startsWith(type+'/')).length]));
  return {source,game,version,files,summary:{source,game,version,counts,configurations,skippedShips,skippedAircraft,shipDecisions,aswOnlyShips:shipDecisions.filter(ship=>ship.reason==='asw-only').length,mixedShips:shipDecisions.filter(ship=>ship.included&&ship.excludedAsw>0).length,warnings,totalBytes:[...files.values()].reduce((sum,bytes)=>sum+bytes.length,0),manifestHash:hash.digest('hex'),repository,destination:`GAME/${game}/${version}`}};
}
export async function collectDatasetParallel(options){
  const concurrency=options.concurrency??Math.min(4,os.availableParallelism());
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Scan concurrency must be between 1 and 4.');
  if(!['WOWS','KORABLI'].includes(options.game))throw Error('Select WOWS or KORABLI.');
  validateVersion(options.version);
  if(!options.source||!fs.existsSync(options.source)||!fs.statSync(options.source).isDirectory())throw Error('Select an existing version folder containing Ship(s), Aircraft and Projectile(s).');
  const source=resolveSource(fs.realpathSync(options.source),options.version);
  const folder=['Ships','Ship'].map(name=>path.join(source,name)).find(file=>fs.existsSync(file));
  const filenames=fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.json')).map(e=>e.name).sort();
  if(concurrency===1||filenames.length<2)return collectDataset(options);
  const started=Date.now(),workers=[],counts=[],total=filenames.length;
  options.onProgress?.({phase:'scan',completed:0,total,remainingSeconds:null,elapsedSeconds:0,workers:Math.min(concurrency,total)});
  try{
    const size=Math.ceil(total/concurrency),tasks=[];
    for(let start=0;start<total;start+=size){
      const index=tasks.length,shipSubset=filenames.slice(start,start+size);counts[index]=0;
      tasks.push(new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('./publisher-scan-worker.mjs',import.meta.url),{workerData:{source,game:options.game,version:options.version,shipSubset}});
        workers.push(worker);let done=false;
        worker.on('message',message=>{
          if(message.type==='progress'){
            counts[index]=message.completed;
            const completed=counts.reduce((n,value)=>n+value,0),elapsedSeconds=(Date.now()-started)/1000;
            options.onProgress?.({phase:'scan',completed,total,elapsedSeconds,remainingSeconds:completed>=3?elapsedSeconds/completed*(total-completed):null,workers:workers.length});
          }else if(message.type==='result'){done=true;resolve(message.plan);}
          else if(message.type==='error'){done=true;reject(Error(message.error));}
        });
        worker.on('error',reject);
        worker.on('exit',code=>{if(!done)reject(Error('Scan worker exited before completion ('+code+').'));});
      }));
    }
    const parts=await Promise.all(tasks),files=new Map(),shipDecisions=[],warnings=[];
    let configurations=0,skippedShips=0,skippedAircraft=0;
    for(const part of parts){
      for(const [file,data]of part.files){
        const bytes=Buffer.from(data);
        if(files.has(file)&&!files.get(file).equals(bytes))throw Error('Source changed during parallel scan. Run Preview again.');
        files.set(file,bytes);
      }
      configurations+=part.summary.configurations;skippedShips+=part.summary.skippedShips;skippedAircraft+=part.summary.skippedAircraft;
      shipDecisions.push(...part.summary.shipDecisions);warnings.push(...part.summary.warnings);
    }
    if(!configurations)throw Error('No supported ship-aircraft-projectile connections found. Nothing will be uploaded.');
    shipDecisions.sort((a,b)=>Number(!/DISABLED|PRESERVED/i.test(a.ship))-Number(!/DISABLED|PRESERVED/i.test(b.ship))||(a.ship<b.ship?-1:a.ship>b.ship?1:0));
    options.onProgress?.({phase:'finalize',completed:total,total,remainingSeconds:null});
    return finishDataset({source,game:options.game,version:options.version,files,configurations,skippedShips,skippedAircraft,shipDecisions,warnings:warnings.slice(0,20)});
  }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
}
export function collectBatch(options){
  if(!Array.isArray(options.datasets)||options.datasets.length!==2||new Set(options.datasets.map(d=>d.game)).size!==2)throw Error('Both mode requires one WOWS and one KORABLI dataset.');
  const plans=options.datasets.map((dataset,index)=>collectDataset({...dataset,onProgress:event=>options.onProgress?.({...event,game:dataset.game,datasetIndex:index+1,datasetCount:2})}));
  return finishBatch(plans);
}
async function collectBatchParallel(options){
  if(!Array.isArray(options.datasets)||options.datasets.length!==2||new Set(options.datasets.map(d=>d.game)).size!==2)throw Error('Both mode requires one WOWS and one KORABLI dataset.');
  const plans=[];
  for(const [index,dataset]of options.datasets.entries())plans.push(await collectDatasetParallel({...dataset,concurrency:options.concurrency,onProgress:event=>options.onProgress?.({...event,game:dataset.game,datasetIndex:index+1,datasetCount:2})}));
  return finishBatch(plans);
}
function finishBatch(plans){
  const summaries=plans.map(plan=>plan.summary),counts=Object.fromEntries(['Ships','Aircraft','Projectiles'].map(type=>[type,summaries.reduce((n,s)=>n+s.counts[type],0)]));
  const summary={repository,datasets:summaries,source:summaries.map(s=>s.game+': '+s.source).join('\n'),destination:summaries.map(s=>s.destination).join('\n'),counts,
    manifestHash:crypto.createHash('sha256').update(summaries.map(s=>s.manifestHash).join('\n')).digest('hex'),
    shipDecisions:summaries.flatMap(s=>s.shipDecisions.map(ship=>({...ship,ship:s.game+' / '+ship.ship}))),warnings:summaries.flatMap(s=>s.warnings.map(w=>s.game+': '+w))};
  for(const key of ['configurations','totalBytes','skippedShips','skippedAircraft','aswOnlyShips','mixedShips'])summary[key]=summaries.reduce((n,s)=>n+s[key],0);
  return {plans,summary};
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
  const stage=phase=>options.onProgress?.({phase,remainingSeconds:null});
  if(!/^[a-f0-9]{64}$/.test(options.expectedHash||''))throw Error('Run Preview first.');
  const batch=options.datasets?await collectBatchParallel(options):null,plan=batch||await collectDatasetParallel(options),plans=batch?batch.plans:[plan];
  if(plan.summary.manifestHash!==options.expectedHash)throw Error('Source files or settings changed after Preview. Run Preview again.');
  stage('authenticate');await run('gh',['auth','status'],root);
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'air-reticle-publisher-')),checkout=path.join(temporary,'checkout');
  let committed=false,finished=false;
  try{
    stage('clone');await run('gh',['repo','clone',repository,checkout,'--','--branch','main','--single-branch'],root);
    const identity=JSON.parse(await run('gh',['api','user'],root));
    await run('git',['config','user.name',identity.login],checkout);
    await run('git',['config','user.email',`${identity.id}+${identity.login}@users.noreply.github.com`],checkout);
    const before=await run('git',['rev-parse','HEAD'],checkout);
    stage('prepare');
    // Check every destination before changing either dataset in the disposable clone.
    for(const item of plans)if(fs.existsSync(versionTarget(checkout,item.game,item.version))&&!options.replace)throw Error('This game/version already exists on GitHub. Enable Replace existing version only if you intend to replace it.');
    for(const item of plans)writeDataset(checkout,item,{replace:options.replace});
    stage('validate');
    for(const args of [['tools/reindex.mjs'],['--test','tests/core.test.mjs'],['tools/build.mjs']])await run(process.execPath,args,checkout);
    const prefixes=plans.map(item=>`GAME/${item.game}/${item.version}/`);
    await run('git',['add','--',...prefixes],checkout);
    const changed=(await run('git',['diff','--cached','--name-only','-z'],checkout)).split('\0').filter(Boolean);
    if(changed.some(file=>!prefixes.some(prefix=>file.startsWith(prefix))))throw Error('Changes outside selected dataset were blocked.');
    if(!changed.length)return {...plan.summary,status:'unchanged',commit:before,url:`https://github.com/${repository}`};
    await run('git',['commit','-m',`Update ${plans.map(item=>item.game+' '+item.version).join(' and ')} aircraft armament data`],checkout);committed=true;
    const commit=await run('git',['rev-parse','HEAD'],checkout);
    stage('push');await run('git',['push','origin','HEAD:main'],checkout);
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
  for(let i=0;i<args.length;i++){if(args[i]==='--replace')values.replace=true;else {if(!['--source','--game','--version','--expected-hash','--progress-file','--batch-file','--workers'].includes(args[i])||!args[i+1])throw Error('Invalid arguments');values[args[i].slice(2)]=args[++i];}}
  if(!['preview','publish'].includes(mode))throw Error('Usage: node tools/data-publisher.mjs preview|publish --source <folder> --game WOWS|KORABLI --version <version> [--expected-hash <preview hash>] [--replace]');
  const options={source:values.source,game:values.game,version:values.version,expectedHash:values['expected-hash'],replace:values.replace};
  if(values.workers!==undefined)options.concurrency=Number(values.workers);
  if(values['batch-file'])options.datasets=JSON.parse(fs.readFileSync(values['batch-file'],'utf8')).datasets;
  if(values['progress-file'])options.onProgress=createProgressWriter(values['progress-file']);
  const result=mode==='preview'?(await (options.datasets?collectBatchParallel(options):collectDatasetParallel(options))).summary:await publishDataset(options);
  process.stdout.write(JSON.stringify({ok:true,...result})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{process.stderr.write(JSON.stringify({ok:false,error:error.message})+'\n');process.exitCode=1;});
