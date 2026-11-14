import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildSalvo}=require('../src/skip-bombers/salvo-model.cjs');
const {createHullContact}=require('../src/skip-bombers/hull-contact.cjs');

export function buildSkipBombers(root,out,topImage){
 const source=path.join(root,'src/skip-bombers');
 const read=name=>fs.readFileSync(path.join(source,name),'utf8');
 const rotation=read('rotation.js'),rotationData=read('assets/yamato-rotation-data.js');
 const rotationVersion=crypto.createHash('sha256').update(rotation).update(rotationData).digest('hex').slice(0,12);
 let html=read('template.html').replaceAll('{{YAMATO_ROTATION_VERSION}}',rotationVersion);
 for(const [marker,value]of Object.entries({
  VERIFIED_DATA:read('data.json'),SALVO_MODEL:buildSalvo.toString(),HULL_CONTACT:createHullContact.toString(),
  HULL_REFERENCE:read('assets/yamato-hull-reference.json'),FRONT_REFERENCE:read('assets/yamato-front-reference.json'),
  YAMATO_IMAGE:JSON.stringify(topImage)
 }))html=html.replace(`/*__${marker}__*/null`,value);
 if(/\/\*__[A-Z_]+__\*\/null/.test(html))throw Error('Unresolved skip-bomber build placeholder');
 const destination=path.join(out,'skip-bombers');
 fs.mkdirSync(path.join(destination,'research'),{recursive:true});
 fs.writeFileSync(path.join(destination,'index.html'),html);
 fs.writeFileSync(path.join(destination,'yamato-rotation.js'),rotation);
 fs.writeFileSync(path.join(destination,'yamato-rotation-data.js'),rotationData);
 fs.copyFileSync(path.join(source,'NOTES.md'),path.join(destination,'research/FINDINGS.md'));
 return crypto.createHash('sha256').update(html).digest('hex').slice(0,12);
}
