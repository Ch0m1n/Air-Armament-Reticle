const siteCatalogUrl=document.currentScript.dataset.catalog;
const ui=id=>document.getElementById(id);
const selections=[],jsonCache=new Map(),uploadedShips=new Map(),uploadedAircraft=new Map(),uploadedWeapons=new Map();
const roleNames={bomb:'Bombers',torpedo:'Torpedo bombers',airstrike:'Airstrike',attack:'Attack aircraft',skip:'Skip bombers'};
const supportedRoles=new Set(['bomb','torpedo','airstrike']);
let catalog=null,busy=false,nextSelection=1,cardView=true,sharedScale=true;
let activeGame='korabli',activeVersion='';
let comparisonRole='bomb';
const shipSlots=[];let nextSlot=1;
const selectionSources=new Map();let modifierSlotId=null;
let expandedDrawingId=null;
const modifierHelpEntries=new Map();let activeHelpButton=null;
const nationNames={USA:'U.S.A.',Germany:'Germany',Japan:'Japan',Netherlands:'Netherlands',UK:'U.K.',Russia:'U.S.S.R.'};
const classNames={AirCarrier:'Aircraft carrier',Battleship:'Battleship',Cruiser:'Cruiser',Destroyer:'Destroyer',Submarine:'Submarine'};
const gameNames={wows:'World of Warships',korabli:'Korabli',mixed:'WoWS-MK'},gameSessions=new Map(),gameVersions=new Map();
const actualGames=['wows','korabli'],gameLabels={wows:'WoWS',korabli:'Korabli'};
const slotGame=slot=>slot.game||(activeGame==='mixed'?'korabli':activeGame);
const activeDataset=()=>catalog?.datasets.find(dataset=>dataset.game===activeGame&&dataset.version===activeVersion);
const gameEntries=()=>activeGame==='mixed'?catalog?.entries||[]:catalog?.entries.filter(entry=>entry.datasetId===activeDataset()?.id)||[];
const defaultVersion=game=>catalog?.datasets.find(dataset=>dataset.game===game&&dataset.default)?.version||catalog?.datasets.find(dataset=>dataset.game===game)?.version||'';
function renderGame() {
  for(const button of document.querySelectorAll('[data-game]'))button.setAttribute('aria-pressed',String(button.dataset.game===activeGame));
  const dataset=activeDataset(),versions=catalog?.datasets.filter(dataset=>dataset.game===activeGame)||[];
  ui('dataset').textContent=activeGame==='mixed'?'WoWS + Korabli':dataset?dataset.dataset:gameNames[activeGame]+' · No bundled dataset';
  ui('snapshot').textContent=activeGame==='mixed'?'Per-card game / version':dataset?.snapshot||'Not available';
  document.title=gameNames[activeGame]+' · Air Armament Reticle';
}
function glyph(name) {
  const nodes=globalThis.RETICLE_ICONS[name]||[];
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${nodes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${escapeHtml(value)}"`).join(' ')}/>`).join('')}</svg>`;
}
for(const node of document.querySelectorAll('[data-icon]'))node.innerHTML=glyph(node.dataset.icon);
function renderTheme(){
  const dark=document.documentElement.dataset.theme==='dark',button=ui('theme-toggle');
  button.innerHTML=glyph(dark?'Sun':'Moon');button.setAttribute('aria-pressed',String(dark));
  button.title=dark?'Switch to light mode':'Switch to dark mode';button.setAttribute('aria-label',button.title);
}
renderTheme();
ui('theme-toggle').addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;
  try{localStorage.setItem('reticle-theme',theme);}catch{}renderTheme();
});
function notice(message,error=false){ui('status').textContent=message;ui('status').classList.toggle('error',error);}
function setBusy(value) {
  busy=value;ui('results').setAttribute('aria-busy',String(value));
  for(const id of ['open','share','export','clear'])ui(id).disabled=value||(id!=='open'&&!selections.length);
  if(activeGame==='mixed')ui('open').disabled=true;
  ui('add-ship').disabled=value||!catalog||shipSlots.length>=12;
  for(const button of document.querySelectorAll('[data-game]'))button.disabled=value;
  for(const input of ui('ship-editors').querySelectorAll('input,select,button'))input.disabled=value||input.dataset.empty==='true';
}
function renderLibrary() {
  if(!catalog)return;
  ui('library-count').textContent=shipSlots.length+' / 12';
  ui('ship-editors').innerHTML=shipSlots.map(slot=>{
    const options=slotOptions(slot);
    const field=(name,label,values,placeholder)=>`<label class="field">${label}<select data-field="${name}" aria-label="${label}" data-empty="${!values.length}"><option value=""${name==='game'?' disabled':''}>${placeholder}</option>${values.map(([value,text])=>`<option value="${escapeHtml(value)}"${slot[name]===value?' selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
    return `<article class="ship-editor" data-slot="${slot.id}" aria-label="${escapeHtml(slotDisplayName(slot)||'Ship selection')}"><div class="editor-heading"><div><button type="button" class="icon-button" data-slot-action="clone" title="Clone ship" aria-label="Clone ship">${glyph('Copy')}</button><button type="button" class="icon-button" data-slot-action="remove" title="Remove ship" aria-label="Remove ship">${glyph('X')}</button></div></div>
      <label class="field">Ship name<span class="ship-name-value"><input type="text" data-field="customName" aria-label="Ship name" maxlength="80" value="${escapeHtml(slotDisplayName(slot))}">${activeGame==='mixed'?'<span class="ship-game-suffix">('+gameLabels[slotGame(slot)]+')</span>':''}</span></label>
      ${activeGame==='mixed'?field('game','Game',actualGames.map(game=>[game,gameLabels[game]]),'Select game'):''}
      ${field('version','Version',catalog.datasets.filter(d=>d.game===slotGame(slot)).map(d=>[d.version,d.version]),'Select version')}
      ${field('nation','Nation',options.nations.map(n=>[n,nationNames[n]||n]),'All nations')}
      ${field('shipClass','Ship type',options.classes.map(n=>[n,classNames[n]||n]),'All ship types')}
      ${field('ship','Ship',options.ships.map(entry=>[entry.shipId,`${entry.tier??'?'} · ${entry.ship}${activeGame==='mixed'?' ('+gameLabels[slotGame(slot)]+')':''}`]),'Select ship')}
      <div class="editor-modules"><h4>Aircraft modules</h4>
      ${field('role','Armament',options.roles.map(role=>[role,roleNames[role]]),'Select armament')}
      ${field('module','Module',options.modules.map(m=>[m.id,`${m.upgrades[0]?.stage||'Standard'} · ${m.id}`]),'Select module')}
      ${field('entryId','Aircraft',options.aircraft.map(e=>[e.id,e.aircraft]),'Select aircraft')}</div>
      <div class="editor-footer"><button type="button" data-slot-action="modifiers" data-empty="${!slot.entryId}"${slot.entryId?'':' disabled'}>Modifiers</button><span class="editor-status">${Object.keys(slot.modifiers||{}).length?'Modified':slot.entryId?'Original data':'No aircraft selected'}</span></div></article>`;
  }).join('');
  setBusy(busy);
}
function newSlot(version=activeVersion,game=activeGame==='mixed'?'korabli':activeGame){return {id:nextSlot++,game,version:version||defaultVersion(game),nation:'',shipClass:'',ship:'',role:'',module:'',entryId:''};}
function slotOptions(slot) {
  const base=catalog.entries.filter(e=>e.datasetId===slotGame(slot)+':'+slot.version);
  const nations=[...new Set(base.map(e=>e.nation))].sort();
  const national=base.filter(e=>!slot.nation||e.nation===slot.nation);
  const classes=[...new Set(national.map(e=>e.shipClass))].sort();
  const filtered=national.filter(e=>!slot.shipClass||e.shipClass===slot.shipClass);
  const ships=[...new Map(filtered.map(e=>[e.shipId,e])).values()].sort((a,b)=>(a.tier??Infinity)-(b.tier??Infinity)||a.ship.localeCompare(b.ship,undefined,{numeric:true})||a.shipId.localeCompare(b.shipId));
  const shipEntries=filtered.filter(e=>e.shipId===slot.ship);
  const roles=Object.keys(roleNames).filter(role=>shipEntries.some(e=>e.role===role));
  const candidates=shipEntries.filter(e=>e.role===slot.role);
  const modules=[...new Map(candidates.flatMap(e=>e.modules||[]).map(m=>[m.id,m])).values()].sort((a,b)=>(a.upgrades[0]?.order||0)-(b.upgrades[0]?.order||0)||a.id.localeCompare(b.id));
  return {nations,classes,ships,roles,modules,aircraft:candidates.filter(e=>!slot.module||e.modules?.some(m=>m.id===slot.module))};
}
function slotFromEntry(entry) {
  const dataset=catalog.datasets.find(d=>d.id===entry.datasetId),slot=newSlot(dataset.version,dataset.game);
  Object.assign(slot,{nation:entry.nation,shipClass:entry.shipClass,ship:entry.shipId,role:entry.role,module:entry.modules?.[0]?.id||'',entryId:entry.id});return slot;
}
function slotDisplayName(slot){return slot.customName||catalog.entries.find(entry=>entry.shipId===slot.ship&&entry.datasetId===slotGame(slot)+':'+slot.version)?.ship||'';}
function comparisonShipLabel(slot){return `${slotDisplayName(slot)}${activeGame==='mixed'?' ('+gameLabels[slotGame(slot)]+')':''}${Object.keys(slot.modifiers||{}).length?' (Modified)':''}`;}
function defaultEntries(){return activeGame==='mixed'?actualGames.flatMap(game=>catalog.datasets.find(dataset=>dataset.game===game&&dataset.version===defaultVersion(game))?.defaults||[]).slice(0,12):activeDataset()?.defaults||[];}
const dimension=value=>value?`${Number(value.width.toFixed(1))} × ${Number(value.height.toFixed(1))} m`:'N/A';
function comparisonMetrics(item) {
  const source=activeGame==='mixed'&&item.version?[['Version',item.version]]:[];
  if(item.kind==='bomb')return [...source,['Minimum aim',dimension(item.aimMinimum)],['Maximum aim',dimension(item.outer)],['Inner region',dimension(item.aimInner)],['Inner allocation',item.innerPercentage==null?'N/A':item.innerPercentage+'%']];
  if(item.kind==='torpedo'){
    const sector=torpedoSector(item);
    return [...source,['Torpedoes per attack',item.total],['Range',item.rangeDistance==null?'N/A':Number((item.rangeDistance/1000).toFixed(2))+' km'],['Arming distance',item.armingDistance==null?'N/A':Math.round(item.armingDistance)+' m'],['Formation width (estimate)',sector?Number(sector.startWidth.toFixed(1))+' m':'N/A'],['Full-aim width at reference distance',sector?`${Number(sector.aimWidth.toFixed(1))} m / ${Number((sector.aimDistance/1000).toFixed(2))} km`:'N/A'],['Formation rows',item.rows]];
  }
  return [...source,['Drop area',dimension(item.outer)],['Inner region',dimension(item.inner)],...airstrikeTimingRows(item),['Bombs per attack',item.payload?.count??'N/A'],['Release interval',item.raw.attackInterval+' s']];
}
function sourceData(item) {
  if(item.files)return item.files.map(file=>{
    const url=new URL('./'+file,document.baseURI);url.searchParams.set('v',catalog.hashes[file].slice(0,12));
    return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener">${escapeHtml(file.split('/').at(-1))}</a>`;
  }).join('');
  return `<p>${escapeHtml(item.filename)}</p><p>${escapeHtml(item.projectile||'Weapon reference unavailable')}</p>`;
}
function cardTools(item) {
  const id=item.id;
  return `<div class="reference-tools"><button type="button" data-action="reference" data-id="${id}" aria-pressed="${!!item.reference}" title="Yamato reference (263 × 38.9 m)"><img src="${YAMATO_IMAGE}" alt="">Yamato</button>
    ${item.kind!=='torpedo'?`<button type="button" data-action="rotate" data-id="${id}" title="Rotate Yamato" aria-label="Rotate Yamato"${item.reference?'':' disabled'}>${glyph('RotateCw')}</button>`:''}
    ${['bomb','airstrike'].includes(item.kind)?`<button type="button" data-action="play" data-id="${id}" aria-label="${item.kind==='bomb'?'Simulate bomb drops':'Simulate airstrike'}" title="${item.kind==='bomb'?'Illustrative bomb drops; not game RNG':'Simulate airstrike'}"${item.kind==='bomb'?bomberPayload(item)&&bomberSimulationRegion(item).outer?'':' disabled':item.weaponVerified&&item.payload?'':' disabled'}>${glyph('Play')}</button><button type="button" data-action="clear" data-id="${id}"${item.attack?.points.length?'':' disabled'}>Clear</button>`:''}</div>${item.kind==='bomb'?`<div class="reference-tools" role="group" aria-label="Drop aiming state">${[['fully','Fully aimed'],['immediate','Immediate drop']].map(([mode,label])=>`<button type="button" data-action="aim-${mode}" data-id="${id}" aria-pressed="${(item.aimMode||'fully')===mode}">${label}</button>`).join('')}</div>`:''}`;
}
function renderComparisonTabs() {
  ui('comparison-tabs').innerHTML=Object.entries(roleNames).map(([kind,label])=>`<button type="button" id="comparison-tab-${kind}" role="tab" data-comparison-tab="${kind}" aria-controls="comparison-${kind}" aria-selected="${kind===comparisonRole}" tabindex="${kind===comparisonRole?0:-1}">${label}<small>${selections.filter(item=>item.kind===kind).length}</small></button>`).join('');
  const entries=!supportedRoles.has(comparisonRole)?[]:comparisonRole==='torpedo'?[['unarmed','Unarmed'],['minimum','Armed']]:comparisonRole==='bomb'?[['minimum','Minimum aim'],['maximum','Maximum aim'],['inner','Inner region']]:[['minimum','Drop area'],['inner','Inner region']];
  ui('legend-items').innerHTML=entries.map(([kind,label])=>`<span><i class="swatch ${kind}"></i>${label}</span>`).join('');
}
function selectComparisonRole(kind,focus=false) {
  if(!Object.hasOwn(roleNames,kind))return;comparisonRole=kind;renderComparison();
  const url=new URL(location.href);url.searchParams.set('type',comparisonRole);history.replaceState(null,'',url);
  if(focus)ui('comparison-tab-'+kind).focus();
}
ui('comparison-tabs').addEventListener('click',event=>{const tab=event.target.closest('[data-comparison-tab]');if(tab)selectComparisonRole(tab.dataset.comparisonTab,true);});
ui('comparison-tabs').addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-comparison-tab]');if(!tab)return;
  const kinds=Object.keys(roleNames),index=kinds.indexOf(tab.dataset.comparisonTab);
  const next=event.key==='ArrowRight'?(index+1)%kinds.length:event.key==='ArrowLeft'?(index+kinds.length-1)%kinds.length:event.key==='Home'?0:event.key==='End'?kinds.length-1:null;
  if(next!=null){event.preventDefault();selectComparisonRole(kinds[next],true);}
});
function renderComparison(focus=null) {
  ui('results').className='comparison-groups';
  renderComparisonTabs();
  ui('comparison-count').textContent=selections.length;
  ui('comparison-subtitle').textContent=!supportedRoles.has(comparisonRole)?'Under the Maintenance!':sharedScale?'Shared scale within '+roleNames[comparisonRole]:'Independent scales';
  ui('cards-view').setAttribute('aria-pressed',String(cardView));ui('list-view').setAttribute('aria-pressed',String(!cardView));
  ui('results').innerHTML=Object.entries(roleNames).map(([kind,label])=>{
    const members=supportedRoles.has(kind)?selections.filter(item=>item.kind===kind):[];
    const metricExtent=sharedScale?commonMetricExtent(members):null,torpedoExtent=commonDistance(members),formationScale=commonScale(members);
    const cards=members.map(item=>{
    const range=sharedScale?torpedoExtent:commonDistance([item]);
    const drawing=item.kind==='bomb'?bombDrawing(item,metricExtent):item.kind==='airstrike'?airstrikeDrawing(item,metricExtent||Math.max(item.outer.width,item.outer.height,item.reference?263:1)):torpedoDrawing(item,sharedScale?formationScale:commonScale([item]),range);
    const targetRange=item.rangeDistance||range;
    const distance=item.kind==='torpedo'&&item.reference&&targetRange>0?`<label class="distance-control"><span class="sr-only">Yamato target distance</span><input type="range" data-distance="${item.id}" min="0" max="${targetRange}" step="1" value="${targetDistance(item,targetRange)}" aria-label="Yamato target distance"><output>${Math.round(targetDistance(item,targetRange))} m</output></label>`:'';
    return `<article class="reticle-card" data-id="${item.id}"><div class="card-heading"><div><span class="card-role">${roleNames[item.kind]}</span><h3>${escapeHtml(item.shipLabel||'Uploaded aircraft')}</h3><p class="aircraft-id">${escapeHtml(item.name)}</p></div><button class="icon-button" type="button" data-action="remove" data-id="${item.id}" title="Remove ${escapeHtml(item.shipLabel||item.name)}" aria-label="Remove ${escapeHtml(item.shipLabel||item.name)}">${glyph('X')}</button></div>${cardTools(item)}<div class="drawing-wrap" data-expand="${item.id}">${drawing}${distance}<button class="drawing-expand icon-button" type="button" data-action="expand" data-id="${item.id}" title="Enlarge chart" aria-label="Enlarge chart">${glyph('Search')}</button></div><div class="card-data"><table class="metric-table"><tbody>${comparisonMetrics(item).map(([label,value])=>`<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table></div><details class="source-data"><summary>Source data</summary>${sourceData(item)}${item.warnings.map(w=>`<p>${escapeHtml(w)}</p>`).join('')}</details></article>`;
    }).join('');
    const empty=!supportedRoles.has(kind)?`<div class="maintenance-state"><h3>Under the Maintenance!</h3><img src="./assets/{{maintenance}}" alt="Two cats wearing a construction helmet and working with a hammer" width="642" height="680"></div>`:`<div class="empty-state">${gameEntries().length?'No '+label.toLowerCase()+' selected':'No '+gameNames[activeGame]+' dataset loaded'}</div>`;
    return `<section id="comparison-${kind}" class="comparison-group" role="tabpanel" aria-labelledby="comparison-tab-${kind}" data-comparison-role="${kind}"${kind===comparisonRole?'':' hidden'}><div class="${cardView?'comparison-cards':'comparison-list'}">${cards||empty}</div></section>`;
  }).join('');
  setBusy(busy);
  refreshExpandedDrawing();
  if(focus)ui('results').querySelector(`[data-action="${focus.action}"][data-id="${focus.id}"]`)?.focus();
}
function refreshExpandedDrawing() {
  if(expandedDrawingId==null)return;
  const item=selections.find(item=>item.id===expandedDrawingId);
  const card=ui('results').querySelector(`article[data-id="${expandedDrawingId}"]`);
  if(!item||!card){ui('drawing-dialog').close();return;}
  ui('drawing-title').textContent=(item.shipLabel||item.name)+' · '+roleNames[item.kind];
  const article=document.createElement('article');article.className='expanded-reticle';article.dataset.id=item.id;
  for(const node of card.querySelectorAll(':scope > .reference-tools,:scope > .drawing-wrap'))article.append(node.cloneNode(true));
  article.querySelector('.drawing-expand')?.remove();article.querySelector('[data-expand]')?.removeAttribute('data-expand');
  const viewBox=article.querySelector('.drawing-wrap > svg').viewBox.baseVal;
  article.style.setProperty('--chart-aspect',viewBox.width/viewBox.height);
  ui('drawing-detail').replaceChildren(article);
}
function openExpandedDrawing(id) {
  if(busy)return;
  expandedDrawingId=id;refreshExpandedDrawing();
  if(ui('drawing-detail').children.length)ui('drawing-dialog').showModal();
}
ui('drawing-dialog').addEventListener('close',()=>{
  const id=expandedDrawingId;expandedDrawingId=null;ui('drawing-detail').replaceChildren();
  ui('results').querySelector(`[data-action="expand"][data-id="${id}"]`)?.focus();
});
ui('drawing-dialog').addEventListener('click',event=>{
  if(event.target!==ui('drawing-dialog'))return;
  const rect=ui('drawing-dialog').getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)ui('drawing-dialog').close();
});
async function repositoryJson(file) {
  if(!/^GAME\/(WOWS|KORABLI)\/[A-Za-z0-9][A-Za-z0-9._-]*\/(Ships|Aircraft|Projectiles)\/[A-Za-z0-9_]+\.json$/.test(file)||!catalog.hashes[file])throw Error('Invalid repository data reference');
  if(!jsonCache.has(file))jsonCache.set(file,(async()=>{
    const url=new URL('./'+file,document.baseURI);url.searchParams.set('v',catalog.hashes[file].slice(0,12));
    const response=await fetch(url);if(!response.ok)throw Error(`Cannot load ${file} (${response.status})`);
    const text=await response.text(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==catalog.hashes[file])throw Error('Data version mismatch. Reload the page.');
    return parseAircraftJson(text).data;
  })());
  try{return await jsonCache.get(file);}catch(error){jsonCache.delete(file);throw error;}
}
function attachData(item,weapon,manifests) {
  if(item.kind==='torpedo')attachTorpedoWeapon(item,weapon);
  if(item.kind==='airstrike'){attachAirstrikeWeapon(item,weapon);item.timingRanges=airstrikeTimingRanges(item,manifests,weapon);}
}
async function addEntry(id,slot=null) {
  const matches=catalog.entries.filter(e=>(e.id===id||e.legacyId===id)&&catalog.datasets.some(d=>d.id===e.datasetId&&(slot?d.game===slotGame(slot)&&d.version===slot.version:activeGame==='mixed'||d.game===activeGame)));
  if(matches.length!==1)throw Error('Aircraft not found or ambiguous for '+gameNames[activeGame]);const entry=matches[0];
  const old=slot&&selections.find(item=>item.slotId===slot.id);
  if(!old&&selections.length>=12)throw Error('Comparison limit reached (12).');
  const [ship,plane,weapon]=await Promise.all(entry.files.map(repositoryJson));
  if(ship.name!==entry.shipId||plane.name!==entry.aircraft)throw Error('Repository identity mismatch');
  const base=analyze(plane,plane.name+'.json');if(base.projectile!==weapon.name)throw Error('Weapon reference mismatch');
  const overrides=old&&old.catalogId!==entry.id?{}:slot?.modifiers||{};
  const modified=modifiedInputs(base.kind,plane,weapon,overrides);
  const item=analyze(modified.aircraft,plane.name+'.json');
  attachData(item,modified.projectile,[shipManifest(ship,ship.name+'.json')]);
  if(!slot){slot=slotFromEntry(entry);shipSlots.push(slot);}
  slot.modifiers=modified.overrides;
  Object.assign(item,{id:old?.id||nextSelection++,slotId:slot.id,catalogId:entry.id,shipLabel:comparisonShipLabel(slot),files:entry.files,reference:old?.reference??true});
  item.game=slotGame(slot);item.version=slot.version;
  slot.entryId=entry.id;
  slot.modifiers=modified.overrides;item.modifiers=modified.overrides;
  if(Object.keys(item.modifiers).length)item.warnings.push('User-modified calculation inputs; not original game data.');
  selectionSources.set(item.id,{plane,weapon,ship});
  if(old)selections[selections.indexOf(old)]=item;else selections.push(item);
}
async function switchDataset(game,version) {
  if(busy||!catalog||(game===activeGame&&version===activeVersion))return;
  gameSessions.set(activeGame+':'+activeVersion,{items:selections.slice(),slots:shipSlots.map(slot=>({...slot})),ships:[...uploadedShips],aircraft:[...uploadedAircraft],weapons:[...uploadedWeapons],comparisonRole});
  gameVersions.set(activeGame,activeVersion);
  const saved=gameSessions.get(game+':'+version);activeGame=game;activeVersion=version;
  selections.splice(0,selections.length,...(saved?.items||[]));
  shipSlots.splice(0,shipSlots.length,...(saved?.slots||[]));
  for(const [map,values]of [[uploadedShips,saved?.ships],[uploadedAircraft,saved?.aircraft],[uploadedWeapons,saved?.weapons]]){map.clear();for(const [key,value]of values||[])map.set(key,value);}
  comparisonRole=saved?.comparisonRole||'bomb';
  renderGame();renderLibrary();setBusy(true);
  try{if(!saved)for(const id of defaultEntries())await addEntry(id);notice('');}catch(error){notice(error.message,true);}
  finally{
    if(!shipSlots.length)shipSlots.push(newSlot());
    setBusy(false);renderLibrary();renderComparison();
    const url=new URL(location.href);url.searchParams.set('game',activeGame);
    if(activeVersion)url.searchParams.set('version',activeVersion);else url.searchParams.delete('version');
    url.searchParams.set('type',comparisonRole);
    if(selections.every(item=>item.catalogId))url.searchParams.set('aircraft',selections.map(item=>item.catalogId).join(','));else url.searchParams.delete('aircraft');
    url.searchParams.delete('slots');
    history.replaceState(null,'',url);
  }
}
for(const button of document.querySelectorAll('[data-game]'))button.addEventListener('click',()=>switchDataset(button.dataset.game,gameVersions.get(button.dataset.game)||defaultVersion(button.dataset.game)));
ui('add-ship').addEventListener('click',()=>{if(busy||shipSlots.length>=12)return;shipSlots.push(newSlot());renderLibrary();ui('ship-editors').lastElementChild.querySelector('select')?.focus();});
function removeSlot(id) {
  const index=shipSlots.findIndex(slot=>slot.id===id);if(index>=0)shipSlots.splice(index,1);
  const item=selections.find(item=>item.slotId===id);if(item)selections.splice(selections.indexOf(item),1);
}
ui('ship-editors').addEventListener('click',async event=>{
  const button=event.target.closest('[data-slot-action]');if(!button||busy)return;
  const slot=shipSlots.find(slot=>slot.id===Number(button.closest('[data-slot]').dataset.slot));if(!slot)return;
  if(button.dataset.slotAction==='remove'){removeSlot(slot.id);renderLibrary();renderComparison();return;}
  if(button.dataset.slotAction==='modifiers'){openModifiers(slot);return;}
  if(shipSlots.length>=12)return;
  const copy={...slot,modifiers:{...slot.modifiers},id:nextSlot++};shipSlots.push(copy);setBusy(true);
  try{if(copy.entryId)await addEntry(copy.entryId,copy);}catch(error){removeSlot(copy.id);notice(error.message,true);}
  finally{setBusy(false);renderLibrary();renderComparison();}
});
ui('ship-editors').addEventListener('change',async event=>{
  const input=event.target.closest('[data-field]');if(!input||busy)return;
  const slot=shipSlots.find(slot=>slot.id===Number(input.closest('[data-slot]').dataset.slot));if(!slot)return;
  if(input.dataset.field==='customName'){
    slot.customName=input.value.trim().slice(0,80);
    const item=selections.find(item=>item.slotId===slot.id);if(item)item.shipLabel=comparisonShipLabel(slot);
    input.value=slotDisplayName(slot);renderComparison();return;
  }
  const snapshot={...slot},field=input.dataset.field;slot[field]=input.value;
  if(['game','version','nation','shipClass','ship'].includes(field))slot.customName='';
  slot.modifiers={};
  const fields=['game','version','nation','shipClass','ship','role','module','entryId'];
  for(const key of fields.slice(fields.indexOf(field)+1))slot[key]='';
  if(field==='game')slot.version=defaultVersion(slotGame(slot));
  if(slot.ship){
    const entries=catalog.entries.filter(e=>e.datasetId===slotGame(slot)+':'+slot.version&&e.shipId===slot.ship);
    if(!slot.role)slot.role=entries[0]?.role||'';
    if(!slot.module)slot.module=slotOptions(slot).modules[0]?.id||'';
    if(!slot.entryId)slot.entryId=slotOptions(slot).aircraft[0]?.id||'';
  }
  setBusy(true);
  try{
    if(slot.entryId){await addEntry(slot.entryId,slot);comparisonRole=slot.role;}
    else {const item=selections.find(item=>item.slotId===slot.id);if(item)selections.splice(selections.indexOf(item),1);}
    notice('');
  }catch(error){Object.assign(slot,snapshot);notice(error.message,true);}
  finally{setBusy(false);renderLibrary();renderComparison();ui('ship-editors').querySelector(`[data-slot="${slot.id}"] [data-field="${field}"]`)?.focus();}
});
function openModifiers(slot) {
  const item=selections.find(item=>item.slotId===slot.id),source=item&&selectionSources.get(item.id);if(!source)return;
  modifierSlotId=slot.id;ui('modifiers-title').textContent=`${comparisonShipLabel(slot)} · Modifiers`;
  hideModifierHelp();modifierHelpEntries.clear();
  ui('modifier-error').textContent='';
  ui('modifier-fields').innerHTML='<div class="modifier-columns" aria-hidden="true"><span>Parameter</span><span>Original</span><span>Value</span><span></span></div>'+modifierFields(item.kind,source.plane,source.weapon).map(field=>{
    const key=modifierKey(field),value=slot.modifiers?.[key]??field.value;
    const hint=`${field.target}.${field.key}${field.index==null?'':'['+field.index+']'} · Original: ${field.value}`;
    const inputId='modifier-'+key.replaceAll(':','-');
    modifierHelpEntries.set(key,{label:field.label,text:modifierHelp(item.kind,field)});
    return `<div class="modifier-field"><span class="modifier-name"><label for="${inputId}">${escapeHtml(field.label)}</label><button type="button" class="modifier-help" data-modifier-help="${key}" aria-label="Help: ${escapeHtml(field.label)}">${glyph('CircleHelp')}</button></span><span class="modifier-original" aria-label="Original value">${field.value}</span><input id="${inputId}" type="number" required data-modifier="${key}" aria-label="${escapeHtml(field.label)}" title="${escapeHtml(hint)}" min="${field.min}" max="${field.max}" step="${field.integer?1:'any'}" value="${value}"><span class="modifier-unit">${escapeHtml(field.unit)}</span></div>`;
  }).join('')+(item.kind==='torpedo'?'<p>Full-aim sector estimate; individual torpedo spacing and build effects are not reproduced.</p>':'');
  if(!ui('modifiers-dialog').open)ui('modifiers-dialog').showModal();
}
const modifierTooltip=document.createElement('div');modifierTooltip.id='modifier-tooltip';modifierTooltip.setAttribute('role','tooltip');modifierTooltip.hidden=true;
ui('modifiers-dialog').append(modifierTooltip);
function hideModifierHelp(){
  activeHelpButton?.removeAttribute('aria-describedby');activeHelpButton=null;modifierTooltip.hidden=true;
}
function showModifierHelp(button){
  const help=modifierHelpEntries.get(button.dataset.modifierHelp);if(!help)return;
  hideModifierHelp();activeHelpButton=button;
  const title=document.createElement('strong'),body=document.createElement('p');title.textContent=help.label;body.textContent=help.text;
  modifierTooltip.replaceChildren(title,body);modifierTooltip.hidden=false;button.setAttribute('aria-describedby','modifier-tooltip');
  const anchor=button.getBoundingClientRect(),box=modifierTooltip.getBoundingClientRect();
  const left=Math.max(8,Math.min(anchor.left+anchor.width/2-box.width/2,innerWidth-box.width-8));
  const top=anchor.bottom+6+box.height<=innerHeight-8?anchor.bottom+6:Math.max(8,anchor.top-box.height-6);
  modifierTooltip.style.left=left+'px';modifierTooltip.style.top=top+'px';
}
ui('modifier-fields').addEventListener('pointerover',event=>{const button=event.target.closest('[data-modifier-help]');if(button&&button!==activeHelpButton)showModifierHelp(button);});
ui('modifier-fields').addEventListener('pointerout',event=>{
  const button=event.target.closest('[data-modifier-help]');if(!button||button.contains(event.relatedTarget)||modifierTooltip.contains(event.relatedTarget))return;
  if(document.activeElement!==button)hideModifierHelp();
});
ui('modifier-fields').addEventListener('focusin',event=>{const button=event.target.closest('[data-modifier-help]');if(button)showModifierHelp(button);else hideModifierHelp();});
ui('modifier-fields').addEventListener('focusout',event=>{if(event.target.closest('[data-modifier-help]'))hideModifierHelp();});
ui('modifier-fields').addEventListener('click',event=>{const button=event.target.closest('[data-modifier-help]');if(button)showModifierHelp(button);});
modifierTooltip.addEventListener('pointerleave',()=>{if(document.activeElement!==activeHelpButton)hideModifierHelp();});
ui('modifier-fields').addEventListener('scroll',hideModifierHelp);
ui('modifiers-dialog').addEventListener('close',hideModifierHelp);
ui('modifiers-dialog').addEventListener('cancel',event=>{if(!modifierTooltip.hidden){event.preventDefault();hideModifierHelp();}});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('[data-modifier-help]')&&!modifierTooltip.contains(event.target))hideModifierHelp();});
window.addEventListener('resize',hideModifierHelp);
async function applyModifiers(overrides,reset=false) {
  if(busy)return;
  const slot=shipSlots.find(slot=>slot.id===modifierSlotId);if(!slot)return;
  const previous=slot.modifiers;setBusy(true);
  try{
    slot.modifiers=overrides;await addEntry(slot.entryId,slot);comparisonRole=slot.role;
    renderLibrary();renderComparison();
    if(reset)openModifiers(slot);else ui('modifiers-dialog').close();
  }catch(error){slot.modifiers=previous;ui('modifier-error').textContent=error.message;}
  finally{setBusy(false);}
}
ui('modifiers-form').addEventListener('submit',event=>{
  event.preventDefault();const overrides={};
  for(const input of ui('modifier-fields').querySelectorAll('[data-modifier]'))overrides[input.dataset.modifier]=input.valueAsNumber;
  applyModifiers(overrides);
});
ui('reset-modifiers').addEventListener('click',()=>applyModifiers({},true));
ui('shared-scale').addEventListener('change',event=>{sharedScale=event.target.checked;renderComparison();});
ui('cards-view').addEventListener('click',()=>{cardView=true;renderComparison();});
ui('list-view').addEventListener('click',()=>{cardView=false;renderComparison();});
ui('clear').addEventListener('click',()=>{if(busy)return;selections.length=0;shipSlots.length=0;shipSlots.push(newSlot());uploadedShips.clear();uploadedAircraft.clear();uploadedWeapons.clear();notice('');renderLibrary();renderComparison();});
function handleReticleClick(event){
  const button=event.target.closest('[data-action]');
  if(!button){
    const drawing=event.target.closest('[data-expand]');
    if(drawing&&!event.target.closest('input,label,button,output'))openExpandedDrawing(Number(drawing.dataset.expand));
    return;
  }
  if(button.disabled)return;
  const id=Number(button.dataset.id),item=selections.find(r=>r.id===id);if(!item)return;
  const action=button.dataset.action;
  if(action==='expand'){openExpandedDrawing(id);return;}
  if(action==='remove'){if(item.slotId)removeSlot(item.slotId);else selections.splice(selections.indexOf(item),1);renderLibrary();renderComparison();return;}
  if(action==='reference')item.reference=!item.reference;
  else if(action==='rotate')item.rotation=((item.rotation||0)+90)%180;
  else if(action==='play'){
    const points=item.kind==='bomb'?simulateBomber(item):simulateAirstrike(item);
    if(!points.length){notice('Drop preview unavailable for these region or payload values.',true);return;}
    item.attack={points,startedAt:Date.now()};notice('');
  }
  else if(action==='aim-fully'||action==='aim-immediate'){item.aimMode=action==='aim-immediate'?'immediate':'fully';item.attack=null;}
  else if(action==='clear')item.attack=null;
  renderComparison({action,id});
  if(ui('drawing-dialog').open)ui('drawing-dialog').querySelector(`[data-action="${action}"]`)?.focus();
}
function handleReticleReset(event){
  const input=event.target.closest('[data-distance]');if(!input)return;
  const item=selections.find(r=>r.id===Number(input.dataset.distance));
  if(!item||!finite(item.armingDistance))return;
  input.value=String(Math.max(0,Math.min(Number(input.max),item.armingDistance)));
  input.dispatchEvent(new Event('input',{bubbles:true}));
}
function handleReticleDistance(event){
  const input=event.target.closest('[data-distance]');if(!input)return;
  const item=selections.find(r=>r.id===Number(input.dataset.distance));if(!item)return;
  const range=item.rangeDistance||commonDistance([item]);item.targetDistance=Math.max(0,Math.min(range,input.valueAsNumber));
  const torpedoes=selections.filter(r=>r.kind==='torpedo');
  for(const member of torpedoes){
    for(const svg of document.querySelectorAll(`article[data-id="${member.id}"] svg[data-metric-scale]`))svg.outerHTML=torpedoDrawing(member,commonScale(sharedScale?torpedoes:[member]),sharedScale?commonDistance(torpedoes):commonDistance([member]));
  }
  for(const article of document.querySelectorAll(`article[data-id="${item.id}"]`)){
    const slider=article.querySelector('[data-distance]');if(slider)slider.value=String(item.targetDistance);
    const output=article.querySelector('output');if(output)output.textContent=Math.round(targetDistance(item,range))+' m';
  }
}
for(const root of [ui('results'),ui('drawing-dialog')]){
  root.addEventListener('click',handleReticleClick);root.addEventListener('dblclick',handleReticleReset);root.addEventListener('input',handleReticleDistance);
}
ui('share').addEventListener('click',async()=>{
  try {
    if(selections.some(item=>!item.catalogId))throw Error('Uploaded JSON results must be shared using Export comparison.');
    const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('aircraft',selections.map(r=>r.catalogId).join(','));
    url.searchParams.set('game',activeGame);
    url.searchParams.set('version',activeVersion);
    url.searchParams.set('type',comparisonRole);
    url.searchParams.set('slots',JSON.stringify(shipSlots.map(({game,version,entryId,nation,shipClass,ship,role,module,modifiers,customName})=>({game,version,entryId,nation,shipClass,ship,role,module,modifiers,customName}))));
    if(!cardView)url.searchParams.set('view','list');if(!sharedScale)url.searchParams.set('scale','independent');
    await navigator.clipboard.writeText(url.href);notice('Comparison link copied.');
  }catch(error){notice(error.message||'Clipboard unavailable.',true);}
});
ui('export').addEventListener('click',()=>{
    const output={tool:'WoWS-Korabli Air Armament Reticle',schema:1,game:activeGame,version:activeVersion,dataset:activeDataset()?.dataset||'Uploaded JSON',snapshot:activeDataset()?.snapshot||null,slots:shipSlots,view:{cards:cardView,sameScale:sharedScale,armament:comparisonRole},results:selections.map(({raw,id,...item})=>item)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='air-armament-comparison.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
ui('open').addEventListener('click',()=>ui('import-dialog').showModal());ui('browse').addEventListener('click',()=>ui('files').click());
ui('notes').addEventListener('click',()=>ui('notes-dialog').showModal());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>ui(button.dataset.close).close());
async function importFiles(list) {
  if(activeGame==='mixed'){notice('Import JSON in a single-game tab.',true);return;}
  if(busy)return;setBusy(true);const messages=[];
  try {
    for(const file of Array.from(list).slice(0,32)) {
      try {
        if(file.size>10*1024*1024)throw Error('File exceeds 10 MB');
        const raw=parseAircraftJson(await file.text()).data;
        if(!validId(raw?.name))throw Error('Missing internal ID');
        const type=raw.typeinfo?.type;
        if(type==='Ship'){if(uploadedShips.size>=20&&!uploadedShips.has(raw.name))throw Error('Ship limit reached');uploadedShips.set(raw.name,shipManifest(raw,file.name));}
        else if(type==='Aircraft'){if(uploadedAircraft.size>=100&&!uploadedAircraft.has(raw.name))throw Error('Aircraft limit reached');uploadedAircraft.set(raw.name,{raw,filename:file.name});}
        else if(type==='Projectile'){if(uploadedWeapons.size>=100&&!uploadedWeapons.has(raw.name))throw Error('Weapon limit reached');uploadedWeapons.set(raw.name,raw);}
        else throw Error('Unsupported JSON type');
      }catch(error){messages.push(file.name+': '+error.message);}
    }
    for(const [name,file]of uploadedAircraft) {
      try {
        const old=selections.find(item=>!item.catalogId&&item.name===name);
        if(!old&&selections.length>=12)continue;
        const item=analyze(file.raw,file.filename);attachData(item,uploadedWeapons.get(item.projectile),[...uploadedShips.values()]);
        if(item.kind==='airstrike'&&item.excluded){if(old)selections.splice(selections.indexOf(old),1);continue;}
        Object.assign(item,{id:old?.id||nextSelection++,game:activeGame,reference:old?.reference??true,rotation:old?.rotation||0,shipLabel:[...uploadedShips.values()].find(ship=>manifestAircraft(ship,new Map()).some(ref=>ref.id===name))?.name||'Uploaded aircraft'});
        if(old)selections[selections.indexOf(old)]=item;else selections.push(item);
      }catch(error){messages.push(name+': '+error.message);}
    }
    if(selections.length)comparisonRole=selections.at(-1).kind;
    ui('import-status').textContent=messages.join(' | ');
    if(!messages.length){ui('import-dialog').close();notice('JSON imported.');}else notice('Some files could not be used.',true);
  }finally{ui('files').value='';setBusy(false);renderComparison();}
}
ui('files').addEventListener('change',()=>importFiles(ui('files').files));
for(const name of ['dragover','dragleave','drop'])ui('drop').addEventListener(name,event=>{event.preventDefault();ui('drop').classList.toggle('over',name==='dragover');if(name==='drop')importFiles(event.dataTransfer.files);});
(async()=>{
  setBusy(true);notice('Loading repository data…');
  try {
    const response=await fetch(siteCatalogUrl);if(!response.ok)throw Error('Could not load aircraft catalog');catalog=await response.json();
    if(catalog.schema!==2||!Array.isArray(catalog.entries)||!Array.isArray(catalog.datasets))throw Error('Unsupported catalog');
    const initial=catalog.datasets.find(dataset=>dataset.id===catalog.defaultDataset),query=new URLSearchParams(location.search);
    activeGame=Object.hasOwn(gameNames,query.get('game'))?query.get('game'):initial?.game||'korabli';activeVersion=activeGame==='mixed'?'':query.get('version')||defaultVersion(activeGame);
    comparisonRole=Object.hasOwn(roleNames,query.get('type'))?query.get('type'):'bomb';
    renderGame();renderLibrary();
    cardView=query.get('view')!=='list';sharedScale=query.get('scale')!=='independent';ui('shared-scale').checked=sharedScale;
    if(query.has('slots')){
      const slots=JSON.parse(query.get('slots'));if(!Array.isArray(slots)||slots.length>12)throw Error('Invalid ship slots');
      for(const value of slots){
        if(value.entryId){
          const entry=catalog.entries.find(e=>e.id===value.entryId&&catalog.datasets.some(d=>d.id===e.datasetId&&(activeGame==='mixed'||d.game===activeGame)));if(!entry)throw Error('Invalid shared aircraft');
          const dataset=catalog.datasets.find(d=>d.id===entry.datasetId);if(value.game&&value.game!==dataset.game)throw Error('Shared game does not match aircraft');
          const slot=slotFromEntry(entry);slot.modifiers=value.modifiers||{};slot.customName=typeof value.customName==='string'?value.customName.trim().slice(0,80):'';
          await addEntry(value.entryId,slot);shipSlots.push(slot);continue;
        }
        const slot=newSlot();if(value.game){if(!actualGames.includes(value.game)||activeGame!=='mixed'&&value.game!==activeGame)throw Error('Invalid shared game');slot.game=value.game;}for(const key of ['version','nation','shipClass','ship','role','module'])if(typeof value[key]==='string')slot[key]=value[key];slot.customName=typeof value.customName==='string'?value.customName.trim().slice(0,80):'';shipSlots.push(slot);
      }
    }else {
      const ids=query.has('aircraft')?query.get('aircraft').split(',').filter(Boolean).slice(0,12):defaultEntries();
      for(const id of ids)await addEntry(id);
    }
    if(!shipSlots.length)shipSlots.push(newSlot());notice('');
  }catch(error){notice(error.message,true);}
  finally{setBusy(false);renderLibrary();renderComparison();}
})();
