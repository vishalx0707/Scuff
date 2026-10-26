import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createChoiceStore} from '../choice-store.mjs';
import {createJobStore} from '../job-store.mjs';
import {createServer} from '../server.mjs';
import {normalize,compilePrompt,compileGeneratorPrompt} from '../dist/core.mjs';

const exec=promisify(execFile),direction={schemaVersion:1,medium:'image',subject:'A stone marker in a meadow',chosenGroups:[]};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWu0AAAAASUVORK5CYII=','base64');
async function temporary(t){const folder=await mkdtemp(path.join(os.tmpdir(),'fieldwork-choices-'));t.after(async()=>{if(path.dirname(path.resolve(folder))!==path.resolve(os.tmpdir())||!path.basename(folder).startsWith('fieldwork-choices-'))throw Error('Unsafe test cleanup path.');await rm(folder,{recursive:true,force:true});});return folder;}

test('choice sessions isolate concurrent chats and preserve authoritative Done after store restart',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),one=await store.create({direction,message:'Choose a camera',owner:'chat-one'}),two=await store.create({direction:{...direction,subject:'A second subject'},owner:'chat-two'});
 assert.notEqual(one.id,two.id);assert.equal(one.preview,true);assert.equal(one.approved,false);assert.equal(one.revision,0);assert.match(one.url,new RegExp(one.id));
 const update=await store.update(one.id,{revision:0,direction:{...direction,lens:'135',chosenGroups:['lens'],tone:'Lonely'}});
 assert.equal(update.revision,1);assert.equal(update.direction.lens,'135');assert.equal((await store.get(two.id)).direction.subject,'A second subject');
 await assert.rejects(store.update(one.id,{revision:0,direction}),error=>error.status===409);
 const done=await store.done(one.id,{revision:1});assert.equal(done.status,'done');assert.equal(done.authoritative,true);assert.equal(done.approved,true);assert.match(done.generatorPrompt,/135 mm/);assert.match(done.generatorPrompt,/Lonely/);
 const readback=await createChoiceStore(folder).get(one.id);assert.equal(readback.status,'done');assert.equal(readback.direction.lens,'135');assert.equal(readback.revision,2);
 assert.equal((await store.done(one.id,{revision:1})).revision,2,'A repeated terminal acknowledgement is idempotent');
 await assert.rejects(store.done(one.id,{revision:2,direction:{...direction,subject:'Changed too late'}}),error=>error.status===409);
 await assert.rejects(store.update(one.id,{revision:2,direction}),error=>error.status===409);await assert.rejects(store.ignore(one.id),error=>error.status===409);
});

test('Ignore never returns draft choices as approved output and simultaneous updates cannot overwrite',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),session=await store.create({direction});
 const updates=await Promise.allSettled([store.update(session.id,{revision:0,direction:{...direction,tone:'First'}}),store.update(session.id,{revision:0,direction:{...direction,tone:'Second'}})]);
 assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);assert.equal(updates.filter(r=>r.status==='rejected').length,1);
 const latest=await store.get(session.id);const ignored=await store.ignore(session.id,{revision:latest.revision});assert.equal(ignored.status,'ignored');assert.equal(ignored.approved,false);assert.equal(ignored.authoritative,false);assert.equal(ignored.direction,null);assert.equal(ignored.agentBrief,null);assert.equal(ignored.generatorPrompt,null);
 assert.equal((await store.ignore(session.id)).revision,ignored.revision);await assert.rejects(store.done(session.id,{revision:ignored.revision}),error=>error.status===409);
 assert.equal((await createJobStore(folder).listJobs()).length,0,'Ignoring or submitting choices never silently queues a build');
});

test('an interrupted writer cannot expose a partial session and a dead save lock is recoverable',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),session=await store.create({direction});
 const file=path.join(folder,'choices',session.id+'.json');
 await writeFile(file+'.abandoned.tmp','{"direction":');
 await writeFile(file+'.lock',JSON.stringify({pid:2147483647,token:'interrupted-process'}));
 assert.equal((await store.get(session.id)).direction.subject,direction.subject,'Only the committed JSON record is read');
 const updated=await createChoiceStore(folder).update(session.id,{revision:0,direction:{...direction,tone:'Recovered'}});assert.equal(updated.revision,1);assert.equal(updated.direction.tone,'Recovered');
});

test('wait observes saved choices and explicit completion; timeout and cancellation do not approve',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),session=await store.create({direction});
 const timed=await store.wait(session.id,{afterRevision:0,timeoutMs:20});assert.equal(timed.timedOut,true);assert.equal(timed.status,'choosing');assert.equal(timed.approved,false);
 const pending=store.wait(session.id,{afterRevision:0,timeoutMs:1000});await delay(30);await store.update(session.id,{revision:0,direction:{...direction,tone:'Quiet'}});const changed=await pending;assert.equal(changed.revision,1);assert.equal(changed.timedOut,false);assert.equal(changed.status,'choosing');assert.equal(changed.approved,false);
 const finished=store.wait(session.id,{afterRevision:1,timeoutMs:1000});await delay(30);await store.done(session.id,{revision:1});assert.equal((await finished).status,'done');
 await assert.rejects(store.wait(session.id,{timeoutMs:55001}),/timeoutMs/);await assert.rejects(store.wait(session.id,{afterRevision:-1}),/afterRevision/);
 const abort=new AbortController(),another=await store.create({direction}),cancelled=store.wait(another.id,{signal:abort.signal});abort.abort();await assert.rejects(cancelled,error=>error.name==='AbortError');assert.equal((await store.get(another.id)).status,'choosing');
});

test('Done validates current prompts and actual reference delivery data while editing remains possible',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),jobs=createJobStore(folder),empty=await store.create({direction:{...direction,subject:''}});
 await assert.rejects(store.done(empty.id,{revision:0}),/subject/);
 const stale=await store.create({direction:{...direction,promptDraft:'Authored draft',promptBasis:'old'}});await assert.rejects(store.done(stale.id,{revision:0}),/out of date/);
 const ref=await jobs.uploadReference({name:'stone.png',role:'identity',mime:'image/png',buffer:png});
 const valid=normalize({...direction,referenceAttachments:[{id:ref.id,role:'identity',notes:'Only the stone shape'}]},true);valid.promptDraft='My current authored brief';valid.promptBasis=compilePrompt(valid);valid.generatorDraft='My generator wording';valid.generatorBasis=compileGeneratorPrompt(valid);
 const session=await store.create({direction:valid}),done=await store.done(session.id,{revision:0});assert.equal(done.agentBrief,valid.promptDraft);assert.equal(done.generatorPrompt,valid.generatorDraft);assert.equal(done.referenceAssets[0].sha256,ref.sha256);assert.deepEqual(await readFile(done.referenceAssets[0].path),png);
 const tampered=await store.create({direction:valid});await writeFile(done.referenceAssets[0].path,'changed');await assert.rejects(store.done(tampered.id,{revision:0}),/missing or changed/);assert.equal((await store.get(tampered.id)).status,'choosing');
});

test('Done rebuilds only untouched generated drafts and preserves stale authored edits for explicit resolution',async t=>{
 const folder=await temporary(t),store=createChoiceStore(folder),initial=normalize(direction,true),agent=compilePrompt(initial),generator=compileGeneratorPrompt(initial);
 const unchanged={...initial,promptDraft:agent,promptBasis:agent,generatorDraft:generator,generatorBasis:generator,tone:'Lonely and cold'};
 const session=await store.create({direction:unchanged}),done=await store.done(session.id,{revision:0});
 assert.equal(done.status,'done');assert.equal(done.agentBrief,compilePrompt(done.direction));assert.equal(done.generatorPrompt,compileGeneratorPrompt(done.direction));assert.match(done.agentBrief,/Lonely and cold/);assert.match(done.generatorPrompt,/Lonely and cold/);
 assert.equal(done.direction.promptDraft,done.direction.promptBasis);assert.equal(done.direction.generatorDraft,done.direction.generatorBasis);
 const authored=await store.create({direction:{...unchanged,promptDraft:agent+'\nKeep my manual sentence.'}});
 await assert.rejects(store.done(authored.id,{revision:0}),error=>error.status===409);const preserved=await store.get(authored.id);assert.equal(preserved.status,'choosing');assert.equal(preserved.direction.promptDraft,agent+'\nKeep my manual sentence.');
 const authoredGenerator=await store.create({direction:{...unchanged,generatorDraft:generator+'\nAuthored generator wording.'}});
 await assert.rejects(store.done(authoredGenerator.id,{revision:0}),error=>error.status===409);assert.equal((await store.get(authoredGenerator.id)).direction.generatorDraft,generator+'\nAuthored generator wording.');
});

test('choice HTTP round trip enforces origin/revisions and long-poll reports exact Done snapshot',async t=>{
 const folder=await temporary(t),server=createServer({storeRoot:folder});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port,headers={'content-type':'application/json','x-fieldwork-request':'1',origin:base};
 assert.equal((await(await fetch(base+'/api/capabilities')).json()).choiceSessions,true);
 assert.equal((await fetch(base+'/api/choices',{method:'POST',headers:{...headers,origin:'https://example.com'},body:JSON.stringify({direction})})).status,403);
 assert.equal((await fetch(base+'/api/choices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({direction})})).status,403);
 const response=await fetch(base+'/api/choices',{method:'POST',headers,body:JSON.stringify({direction,owner:'local-chat'})});assert.equal(response.status,201);const session=await response.json();
 const pending=fetch(base+`/api/choices/${session.id}/wait?afterRevision=0&timeoutMs=1000`);
 const submitted=await fetch(base+`/api/choices/${session.id}/done`,{method:'POST',headers,body:JSON.stringify({revision:0,direction:{...direction,tone:'Late final choice'}})});assert.equal(submitted.status,200);const done=await(await pending).json();assert.equal(done.status,'done');assert.equal(done.direction.tone,'Late final choice');
 const late=await fetch(base+`/api/choices/${session.id}/save`,{method:'POST',headers,body:JSON.stringify({revision:1,direction})});assert.equal(late.status,409);
 const timeout=await fetch(base+`/api/choices/${session.id}/wait?timeoutMs=55001`);assert.equal(timeout.status,400);
 assert.equal((await fetch(base+'/api/choices/../../package.json')).status,404);
});

test('choice CLI creates and exports only explicitly completed choices without opening a browser',async t=>{
 const folder=await temporary(t),input=path.join(folder,'direction.json'),output=path.join(folder,'selected.json'),store=path.join(folder,'store');await writeFile(input,JSON.stringify(direction));
 const run=args=>exec(process.execPath,['choices.mjs',...args,'--store',store],{cwd:new URL('..',import.meta.url)});
 const created=JSON.parse((await run(['create',input,'--owner','test-chat'])).stdout);assert.equal(created.status,'choosing');assert.match(created.url,/^http:\/\/127\.0\.0\.1:8787\/\?choice=/);
 await assert.rejects(run(['export',created.id,output]));const waited=JSON.parse((await run(['wait',created.id,'--timeout-ms','0'])).stdout);assert.equal(waited.timedOut,true);assert.equal(waited.approved,false);
 await run(['done',created.id,'--revision','0']);await run(['export',created.id,output]);assert.equal(JSON.parse(await readFile(output,'utf8')).subject,direction.subject);
});
