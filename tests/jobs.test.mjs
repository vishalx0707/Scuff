import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createJobStore} from '../job-store.mjs';
import {createServer} from '../server.mjs';
import {normalize,compilePrompt,compileGeneratorPrompt} from '../dist/core.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWu0AAAAASUVORK5CYII=','base64');
const state={schemaVersion:1,medium:'image',subject:'One stone beside grass',chosenGroups:[]};
async function temporary(t){const folder=await mkdtemp(path.join(os.tmpdir(),'fieldwork-handoff-'));t.after(async()=>{if(!path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep+'fieldwork-handoff-'))throw new Error('Unsafe test cleanup path.');await rm(folder,{recursive:true,force:true});});return folder;}

test('artifact containment accepts canonical store aliases while rejecting escapes',async t=>{
  const folder=await temporary(t),real=path.join(folder,'actual-store'),alias=path.join(folder,'store-alias');
  await mkdir(real);await symlink(real,alias,process.platform==='win32'?'junction':'dir');
  const store=createJobStore(alias),job=await store.createJob(state),output=path.join(folder,'output.png');
  await writeFile(output,png);await store.claimJob(job.id,'alias-test');
  const completed=await store.completeJob(job.id,{inspection:'Inspected the actual diagnostic image file.',artifacts:[{path:output,inspected:true}]});
  const artifact=await store.getArtifact(job.id,completed.artifacts[0].id);
  assert.deepEqual(await readFile(artifact.path),png);
  // An outside file with the correct bytes is still outside the registered store.
  completed.artifacts[0].path=output;
  await writeFile(path.join(real,'jobs',job.id+'.json'),JSON.stringify(completed));
  await assert.rejects(store.getArtifact(job.id,artifact.id),/Output is unavailable/);
});

test('reference bytes survive a queued handoff and inspected results have registered immutable copies',async t=>{
  const folder=await temporary(t),store=createJobStore(path.join(folder,'store'));
  const ref=await store.uploadReference({name:'stone.png',role:'identity',mime:'image/png',buffer:png});
  assert.equal(ref.sha256,createHash('sha256').update(png).digest('hex'));
  const job=await store.createJob({...state,referenceAttachments:[{id:ref.id,role:'identity',notes:'Keep the stone shape.'}]});
  assert.equal(job.status,'queued');assert.equal(job.referenceAssets[0].sha256,ref.sha256);assert.deepEqual(await readFile(job.referenceAssets[0].path),png);
  assert.equal(job.execution.automatic,false);assert.ok(job.agentBrief);assert.ok(job.generatorPrompt);
  await assert.rejects(store.completeJob(job.id,{}),/Claim a queued job/);
  const claims=await Promise.allSettled([store.claimJob(job.id,'agent-one'),store.claimJob(job.id,'agent-two')]);
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);assert.equal(claims.filter(x=>x.status==='rejected').length,1);
  const artifact=path.join(folder,'result.png');await writeFile(artifact,png);
  const receipt={inspection:'Opened the test output and checked the single image.',artifacts:[{path:artifact,kind:'image',label:'Selected result',inspected:true}],referenceEvidence:[{id:ref.id,inspected:true,use:'Identity input attached to the generator.',attached:true}],limitations:['Fixture only; no model execution in this software test.']};
  await assert.rejects(store.completeJob(job.id,{...receipt,referenceEvidence:[]}),/Record how reference/);
  await assert.rejects(store.completeJob(job.id,{...receipt,referenceEvidence:[{...receipt.referenceEvidence[0],attached:false}]}),/actual generator received/);
  await assert.rejects(store.completeJob(job.id,{...receipt,artifacts:[{path:artifact,inspected:false}]}),/Confirm inspection/);
  const completed=await store.completeJob(job.id,receipt);assert.equal(completed.status,'completed');assert.equal(completed.artifacts[0].sha256,ref.sha256);
  const result=await store.getArtifact(job.id,completed.artifacts[0].id);await writeFile(artifact,'changed source');assert.deepEqual(await readFile(result.path),png);
  await assert.rejects(store.failJob(job.id,'Too late.'),/Claim a queued job/);
  await writeFile(result.path,'tampered output');await assert.rejects(store.getArtifact(job.id,result.id),/changed after verification/);
});

test('reference admission rejects disguised payloads, path names, role confusion and missing attachments',async t=>{
  const folder=await temporary(t),store=createJobStore(folder);
  await assert.rejects(store.uploadReference({name:'../stone.png',role:'identity',mime:'image/png',buffer:png}),/plain filename/);
  await assert.rejects(store.uploadReference({name:'stone.png',role:'identity',mime:'image/png',buffer:Buffer.from('<script>oops</script>')}),/do not match/);
  await assert.rejects(store.uploadReference({name:'stone.png',role:'audio',mime:'image/png',buffer:png}),/Audio files/);
  await assert.rejects(store.createJob({...state,medium:'general'}),/Choose Blender/);
  await assert.rejects(store.createJob({...state,referenceAttachments:[{id:'f477b391-070c-4b0e-a18b-df556ec9a990',role:'identity',notes:''}]}),/not found/);
  const job=await store.createJob(state);await store.claimJob(job.id);await store.failJob(job.id,'The requested generator was not connected.');assert.equal((await store.getJob(job.id)).status,'failed');
});

test('queue rejects stale instructions and preserves both current authored drafts',async t=>{
  const folder=await temporary(t),store=createJobStore(folder),normalized=normalize(state,true);
  await assert.rejects(store.createJob({...state,promptDraft:'My agent instructions',promptBasis:'An old basis'}),/stale prompt/);
  await assert.rejects(store.createJob({...state,generatorDraft:'My generator wording',generatorBasis:'An old basis'}),/stale prompt/);
  const job=await store.createJob({...state,promptDraft:'My agent instructions',promptBasis:compilePrompt(normalized),generatorDraft:'My generator wording',generatorBasis:compileGeneratorPrompt(normalized)});
  assert.equal(job.agentBrief,'My agent instructions');assert.equal(job.generatorPrompt,'My generator wording');
});

test('HTTP API carries actual reference bytes, rejects cross-origin writes and serves only registered outputs',async t=>{
  const folder=await temporary(t),storeRoot=path.join(folder,'store'),store=createJobStore(storeRoot),server=createServer({storeRoot});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={'x-fieldwork-request':'1','content-type':'application/json'};
  const packageVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
  assert.equal((await(await fetch(base+'/health')).json()).version,packageVersion);
  const capabilities=await(await fetch(base+'/api/capabilities')).json();assert.equal(capabilities.queue,true);assert.equal(capabilities.automaticExecution,false);
  assert.equal((await fetch(base+'/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction:state})})).status,403);
  assert.equal((await fetch(base+'/api/jobs',{method:'POST',headers:{...headers,origin:'https://example.com'},body:JSON.stringify({direction:state})})).status,403);
  const upload=await fetch(base+'/api/references',{method:'POST',headers:{'x-fieldwork-request':'1','x-file-name':encodeURIComponent('stone reference.png'),'x-reference-role':'identity','content-type':'image/png'},body:png});assert.equal(upload.status,201);
  const ref=await upload.json();assert.deepEqual(Buffer.from(await(await fetch(base+ref.url)).arrayBuffer()),png);
  const created=await fetch(base+'/api/jobs',{method:'POST',headers:{...headers,origin:base},body:JSON.stringify({direction:{...state,referenceAttachments:[{id:ref.id,role:'identity',notes:''}]}})});assert.equal(created.status,201);const job=await created.json();assert.equal((await(await fetch(base+'/api/jobs/'+job.id)).json()).status,'queued');
  await store.claimJob(job.id,'test-agent');const output=path.join(folder,'selected.png');await writeFile(output,png);
  const complete=await store.completeJob(job.id,{inspection:'Inspected the software-test fixture output image.',artifacts:[{path:output,inspected:true}],referenceEvidence:[{id:ref.id,inspected:true,attached:true,use:'Actual image bytes supplied as identity reference.'}]});
  const delivered=await fetch(base+complete.artifacts[0].url);assert.equal(delivered.status,200);assert.equal(delivered.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await delivered.arrayBuffer()),png);
  assert.equal((await fetch(base+complete.artifacts[0].url,{headers:{range:'bytes=0-7'}})).status,206);
  assert.equal((await fetch(base+'/api/jobs/'+job.id+'/artifacts/../package.json')).status,404);
  assert.equal((await fetch(base+'/.fieldwork-local/jobs/'+job.id+'.json')).status,404);
});
