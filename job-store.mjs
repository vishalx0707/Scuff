import {mkdir,readFile,writeFile,open,unlink,readdir,stat,copyFile,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as core from './dist/core.mjs';
import {saveJSON as save} from './atomic-json.mjs';

export const defaultStoreRoot=fileURLToPath(new URL('./.fieldwork-local/',import.meta.url));
const roles=new Set(['identity','composition','atmosphere','style','audio']);
const formats={'image/png':['.png',20*1024*1024],'image/jpeg':['.jpg',20*1024*1024],'image/webp':['.webp',20*1024*1024],'image/gif':['.gif',20*1024*1024],'audio/wav':['.wav',40*1024*1024],'audio/x-wav':['.wav',40*1024*1024],'audio/mpeg':['.mp3',40*1024*1024],'audio/ogg':['.ogg',40*1024*1024],'audio/mp4':['.m4a',40*1024*1024]};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validId(id){if(typeof id!=='string'||!idPattern.test(id))throw Object.assign(new Error('Unknown local item.'),{status:404});return id;}
const fail=(text,status=400)=>Object.assign(new Error(text),{status});
function signature(buffer,mime){
  if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg')return buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
  if(mime==='image/webp')return buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(mime==='image/gif')return ['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6));
  if(mime==='audio/wav'||mime==='audio/x-wav')return buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WAVE';
  if(mime==='audio/ogg')return buffer.toString('ascii',0,4)==='OggS';
  if(mime==='audio/mp4')return buffer.toString('ascii',4,8)==='ftyp';
  if(mime==='audio/mpeg')return buffer.toString('ascii',0,3)==='ID3'||(buffer[0]===255&&(buffer[1]&224)===224);
  return false;
}
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function json(file){try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')throw fail('Local item was not found.',404);throw error;}}
function publicRef(ref){const {path:localPath,...meta}=ref;return meta;}

export function createJobStore(root=defaultStoreRoot){
  root=path.resolve(root);
  const refsDir=path.join(root,'references'),jobsDir=path.join(root,'jobs'),artifactsDir=path.join(root,'artifacts');
  const ready=()=>Promise.all([mkdir(refsDir,{recursive:true}),mkdir(jobsDir,{recursive:true}),mkdir(artifactsDir,{recursive:true})]);
  const refFile=id=>path.join(refsDir,validId(id)+'.json');
  const jobFile=id=>path.join(jobsDir,validId(id)+'.json');
  async function getReference(id){const ref=await json(refFile(id));const info=await stat(ref.path).catch(()=>null);if(!info?.isFile()||info.size!==ref.size||await hashFile(ref.path)!==ref.sha256)throw fail('The stored reference is missing or changed. Upload it again.',409);return ref;}
  async function uploadReference({name,role,mime,buffer}){
    await ready();
    if(typeof name!=='string'||!name.trim()||name.length>160||/[\\/\x00-\x1f]/.test(name)||name==='.'||name==='..')throw fail('Use a plain filename, without a folder path.');
    if(!roles.has(role))throw fail('Choose identity, composition, atmosphere, style or audio.');
    mime=String(mime||'').toLowerCase().split(';')[0].trim();
    if(!formats[mime])throw fail('Upload PNG, JPEG, WebP, GIF, WAV, MP3, Ogg or M4A.');
    if((role==='audio')!==mime.startsWith('audio/'))throw fail('Audio files need the audio role; visual roles need an image.');
    if(!Buffer.isBuffer(buffer)||buffer.length<8||buffer.length>formats[mime][1])throw fail('Reference file is empty or exceeds its size limit.',413);
    if(!signature(buffer,mime))throw fail('File contents do not match the declared image/audio format.');
    const id=randomUUID(),file=path.join(refsDir,id+formats[mime][0]),sha256=createHash('sha256').update(buffer).digest('hex');
    const ref={id,name:name.trim(),role,mime,size:buffer.length,sha256,url:`/api/references/${id}/file`,createdAt:new Date().toISOString(),path:file};
    await writeFile(file,buffer,{flag:'wx'});await save(refFile(id),ref);return publicRef(ref);
  }
  async function listReferences(){await ready();const names=(await readdir(refsDir)).filter(n=>n.endsWith('.json'));const refs=await Promise.all(names.map(n=>json(path.join(refsDir,n))));return refs.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(publicRef);}
  async function createJob(direction){
    await ready();const state=core.normalize(direction,true);if(!state.subject.trim())throw fail('Describe the subject before queuing a build.');
    if(state.medium==='general')throw fail('Choose Blender, Image generation or Video generation before queuing a build.');
    const referenceAssets=[];
    for(const attachment of state.referenceAttachments||[]){const ref=await getReference(attachment.id);if(attachment.role!==ref.role)throw fail('A reference role changed. Upload it with the intended role or keep its original role.');referenceAssets.push({...ref,notes:attachment.notes||''});}
    const agentBrief=core.compilePrompt(state),generatorPrompt=core.compileGeneratorPrompt?core.compileGeneratorPrompt(state):agentBrief;
    const stale=Boolean(state.promptDraft&&state.promptBasis!==agentBrief);
    const generatorStale=Boolean(state.generatorDraft&&state.generatorBasis!==generatorPrompt);
    if(stale||generatorStale)throw fail('Choices changed after a saved prompt was prepared. Reconcile or regenerate the stale prompt before queuing.',409);
    const id=randomUUID(),now=new Date().toISOString();
    const job={id,status:'queued',createdAt:now,updatedAt:now,direction:state,agentBrief:state.promptDraft||agentBrief,generatorPrompt:state.generatorDraft||generatorPrompt,referenceAssets,artifacts:[],inspection:null,error:null,limitations:[],draftStale:false,generatorDraftStale:false,execution:{automatic:false,agent:null,claimedAt:null,completedAt:null}};
    await save(jobFile(id),job);return job;
  }
  async function getJob(id){return json(jobFile(id));}
  async function listJobs(){await ready();const names=(await readdir(jobsDir)).filter(n=>n.endsWith('.json'));return (await Promise.all(names.map(n=>json(path.join(jobsDir,n))))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
  async function claimJob(id,agent='local-agent'){
    if(typeof agent!=='string'||!agent.trim()||agent.length>120)throw fail('Name the agent claiming this job.');
    const file=jobFile(id),lock=file+'.claim';let handle;
    try{handle=await open(lock,'wx');}catch(error){if(error.code==='EEXIST')throw fail('This job is already claimed.',409);throw error;}
    try{const job=await getJob(id);if(job.status!=='queued')throw fail('Only a queued job can be claimed.',409);for(const asset of job.referenceAssets){const ref=await getReference(asset.id);if(ref.sha256!==asset.sha256)throw fail('A queued reference changed; upload it and queue a new direction.',409);}const now=new Date().toISOString();job.status='running';job.updatedAt=now;job.execution={...job.execution,agent:agent.trim(),claimedAt:now};await save(file,job);return job;}catch(error){await unlink(lock).catch(()=>{});throw error;}finally{await handle.close();}
  }
  async function withRunningJob(id,operation){const file=jobFile(id),lock=file+'.update';let handle;try{handle=await open(lock,'wx');}catch(error){if(error.code==='EEXIST')throw fail('This job is being updated.',409);throw error;}try{const job=await getJob(id);if(job.status!=='running')throw fail('Claim a queued job before reporting a result.',409);return await operation(job,file);}finally{await handle.close();await unlink(lock).catch(()=>{});}}
  async function completeJob(id,receipt){return withRunningJob(id,async(job,file)=>{
    if(!receipt||typeof receipt!=='object'||Array.isArray(receipt))throw fail('Supply a result receipt.');
    if(typeof receipt.inspection!=='string'||receipt.inspection.trim().length<20||receipt.inspection.length>12000)throw fail('Describe the actual visual/temporal inspection in at least 20 characters.');
    if(!Array.isArray(receipt.artifacts)||!receipt.artifacts.length||receipt.artifacts.length>24)throw fail('Supply between one and 24 actual output files.');
    if(job.referenceAssets.length){
      if(!Array.isArray(receipt.referenceEvidence))throw fail('Report inspection and generator delivery for each reference.');
      for(const ref of job.referenceAssets){const evidence=receipt.referenceEvidence.find(r=>r?.id===ref.id);if(!evidence||evidence.inspected!==true||typeof evidence.use!=='string'||evidence.use.trim().length<8)throw fail(`Record how reference ${ref.name} was inspected and used.`);if(['image','video'].includes(job.direction.medium)&&evidence.attached!==true)throw fail(`Confirm the actual generator received reference ${ref.name}.`);}
    }
    const prepared=[];
    for(const entry of receipt.artifacts){
      if(!entry||typeof entry.path!=='string'||!path.isAbsolute(entry.path))throw fail('Each artifact needs an absolute local file path.');
      if(entry.inspected!==true)throw fail('Confirm inspection of every delivered artifact; do not report uninspected outputs as complete.');
      const source=await realpath(entry.path).catch(()=>null),info=source&&await stat(source);if(!info?.isFile()||info.size===0)throw fail('An output file is missing or empty.');if(info.size>1024*1024*1024)throw fail('An output file exceeds the 1 GB local handoff limit.',413);
      const artifactId=randomUUID(),ext=path.extname(source).toLowerCase().slice(0,12),destination=path.join(artifactsDir,job.id+'-'+artifactId+ext),sha256=await hashFile(source);
      prepared.push({id:artifactId,label:typeof entry.label==='string'?entry.label.slice(0,160):path.basename(source),kind:typeof entry.kind==='string'?entry.kind.slice(0,40):'output',name:path.basename(source),path:destination,sourcePath:source,size:info.size,sha256,inspected:true,url:`/api/jobs/${job.id}/artifacts/${artifactId}`});
    }
    const copied=[];
    try{for(const artifact of prepared){copied.push(artifact.path);await copyFile(artifact.sourcePath,artifact.path);if(await hashFile(artifact.path)!==artifact.sha256)throw fail('Output copy verification failed.',409);}const now=new Date().toISOString();job.status='completed';job.updatedAt=now;job.artifacts=prepared;job.inspection=receipt.inspection.trim();job.referenceEvidence=receipt.referenceEvidence||[];job.limitations=Array.isArray(receipt.limitations)?receipt.limitations.filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,2000)):[];job.execution.completedAt=now;await save(file,job);return job;}catch(error){await Promise.all(copied.map(output=>unlink(output).catch(()=>{})));throw error;}
  });}
  async function failJob(id,message){return withRunningJob(id,async(job,file)=>{if(typeof message!=='string'||!message.trim()||message.length>6000)throw fail('Describe why this execution could not complete.');job.status='failed';job.error=message.trim();job.updatedAt=new Date().toISOString();await save(file,job);return job;});}
  async function getArtifact(jobId,artifactId){
    validId(artifactId);const job=await getJob(jobId),artifact=job.artifacts.find(item=>item.id===artifactId);
    if(!artifact)throw fail('Output was not found.',404);
    // Resolve both sides: Windows short names and junctions can identify the
    // same directory using different strings. Still reject symlink escapes.
    const actual=await realpath(artifact.path).catch(()=>null),boundary=await realpath(artifactsDir).catch(()=>null);
    const relative=actual&&boundary?path.relative(boundary,actual):null;
    if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw fail('Output is unavailable.',404);
    if(await hashFile(actual)!==artifact.sha256)throw fail('Output changed after verification.',409);return artifact;
  }
  return {root,uploadReference,listReferences,getReference,createJob,getJob,listJobs,claimJob,completeJob,failJob,getArtifact};
}
