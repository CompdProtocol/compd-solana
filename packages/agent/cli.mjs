import { readFileSync } from 'node:fs';
import { Dbc } from '../meteora-dbc/index.mjs';
import { Journal } from './journal.mjs';
import { cycle } from './lifecycle.mjs';
const [command,configFile]=process.argv.slice(2);
if(command!=='observe'||!configFile)throw Error('Usage: npm run agent -- observe /absolute/path/to/public-inputs.json');
const config=JSON.parse(readFileSync(configFile,'utf8'));
const dbc=Dbc.connect(config.rpcUrl,config);
const journal=new Journal(config.journalPath);
try{console.log(JSON.stringify(await cycle({journal,dbc})));}finally{journal.close();}
