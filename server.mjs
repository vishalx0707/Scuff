import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createJobStore} from './job-store.mjs';
import {createChoiceStore} from './choice-store.mjs';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const {version}=JSON.parse(await readFile(new URL('./package.json',import.meta.url),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4'};
const json=(res,status,body,head=false)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(head?undefined:JSON.stringify(body));};
const bad=(text,status=400)=>Object.assign(new Error(text),{status});
function localHost(host){return /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(host||'');}
function mutationAllowed(req){
  if(req.headers['x-fieldwork-request']!=='1')throw bad('Use the local Fieldwork request header.',403);
  if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw bad('Invalid request origin.',403);}if(origin.protocol!=='http:'||origin.host!==req.headers.host||!localHost(origin.host))throw bad('Only the local workspace can submit this request.',403);}
  if(req.headers['sec-fetch-site']&& !['same-origin','none'].includes(req.headers['sec-fetch-site']))throw bad('Only the local workspace can submit this request.',403);
}
function readBody(req,limit){return new Promise((resolve,reject)=>{const chunks=[];let length=0,failed=false;req.on('data',chunk=>{length+=chunk.length;if(length>limit){if(!failed){failed=true;reject(bad('Request exceeds the local size limit.',413));}return;}if(!failed)chunks.push(chunk);});req.on('end',()=>{if(!failed)resolve(Buffer.concat(chunks));});req.on('error',reject);});}
async function sendFile(req,res,file,type,name){
  const info=await stat(file);if(!info.isFile())throw bad('Not found.',404);
  const headers={'Content-Type':type||mime[path.extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes'};
  if(name)headers['Content-Disposition']=(/^(image\/(png|jpeg|webp|gif)|audio\/|video\/)/.test(headers['Content-Type'])?'inline':'attachment')+`; filename*=UTF-8''${encodeURIComponent(name)}`;
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match)throw bad('Unsupported byte range.',416);start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),info.size-1):end;if(start>end||start>=info.size)throw bad('Byte range is outside this file.',416);status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
  headers['Content-Length']=String(Math.max(0,end-start+1));res.writeHead(status,headers);
  if(req.method==='HEAD'||info.size===0){res.end();return;}createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
}
export function createServer({storeRoot}={}){const store=createJobStore(storeRoot),choices=createChoiceStore(storeRoot);return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  // Codex's preview annotation overlay injects styles into a shadow root and positions elements inline.
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
    if(!localHost(req.headers.host))throw bad('Use the local workspace address.',403);
    const url=new URL(req.url,'http://'+req.headers.host),head=req.method==='HEAD';
    if(url.pathname==='/health'&&['GET','HEAD'].includes(req.method)){json(res,200,{ok:true,app:'Scuff',version,choiceSessions:true},head);return;}
    if(url.pathname.startsWith('/api/')){
      if(req.method==='POST')mutationAllowed(req);
      const jobRoute=/^\/api\/jobs\/([^/]+)$/.exec(url.pathname),referenceRoute=/^\/api\/references\/([^/]+)\/file$/.exec(url.pathname),artifactRoute=/^\/api\/jobs\/([^/]+)\/artifacts\/([^/]+)$/.exec(url.pathname);
      const choiceRoute=/^\/api\/choices\/([^/]+)(?:\/(save|done|ignore|wait))?$/.exec(url.pathname);
      if(['GET','HEAD'].includes(req.method)){
        if(url.pathname==='/api/capabilities'){json(res,200,{version,queue:true,choiceSessions:true,automaticExecution:false,referenceUpload:true,referenceImageMaxBytes:20*1024*1024,referenceAudioMaxBytes:40*1024*1024,execution:'A separately connected agent claims queued work and reports inspected output.'},head);return;}
        if(choiceRoute&&!choiceRoute[2]){json(res,200,await choices.get(choiceRoute[1]),head);return;}
        if(choiceRoute?.[2]==='wait'){
          const controller=new AbortController(),closed=()=>controller.abort();res.on('close',closed);
          try{const after=url.searchParams.get('afterRevision'),timeout=url.searchParams.get('timeoutMs');const session=await choices.wait(choiceRoute[1],{afterRevision:after===null?undefined:Number(after),timeoutMs:head?0:timeout===null?55000:Number(timeout),signal:controller.signal});if(!res.destroyed)json(res,200,session,head);}finally{res.off('close',closed);}return;
        }
        if(url.pathname==='/api/references'){json(res,200,await store.listReferences(),head);return;}
        if(url.pathname==='/api/jobs'){json(res,200,await store.listJobs(),head);return;}
        if(jobRoute){json(res,200,await store.getJob(jobRoute[1]),head);return;}
        if(referenceRoute){const ref=await store.getReference(referenceRoute[1]);await sendFile(req,res,ref.path,ref.mime,ref.name);return;}
        if(artifactRoute){const artifact=await store.getArtifact(artifactRoute[1],artifactRoute[2]);await sendFile(req,res,artifact.path,null,artifact.name);return;}
      }
      if(req.method==='POST'&&(url.pathname==='/api/choices'||(choiceRoute&&['save','done','ignore'].includes(choiceRoute[2])))){
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw bad('Send the choice request as JSON.',415);
        const body=await readBody(req,2097152);let payload;try{payload=JSON.parse(body.toString('utf8'));}catch{throw bad('This request is not valid JSON.');}
        if(!payload||typeof payload!=='object'||Array.isArray(payload))throw bad('Send a choice request object.');
        const session=url.pathname==='/api/choices'?await choices.create(payload):await choices[choiceRoute[2]==='save'?'update':choiceRoute[2]](choiceRoute[1],payload);
        json(res,url.pathname==='/api/choices'?201:200,session);return;
      }
      if(req.method==='POST'&&url.pathname==='/api/references'){
        const body=await readBody(req,40*1024*1024);let name;try{name=decodeURIComponent(req.headers['x-file-name']||'');}catch{throw bad('Invalid reference filename.');}
        const ref=await store.uploadReference({name,role:req.headers['x-reference-role'],mime:req.headers['content-type'],buffer:body});json(res,201,ref);return;
      }
      if(req.method==='POST'&&url.pathname==='/api/jobs'){
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw bad('Send the direction as JSON.',415);
        const body=await readBody(req,2097152);let payload;try{payload=JSON.parse(body.toString('utf8'));}catch{throw bad('This request is not valid JSON.');}json(res,201,await store.createJob(payload?.direction));return;
      }
      throw bad('Local API route or method was not found.',404);
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
    const decoded=decodeURIComponent(url.pathname),file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html'))throw bad('Forbidden.',403);
    await sendFile(req,res,file);
  }catch(error){if(res.destroyed)return;const status=error.status||(error.code==='ENOENT'?404:400);if(res.headersSent){res.destroy();return;}json(res,status,{error:error.code==='ENOENT'?'Not found.':error.message||'Invalid request.'},req.method==='HEAD');}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.FIELDWORK_PORT||process.argv[2]||8787);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port from 1024 to 65535.');
  const server=createServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Try: node server.mjs ${port+1}`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Scuff ${version} is ready: http://127.0.0.1:${port}\nQueued work needs a connected agent; no model runs automatically.\nKeep this process running while using the workspace. Press Ctrl+C to stop.`));
}
