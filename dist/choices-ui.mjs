import {normalize,compilePrompt,compileGeneratorPrompt} from './core.mjs';

// One explicit choice session. The server owns the revision and terminal decision;
// local edits are never interpreted as Done and cannot overwrite a newer tab.
export function createChoiceSession({id,getState,adopt,cacheKey,onUpdate}){
  let session=null,error='',loading=true,busy=false,conflict=false,timer,pollTimer,inflight=null,edit=0,savedEdit=0,closed=false,recovery=null;
  const path='/api/choices/'+encodeURIComponent(id);
  const emit=()=>onUpdate?.();
  async function request(url,body){
    const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Fieldwork-Request':'1'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({error:'The local server returned an unreadable response.'}));
    if(!response.ok)throw Object.assign(Error(typeof data.error==='string'?data.error:'The choice request failed.'),{status:response.status});
    return data;
  }
  const snapshot=()=>normalize(getState(),true);
  function accept(next,{replace=false}={}){
    session=next;closed=next.status!=='choosing';
    if(closed){window.removeEventListener('blur',flushOnLeave);document.removeEventListener('visibilitychange',flushOnHidden);}
    if(replace&&next.direction){adopt(normalize(next.direction,true));edit=0;savedEdit=0;}
    emit();
  }
  function failure(reason){error=reason.message||String(reason);if(reason.status===409){conflict=true;error+=' Load the latest choices before editing again; your draft is kept in this browser.';}emit();}
  async function load(){
    clearTimeout(timer);clearTimeout(pollTimer);loading=true;emit();
    try{
      const next=await request(path);let cached;
      try{const value=JSON.parse(localStorage.getItem(cacheKey)||'null');if(value)cached=normalize(value,true);}catch{}
      if(next.status==='choosing'&&cached&&JSON.stringify(cached)!==JSON.stringify(next.direction)){
        recovery=cached;try{localStorage.setItem(cacheKey+'.recovery',JSON.stringify(recovery));}catch{}
      }
      accept(next,{replace:true});error='';conflict=false;loading=false;emit();schedulePoll();return next;
    }
    catch(reason){loading=false;failure(reason);return null;}
  }
  function changed(){
    if(loading||closed||conflict||!session)return;
    edit++;error='';clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),300);emit();
  }
  async function flush(){
    clearTimeout(timer);
    if(inflight){await inflight;if(edit!==savedEdit&&!closed&&!conflict)return flush();return;}
    if(loading||closed||!session||conflict||edit===savedEdit)return;
    const sequence=edit,direction=snapshot(),revision=session.revision;
    inflight=(async()=>{
      try{const next=await request(path+'/save',{direction,revision});savedEdit=sequence;accept(next);error='';}
      catch(reason){failure(reason);throw reason;}
      finally{inflight=null;emit();}
    })();
    await inflight;
    if(edit!==savedEdit&&!closed&&!conflict)return flush();
  }
  async function done(){
    if(busy||loading||closed||conflict||!session)return;
    const invalid=document.querySelector('#main [aria-invalid="true"]');
    if(invalid){error='Correct the marked field before sending your choices.';emit();invalid.focus();return;}
    let direction;
    try{
      direction=snapshot();if(!direction.subject.trim())throw Error('Describe the subject before sending your choices.');
      for(const [draft,basis,compile] of [['promptDraft','promptBasis',compilePrompt],['generatorDraft','generatorBasis',compileGeneratorPrompt]]){
        const generated=compile(direction);
        if(direction[draft]&&direction[basis]!==generated){
          if(direction[draft]===direction[basis]){direction[draft]=generated;direction[basis]=generated;}
          else throw Error('Your edited prompt predates these choices. Open Build & review and reconcile or regenerate it before Done.');
        }
      }
      adopt(direction);changed();
    }catch(reason){failure(reason);return;}
    busy=true;emit();
    try{await flush();if(conflict)return;const next=await request(path+'/done',{direction:snapshot(),revision:session.revision});accept(next,{replace:true});error='';clearTimeout(pollTimer);}
    catch(reason){failure(reason);}
    finally{busy=false;emit();}
  }
  async function ignore(){
    if(busy||loading||closed||!session)return;
    busy=true;clearTimeout(timer);emit();
    try{if(inflight)await inflight.catch(()=>{});const next=await request(path+'/ignore',{revision:session.revision});accept(next);error='';clearTimeout(pollTimer);}
    catch(reason){failure(reason);}
    finally{busy=false;emit();}
  }
  async function reload(){
    if(busy)return;
    try{localStorage.setItem(cacheKey+'.conflict',JSON.stringify(getState()));}catch{}
    await load();
  }
  function restoreLocal(){
    if(!recovery||!canEdit())return;
    const next=recovery;recovery=null;adopt(next);changed();emit();
  }
  async function poll(){
    if(document.hidden||loading||busy||closed||!session){schedulePoll();return;}
    try{
      const latest=await request(path);
      if(latest.status!=='choosing'){accept(latest,{replace:true});error='';clearTimeout(timer);emit();return;}
      if(latest.revision!==session.revision&&!inflight){
        if(edit!==savedEdit){conflict=true;error='Choices changed in another tab. Load the latest choices; your draft is kept in this browser.';emit();}
        else accept(latest,{replace:true});
      }
    }catch(reason){if(reason.status===404)failure(reason);}
    schedulePoll();
  }
  function schedulePoll(){clearTimeout(pollTimer);if(!closed)pollTimer=setTimeout(poll,3000);}
  function view(){return {session,error,loading,busy,conflict,closed,dirty:edit!==savedEdit,saving:!!inflight,recoverable:!!recovery&&!closed};}
  function canEdit(){return !loading&&!busy&&!closed&&!conflict&&!!session;}
  // Moving from the page back to the chat sends the pending draft promptly.
  // This is only a draft save; losing focus never means Done or Ignore.
  const flushOnLeave=()=>{if(canEdit())flush().catch(()=>{});};
  const flushOnHidden=()=>{if(document.hidden)flushOnLeave();};
  window.addEventListener('blur',flushOnLeave);
  document.addEventListener('visibilitychange',flushOnHidden);
  return {load,changed,flush,done,ignore,reload,restoreLocal,view,canEdit};
}
