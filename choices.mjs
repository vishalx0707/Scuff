import {readFile,writeFile} from 'node:fs/promises';
import {createChoiceStore} from './choice-store.mjs';

const args=process.argv.slice(2),take=flag=>{const i=args.indexOf(flag);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Supply a value for '+flag);return args.splice(i,2)[1];};
try{
  const storeRoot=take('--store'),owner=take('--owner'),messageFile=take('--message-file'),revision=take('--revision'),after=take('--after-revision'),timeout=take('--timeout-ms'),directionFile=take('--direction'),base=take('--base-url')||'http://127.0.0.1:8787';
  const baseURL=new URL(base);if(baseURL.protocol!=='http:'||!['127.0.0.1','localhost'].includes(baseURL.hostname)||baseURL.username||baseURL.password)throw Error('Use a plain local HTTP base URL.');
  const [command,id,output]=args;if(args.some(a=>a.startsWith('--')))throw Error('Unknown option.');
  const store=createChoiceStore(storeRoot),readDirection=async file=>{const text=await readFile(file,'utf8');if(Buffer.byteLength(text)>2097152)throw Error('Direction file exceeds2MB.');return JSON.parse(text);};
  let result;
  if(command==='create'){if(!id)throw Error('Supply a direction JSON file.');result=await store.create({direction:await readDirection(id),owner:owner||'',message:messageFile?await readFile(messageFile,'utf8'):''});}
  else if(command==='show')result=await store.get(id);
  else if(command==='save'){if(!directionFile)throw Error('Supply --direction with the edited JSON file.');result=await store.update(id,{revision:revision===undefined?undefined:Number(revision),direction:await readDirection(directionFile)});}
  else if(command==='wait')result=await store.wait(id,{afterRevision:after===undefined?undefined:Number(after),timeoutMs:timeout===undefined?55000:Number(timeout)});
  else if(command==='done')result=await store.done(id,{revision:revision===undefined?undefined:Number(revision),...(directionFile?{direction:await readDirection(directionFile)}:{})});
  else if(command==='ignore')result=await store.ignore(id,{revision:revision===undefined?undefined:Number(revision)});
  else if(command==='export'){const session=await store.get(id);if(session.status!=='done')throw Error('Only explicitly completed choices can be exported for use.');result=session.direction;if(output){await writeFile(output,JSON.stringify(result,null,2)+'\n','utf8');result={id,status:'done',output};}}
  else{console.log('Usage: node choices.mjs create direction.json [--message-file text.txt] [--owner thread-id]\n       node choices.mjs show <id> | wait <id> [--after-revision N] [--timeout-ms 55000]\n       node choices.mjs save <id> --revision N --direction edited.json\n       node choices.mjs done <id> --revision N [--direction final.json] | ignore <id> [--revision N]\n       node choices.mjs export <id> [output.json]\nOptions: --store <isolated-folder> --base-url http://127.0.0.1:8787\nNo browser is opened. Choosing/timeouts are never approval.');process.exitCode=command==='help'||!command?0:1;}
  if(result){if(result.url)result.url=new URL(result.url,baseURL).href;console.log(JSON.stringify(result,null,2));}
}catch(error){console.error('Fieldwork choices: '+error.message);process.exitCode=1;}
