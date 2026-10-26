import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from '../server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.resolve(process.argv[2]||'test-results');
await mkdir(out,{recursive:true});
const server=createServer({storeRoot:path.join(out,'browser-store')});
await new Promise((resolve,reject)=>server.once('error',reject).listen(8787,'127.0.0.1',resolve));
try {
 for(const [script,result] of [['run-browser.mjs','workspace.json'],['choice-browser.mjs','choice-ui'],['agent-browser.mjs','agent-roundtrip']]){
  const child=spawn(process.execPath,[path.join(root,'tests',script),path.join(out,result)],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)throw Error(`${script} failed (${code}).`);
 }
} finally {await new Promise(resolve=>server.close(resolve));}
