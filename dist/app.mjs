import {catalog,defaults,find} from './presets.mjs';
import {normalize,freshDirection,effectiveCamera,effectiveResearch,effectiveOutput,numberLimits,compilePrompt,compileGeneratorPrompt,createStyle,applyStyle,referenceSearch,exportBrief,safeFileName,paletteFor,paletteKeys} from './core.mjs';
import {research} from './workflows.mjs';
import {exampleFor,exampleNote} from './examples.mjs';
import {createChoiceSession} from './choices-ui.mjs';

const $=id=>document.getElementById(id);
const choiceId=new URL(location.href).searchParams.get('choice'),choicePrefix=choiceId?'fieldwork.choice.'+choiceId:null;
const storageKey=choicePrefix||'fieldwork.direction.v1',looksKey=choicePrefix?choicePrefix+'.looks':'fieldwork.looks.v1',stylesKey=choicePrefix?choicePrefix+'.styles':'fieldwork.styles.v1',jobKey=choicePrefix?choicePrefix+'.job':'fieldwork.job.v1';
const chapters=[['direction','Direction'],['language','Language'],['camera','Camera direction'],['light','Light & color'],['surface','Surface & detail']];
const headings={language:'Language',camera:'Camera direction',light:'Light & color',surface:'Surface & detail',direction:'Direction',handoff:'Build & review',journal:'Review journal'};
const media=[['general','General'],['blender','Blender'],['image','Image generation'],['video','Video generation']];
const recipes={
  dreamy:{lens:'50',angle:'threequarter',focus:'balanced',composition:'space',lighting:'soft',atmosphere:'haze',palette:'butter',material:'clay',finish:'clean'},
  brutalist:{lens:'24',angle:'low',focus:'deep',composition:'center',lighting:'hard',atmosphere:'clear',palette:'mono',material:'pbr',finish:'raw'},
  cyberpunk:{lens:'35',angle:'low',focus:'balanced',composition:'frame',lighting:'neon',atmosphere:'haze',palette:'cyan',material:'worn',finish:'bloom'},
  maximalist:{lens:'35',angle:'high',focus:'deep',composition:'thirds',lighting:'soft',atmosphere:'clear',palette:'plum',material:'pbr',finish:'clean'},
  tactile:{lens:'85',angle:'eye',focus:'balanced',composition:'center',lighting:'soft',atmosphere:'clear',palette:'sand',material:'clay',finish:'film'},
  graphic:{lens:'ortho',angle:'isometric',focus:'deep',composition:'center',lighting:'hard',atmosphere:'clear',palette:'butter',material:'pbr',finish:'clean'}
};
const detailOptions=[['sparse','Sparse','A few purposeful details.'],['balanced','Balanced','A focal area with quiet surroundings.'],['intricate','Intricate','Layered details in a controlled hierarchy.']];
const outcomes={pending:'Awaiting review',improved:'Improved',mixed:'Mixed result',rejected:'Rejected revision'};
let state=freshDirection('general'),saved=[],styles=[],undo,toastTimer,currentPage='',restoreWarning='',saveProblem=false,jobTimer,jobPolls=0;
let choiceSession=null;
const openPanels=new Set(),statuses=new Map(),unreadable={};

// Restore leniently: one unrecognized option (for example after the presets change) must not wipe a whole
// direction or every saved look. The untouched original is set aside as "<key>.unreadable" before the first overwrite.
function readStored(key){try{return localStorage.getItem(key);}catch{return null;}}
function parse(raw){try{return JSON.parse(raw);}catch{return null;}}
const rawDirection=readStored(storageKey),rawLooks=readStored(looksKey);
const rawStyles=readStored(stylesKey);
if(rawStyles){const data=parse(rawStyles);if(Array.isArray(data)){styles=data.slice(0,50).filter(s=>s?.kind==='fieldwork-style'&&s.settings&&typeof s.name==='string');if(styles.length!==data.length){unreadable[stylesKey]=rawStyles;restoreWarning+='Some saved styles could not be read. The original record is kept. ';}}else{unreadable[stylesKey]=rawStyles;restoreWarning+='Saved styles could not be read. ';}}
if(rawDirection){
  const data=parse(rawDirection);
  try{state=normalize(data,true);}catch{
    unreadable[storageKey]=rawDirection;
    try{state=normalize(data);restoreWarning='Some settings in the previous direction were not recognized and were reset. ';}
    catch{restoreWarning='The previous direction could not be restored. ';}
  }
}
if(rawLooks){
  const list=parse(rawLooks);
  if(!Array.isArray(list)){unreadable[looksKey]=rawLooks;restoreWarning+='Saved looks could not be read. The original record is kept in this browser.';}
  else{
    let partial=list.length>50;
    saved=list.slice(0,50).flatMap(look=>{try{return [normalize(look,true)];}catch{partial=true;try{return [normalize(look)];}catch{return [];}}});
    if(partial){unreadable[looksKey]=rawLooks;restoreWarning+='Some saved looks had unrecognized settings. The original record is kept in this browser.';}
  }
}
function keepAside(key){if(!(key in unreadable))return;try{localStorage.setItem(key+'.unreadable',unreadable[key]);delete unreadable[key];}catch{}}

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function button(text,cls,action){const node=el('button',cls,text);node.type='button';node.addEventListener('click',action);return node;}
function link(text,href,cls){const node=el('a',cls,text);node.href=href;return node;}
function notify(message,restore){clearTimeout(toastTimer);const dialog=document.querySelector('dialog[open]');(dialog||document.body).append($('toast'));$('toast-text').textContent=message;undo=restore||null;$('undo-button').hidden=!undo;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;undo=null;},restore?18000:6500);}
function setSaveProblem(on){saveProblem=on;const status=$('save-status');status.textContent=on?'Not saved: export a copy':'Saved on this computer';status.classList.toggle('problem',on);}
function store(){keepAside(storageKey);try{localStorage.setItem(storageKey,JSON.stringify(state));if(saveProblem)setSaveProblem(false);return true;}catch{if(!saveProblem){setSaveProblem(true);notify('Browser storage is unavailable or full. Export your direction from Looks & files to keep this work.');}return false;}}
function storeLooks(){keepAside(looksKey);try{localStorage.setItem(looksKey,JSON.stringify(saved));return true;}catch{notify('Saved looks could not be stored. Export a JSON copy instead.');return false;}}
function commit(patch){if(choiceSession&&!choiceSession.canEdit())return;state=normalize({...state,...patch});store();choiceSession?.changed();refreshChrome();}
function replaceState(next,message){if(choiceSession&&!choiceSession.canEdit())return;const before=state;state=normalize(next,true);store();choiceSession?.changed();renderPage(true);notify(message,()=>{if(choiceSession&&!choiceSession.canEdit())return;state=before;store();choiceSession?.changed();renderPage(true);notify('Previous direction restored.');});}
function refreshChrome(){
  const hasSubject=!!state.subject.trim(),need=$('subject-needed'),open=$('open-handoff');
  if(need)need.hidden=hasSubject;if(open)open.disabled=!hasSubject||!!document.querySelector('#main input[aria-invalid="true"]');
  $('current-name').textContent=state.name;
  $('workflow-medium').value=state.medium;
  for(const [node,read] of statuses)node.textContent=read();
  refreshResearch();
  updateChoiceBar();
}
function route(){const [page,target]=(location.hash.slice(1)||'direction').split('/');return {page:Object.hasOwn(headings,page)?page:'direction',target};}
function go(page){if(location.hash==='#'+page)renderPage();else location.hash=page;}
function mount(parent,...nodes){parent.append(...nodes);return parent;}
const grid=(...fields)=>mount(el('div','form-grid'),...fields);
function section(title,id){const area=el('section','section');if(id)area.id=id;area.append(el('h2',null,title));return area;}
// Collapsible optional content. Open state survives re-renders for the session; the status line stays live.
function panel(id,title,status,...content){
  const box=el('details','panel'),summary=el('summary'),body=el('div','panel-body');
  box.id=id;box.open=openPanels.has(id);summary.append(el('span','panel-title',title));
  if(status){const note=el('span','panel-status',status());statuses.set(note,status);summary.append(note);}
  body.append(...content);box.append(summary,body);
  box.addEventListener('toggle',()=>{if(box.open)openPanels.add(id);else openPanels.delete(id);});
  return box;
}
const written=keys=>()=>{const count=keys.filter(k=>String(state[k]??'').trim()).length;return count?count+' of '+keys.length+' written':'';};
const chosen=key=>state.chosenGroups.includes(key);
function choose(patch,...keys){commit({...patch,chosenGroups:[...new Set([...state.chosenGroups,...keys])]});}
function textField(key,label,{placeholder='',rows=3,max=2000,full=false,large=false}={}){
  const wrap=el('div','field'+(full?' full':'')+(large?' large-field':'')),name=el('label',null,label),input=el(rows?'textarea':'input');
  input.id='field-'+key;name.htmlFor=input.id;input.value=state[key]??'';input.maxLength=max;if(rows)input.rows=rows;input.placeholder=placeholder;
  input.addEventListener('input',()=>commit({[key]:input.value}));wrap.append(name,input);return wrap;
}
function selectField(key,label,options,onChange,value=state[key]){const wrap=el('div','field'),name=el('label',null,label),input=el('select');input.id='setting-'+key;name.htmlFor=input.id;options.forEach(([v,t])=>{const option=el('option',null,t);option.value=v;input.append(option);});input.value=value;input.addEventListener('change',()=>{commit({[key]:input.value});onChange?.(input.value);});wrap.append(name,input);return wrap;}
function numberField(key,label){
  const limits=numberLimits[key],wrap=el('div','field'),name=el('label',null,label),input=el('input'),error=el('p','field-error');
  input.type='number';input.id='field-'+key;name.htmlFor=input.id;input.min=limits.min;input.max=limits.max;input.step=limits.integer?'1':'any';input.value=state[key]??'';input.placeholder='Choose during build';error.id='error-'+key;error.setAttribute('aria-live','polite');input.setAttribute('aria-describedby',error.id);
  input.addEventListener('input',()=>{
    const value=input.value===''&&!input.validity.badInput?null:input.valueAsNumber;
    if(value!==null&&(!Number.isFinite(value)||value<limits.min||value>limits.max||(limits.integer&&!Number.isInteger(value)))){
      error.textContent=`Not saved. Enter ${limits.integer?'a whole number':'a number'} from ${limits.min} to ${limits.max}, or clear this field.`;input.setAttribute('aria-invalid','true');refreshChrome();return;
    }
    error.textContent='';input.removeAttribute('aria-invalid');commit({[key]:value});
  });wrap.append(name,input,error);return wrap;
}
function researchSelect(key,label){return selectField(key,label,research[key].options.map(o=>[o.id,o.label]));}
function researchFeedback(id,areas){const box=el('div','research-feedback');box.id=id;box.dataset.areas=areas.join(',');return box;}
function refreshResearch(){
  const status=effectiveResearch(state);
  const short={lens:`Your ${status.projection==='ORTHO'?'orthographic camera':find('lens',state.lens).label+' lens'} stays selected. The capture style adapts to it.`,viewpoint:'Your chosen viewpoint stays selected.',lighting:'Your chosen lighting stays selected; any capture light is a separate adjustable addition.',aspect:'Your frame shape stays selected.',finish:'Keep a clean master. Capture effects belong in a separate version.',event:'Name the event that motivates this camera movement.',fog:'Keep fog in the distance so the subject still has clear air.',references:'Add the actual source links or paths for these reference roles.',focus:'Test the focus change with the selected focus treatment.',operator:status.projection==='ORTHO'?'This movement has limited depth cues with an orthographic camera. Check its adaptation in the prompt.':'Check this movement with the selected projection in a preview.'};
  document.querySelectorAll('.research-feedback').forEach(box=>{const areas=box.dataset.areas.split(','),notes=status.conflicts.filter(c=>areas.includes(c.area));box.replaceChildren(...notes.map(c=>el('p',null,short[c.area]||c.text)));box.hidden=!notes.length;});
  const nature=$('nature-fields');if(nature)nature.hidden=state.workflow!=='nature';
  const shot=$('shot-fields'),still=$('shot-still-note');if(shot)shot.hidden=effectiveOutput(state)!=='animation';if(still)still.hidden=effectiveOutput(state)==='animation';
  const hint=$('capture-hint');if(hint)hint.textContent=research.captureStyle.options.find(o=>o.id===state.captureStyle).hint;
  const opHint=$('operator-hint');if(opHint)opHint.textContent=research.cameraOperator.options.find(o=>o.id===state.cameraOperator).hint;
}
function capturePanel(){return panel('capture','Capture style',()=>research.captureStyle.options.find(o=>o.id===state.captureStyle).label,researchSelect('captureStyle','Capture'),el('p','segment-hint',''),researchFeedback('capture-feedback',['lens','viewpoint','lighting','aspect','finish']));}
function naturePanel(){
  const fields=el('div','form-grid');fields.id='nature-fields';fields.append(numberField('natureTerrainM','Terrain width (metres)'),numberField('natureScatterMax','Maximum foliage instances'),numberField('natureSeed','Scatter seed'),researchSelect('natureFog','Fog treatment'),textField('natureFoliage','Vegetation',{max:2000,full:true,placeholder:'Grass height, color variation, clumps, bare ground and which plants belong near the camera.'}),textField('natureExclusions','Scatter exclusions',{max:2000,full:true,placeholder:'Paths, a clearing around the subject, water edges and the whole camera path.'}),researchFeedback('nature-feedback',['fog']));
  return panel('nature','Nature environment',()=>state.workflow==='nature'?'Enabled':'Optional',researchSelect('workflow','Scene workflow'),fields);
}
function shotPanel(){
  const fields=el('div','form-grid');fields.id='shot-fields';
  const hint=el('p','segment-hint');hint.id='operator-hint';
  fields.append(numberField('animationSeconds','Duration (seconds)'),numberField('animationFps','Frames per second'),operatorChoices(),textField('animationEvent','Action & timing',{max:1000,full:true,placeholder:'The event the camera responds to.'}),textField('animationRecovery','Recovery',{max:1000,full:true,placeholder:'How framing, focus and exposure settle.'}),textField('operatorTiming','Combined movement',{full:true,placeholder:'Handheld throughout; zoom on the reveal; briefly miss focus, then recover.'}),operatorBeats(),researchFeedback('shot-feedback',['operator','focus','event']));
  const note=el('p','segment-hint','Choose Animation in Format & scope to plan a shot. Stored shot settings are retained when you switch to a still.');note.id='shot-still-note';
  return panel('shot','Shot & motion',()=>effectiveOutput(state)==='animation'?(state.animationSeconds?state.animationSeconds+' seconds':'Animation'):'For animation',note,fields);
}
// A short visible choice row; native radios keep arrow-key behavior.
function segmented(key,legend,options,onChange){
  const set=el('fieldset','segmented'),row=el('div','segments');set.id='setting-'+key;set.append(el('legend','sr-only',legend));
  for(const [value,text] of options){const item=el('label'),input=el('input');input.type='radio';input.name='setting-'+key;input.id='setting-'+key+'-'+value;input.value=value;input.checked=state[key]===value;input.addEventListener('change',()=>{commit({[key]:value});onChange?.(value);});item.append(input,el('span',null,text));row.append(item);}
  set.append(row);return set;
}
function choiceNote(group){
  const option=find(group,state[group]),key=group+':'+state[group],note=()=>state.judgments[key]||state.judgments[group]||'';
  const label=el('label',null,'Your note on '+option.label),input=el('textarea');
  input.id='note-'+group;label.htmlFor=input.id;input.rows=2;input.maxLength=2000;input.value=note();input.placeholder='What should we borrow, change, or be careful about?';
  input.addEventListener('input',()=>commit({judgments:{...state.judgments,[key]:input.value}}));
  const box=panel('more-'+group,option.label+': details & note',()=>note().trim()?'Note added':'',el('p','choice-direction',option.direction),label,input);
  box.classList.add('note-panel');return box;
}

function examplePreview(group,id,label,hint=''){
  const figure=el('figure','example-preview'),frame=el('div','example-frame'),tile=el('div','example-tile'),image=el('img','example-image'),status=el('p','example-status','Loading example…'),caption=el('figcaption','example-caption'),heading=el('div','example-heading'),selected=el('strong','example-selected',label),kind=el('span','example-kind','Example · AI variation'),description=el('p','example-description',hint),note=el('p','example-note',exampleNote(group,id));
  figure.dataset.exampleGroup=group;figure.dataset.exampleOption=id;
  frame.setAttribute('aria-busy','true');image.alt=`AI example: ${label}.`;image.decoding='async';image.draggable=false;image.hidden=true;status.setAttribute('role','status');
  heading.append(selected,kind);caption.append(heading,description,note);tile.append(image);frame.append(tile,status);figure.append(frame,caption);
  const asset=exampleFor(group,id);
  if(!asset){status.textContent='Example unavailable.';frame.setAttribute('aria-busy','false');return figure;}
  image.alt=`${asset.scene}. AI example: ${label}.`;kind.title=asset.scene+'; an example scene, not a preview of your subject.';
  const source=link('Reference ↗',asset.referenceUrl,'example-source');source.target='_blank';source.rel='noopener noreferrer';source.setAttribute('aria-label','Pinterest reference for '+(catalog[group]?.label||'Detail'));caption.append(source);
  image.style.width=(asset.columns*100)+'%';image.style.height=(asset.rows*100)+'%';image.style.left=(-asset.column*100)+'%';image.style.top=(-asset.row*100)+'%';
  image.addEventListener('load',()=>{const ratio=(image.naturalWidth/asset.columns)/(image.naturalHeight/asset.rows),frameRatio=1.5,width=Math.min(100,100*ratio/frameRatio),height=Math.min(100,100*frameRatio/ratio);tile.style.width=width+'%';tile.style.height=height+'%';tile.style.left=(100-width)/2+'%';tile.style.top=(100-height)/2+'%';image.hidden=false;status.hidden=true;frame.setAttribute('aria-busy','false');});
  image.addEventListener('error',()=>{image.hidden=true;status.hidden=false;status.textContent='This example could not load. Your selection is saved.';frame.setAttribute('aria-busy','false');figure.classList.add('example-unavailable');});
  image.src=asset.src;
  return figure;
}
function groupSection(group){
  const data=catalog[group],current=find(group,state[group]),area=section(data.label,group),grid=el('div','choice-grid example-options'+(group==='world'?' world-grid':'')),preview=examplePreview(group,current.id,current.label,current.hint);
  grid.setAttribute('role','group');grid.setAttribute('aria-label',data.label);
  data.options.forEach(option=>{
    const choice=button('','choice example-option',()=>{
      const scroll=window.scrollY;choose({[group]:option.id},group);renderPage(true);window.scrollTo(0,scroll);document.querySelector('[data-option="'+group+':'+option.id+'"]')?.focus({preventScroll:true});
    });
    choice.dataset.option=group+':'+option.id;choice.setAttribute('aria-pressed',String(chosen(group)&&state[group]===option.id));choice.setAttribute('aria-label',option.label+'. '+option.hint);
    const copy=el('span','choice-copy');copy.append(el('span','choice-title',option.label),el('span','choice-check','✓'));grid.append(mount(choice,copy));
  });
  const dormantLens=group==='lens'&&chosen(group)&&effectiveCamera(state).projection==='ORTHO'&&state.lens!=='ortho';
  const materialOverride=group==='material'&&chosen(group)&&state.materials.trim()&&state.material!=='pbr';
  const selection=el('div','selection-status');selection.append(el('span',null,dormantLens?'Stored · parallel projection applies':materialOverride?'Stored · explicit materials apply':chosen(group)?'Selected':'Not selected'),button('Leave open','text-button',()=>{commit({chosenGroups:state.chosenGroups.filter(g=>g!==group),...(group==='palette'?{paletteRoles:null,customAccent:''}:{})});renderPage(true);}));selection.querySelector('button').hidden=!chosen(group);
  if(!chosen(group)){preview.classList.add('unselected-example');preview.querySelector('.example-kind').textContent='Example · Not selected';}
  area.append(preview,grid,selection,choiceNote(group));return area;
}
function jumpNav(groups,page){const nav=el('nav','jump-nav');nav.setAttribute('aria-label','On this page');groups.forEach(g=>nav.append(link(catalog[g].label,'#'+page+'/'+g)));return nav;}
function paletteControls(){
  const roles=el('div','palette-roles'),colors=paletteFor(state);
  for(const key of paletteKeys){
    const wrap=el('div','role'),label=el('label',null,key[0].toUpperCase()+key.slice(1)),picker=el('input'),hex=el('input'),error=el('p','field-error');picker.type='color';picker.id='color-'+key;label.htmlFor=picker.id;picker.value=colors[key];hex.type='text';hex.value=colors[key].toUpperCase();hex.id='hex-'+key;hex.maxLength=7;hex.setAttribute('aria-label',key+' hex color');hex.setAttribute('aria-describedby','error-'+key);error.id='error-'+key;error.setAttribute('aria-live','polite');
    picker.addEventListener('input',()=>{hex.value=picker.value.toUpperCase();error.textContent='';hex.removeAttribute('aria-invalid');choose({paletteRoles:{...paletteFor(state),[key]:picker.value}},'palette');});
    hex.addEventListener('change',()=>{if(!/^#[0-9a-f]{6}$/i.test(hex.value)){error.textContent='Use six hex digits, like #305BA5.';hex.setAttribute('aria-invalid','true');return;}error.textContent='';hex.removeAttribute('aria-invalid');picker.value=hex.value;choose({paletteRoles:{...paletteFor(state),[key]:hex.value}},'palette');});
    wrap.append(label,picker,hex,error);roles.append(wrap);
  }
  const foot=el('div','palette-footer');foot.append(el('p',null,'Appearance targets for the render. Editing a role overrides where the preset places its colors.'),button('Use preset colors','secondary',()=>replaceState({...state,paletteRoles:null,customAccent:''},'Palette roles reset to the selected relationship.')));
  return panel('palette-roles','Fine-tune the five color roles',()=>state.paletteRoles?'Custom roles in use':'Preset colors',roles,foot);
}
function languagePage(main){
  // The page heading already asks for the language, so the section keeps its anchor but not a second title.
  const world=groupSection('world'),strip=el('div','recipe-strip'),text=el('p');world.querySelector('h2').remove();
  text.append(el('strong',null,find('world',state.world).label));
  strip.append(text,button('Apply suggested setup','secondary',()=>replaceState({...state,...recipes[state.world],chosenGroups:[...new Set([...state.chosenGroups,'world',...Object.keys(recipes[state.world])])],paletteRoles:null},'Suggested camera, light and surfaces applied.')));
  strip.hidden=!chosen('world');
  world.querySelector('.choice-grid').after(strip);world.setAttribute('aria-label',catalog.world.label);main.append(world);
  const strength=section('Strength','strength');strength.append(segmented('strength','Treatment strength',[['subtle','Subtle'],['balanced','Balanced'],['bold','Bold']]));main.append(strength);
}
function cameraPage(main){
  const groups=['lens','angle','focus','composition'];main.append(jumpNav(groups,'camera'));const notes=effectiveCamera(state).notes;
  if(notes.length){const feedback=el('div','feedback-note');feedback.id='camera-feedback';notes.forEach(n=>feedback.append(el('p',null,n)));main.append(feedback);}
  groups.forEach(g=>main.append(groupSection(g)));
  const capture=capturePanel();capture.querySelector('.segment-hint').id='capture-hint';main.append(capture);
  main.append(panel('framing','Framing',written(['shotSize']),textField('shotSize','Shot size',{rows:0,placeholder:'Close-up, full-body, wide…'})),cameraSet());
}
function lightPage(main){const palette=groupSection('palette');palette.append(paletteControls());main.append(jumpNav(['lighting','atmosphere','palette'],'light'),groupSection('lighting'),panel('light-control','Light details',written(['lightSource','lightDirection','lightQuality']),grid(textField('lightSource','Source',{rows:0,placeholder:'Window, on-camera flash, sun…'}),textField('lightDirection','Direction',{rows:0,placeholder:'Above, side, behind…'}),textField('lightQuality','Quality & fill',{rows:0,placeholder:'Hard key with soft fill'}),numberField('lightKelvin','Color temperature (K)'))),groupSection('atmosphere'),palette);}
function surfacePage(main){
  main.append(groupSection('material'),groupSection('finish'));
  const hints=Object.fromEntries(detailOptions.map(([v,,h])=>[v,h])),labels=Object.fromEntries(detailOptions.map(([v,label])=>[v,label])),area=section('Detail','detail');
  let preview=examplePreview('detail',state.detail,labels[state.detail],hints[state.detail]);
  area.append(preview,segmented('detail','Detail density',detailOptions,v=>{const next=examplePreview('detail',v,labels[v],hints[v]);preview.replaceWith(next);preview=next;}));main.append(area,panel('surface-control','Surface details',written(['materials','wear','smallDetails']),grid(textField('materials','Materials',{placeholder:'Metal hull, painted timber, fabric…'}),textField('wear','Wear',{placeholder:'Where it is worn, and why.'}),textField('smallDetails','Small details',{full:true,placeholder:'Details that support this scene.'}))));
}
function summary(){
  const grid=el('div','summary-grid'),cam=effectiveCamera(state);
  [['Creative language',find('world',state.world).label,'language','world'],['Camera',cam.projection==='ORTHO'?'Orthographic':find('lens',state.lens).label,'camera/lens','lens'],['Viewpoint',find('angle',state.angle).label,'camera/angle','angle'],['Focus',find('focus',state.focus).label,'camera/focus','focus'],['Light',find('lighting',state.lighting).label,'light/lighting','lighting'],['Color',state.paletteRoles?'Custom palette roles':find('palette',state.palette).label,'light/palette','palette'],['Surface',find('material',state.material).label,'surface/material','material'],['Finish',find('finish',state.finish).label,'surface/finish','finish']].forEach(([label,value,dest,key])=>{const a=link('','#'+dest,'summary-link');a.append(el('span',null,label),el('strong',null,chosen(key)?value:'Open'));grid.append(a);});
  return grid;
}
function accentField(){
  const wrap=el('div','field'),label=el('label',null,'Focal accent color'),input=el('input'),error=el('p','field-error');
  input.id='field-customAccent';label.htmlFor=input.id;input.value=state.customAccent;input.maxLength=7;input.placeholder='#305BA5';error.id='accent-error';input.setAttribute('aria-describedby',error.id);
  input.addEventListener('change',()=>{if(input.value&&!/^#[0-9a-f]{6}$/i.test(input.value)){error.textContent='Use a color like #305BA5, or leave this empty.';input.setAttribute('aria-invalid','true');return;}error.textContent='';input.removeAttribute('aria-invalid');const patch={customAccent:input.value};if(state.paletteRoles&&input.value)patch.paletteRoles={...state.paletteRoles,accent:input.value};commit(patch);});
  wrap.append(label,input,el('p',null,'Optional. # and six hex digits. The five role colors live in Light & color.'),error);return wrap;
}
function directionPage(main){
  const essentials=el('div','form-grid essentials');
  essentials.append(textField('name','Name',{rows:0,max:100,full:true,placeholder:'Give this direction a name'}),textField('subject','Subject & setting',{rows:4,max:4000,full:true,large:true,placeholder:'A cruise ship stranded on a mountain ridge.'}),textField('action','Action',{rows:2,placeholder:'What is happening?'}),textField('tone','Tone',{rows:2,placeholder:'How should it feel?'}));
  main.append(essentials);
  const grid=(...fields)=>mount(el('div','form-grid'),...fields);
  const animation=el('p','feedback-note','The brief asks the builder to establish duration and frame rate before rendering a full sequence.');animation.id='animation-note';animation.hidden=effectiveOutput(state)!=='animation';
  const label=(key,options)=>Object.fromEntries(options)[key==='output'?effectiveOutput(state):state[key]];
  const scopeOptions={output:[['still','Still image'],['animation','Animation']],aspect:[['3:2','3:2 · landscape'],['16:9','16:9 · wide'],['1:1','1:1 · square'],['9:16','9:16 · portrait']],mode:[['new','A new separate scene'],['copy','Improve a versioned copy']],quality:[['preview','Preview first'],['final','Preview, then final']]};
  if(state.medium==='image')scopeOptions.output=[['still','Still image']];if(state.medium==='video')scopeOptions.output=[['animation','Video']];if(state.medium!=='blender')scopeOptions.mode=[['new','New result'],['copy','Versioned copy']];
  const check=el('label','check-label'),review=el('input');review.type='checkbox';review.id='review-loop';review.checked=state.review;review.addEventListener('change',()=>commit({review:review.checked}));check.append(review,document.createTextNode('Include the render → inspect → revise loop in the prompt'));
  const refine=section('Settings','refine'),panels=el('div','panels');
  panels.append(
    panel('story','Story',written(['intent','timeOfDay','weather','storyContrast']),grid(textField('intent','Intent',{full:true}),textField('timeOfDay','Time of day',{rows:0,placeholder:'Early morning'}),textField('weather','Weather',{rows:0,placeholder:'Low clouds after rain'}),textField('storyContrast','Narrative contrast',{full:true,placeholder:'An unexpected situation, attitude or emotion—if the idea needs it.'}))),
    panel('scene-detail','Focal point & surroundings',written(['focalPoint','environment']),grid(textField('focalPoint','Focal point',{max:1000,placeholder:'One folded edge catching the light.'}),textField('environment','Environment',{placeholder:'The space, the scale, and what belongs near or far.'}))),
    panel('scope','Format & scope',()=>[label('output',scopeOptions.output),state.aspect,label('mode',scopeOptions.mode),label('quality',scopeOptions.quality)].join(' · '),grid(selectField('output','Deliverable',scopeOptions.output,v=>{animation.hidden=v!=='animation';},effectiveOutput(state)),selectField('aspect','Frame shape',scopeOptions.aspect),selectField('mode','Project scope',scopeOptions.mode),selectField('quality','Render budget',scopeOptions.quality)),animation),
    panel('boundaries','Constraints',written(['preserve','reject','acceptance','exclusions']),grid(textField('preserve','Must preserve',{max:3000,placeholder:'Qualities or approved elements that must survive every revision.'}),textField('reject','Immediate rejection',{max:3000,placeholder:'What would make the image wrong, even if the render is clean?'}),textField('acceptance','Acceptance criteria',{max:3000,full:true,placeholder:'Visible qualities you can inspect in the actual image, at thumbnail and full size.'}),textField('exclusions','Keep out / keep unchanged',{max:3000,full:true,placeholder:'No people or text. Do not change the approved silhouette.'}))),
    panel('references','References',()=>state.referenceAttachments.length?state.referenceAttachments.length+' attached':written(['references','referenceNotes'])(),referenceUploads(),grid(textField('references','Source links or local paths',{max:4000,full:true,placeholder:'Additional sources for the agent to inspect.'}),textField('referenceNotes','Reference notes',{max:4000,full:true,placeholder:'What should be borrowed?'}),textField('referenceIdentity','Identity',{max:1000,placeholder:'Subject design, proportions and materials.'}),textField('referenceComposition','Composition',{max:1000,placeholder:'Layout, pose and framing.'}),textField('referenceAtmosphere','Atmosphere',{max:1000,placeholder:'Light, air and mood.'}),researchFeedback('references-feedback',['references']))),
    ...(state.medium==='blender'?[naturePanel()]:[]),...(state.medium!=='image'?[shotPanel()]:[]),
    ...(state.medium==='video'||(state.medium==='general'&&effectiveOutput(state)==='animation')?[panel('audio','Sound & dialogue',written(['sound','dialogue','referenceAudio','audioNotes']),grid(textField('sound','Sound'),textField('dialogue','Dialogue'),textField('referenceAudio','Voice reference',{max:1000}),textField('audioNotes','Voice notes',{placeholder:'Voice/accent/cadence; specify whether any original words should carry over.'})))]:[]),
    ...(state.medium!=='blender'?[generationPanel()]:[]),
    panel('style-source','Style source',written(['styleSource','generatingPrompt']),grid(textField('styleSource','Approved image',{full:true,placeholder:'The approved image path or source URL.'}),textField('generatingPrompt','Producing prompt',{max:20000,full:true,placeholder:'The prompt that produced that image.'}))),
    panel('advanced','Review loop & accent',()=>(state.review?'Review loop on':'Review loop off')+(state.customAccent?' · '+state.customAccent.toUpperCase():''),check,accentField())
  );
  refine.append(panels);main.append(refine);
  const choices=section('Selections','choices');choices.append(summary());main.append(choices);
  const end=el('div','page-end'),need=el('p','gate','Add the scene or subject above to prepare the build prompt.'),open=button('Review the build prompt →','primary',()=>go('handoff'));
  need.id='subject-needed';open.id='open-handoff';end.append(need,open);main.append(end);
}
function tabs(main){const nav=el('nav','handoff-tabs');nav.setAttribute('aria-label','Build and review');const {page,target}=route();for(const [href,text] of [['handoff','Agent brief'],['handoff/generator','Generator prompt'],['journal','Review journal']]){const a=link(text,'#'+href);if((href==='journal'&&page==='journal')||(page==='handoff'&&href===(target==='generator'?'handoff/generator':'handoff')))a.setAttribute('aria-current','page');nav.append(a);}main.append(nav);}
function ensurePrompt(generator=false){const draft=generator?'generatorDraft':'promptDraft',basis=generator?'generatorBasis':'promptBasis';if(!state[draft]){const generated=generator?compileGeneratorPrompt(state):compilePrompt(state);commit({[draft]:generated,[basis]:generated});}}
function handoffPage(main){
  tabs(main);
  if(!state.subject.trim()){const gate=el('div','page-end empty-gate');gate.append(el('p','gate','Your choices are saved. Describe the scene before preparing the prompt.'),link('Describe your scene →','#direction','primary'));main.append(gate);return;}
  const generator=route().target==='generator',draft=generator?'generatorDraft':'promptDraft',basis=generator?'generatorBasis':'promptBasis',compile=generator?compileGeneratorPrompt:compilePrompt;
  ensurePrompt(generator);
  if(state[basis]!==compile(state)){const note=el('div','feedback-note');note.id='prompt-stale';note.textContent='Choices changed. Regenerate to include them; Undo restores your edits.';main.append(note);}
  if(!choiceId)main.append(executionPanel());
  const toolbar=el('div','prompt-toolbar'),label=el('label','prompt-label','Editable prompt'),actions=el('div','actions');label.htmlFor='prompt-output';
  actions.append(button('Regenerate','secondary',()=>{const generated=compile(state);replaceState({...state,[draft]:generated,[basis]:generated},'Prompt rebuilt from the current direction.');}),button('Download .md','secondary',()=>{download(state[draft],safeFileName(state.name)+(generator?'-generator':'-agent')+'.md');notify('Prompt downloaded with your edits.');}),button('Copy prompt','primary',async e=>{const target=e.currentTarget;try{await navigator.clipboard.writeText(state[draft]);target.textContent='Copied ✓';setTimeout(()=>{if(target.isConnected)target.textContent='Copy prompt';},1800);}catch{$('prompt-output').focus();$('prompt-output').select();notify('Clipboard unavailable. The prompt is selected; press Ctrl+C.');}}));
  toolbar.append(label,actions);main.append(toolbar);
  const output=el('textarea');output.id='prompt-output';output.value=state[draft];output.maxLength=300000;output.spellcheck=false;output.addEventListener('input',()=>commit({[draft]:output.value}));main.append(output);
}
function journalPage(main){
  tabs(main);
  const form=el('form','journal-form'),fields=el('div','form-grid');form.setAttribute('aria-label','Add a review entry');
  const area=(id,text,placeholder)=>{const wrap=el('div','field'),label=el('label',null,text),input=el('textarea');input.id=id;input.maxLength=2000;input.rows=3;input.placeholder=placeholder;label.htmlFor=id;wrap.append(label,input);return wrap;};
  fields.append(area('journal-issue','Observation','A visible issue in the actual render.'),area('journal-change','Revision','The adjustment, and what you kept fixed.'));
  const row=el('div','journal-submit'),wrap=el('div','field'),label=el('label',null,'Outcome'),outcome=el('select');outcome.id='journal-outcome';label.htmlFor=outcome.id;for(const [v,t] of Object.entries(outcomes)){const o=el('option',null,t);o.value=v;outcome.append(o);}wrap.append(label,outcome);
  const submit=el('button','primary','Add review entry');submit.type='submit';row.append(wrap,submit);
  const error=el('p','field-error');error.id='journal-error';error.setAttribute('role','alert');form.append(fields,row,error);
  form.addEventListener('submit',e=>{e.preventDefault();if(state.journal.length>=50){error.textContent='You have 50 entries. Export a copy, then remove an old entry before adding another.';return;}if(!$('journal-issue').value.trim()){error.textContent='Describe what you observed before adding the entry.';$('journal-issue').focus();return;}const entry={id:crypto.randomUUID(),at:new Date().toISOString(),issue:$('journal-issue').value,change:$('journal-change').value,outcome:outcome.value};commit({journal:[...state.journal,entry]});renderPage(true);notify('Review entry added.');});
  main.append(form);
  const history=section('Reviews','record');if(!state.journal.length)history.append(el('p','journal-empty','No reviews recorded yet.'));
  state.journal.slice().reverse().forEach(entry=>{const item=el('article','journal-entry'),head=el('div','journal-entry-head'),date=el('p',null,new Date(entry.at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}));date.append(el('span','outcome',outcomes[entry.outcome]));head.append(date,button('Remove','secondary',()=>{const before=state.journal;commit({journal:state.journal.filter(x=>x.id!==entry.id)});renderPage(true);notify('Review entry removed.',()=>{commit({journal:before});renderPage(true);notify('Review entry restored.');});}));item.append(head,el('h3',null,entry.issue));if(entry.change)item.append(el('p',null,entry.change));history.append(item);});
  main.append(history);
}
function pageEnd(main,page){const i=chapters.findIndex(x=>x[0]===page);if(i<0||page==='direction')return;const nav=el('nav','page-end');nav.setAttribute('aria-label','Next chapter');nav.append(i===chapters.length-1?link('Build & review →','#handoff','primary'):link('Next: '+chapters[i+1][1]+' →','#'+chapters[i+1][0],'primary'));main.append(nav);}
const pages={language:languagePage,camera:cameraPage,light:lightPage,surface:surfacePage,direction:directionPage,handoff:handoffPage,journal:journalPage};
function renderPage(keepScroll=false){
  clearTimeout(jobTimer);const {page,target}=route(),before=window.scrollY,main=$('main');statuses.clear();main.replaceChildren();
  document.querySelectorAll('#chapters a').forEach(a=>{if(a.hash==='#'+page||(page==='journal'&&a.hash==='#handoff'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const head=el('header','page-head');head.append(el('h1',null,headings[page]));main.append(head);if(choiceId)main.append(choiceBar());
  pages[page](main);pageEnd(main,page);
  document.title=(chapters.find(x=>x[0]===page)?.[1]||(page==='journal'?'Review journal':'Build prompt'))+' · Creative direction'+(state.medium==='general'?'':' / '+Object.fromEntries(media)[state.medium]);
  refreshChrome();
  const goal=target&&$(target);if(goal?.tagName==='DETAILS'){goal.open=true;openPanels.add(goal.id);}
  if(keepScroll)window.scrollTo(0,before);else if(goal)goal.scrollIntoView({block:'start',behavior:'instant'});else{window.scrollTo(0,0);if(currentPage&&currentPage!==page)main.focus({preventScroll:true});}
  currentPage=page;
  updateChoiceBar();
  if(innerWidth<=800){const active=document.querySelector('#chapters a[aria-current=page]');if(active)document.querySelector('.sidebar').scrollLeft=Math.max(0,active.offsetLeft-20);}
}
function choiceBar(){
  const box=el('section','choice-session-bar');box.id='choice-session';box.setAttribute('aria-label','Agent choices');
  const copy=el('div','choice-session-copy'),message=el('p','choice-session-message'),status=el('p','choice-session-status');message.id='choice-message';status.id='choice-status';status.setAttribute('role','status');copy.append(message,status);
  const actions=el('div','actions'),done=button('Done','primary',()=>choiceSession?.done()),ignore=button('Ignore','secondary',()=>choiceSession?.ignore());done.id='choice-done';ignore.id='choice-ignore';actions.append(ignore,done);
  const error=el('p','field-error');error.id='choice-error';error.setAttribute('role','alert');const reload=button('Load latest','text-button',()=>choiceSession?.reload());reload.id='choice-reload';reload.hidden=true;
  const recover=button('Restore local draft','text-button',()=>choiceSession?.restoreLocal());recover.id='choice-recover';recover.hidden=true;
  box.append(copy,actions,error,reload,recover);return box;
}
function updateChoiceBar(){
  if(!choiceId||!choiceSession)return;const view=choiceSession.view(),box=$('choice-session');if(!box)return;
  $('choice-message').textContent=view.session?.message||'Choose your direction';
  $('choice-status').textContent=view.loading?'Loading choices…':view.session?.status==='done'?'Sent to agent':view.session?.status==='ignored'?'Ignored · no choices sent':view.conflict?'Changed in another tab':view.saving?'Saving…':view.dirty?'Unsaved changes':view.session?'Saved · agent is waiting':'Choices unavailable';
  $('choice-error').textContent=view.error;$('choice-reload').hidden=!view.error;
  $('choice-recover').hidden=!view.recoverable;$('choice-recover').disabled=!choiceSession.canEdit();
  $('choice-done').disabled=!choiceSession.canEdit();$('choice-ignore').disabled=view.loading||view.busy||view.closed||!view.session;
  // Terminal or unavailable sessions remain readable, but cannot silently accept edits.
  const locked=!choiceSession.canEdit();
  for(const control of document.querySelectorAll('#main input,#main textarea,#main select,#main button,#workflow-medium')){
    if(box.contains(control))continue;
    if(locked){if(!control.disabled)control.dataset.choiceDisabled='1';control.disabled=true;}
    else if(control.dataset.choiceDisabled){delete control.dataset.choiceDisabled;control.disabled=false;}
  }
  box.dataset.status=view.session?.status||'loading';
}
function download(content,name,type='text/plain'){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function openMenu(){renderLooks();renderStyles();$('import-error').hidden=true;$('menu-dialog').showModal();}
function renderLooks(){
  const list=$('saved-looks');list.replaceChildren();$('look-count').textContent=saved.length?String(saved.length):'';
  if(!saved.length){list.append(el('p','empty-state','No saved directions.'));return;}
  saved.forEach((look,i)=>{const row=el('div','saved-item'),load=button('',null,()=>{$('menu-dialog').close();replaceState(look,'Direction restored.');});load.append(el('strong',null,look.name),el('span',null,'Full direction, subject and review history'));const del=button('Delete','secondary',()=>{const before=[...saved];saved.splice(i,1);if(!storeLooks()){saved=before;return;}renderLooks();notify('Direction deleted.',()=>{saved=before;storeLooks();renderLooks();notify('Direction restored.');});});del.setAttribute('aria-label','Delete '+look.name);row.append(load,del);list.append(row);});
}
function saveLook(){if(saved.length>=50){notify('You have 50 saved directions. Export or delete one before saving another.');return;}const title=state.name==='Untitled direction'?'Direction '+(saved.length+1):state.name;const before=[...saved];saved.push(normalize({...state,name:title}));if(!storeLooks()){saved=before;return;}renderLooks();notify('“'+title+'” saved.');}
function storeStyles(){keepAside(stylesKey);try{localStorage.setItem(stylesKey,JSON.stringify(styles));return true;}catch{notify('Styles could not be stored. Export the style instead.');return false;}}
function renderStyles(){
  const list=$('saved-styles');list.replaceChildren();if(!styles.length){list.append(el('p','empty-state','No saved styles.'));return;}
  styles.forEach((style,index)=>{const row=el('div','saved-item'),apply=button('',null,()=>{try{const next=applyStyle(state,style);$('menu-dialog').close();replaceState(next,'Style applied. Current subject and references kept.');}catch(error){notify(error.message);}});apply.append(el('strong',null,style.name),el('span',null,style.source?.image&&style.source?.prompt?'Image + producing prompt recorded':'Visual settings'));
    const actions=el('div','saved-actions');actions.append(button('Export','text-button',()=>download(JSON.stringify(style,null,2),safeFileName(style.name)+'-style.json','application/json')),button('Delete','secondary',()=>{const before=[...styles];styles.splice(index,1);if(!storeStyles()){styles=before;return;}renderStyles();notify('Style deleted.',()=>{styles=before;storeStyles();renderStyles();notify('Style restored.');});}));row.append(apply,actions);list.append(row);
  });
}
function saveStyle(){if(styles.length>=50){notify('You have 50 styles. Export or delete one before saving another.');return;}try{const before=[...styles],style=createStyle(state);if(style.name==='Untitled direction')style.name='Style '+(styles.length+1);styles.push(style);if(!storeStyles()){styles=before;return;}renderStyles();notify('Style saved. Subject and review history are not part of the style.');}catch(error){notify(error.message);}}
function checkField(label,checked,onChange,id){const wrap=el('label','check-label'),input=el('input');input.type='checkbox';input.checked=checked;if(id)input.id=id;input.addEventListener('change',()=>onChange(input.checked));wrap.append(input,document.createTextNode(label));return wrap;}
function operatorChoices(){
  const box=el('fieldset','operator-choices full');box.append(el('legend',null,'Camera behavior'));
  const selected=state.cameraOperators.length?state.cameraOperators:state.cameraOperator!=='none'?[state.cameraOperator]:[];
  research.cameraOperator.options.filter(o=>o.id!=='none').forEach(option=>{const item=checkField(option.label,selected.includes(option.id),checked=>{const current=state.cameraOperators.length?state.cameraOperators:state.cameraOperator!=='none'?[state.cameraOperator]:[],next=checked?[...new Set([...current,option.id])]:current.filter(x=>x!==option.id);commit({cameraOperators:next,cameraOperator:next[0]||'none'});},'operator-'+option.id);item.title=option.hint;box.append(item);});return box;
}
function localText(label,value,onInput,{rows=2,max=2000}={}){const wrap=el('div','field'),name=el('label',null,label),input=el(rows?'textarea':'input'),id='entry-'+crypto.randomUUID();input.id=id;name.htmlFor=id;input.value=value??'';input.maxLength=max;if(rows)input.rows=rows;input.addEventListener('input',()=>onInput(input.value));wrap.append(name,input);return wrap;}
function localNumber(label,value,onInput){const wrap=el('div','field'),name=el('label',null,label),input=el('input'),error=el('p','field-error'),id='entry-'+crypto.randomUUID();input.id=id;name.htmlFor=id;input.type='number';input.min=0;input.max=600;input.step='any';input.value=value??'';input.addEventListener('input',()=>{const next=input.value===''?null:input.valueAsNumber;if(next!==null&&(!Number.isFinite(next)||next<0||next>600)){input.setAttribute('aria-invalid','true');error.textContent='Use 0–600 seconds.';refreshChrome();return;}input.removeAttribute('aria-invalid');error.textContent='';onInput(next);refreshChrome();});wrap.append(name,input,error);return wrap;}
function operatorBeats(){
  const content=el('div','entry-list');
  state.operatorBeats.forEach((beat,index)=>{const card=el('div','entry-card'),head=el('div','entry-head'),error=el('p','field-error');let draft={...beat};card.dataset.beatIndex=index;error.setAttribute('role','alert');head.append(el('strong',null,research.cameraOperator.options.find(o=>o.id===beat.id)?.label||'Behavior'),button('Remove','text-button',()=>{commit({operatorBeats:state.operatorBeats.filter((_,i)=>i!==index)});renderPage(true);}));
    const update=patch=>{draft={...draft,...patch};const invalid=draft.startSeconds!==null&&draft.endSeconds!==null&&draft.endSeconds<draft.startSeconds;error.textContent=invalid?'Not saved. The end must follow the start.':'';const end=card.querySelectorAll('input[type=number]')[1];if(invalid)end?.setAttribute('aria-invalid','true');else end?.removeAttribute('aria-invalid');if(!invalid)commit({operatorBeats:state.operatorBeats.map((b,i)=>i===index?draft:b)});else refreshChrome();};
    const fields=grid(localNumber('Start (seconds)',beat.startSeconds,v=>update({startSeconds:v})),localNumber('End (seconds)',beat.endSeconds,v=>update({endSeconds:v})),localText('Trigger',beat.trigger,v=>update({trigger:v}),{max:1000}),localText('Recovery',beat.recovery,v=>update({recovery:v}),{max:1000}));card.append(head,fields,error);content.append(card);
  });
  const row=el('div','entry-add'),select=el('select');select.id='beat-operator';select.setAttribute('aria-label','Behavior for a timed beat');research.cameraOperator.options.filter(o=>o.id!=='none').forEach(o=>{const item=el('option',null,o.label);item.value=o.id;select.append(item);});
  row.append(select,button('Add beat','secondary',()=>{if(state.operatorBeats.length>=24){notify('Keep up to 24 timed beats.');return;}commit({operatorBeats:[...state.operatorBeats,{id:select.value,startSeconds:null,endSeconds:null,trigger:'',recovery:''}]});renderPage(true);}));content.append(row);
  return panel('operator-beats','Timed beats',()=>state.operatorBeats.length?state.operatorBeats.length+' beats':'Optional',content);
}
function cameraSet(){
  const list=el('div','entry-list');state.shots.forEach((shot,index)=>{const card=el('div','entry-card'),head=el('div','entry-head'),update=patch=>commit({shots:state.shots.map((s,i)=>i===index?{...s,...patch}:s)});
    const controls=el('div','actions');controls.append(button('Use camera','secondary',()=>{const keys=['lens','angle','focus','composition'].filter(k=>shot[k]);choose({...Object.fromEntries(keys.map(k=>[k,shot[k]])),shotSize:shot.shotSize||''},...keys);renderPage(true);}),button('Remove','text-button',()=>{commit({shots:state.shots.filter((_,i)=>i!==index)});renderPage(true);}));head.append(el('strong',null,'Camera '+(index+1)),controls);
    card.append(head,grid(localText('Name',shot.name,v=>update({name:v}),{rows:0,max:100}),localText('Shot size',shot.shotSize,v=>update({shotSize:v}),{rows:0,max:1000}),localText('View & purpose',shot.description,v=>update({description:v}))),el('p','entry-note',['lens','angle','focus','composition'].filter(k=>shot[k]).map(k=>find(k,shot[k])?.label).filter(Boolean).join(' · ')));list.append(card);
  });
  const add=button('Add current camera','secondary',()=>{if(state.shots.length>=12){notify('Keep up to 12 cameras in a set.');return;}const camera=Object.fromEntries(['lens','angle','focus','composition'].filter(chosen).map(k=>[k,state[k]]));commit({shots:[...state.shots,{id:crypto.randomUUID(),name:'Camera '+(state.shots.length+1),...camera,shotSize:state.shotSize,description:''}]});renderPage(true);});
  return panel('camera-set','Camera set',()=>state.shots.length?state.shots.length+' cameras':'Optional',el('p','segment-hint','Alternative views of the same scene.'),list,add);
}
function generationPanel(){return panel('generation','Generation plan',written(['modelCandidates','draftResolution','finalResolution','budgetLimit','selectedCandidate']),grid(textField('modelCandidates','Models to compare',{placeholder:'Optional. Keep the prompt and references fixed.'}),textField('budgetLimit','Budget limit',{rows:0,placeholder:'Your permitted limit.'}),textField('draftResolution','Draft size',{rows:0,placeholder:'Tool-supported preview size'}),textField('finalResolution','Final size',{rows:0,placeholder:'Chosen final dimensions'}),textField('selectedCandidate','Selected result',{full:true,placeholder:'The candidate to retain and why.'})),checkField('Upscale the selected draft',state.upscale,v=>commit({upscale:v}),'upscale-selected'));}
async function api(url,options={}){const response=await fetch(url,options),data=await response.json().catch(()=>({error:'The local server returned an unreadable response.'}));if(!response.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||'Local request failed ('+response.status+').');return data;}
let referenceRecords=[];
function referenceUploads(){
  const wrap=el('div','reference-upload'),row=el('div','entry-add'),role=el('select'),input=el('input'),status=el('p','field-error'),list=el('div','attachment-list');role.id='reference-role';role.setAttribute('aria-label','Reference role');[['identity','Identity'],['composition','Composition'],['atmosphere','Atmosphere'],['style','Style'],['audio','Voice / audio']].forEach(([id,label])=>{const option=el('option',null,label);option.value=id;role.append(option);});
  input.id='reference-upload';input.type='file';input.accept='image/*,audio/*';input.multiple=true;input.hidden=true;
  const draw=()=>{if(!list.isConnected)return;list.replaceChildren();state.referenceAttachments.forEach((attachment,index)=>{const record=referenceRecords.find(r=>r.id===attachment.id),item=el('div','attachment'),copy=el('div');copy.append(el('strong',null,record?.name||attachment.id),el('span',null,attachment.role));const remove=button('Remove','text-button',()=>{commit({referenceAttachments:state.referenceAttachments.filter((_,i)=>i!==index)});draw();});item.append(copy,remove);list.append(item);});};
  const add=button('Attach files','secondary',()=>input.click());add.id='attach-reference';row.append(role,add,input);
  input.addEventListener('change',async()=>{const files=[...input.files];input.value='';if(!files.length)return;add.disabled=true;status.textContent='';try{for(const file of files){if(state.referenceAttachments.length>=24)throw Error('Keep up to 24 attached references.');const data=await api('/api/references',{method:'POST',headers:{'X-Fieldwork-Request':'1','X-File-Name':encodeURIComponent(file.name),'X-Reference-Role':role.value,'Content-Type':file.type||'application/octet-stream'},body:file});const record=data.reference||data;referenceRecords.push(record);commit({referenceAttachments:[...state.referenceAttachments,{id:record.id,role:role.value,notes:''}],...(role.value==='style'&&!state.styleSource?{styleSource:record.url}:{})});}}catch(error){status.textContent=error.message;}finally{add.disabled=false;draw();}});
  wrap.append(row,status,list);queueMicrotask(()=>{draw();api('/api/references').then(data=>{referenceRecords=Array.isArray(data)?data:data.references||[];draw();}).catch(()=>{});});return wrap;
}
function executionPanel(){
  const box=el('section','execution-panel'),head=el('div','entry-head'),copy=el('div'),title=el('strong',null,'Build'),status=el('p','execution-status','Queue this direction for the local agent.'),actions=el('div','actions'),error=el('p','field-error'),result=el('div','execution-result');status.id='job-status';status.setAttribute('role','status');error.id='job-error';result.id='job-result';copy.append(title,status);let activeId=readStored(jobKey)||'';
  const draw=job=>{if(!box.isConnected)return;const names={queued:'Waiting for agent',running:'Agent is working',completed:'Completed',failed:'Build failed'};status.textContent=names[job.status]||job.status||'Unknown status';result.replaceChildren();error.textContent='';if(job.error)error.textContent=typeof job.error==='string'?job.error:job.error.message||JSON.stringify(job.error);
    if(job.direction)result.append(el('p','entry-note','Build: '+(job.direction.name||'Untitled direction')+' · '+job.direction.subject));
    if(job.status==='queued')result.append(el('p','entry-note','The queue does not start an AI by itself. Ask your connected agent to process this local build.'));
    for(const artifact of job.artifacts||[]){
      if(!artifact.url)continue;let url;try{url=new URL(artifact.url,location.href);}catch{continue;}
      if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))continue;
      const card=el('div','artifact'),name=artifact.name||'',label=artifact.label||name||'Open result',mime=artifact.mime||artifact.type||'';
      if(/^video\//i.test(mime)||/\.(mp4|webm)$/i.test(name)){
        const video=el('video');video.src=url.href;video.controls=true;video.preload='metadata';video.playsInline=true;video.autoplay=false;video.setAttribute('aria-label',label);card.append(video);
      }else if(/^audio\//i.test(mime)||/\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(name)){
        const audio=el('audio');audio.src=url.href;audio.controls=true;audio.preload='metadata';audio.autoplay=false;audio.setAttribute('aria-label',label);card.append(audio);
      }else if(/^image\//i.test(mime)||/\.(png|jpe?g|webp|gif)$/i.test(name)){
        const image=el('img');image.src=url.href;image.alt=label;image.loading='lazy';card.append(image);
      }
      const file=link(label,url.pathname+url.search);if(name){file.title=name;file.setAttribute('aria-label',label===name?name:label+' ('+name+')');}card.append(file);result.append(card);
    }
    if(job.inspection||(job.limitations||[]).length){const notes=[];if(job.inspection)notes.push(el('p','inspection',typeof job.inspection==='string'?job.inspection:JSON.stringify(job.inspection)));for(const limitation of job.limitations||[])notes.push(el('p','entry-note',limitation));const review=panel('job-review-'+job.id,'Review notes',null,...notes);review.classList.add('result-review');result.append(review);}
    if(['queued','running'].includes(job.status)&&jobPolls<240&&route().page==='handoff'&&!document.hidden){clearTimeout(jobTimer);jobTimer=setTimeout(()=>{jobPolls++;refresh();},jobPolls<20?3000:15000);}
  };
  const refresh=async()=>{if(!activeId||!box.isConnected)return;try{draw(await api('/api/jobs/'+encodeURIComponent(activeId)));}catch(e){if(box.isConnected)error.textContent=e.message;}};
  const queue=button('Queue build','primary',async()=>{error.textContent='';if((state.promptDraft&&state.promptBasis!==compilePrompt(state))||(state.generatorDraft&&state.generatorBasis!==compileGeneratorPrompt(state))){error.textContent='A saved prompt is out of date. Regenerate it or update the choices before queuing.';return;}queue.disabled=true;try{const data=await api('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json','X-Fieldwork-Request':'1'},body:JSON.stringify({direction:exportBrief(state)})});const job=data.job||data;activeId=job.id;try{localStorage.setItem(jobKey,activeId);}catch{}jobPolls=0;draw(job);}catch(e){error.textContent=e.message;}finally{queue.disabled=false;}});queue.id='queue-build';
  actions.append(queue,button('Refresh','secondary',()=>{jobPolls=0;refresh();}));head.append(copy,actions);box.append(head,error,result);if(activeId)queueMicrotask(refresh);return box;
}
function reset(){$('menu-dialog').close();replaceState(freshDirection(state.medium),'Fresh direction started. Saved directions and styles are kept.');go('direction');}

// Build one chapter list, one utility button and one dialog.
function buildChrome(){
  const workspaceTitle=document.querySelector('.workspace-title'),brand=el('div','workspace-brand'),context=el('div','workflow-context'),medium=el('select');
  medium.id='workflow-medium';medium.setAttribute('aria-label','Workflow');
  media.forEach(([value,label])=>{const option=el('option',null,label);option.value=value;medium.append(option);});
  medium.value=state.medium;
  medium.addEventListener('change',()=>{commit({medium:medium.value});renderPage(true);});
  workspaceTitle.before(brand);brand.append(workspaceTitle,context);context.append(el('span','workflow-slash','/'),medium);

  document.querySelector('.skip').textContent='Skip to content';
  const menu=button('Saved & files','secondary',openMenu);menu.id='menu-button';menu.setAttribute('aria-haspopup','dialog');
  document.querySelector('.header-actions').replaceChildren($('save-status'),menu);
  const nav=$('chapters');
  chapters.forEach(([id,title],i)=>{const a=link('','#'+id);a.append(el('span','chapter-number',String(i+1).padStart(2,'0')),document.createTextNode(title));nav.append(a);});
  const build=link('','#handoff');build.id='handoff-link';build.append(el('span','chapter-number','→'),document.createTextNode('Build & review'));
  const rule=el('span','nav-rule');rule.setAttribute('aria-hidden','true');nav.append(rule,build);
  document.querySelector('.sidebar').replaceChildren(nav);
  const dialog=el('dialog');dialog.id='menu-dialog';dialog.setAttribute('aria-labelledby','menu-title');
  const head=el('div','dialog-head'),title=el('h2',null,'Saved & files');title.id='menu-title';head.append(title,button('Close','secondary close-dialog',()=>dialog.close()));
  const current=el('p','menu-current'),name=el('strong');name.id='current-name';current.append(el('span',null,'Current direction'),name);
  const save=button('Save direction','primary',saveLook);save.id='save-look';
  const looksTitle=el('h3',null,'Directions '),count=el('span');count.id='look-count';looksTitle.append(count);
  const list=el('div');list.id='saved-looks';
  const looks=mount(el('section','menu-section'),mount(el('div','save-row'),current,save),looksTitle,list);
  const styleList=el('div');styleList.id='saved-styles';
  const styleSave=button('Save style','secondary',saveStyle);styleSave.id='save-style';
  const styleSection=mount(el('section','menu-section'),mount(el('div','save-row'),el('h3',null,'Styles'),styleSave),el('p','menu-note','Camera, light and finish. Applying a style keeps your current subject and references.'),styleList);
  const exportButton=button('Export direction (.json)','secondary',()=>{download(JSON.stringify(exportBrief(state),null,2),safeFileName(state.name)+'.json','application/json');notify('Direction, notes and journal exported.');});exportButton.id='export-button';
  const importButton=button('Import direction (.json)','secondary',()=>$('import-file').click());importButton.id='import-button';
  const search=button('Reference-search plan (.md)','secondary',()=>{download(referenceSearch(state),safeFileName(state.name)+'-reference-search.md');notify('Search plan downloaded. No search has run.');});search.id='search-brief-button';
  const error=el('p','error');error.id='import-error';error.setAttribute('role','alert');error.hidden=true;
  const files=mount(el('section','menu-section'),el('h3',null,'Files'),mount(el('div','file-actions'),exportButton,importButton,search),el('p','menu-note','Exports include notes, palette, prompt and journal. The search plan is text only; it runs no search.'),error);
  const resetButton=button('Start a fresh direction','text-button',reset);resetButton.id='reset-button';
  const fresh=mount(el('section','menu-section menu-reset'),resetButton,el('p','menu-note','Saved directions and styles are kept.'));
  dialog.append(head,looks,styleSection,files,fresh);
  dialog.addEventListener('close',()=>{if(dialog.contains($('toast')))document.body.append($('toast'));});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  $('toast').before(dialog);
}
const launchURL=new URL(location.href),launchMedium=launchURL.searchParams.get('medium');
if(!choiceId&&media.some(([value])=>value===launchMedium)){
  state=normalize({...state,medium:launchMedium});
  if(store()){launchURL.searchParams.delete('medium');history.replaceState(null,'',launchURL);}
}
buildChrome();
if(choiceId){
  choiceSession=createChoiceSession({id:choiceId,getState:()=>state,cacheKey:storageKey,adopt:next=>{state=normalize(next,true);store();if(currentPage)renderPage(true);},onUpdate:()=>updateChoiceBar()});
  await choiceSession.load();
}
$('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2097152)throw Error('Choose a JSON file smaller than 2 MB.');const data=JSON.parse(await file.text()),isStyle=data?.kind==='fieldwork-style',next=isStyle?applyStyle(state,data):normalize(data,true);$('import-error').hidden=true;$('menu-dialog').close();replaceState(next,isStyle?'Style imported and applied. Current subject kept.':'Direction imported.');}catch(error){$('import-error').textContent='Import failed. '+(error instanceof SyntaxError?'This file is not valid JSON.':error.message)+' Your current direction is unchanged.';$('import-error').hidden=false;}});
$('undo-button').addEventListener('click',()=>{const action=undo;undo=null;action?.();});
$('dismiss-toast').addEventListener('click',()=>{$('toast').hidden=true;clearTimeout(toastTimer);});
window.addEventListener('hashchange',()=>renderPage());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&route().page==='handoff'){jobPolls=0;renderPage(true);}});
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();$('main').focus();window.scrollTo(0,0);});
renderPage();if(restoreWarning)notify(restoreWarning.trim());
