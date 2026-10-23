import {setTimeout} from 'node:timers/promises';
import {cycle,CYCLE_MS} from './lifecycle.mjs';
export async function runScheduler({journal,dbc,signal,report=console.log,clock=Date.now}) {
  while(!signal.aborted){
    try {report(await cycle({journal,dbc,now:clock()}));}
    catch(error){report({state:'FAILED',error:error.message});}
    const now=clock(),delay=CYCLE_MS-(now%CYCLE_MS);
    try{await setTimeout(delay,undefined,{signal});}catch(error){if(error.name!=='AbortError')throw error;}
  }
}
