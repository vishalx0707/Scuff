import {mkdir,readFile,open,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createJobStore,defaultStoreRoot} from './job-store.mjs';
import {normalize,compilePrompt,compileGeneratorPrompt} from './dist/core.mjs';
import {saveJSON as save} from './atomic-json.mjs';

const bad=(message,status=400)=>Object.assign(new Error(message),{status});
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const revision=value=>Number.isSafeInteger(value)&&value>=0;
async function load(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')throw bad('Choice session was not found.',404);throw error;}}
function result(session){
  const terminal=session.status!=='choosing';
  return {...session,...(session.status==='ignored'?{direction:null,agentBrief:null,generatorPrompt:null,referenceAssets:[]}:{}),preview:!terminal,authoritative:session.status==='done',approved:session.status==='done',url:`/?choice=${session.id}#direction`,notice:session.status==='choosing'?'Draft choices only. Wait for Done or Ignore; a timeout is not approval.':session.status==='done'?'The user submitted these choices. This confirms the direction, not permission for unrelated actions.':'The user ignored this choice request. Do not apply its draft choices.'};
}
export function createChoiceStore(root=defaultStoreRoot){
  root=path.resolve(root);const folder=path.join(root,'choices'),references=createJobStore(root);
  const ready=()=>mkdir(folder,{recursive:true});
  const fileFor=id=>{if(typeof id!=='string'||!idPattern.test(id))throw bad('Unknown choice session.',404);return path.join(folder,id+'.json');};
  async function locked(id,operation){
    const file=fileFor(id),lock=file+'.lock',token=randomUUID();let handle;
    await ready();
    try{handle=await open(lock,'wx');}catch(error){
      if(error.code!=='EEXIST')throw error;
      // A crashed local writer must not permanently strand a session. Never
      // steal a live process's lock, including writers in another agent.
      let previous;try{previous=JSON.parse(await readFile(lock,'utf8'));}catch{throw bad('Choice session is being saved. Retry the request.',409);}
      if(!Number.isSafeInteger(previous.pid)||previous.pid<=0)throw bad('Choice session has an unreadable save lock.',409);
      let alive=true;try{process.kill(previous.pid,0);}catch(probe){if(probe.code==='ESRCH')alive=false;}
      if(alive)throw bad('Choice session is being saved. Retry the request.',409);
      await unlink(lock).catch(()=>{});
      try{handle=await open(lock,'wx');}catch{throw bad('Choice session is being saved. Retry the request.',409);}
    }
    try{await handle.writeFile(JSON.stringify({pid:process.pid,token}));return await operation(await load(file),file);}
    finally{await handle.close();let owner;try{owner=JSON.parse(await readFile(lock,'utf8'));}catch{}if(owner?.token===token)await unlink(lock).catch(()=>{});}
  }
  function matching(session,value,required=true){if(value===undefined&&!required)return;if(!revision(value))throw bad('Supply the current choice-session revision.');if(value!==session.revision)throw bad('Choices changed in another tab. Reload the latest session before saving.',409);}
  function choosing(session){if(session.status!=='choosing')throw bad('This choice session is closed. Start a new request to change it.',409);}
  async function create({direction,message='',owner=''}={}){
    if(typeof message!=='string'||message.length>2000||typeof owner!=='string'||owner.length>200)throw bad('Message and owner must be short text.');
    const state=normalize(direction,true);await ready();const id=randomUUID(),now=new Date().toISOString();
    const session={id,status:'choosing',revision:0,direction:state,message,owner,createdAt:now,updatedAt:now,completedAt:null,agentBrief:null,generatorPrompt:null,referenceAssets:[]};
    await save(fileFor(id),session);return result(session);
  }
  async function get(id){return result(await load(fileFor(id)));}
  async function update(id,{direction,revision:expected}={}){return locked(id,async(session,file)=>{choosing(session);matching(session,expected);const state=normalize(direction,true);session.direction=state;session.revision++;session.updatedAt=new Date().toISOString();await save(file,session);return result(session);});}
  async function done(id,{direction,revision:expected}={}){return locked(id,async(session,file)=>{
    if(session.status==='done'){
      if(direction!==undefined&&JSON.stringify(normalize(direction,true))!==JSON.stringify(session.direction))throw bad('This choice session already submitted a different direction.',409);
      return result(session);
    }
    choosing(session);matching(session,expected);const state=direction===undefined?session.direction:normalize(direction,true);
    if(!state.subject.trim())throw bad('Describe the subject before choosing Done.');
    const generated=compilePrompt(state),generator=compileGeneratorPrompt(state);
    // A prompt that still equals its old generated basis has no authored edits
    // to protect. Rebuild it for the submitted choices, as the page does on Done.
    // An edited stale draft must remain explicit rather than silently overwritten.
    for(const [draft,basis,current] of [['promptDraft','promptBasis',generated],['generatorDraft','generatorBasis',generator]]){
      if(state[draft]&&state[basis]!==current){
        if(state[draft]!==state[basis])throw bad('A saved prompt is out of date. Reconcile or regenerate it before choosing Done.',409);
        state[draft]=current;state[basis]=current;
      }
    }
    const assets=[];
    for(const attachment of state.referenceAttachments){const ref=await references.getReference(attachment.id);if(ref.role!==attachment.role)throw bad('The reference role changed. Use its uploaded role.',409);assets.push({...ref,notes:attachment.notes});}
    const now=new Date().toISOString();Object.assign(session,{status:'done',direction:state,revision:session.revision+1,updatedAt:now,completedAt:now,agentBrief:state.promptDraft||generated,generatorPrompt:state.generatorDraft||generator,referenceAssets:assets});
    await save(file,session);return result(session);
  });}
  async function ignore(id,{revision:expected}={}){return locked(id,async(session,file)=>{if(session.status==='ignored')return result(session);choosing(session);matching(session,expected,false);session.status='ignored';session.revision++;session.completedAt=session.updatedAt=new Date().toISOString();await save(file,session);return result(session);});}
  async function wait(id,{afterRevision,timeoutMs=55000,signal}={}){
    if(afterRevision!==undefined&&!revision(afterRevision))throw bad('afterRevision must be a nonnegative whole number.');
    if(!Number.isInteger(timeoutMs)||timeoutMs<0||timeoutMs>55000)throw bad('timeoutMs must be a whole number from0to55000.');
    const deadline=Date.now()+timeoutMs;let session=await get(id);const baseline=afterRevision??session.revision;
    while(session.status==='choosing'&&session.revision<=baseline&&Date.now()<deadline){await delay(Math.min(180,Math.max(1,deadline-Date.now())),undefined,{signal});session=await get(id);}
    return {...session,timedOut:session.status==='choosing'&&session.revision<=baseline};
  }
  return {root,create,get,update,done,ignore,wait};
}
