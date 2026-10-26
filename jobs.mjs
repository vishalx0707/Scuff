import {readFile} from 'node:fs/promises';
import {createJobStore} from './job-store.mjs';

const args=process.argv.slice(2),rootIndex=args.indexOf('--store'),storeRoot=rootIndex>=0?args[rootIndex+1]:undefined;
if(rootIndex>=0)args.splice(rootIndex,2);
const [command,id,fileOrAgent]=args,store=createJobStore(storeRoot);
try{
  let result;
  if(command==='list')result=await store.listJobs();
  else if(command==='show')result=await store.getJob(id);
  else if(command==='claim')result=await store.claimJob(id,fileOrAgent||'Codex');
  else if(command==='complete'){if(!fileOrAgent)throw new Error('Supply the result-receipt JSON path.');result=await store.completeJob(id,JSON.parse(await readFile(fileOrAgent,'utf8')));}
  else if(command==='fail'){if(!fileOrAgent)throw new Error('Supply a plain reason for the failure.');result=await store.failJob(id,fileOrAgent);}
  else {console.log('Usage: node jobs.mjs list | show <id> | claim <id> [agent-name] | complete <id> <receipt.json> | fail <id> <reason> [--store <isolated-store-path>]');process.exitCode=command==='help'||!command?0:1;}
  if(result)console.log(JSON.stringify(result,null,2));
}catch(error){console.error('Fieldwork: '+error.message);process.exitCode=1;}
