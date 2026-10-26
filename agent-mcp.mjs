// Local stdio MCP adapter. No model calls, browser launch or chat-process injection.
import {createInterface} from 'node:readline';
import {createServer} from './server.mjs';

const configured=new URL(process.env.FIELDWORK_URL||'http://127.0.0.1:8787');
if(configured.protocol!=='http:'||!['127.0.0.1','localhost'].includes(configured.hostname)||configured.username||configured.password||configured.search||configured.hash||configured.pathname!=='/')throw Error('FIELDWORK_URL must be a plain local HTTP origin.');
const base=configured.origin;
let server,ready,initialized=false,clientCapabilities={},nextId=0;
const pending=new Map(),aborters=new Map();
const emit=message=>process.stdout.write(JSON.stringify(message)+'\n');
const result=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
async function ensureServer(){
 if(ready)return ready;
 ready=(async()=>{
  try{const response=await fetch(base+'/api/capabilities',{signal:AbortSignal.timeout(1500)});const c=await response.json();if(response.ok&&c.choiceSessions)return;throw Error('The local server does not support choice sessions. Restart the updated server.');}
  catch(error){if(error.message.includes('does not support'))throw error;if(process.env.FIELDWORK_AUTOSTART==='0')throw Error('Start the local Fieldwork server before using the agent tools.');}
  server=createServer({storeRoot:process.env.FIELDWORK_STORE});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(configured.port||80),'127.0.0.1',resolve);});
 })().catch(error=>{ready=null;throw error;});return ready;
}
async function api(route,body,signal){await ensureServer();const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-Fieldwork-Request':'1'},body:body===undefined?undefined:JSON.stringify(body),signal});const value=await response.json();if(!response.ok)throw Error(value.error||'Local choice request failed.');return value;}
const sessionPath=id=>{if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw Error('Use the session ID returned by start_choices.');return '/api/choices/'+id;};
const input=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const sid={type:'string',description:'Exact choice-session ID returned to this chat.'};
const tools=[
 {name:'start_choices',description:'Prepare a local creative-choice page from this conversation. Returns its URL and scoped session ID; does not open a window. Use the host browser/page tool only when the user wants to view it, then ask Done or Ignore with the host question tool or ask_choices.',inputSchema:input({direction:{type:'object',description:'Schema1 direction. New projects use chosenGroups:[]; preserve the conversation subject and medium.'},message:{type:'string',maxLength:2000},owner:{type:'string',maxLength:200,description:'Actual chat/task identifier when available; never another task.'}},['direction']),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
 {name:'read_choices',description:'Read latest values from this specific local session. While choosing these are provisional; only done is final. ignored is not permission to use partial choices.',inputSchema:input({id:sid},['id']),annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'wait_choices',description:'Wait up to55seconds for a revision or Done/Ignore in the site. A timeout returns choosing and is never approval. Continue waiting while the user is choosing; do not render or guess.',inputSchema:input({id:sid,afterRevision:{type:'integer',minimum:0},timeoutMs:{type:'integer',minimum:0,maximum:55000}},['id']),annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'ask_choices',description:'After making the page available, request native chat Done/Ignore through MCP form elicitation if this client supports it. Falls back to host-question instructions without pretending a question was displayed. This does not launch a browser or generation.',inputSchema:input({id:sid},['id']),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
 {name:'finish_choices',description:'Record an explicit user Done or Ignore from this chat. Never call based on timeout, preset defaults, page load or model inference. Done validates and returns the latest saved choices/instructions; Ignore skips this step without creating a build.',inputSchema:input({id:sid,decision:{type:'string',enum:['done','ignore']},revision:{type:'integer',minimum:0}},['id','decision','revision']),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}}
];
function chatQuestion(session){return {question:`Choose the creative direction at ${base}/?choice=${session.id}#direction, then choose Done or Ignore.`,options:['Done','Ignore'],meaning:{Done:'Use the final choices and continue the existing task.',Ignore:'Skip this choice step and use the original conversation context.'}};}
function terminal(session){return ['done','ignored'].includes(session.status);}
async function settledDraft(route,initial,signal){
 let previous=initial,stable=0;
 // One unchanged read can precede a delayed blur/autosave request. Require a
 // quiet window across several reads, and restart it whenever a save arrives.
 // This still observes server-saved data only; offline browser text is unknown.
 for(let attempt=0;attempt<10;attempt++){
  await new Promise((resolve,reject)=>{if(signal?.aborted){reject(Error('Choice confirmation cancelled.'));return;}const aborted=()=>{clearTimeout(timer);reject(Error('Choice confirmation cancelled.'));},timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);resolve();},400);signal?.addEventListener('abort',aborted,{once:true});});
  const current=await api(route,undefined,signal);if(terminal(current))return current;
  stable=current.revision===previous.revision?stable+1:0;
  if(stable>=3)return current;previous=current;
 }
 throw Error('The page is still saving choices. Wait for Saved or choose Done on the page, then read the latest session.');
}
async function askForm(params,signal){
 const id='fieldwork-question-'+(++nextId);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);signal?.removeEventListener('abort',onAbort);emit({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:id,reason:'Question wait ended without a submitted answer.'}});reject(Error('Chat question remains unanswered; the session is still choosing.'));},55000);
  const onAbort=()=>{clearTimeout(timer);pending.delete(id);emit({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:id,reason:'The choice step ended or the requesting tool was cancelled.'}});reject(Error('Chat question cancelled; no choice was submitted.'));};
  if(signal?.aborted){onAbort();return;}
  signal?.addEventListener('abort',onAbort,{once:true});
  pending.set(id,{resolve:value=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);resolve(value);},reject:error=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);reject(error);}});
  emit({jsonrpc:'2.0',id,method:'elicitation/create',params});
 });
}
async function call(name,args,signal){
 if(name==='start_choices'){const session=await api('/api/choices',args,signal);return result({...session,url:base+'/?choice='+session.id+'#direction',chatQuestion:chatQuestion(session),instructions:'Keep this session ID with this chat. Offer/open the local page using the host UI. Wait for Done or Ignore, then read the server snapshot. Do not copy choices manually or start a build before this selection step ends.'});}
 const route=sessionPath(args.id);
 if(name==='read_choices')return result(await api(route,undefined,signal));
 if(name==='wait_choices'){
  if(args.timeoutMs!==undefined&&(!Number.isInteger(args.timeoutMs)||args.timeoutMs<0||args.timeoutMs>55000))throw Error('timeoutMs must be0–55000.');
  if(args.afterRevision!==undefined&&(!Number.isInteger(args.afterRevision)||args.afterRevision<0))throw Error('afterRevision must be a nonnegative integer.');
  return result(await api(route+'/wait?'+new URLSearchParams({afterRevision:String(args.afterRevision??0),timeoutMs:String(args.timeoutMs??55000)}),undefined,signal));
 }
 if(name==='finish_choices'){
  if(!['done','ignore'].includes(args.decision)||!Number.isInteger(args.revision)||args.revision<0)throw Error('Use explicit done/ignore and the latest nonnegative revision.');
  return result(await api(route+'/'+args.decision,{revision:args.revision},signal));
 }
 if(name==='ask_choices'){
  const session=await api(route,undefined,signal);if(terminal(session))return result(session);
  const elicitation=clientCapabilities.elicitation,supportsForm=elicitation&&typeof elicitation==='object'&&(Object.hasOwn(elicitation,'form')||Object.keys(elicitation).length===0);
  if(!supportsForm)return result({id:session.id,status:session.status,nativeQuestionDisplayed:false,chatQuestion:chatQuestion(session),instructions:'Use your host native user-input tool with Done and Ignore. On an explicit response, call finish_choices with the latest revision. If no host question tool exists, give the link and wait for a user reply. Never claim native buttons were shown.'});
  let answer;const interaction=new AbortController(),cancel=()=>interaction.abort();signal?.addEventListener('abort',cancel,{once:true});
  try{
   const form=askForm({mode:'form',message:chatQuestion(session).question,requestedSchema:{type:'object',properties:{decision:{type:'string',title:'Continue',enum:['Done','Ignore']}},required:['decision']}},interaction.signal).then(value=>({answer:value}));
   const page=(async()=>{let latest=session;while(!terminal(latest))latest=await api(route+'/wait?'+new URLSearchParams({afterRevision:String(latest.revision),timeoutMs:'50000'}),undefined,interaction.signal);return {session:latest};})();
   const completion=await Promise.race([form,page]);if(completion.session)return result(completion.session);answer=completion.answer;
  }catch(error){if(signal?.aborted)throw error;const latest=await api(route,undefined,signal);if(terminal(latest))return result(latest);return result({id:session.id,status:latest.status,nativeQuestionDisplayed:true,unanswered:true,message:error.message});}
  finally{signal?.removeEventListener('abort',cancel);interaction.abort();}
  let latest=await api(route,undefined,signal);if(terminal(latest))return result(latest);
  if(answer?.action==='accept'&&['Done','Ignore'].includes(answer.content?.decision)){
   if(answer.content.decision==='Done')latest=await settledDraft(route,latest,signal);
   if(terminal(latest))return result(latest);
   return result(await api(route+'/'+(answer.content.decision==='Done'?'done':'ignore'),{revision:latest.revision},signal));
  }
  return result({id:session.id,status:latest.status,nativeQuestionDisplayed:true,questionDismissed:true,instructions:'No Done/Ignore selection was submitted. Keep the step pending or wait for an explicit user response.'});
 }
 throw Error('Unknown Fieldwork tool.');
}
async function handle(message){
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||(message.method!==undefined&&typeof message.method!=='string')){
  emit({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid JSON-RPC request.'}});return;
 }
 if(message.id!==undefined&&!message.method){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}return;}
 if(message.method==='notifications/cancelled'){aborters.get(message.params?.requestId)?.abort();return;}
 if(message.id===undefined)return;
 const id=message.id,reply=value=>emit({jsonrpc:'2.0',id,result:value}),error=(code,text)=>emit({jsonrpc:'2.0',id,error:{code,message:text}});
 try{
  if(message.method==='initialize'){if(initialized){error(-32600,'Already initialized.');return;}initialized=true;clientCapabilities=message.params?.capabilities||{};const offered=message.params?.protocolVersion;reply({protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(offered)?offered:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fieldwork-choices',version:'0.3.1'},instructions:'Start a scoped choice session, make its URL available, ask Done/Ignore and wait/read the final snapshot. No browser launches or model calls occur in this server.'});return;}
  if(!initialized){error(-32002,'Initialize first.');return;}
  if(message.method==='ping'){reply({});return;}
  if(message.method==='tools/list'){reply({tools});return;}
  if(message.method!=='tools/call'){error(-32601,'Method not found.');return;}
  if(!tools.some(t=>t.name===message.params?.name)){error(-32602,'Unknown tool.');return;}
  const aborter=new AbortController();aborters.set(id,aborter);
  try{reply(await call(message.params.name,message.params.arguments||{},aborter.signal));}
  catch(err){reply({content:[{type:'text',text:err.message}],isError:true});}
  finally{aborters.delete(id);}
 }catch(err){error(-32603,err.message);}
}
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{try{void handle(JSON.parse(line));}catch{emit({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON.'}});}});
lines.on('close',()=>{for(const a of aborters.values())a.abort();for(const p of pending.values())p.reject(Error('MCP transport closed.'));pending.clear();if(server)server.close();});
