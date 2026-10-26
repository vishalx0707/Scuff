import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server.mjs';
import {freshDirection} from '../dist/core.mjs';
async function fixture(capabilities={},autostart=false){
 const folder=await mkdtemp(path.join(tmpdir(),'fieldwork-mcp-')),server=createServer({storeRoot:folder});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 if(autostart)await new Promise(r=>server.close(r));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../agent-mcp.mjs',import.meta.url))],{env:{...process.env,FIELDWORK_URL:origin,FIELDWORK_AUTOSTART:autostart?'1':'0',FIELDWORK_STORE:folder},stdio:['pipe','pipe','pipe'],windowsHide:true}),waiting=new Map(),serverRequests=[];let id=0,handler,stderr='';
 child.stderr.on('data',b=>stderr+=b);
 const send=message=>child.stdin.write(JSON.stringify(message)+'\n');
 createInterface({input:child.stdout}).on('line',line=>{let message;try{message=JSON.parse(line);}catch{assert.fail('Non-JSON MCP stdout: '+line);}if(message.method){serverRequests.push(message);handler?.(message);}else{const p=waiting.get(message.id);if(p){waiting.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}}});
 const request=(method,params={})=>new Promise((resolve,reject)=>{const rid=++id,timer=setTimeout(()=>reject(Error('MCP test response timeout '+method)),8000);waiting.set(rid,{resolve,reject,timer});send({jsonrpc:'2.0',id:rid,method,params});});
 const call=async(name,args)=>{const r=await request('tools/call',{name,arguments:args});if(r.isError)throw Error(r.content[0].text);return r.structuredContent;};
 const post=async(route,body)=>{const r=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json','X-Fieldwork-Request':'1'},body:JSON.stringify(body)});const value=await r.json();assert.equal(r.ok,true,JSON.stringify(value));return value;};
 await request('initialize',{protocolVersion:'2025-11-25',capabilities,clientInfo:{name:'isolated-protocol-test',version:'1'}});send({jsonrpc:'2.0',method:'notifications/initialized'});
 return {request,call,post,serverRequests,send,respond:(id,value)=>send({jsonrpc:'2.0',id,result:value}),onQuestion:f=>{handler=f;},close:async()=>{child.stdin.end();await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);});for(const p of waiting.values())clearTimeout(p.timer);if(server.listening)await new Promise(r=>server.close(r));const target=path.resolve(folder);assert.equal(path.dirname(target),path.resolve(tmpdir()));assert.ok(path.basename(target).startsWith('fieldwork-mcp-'));await rm(target,{recursive:true,force:true});assert.equal(stderr,'');}};
}
const direction=()=>({...freshDirection('blender'),subject:'A robot waiting at a bus shelter',tone:'Lonely',action:'Waiting'});
test('malformed JSON-RPC envelopes do not crash the adapter',async()=>{
 const f=await fixture();try{
  for(const message of [null,[],42,{jsonrpc:'1.0',id:9,method:'ping'},{jsonrpc:'2.0',id:10,method:42}])f.send(message);
  assert.deepEqual(await f.request('ping'),{});
 }finally{await f.close();}
});
test('MCP starts its local choice server without an OS browser or model process',async()=>{
 const f=await fixture({},true);try{const session=await f.call('start_choices',{direction:direction()});assert.equal(session.status,'choosing');assert.match(session.url,/127\.0\.0\.1/);assert.equal((await f.call('read_choices',{id:session.id})).direction.subject,direction().subject);}finally{await f.close();}
});
test('MCP choice loop returns exact final values and honestly falls back without host elicitation',async()=>{
 const f=await fixture();try{
  const tools=(await f.request('tools/list')).tools;assert.deepEqual(tools.map(t=>t.name),['start_choices','read_choices','wait_choices','ask_choices','finish_choices']);
  const a=await f.call('start_choices',{direction:direction(),owner:'chat-A'}),b=await f.call('start_choices',{direction:{...direction(),subject:'A fox in fog'},owner:'chat-B'});assert.notEqual(a.id,b.id);assert.match(a.url,/\?choice=/);
  const asked=await f.call('ask_choices',{id:a.id});assert.equal(asked.nativeQuestionDisplayed,false);assert.deepEqual(asked.chatQuestion.options,['Done','Ignore']);assert.equal(f.serverRequests.length,0);
  const timed=await f.call('wait_choices',{id:a.id,timeoutMs:0});assert.equal(timed.status,'choosing');assert.equal(timed.timedOut,true);
  const pending=f.call('wait_choices',{id:a.id,afterRevision:a.revision,timeoutMs:2000});const edited={...a.direction,tone:'Quietly absurd',lens:'135',angle:'isometric',chosenGroups:['lens','angle']};await f.post('/api/choices/'+a.id+'/save',{direction:edited,revision:0});const changed=await pending;assert.equal(changed.direction.tone,'Quietly absurd');assert.equal(changed.status,'choosing');
  const done=await f.call('finish_choices',{id:a.id,decision:'done',revision:changed.revision});assert.equal(done.status,'done');assert.equal(done.authoritative,true);assert.match(done.generatorPrompt,/Orthographic/);assert.doesNotMatch(done.generatorPrompt,/135 mm perspective/);assert.equal((await f.call('read_choices',{id:b.id})).direction.subject,'A fox in fog');
  const ignored=await f.call('finish_choices',{id:b.id,decision:'ignore',revision:b.revision});assert.equal(ignored.status,'ignored');assert.equal(ignored.direction,null);assert.equal(ignored.agentBrief,null);
 }finally{await f.close();}
});
test('standard MCP form Done/Ignore returns server choices; dismissing is never submission',async()=>{
 const f=await fixture({elicitation:{form:{}}});try{
  let answer={action:'accept',content:{decision:'Done'}};
  f.onQuestion(message=>{assert.equal(message.method,'elicitation/create');assert.equal(message.params.mode,'form');assert.deepEqual(message.params.requestedSchema.properties.decision.enum,['Done','Ignore']);f.respond(message.id,answer);});
  const session=await f.call('start_choices',{direction:direction()});
  await f.post('/api/choices/'+session.id+'/save',{direction:{...session.direction,tone:'User-chosen wonder'},revision:session.revision});
  const done=await f.call('ask_choices',{id:session.id});assert.equal(done.status,'done');assert.equal(done.direction.tone,'User-chosen wonder');assert.match(done.agentBrief,/User-chosen wonder/);
  const second=await f.call('start_choices',{direction:direction()});answer={action:'accept',content:{decision:'Ignore'}};const ignored=await f.call('ask_choices',{id:second.id});assert.equal(ignored.status,'ignored');assert.equal(ignored.direction,null);
  const third=await f.call('start_choices',{direction:direction()});answer={action:'cancel',content:null};const dismissed=await f.call('ask_choices',{id:third.id});assert.equal(dismissed.status,'choosing');assert.equal(dismissed.questionDismissed,true);assert.equal((await f.call('read_choices',{id:third.id})).status,'choosing');
  assert.equal(f.serverRequests.length,3);
 }finally{await f.close();}
});
test('Done on the page returns to a waiting chat tool even while its native question is unanswered',async()=>{
 const f=await fixture({elicitation:{form:{}}});try{
  const session=await f.call('start_choices',{direction:direction()});let question;
  f.onQuestion(message=>{if(message.method==='elicitation/create')question=message;});
  const response=f.call('ask_choices',{id:session.id});
  await new Promise(resolve=>setTimeout(resolve,40));assert.ok(question);
  await f.post('/api/choices/'+session.id+'/done',{revision:session.revision,direction:{...session.direction,tone:'Final choice sent from the page'}});
  const completed=await response;assert.equal(completed.status,'done');assert.equal(completed.direction.tone,'Final choice sent from the page');
  assert.ok(f.serverRequests.some(r=>r.method==='notifications/cancelled'&&r.params.requestId===question.id));
 }finally{await f.close();}
});
