import {parentPort,workerData} from 'node:worker_threads';
import {collectDataset} from './data-publisher.mjs';

try{
  const excludedNames=workerData.shipSubset.filter(name=>/DISABLED|PRESERVED/i.test(name)).length;
  const plan=collectDataset({...workerData,allowEmpty:true,onProgress:event=>{
    if(event.phase==='scan')parentPort.postMessage({type:'progress',completed:event.completed+excludedNames});
  }});
  parentPort.postMessage({type:'progress',completed:workerData.shipSubset.length});
  parentPort.postMessage({type:'result',plan});
}catch(error){parentPort.postMessage({type:'error',error:error.message});}
