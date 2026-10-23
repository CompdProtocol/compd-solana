import { readdirSync,readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
for(const file of ['packages','scripts','tests'].flatMap(walk).filter(p=>p.endsWith('.mjs'))){
 const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(1);
 const source=readFileSync(file,'utf8');
 if(!file.startsWith('scripts/')&&/sendRawTransaction|sendAndConfirmTransaction|\.sign\(|\.partialSign\(/.test(source))throw Error(`Signing/broadcast path prohibited: ${file}`);
}
console.log('Active JavaScript syntax and no-sign/no-broadcast checks PASS');
