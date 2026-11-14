import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
const {createHullContact}=require('../src/skip-bombers/hull-contact.cjs');

export function buildSkipBombers(root,out,topImage){
 const source=path.join(root,'src/skip-bombers');
 const read=name=>fs.readFileSync(path.join(source,name),'utf8');
 const png=name=>JSON.stringify('data:image/png;base64,'+fs.readFileSync(path.join(source,'assets',name)).toString('base64'));
 let html=read('template.html');
 for(const [marker,value]of Object.entries({
  VERIFIED_DATA:read('data.json'),SALVO_MODEL:buildSalvo.toString(),HULL_CONTACT:createHullContact.toString(),
  HULL_REFERENCE:read('assets/yamato-hull-reference.json'),FRONT_REFERENCE:read('assets/yamato-front-reference.json'),
  YAMATO_IMAGE:JSON.stringify(topImage),YAMATO_FRONT:png('yamato-front.png'),YAMATO_SIDE:png('yamato-side.png')
 }))html=html.replace(`/*__${marker}__*/null`,value);
 if(/\/\*__[A-Z_]+__\*\/null/.test(html))throw Error('Unresolved skip-bomber build placeholder');
 const destination=path.join(out,'skip-bombers');
 fs.mkdirSync(path.join(destination,'research'),{recursive:true});
 fs.writeFileSync(path.join(destination,'index.html'),html);
 fs.copyFileSync(path.join(source,'NOTES.md'),path.join(destination,'research/FINDINGS.md'));
}
