import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const directory=process.argv[2];if(!directory)throw Error('Provide installed lucide package path');
const require=createRequire(import.meta.url),lucide=require(directory);
const names=['Plane','Search','Plus','X','Copy','Download','Upload','Trash2','LayoutGrid','Rows3','RotateCw','Play','Info','CircleHelp','Moon','Sun','Ship','Crosshair'];
const output=path.resolve(import.meta.dirname,'../src/vendor');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'icons.json'),JSON.stringify(Object.fromEntries(names.map(name=>[name,lucide[name]])))+'\n');
fs.copyFileSync(path.join(directory,'LICENSE'),path.join(output,'lucide-LICENSE'));
