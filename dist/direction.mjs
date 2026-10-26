import {catalog,groups,find} from './presets.mjs';
import {research} from './workflows.mjs';

export const extendedTextLimits={tone:2000,action:2000,timeOfDay:300,weather:500,storyContrast:2000,shotSize:500,lightSource:1000,lightDirection:1000,lightQuality:1000,materials:3000,wear:2000,smallDetails:2000,sound:2000,dialogue:4000,referenceAudio:1000,audioNotes:2000,generatingPrompt:300000,styleSource:4000,modelCandidates:2000,draftResolution:300,finalResolution:300,budgetLimit:1000,selectedCandidate:1000,operatorTiming:3000,generatorDraft:300000,generatorBasis:300000};
export const attachmentRoles=['identity','composition','atmosphere','style','audio'];
const operatorIds=research.cameraOperator.options.filter(o=>o.id!=='none').map(o=>o.id);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const unique=v=>[...new Set(v)];
export function normalizeExtended(input,result,strict){
  const fail=message=>{if(strict)throw new Error(message);return false;};
  result.chosenGroups=[...groups];result.cameraOperators=[];result.operatorBeats=[];result.shots=[];result.referenceAttachments=[];
  if(input.chosenGroups!==undefined){
    if(!Array.isArray(input.chosenGroups)||input.chosenGroups.some(g=>!groups.includes(g)))fail('Chosen groups must contain known visual sections.');
    else result.chosenGroups=unique(input.chosenGroups);
  }
  if(typeof input.upscale==='boolean')result.upscale=input.upscale;
  else if(input.upscale!==undefined)fail('Upscale must be true or false.');
  if(input.cameraOperators!==undefined){
    if(!Array.isArray(input.cameraOperators)||input.cameraOperators.length>8||input.cameraOperators.some(id=>!operatorIds.includes(id)))fail('Choose up to eight known camera behaviors.');
    else result.cameraOperators=unique(input.cameraOperators);
  }
  if(input.operatorBeats!==undefined){
    if(!Array.isArray(input.operatorBeats)||input.operatorBeats.length>24)fail('Camera timing must contain at most 24 beats.');
    else for(const beat of input.operatorBeats){
      const timing=k=>beat[k]===undefined||beat[k]===null||(typeof beat[k]==='number'&&Number.isFinite(beat[k])&&beat[k]>=0&&beat[k]<=600);
      if(!object(beat)||!operatorIds.includes(beat.id)||!timing('startSeconds')||!timing('endSeconds')||!text(beat.trigger??'',1000)||!text(beat.recovery??'',1000)||(beat.startSeconds!=null&&beat.endSeconds!=null&&beat.endSeconds<beat.startSeconds)||(result.animationSeconds!==null&&(beat.endSeconds>result.animationSeconds||beat.startSeconds>result.animationSeconds))){
        fail('A camera beat needs a known behavior, valid start/end seconds and text trigger/recovery.');continue;
      }
      result.operatorBeats.push({id:beat.id,startSeconds:beat.startSeconds??null,endSeconds:beat.endSeconds??null,trigger:beat.trigger??'',recovery:beat.recovery??''});
    }
  }
  if(input.shots!==undefined){
    if(!Array.isArray(input.shots)||input.shots.length>12)fail('A scene can have at most 12 camera alternatives.');
    else for(const [index,shot] of input.shots.entries()){
      const id=shot?.id??`shot-${index+1}`;
      if(!object(shot)||!safeId(id)||!text(shot.name??'',100)||!text(shot.shotSize??'',500)||!text(shot.description??'',2000)||['lens','angle','focus','composition'].some(key=>shot[key]!==undefined&&!find(key,shot[key]))||result.shots.some(s=>s.id===id)){
        fail('A camera alternative needs a unique safe ID, text and known optional camera choices.');continue;
      }
      result.shots.push({id,name:shot.name??'',...Object.fromEntries(['lens','angle','focus','composition'].filter(key=>shot[key]!==undefined).map(key=>[key,shot[key]])),shotSize:shot.shotSize??'',description:shot.description??''});
    }
  }
  if(input.referenceAttachments!==undefined){
    if(!Array.isArray(input.referenceAttachments)||input.referenceAttachments.length>24)fail('Supply at most 24 reference attachments.');
    else for(const ref of input.referenceAttachments){
      if(!object(ref)||!safeId(ref.id)||!attachmentRoles.includes(ref.role)||!text(ref.notes??'',2000)||result.referenceAttachments.some(r=>r.id===ref.id&&r.role===ref.role)){
        fail('A reference attachment needs a safe asset ID, a known role and text notes.');continue;
      }
      result.referenceAttachments.push({id:ref.id,role:ref.role,notes:ref.notes??''});
    }
  }
  return result;
}

export function operatorChoices(s){
  const ids=unique([...(s.cameraOperators?.length?s.cameraOperators:s.cameraOperator!=='none'?[s.cameraOperator]:[]),...(s.operatorBeats||[]).map(b=>b.id)]);
  return ids.map(id=>research.cameraOperator.options.find(o=>o.id===id)).filter(Boolean);
}
export function resolveChoices(input){
  const s={...input},chosenGroups=[...(s.chosenGroups??groups)],inferredGroups=[];
  const chosen=new Set(chosenGroups),capture=research.captureStyle.options.find(o=>o.id===s.captureStyle);
  if(capture&&capture.id!=='none'){
    for(const [key,value] of [['lens',capture.lens?.[0]],['angle',capture.angle?.[0]],['lighting',capture.lighting?.[0]]])if(!chosen.has(key)&&value){s[key]=value;inferredGroups.push(key);}
  }
  const activeGroups=unique([...chosenGroups,...inferredGroups]),active=new Set(activeGroups),notes=[];
  let projection=active.has('lens')?(s.lens==='ortho'?'ORTHO':s.lens==='fisheye'?'PANO':'PERSP'):null;
  if(active.has('angle')&&s.angle==='isometric'){
    if(projection!=='ORTHO')notes.push('Isometric uses orthographic projection. The selected lens is kept in your choices but is not applied.');
    projection='ORTHO';
  }
  if(projection==='ORTHO'&&active.has('focus')&&s.focus==='shallow')notes.push('Cycles supports orthographic depth of field. Test the focus target and blur in the actual engine at the scene scale; a perspective lens preset does not set orthographic coverage.');
  if(projection==='ORTHO'&&active.has('focus')&&s.focus==='miniature')notes.push('Miniature focus is a separate stylized effect. Ordinary depth of field alone does not create a tilted focus band.');
  if(projection==='PANO')notes.push('Fisheye needs a supported panoramic camera, not a short perspective lens. Check the chosen render engine.');
  const camera={projection,mm:projection==='PERSP'?find('lens',s.lens).mm:null,notes,lens:projection==='ORTHO'?'ortho':active.has('lens')?s.lens:null,angle:active.has('angle')?s.angle:null,focus:active.has('focus')?s.focus:null,composition:active.has('composition')?s.composition:null};
  return {state:s,chosenGroups,inferredGroups,activeGroups,camera,operators:operatorChoices(s),capture};
}

const quote=value=>JSON.stringify(value);
const field=(label,value)=>value?.trim()?`${label}: ${quote(value)}.`:'';
const present=parts=>parts.filter(Boolean).join(' ');
const operatorWords={
  handheld:'Subtle correlated handheld movement; one event-driven flinch and a manual correction, then settle.',
  crashzoom:'React to the reveal with a rapid optical zoom from a nearly fixed position, a slight overshoot, focus recovery and settle; do not move forward as a dolly.',
  concealed:'Lean out from behind actual foreground cover, observe, then retreat; preserve the cover and continuous space.',
  whippan:'Turn rapidly toward an off-screen event with directional motion blur, slight overshoot and correction; maintain one continuous space.',
  walking:'Retreat through real space as the subject approaches, with small uneven step rhythms and perspective parallax.',
  obstruction:'A near-lens foreground element enters, briefly blocks the view, then clears; preserve subject identity and continuous action.',
  exposure:'Cross from dark interior into bright daylight; briefly overexpose, then adapt and settle to readable exposure.',
  focus:'Briefly miss focus after the event, hunt, then reacquire the intended subject and end sharp.'
};
const captureFinish={skate:'Mild grain and slight near-flash highlight clipping where the subject remains identifiable.',phone:'Slight directional handheld motion blur across the whole frame; keep the subject identifiable.',documentary:'Mild grain and slightly underexposed shadows away from the focal subject.',blurred:'Whole-frame directional camera-shake blur, with highlights streaking consistently.',curbside:'Soft nearby foreground partly cropped by the frame edge.',disposable:'Visible grain, limited highlight range near the flash and darker distant shadows, with identity preserved.',concealed:'A soft, physically plausible foreground cover edge overlaps part of the view.',cctv:'Restrained sensor noise and compression; no invented timestamp or branding.',drone:'Only capture limitations that the intended aerial shot needs.',camcorder:'Deliberately limited resolution, compression and subtle consumer-video sensor noise.',selfie:'A small candid framing error when appropriate; no required beauty smoothing.',action:'Motion or wide-angle capture limitations only where physically appropriate.',architectural:'No capture imperfection required; preserve geometric legibility.'};
const captureCamera={skate:'Very close, low, wide-angle participant viewpoint; near parts appear larger, the ground rises toward the lens, with a slightly crooked horizon.',phone:'A passing phone-height glance at handheld distance, with a loose incidental crop.',documentary:'A close, eye-level observer within the space; restrained perspective and framing that follows the action.',blurred:'Casual, slightly imprecise framing at handheld distance.',curbside:'A ground-level observer beside a near foreground edge, with wide surroundings behind the subject.',concealed:'A distant observer behind actual foreground cover, with part of the frame obstructed and the subject unaware.'};
const lightingProfiles={
  soft:{source:'One large soft source',direction:'From the side',quality:'Soft gradients and restrained environmental fill'},
  golden:{source:'Late-day sunlight',direction:'Low near the horizon',quality:'Warm key, cool readable fill and long shadows'},
  neon:{source:'A small number of visible practical or emissive sources',direction:'Motivated by the visible fixture positions',quality:'Controlled colored accents with readable shadow detail'},
  hard:{source:'A relatively small directional source',direction:'Positioned for the intended graphic shadow',quality:'Hard shadows and controlled negative fill'},
  overcast:{source:'An overcast sky',direction:'Broad sky illumination with subtle direction',quality:'Soft light with enough value separation to retain form'},
  backlit:{source:'A motivated source behind the subject',direction:'Behind or behind-side',quality:'Luminous edges and plausible bounce/fill on the front'}
};
export function resolvedOperator(op,camera,native=false){
  if(op.id==='crashzoom'&&camera.projection==='ORTHO')return 'Rapid parallel-view magnification: animate orthographic scale with slight overshoot and settle. This is reframing, not an optical focal-length zoom.';
  if(op.id==='crashzoom'&&camera.projection==='PANO')return 'Rapid fisheye magnification: change the supported fisheye field of view, then settle. If unsupported, report the limitation; do not request an ordinary focal-length zoom.';
  if(op.id==='walking'&&camera.projection==='ORTHO')return 'Translate backward through the scene with small step rhythms. Preserve parallel projection; the result is reframing without perspective parallax.';
  return native?`${op.implement} Distinction to preserve: ${op.distinction}`:operatorWords[op.id];
}
export function captureDescription(d,native=false){
  const {state:s,camera:cam,capture:cs,activeGroups}=d;
  if(!cs||cs.id==='none')return null;
  const active=new Set(activeGroups),lensKey=cam.projection==='ORTHO'?'ortho':s.lens;
  const viewpointConflict=active.has('angle')&&!cs.angle.includes(s.angle),lensConflict=cam.projection!==null&&!cs.lens.includes(lensKey);
  const lightConflict=!!(s.lightSource.trim()||s.lightDirection.trim()||s.lightQuality.trim())||(active.has('lighting')&&cs.lighting&&!cs.lighting.includes(s.lighting));
  const cameraConflict=viewpointConflict||lensConflict;
  const clean=active.has('finish')&&['clean','raw'].includes(s.finish);
  return {
    id:cs.id,label:cs.label,adapted:cameraConflict||lightConflict,
    camera:cameraConflict?'Use the resolved projection, viewpoint and framing; borrow only the observer’s candid or observational framing where compatible.':native?cs.camera:(captureCamera[cs.id]||cs.camera),
    light:lightConflict?'':native?(cs.lightDirection||''):(cs.light?`Light motivated as ${cs.light}.`:''),
    imperfection:clean?'Preserve the selected clean finish; any capture degradation belongs in a separate optional comparison, not the master.':native?cs.imperfection:captureFinish[cs.id],
    check:cameraConflict?'The resolved projection and viewpoint remain unchanged, the subject is readable, and no incompatible foreground enlargement or perspective effect is introduced.':cs.check,
    notes:[...(cameraConflict?[`${cs.label} is adapted to the explicit camera choices; do not claim the original capture recipe was reproduced.`]:[]),...(lightConflict?[`${cs.label} does not override the explicit lighting design.`]:[])]
  };
}
export function ctltParagraphs(d,{native=false,palette=null}={}){
  const s=d.state,active=new Set(d.activeGroups),cam=d.camera,cs=captureDescription(d,native),has=g=>active.has(g),preset=g=>native?find(g,s[g]).direction:`${find(g,s[g]).label}: ${find(g,s[g]).hint}`;
  const lens=cam.projection==='ORTHO'?'Orthographic parallel projection; set coverage with orthographic scale, do not apply a focal length.':cam.projection==='PANO'?(native?find('lens','fisheye').direction:'Panoramic fisheye projection with curved lines; a short rectilinear lens is not equivalent.'):cam.projection==='PERSP'?(native?find('lens',s.lens).direction:`${cam.mm} mm perspective lens on a 36 mm sensor; choose distance for the intended framing.`):'';
  const focus=has('focus')?(cam.projection==='ORTHO'&&s.focus==='shallow'?(native?'Cycles supports orthographic depth of field. Set an explicit focus target and test it at scene scale.':'Selective focus in the parallel view; test support in the chosen tool.'):preset('focus')):'';
  const timing=s.output==='animation'?[s.animationSeconds!==null?`Duration: ${s.animationSeconds} seconds.`:'',s.animationFps!==null?`Frame rate: ${s.animationFps} fps.`:'',field('Event',s.animationEvent),field('Recovery',s.animationRecovery),field('Operator timing',s.operatorTiming),...d.operators.map(op=>`${op.label}: ${resolvedOperator(op,cam,native)}`),...(s.operatorBeats.length?[`Timed beats (literal data): ${quote(s.operatorBeats)}.`]:[]),...(d.operators.length&&!s.animationEvent.trim()&&!s.operatorBeats.some(b=>b.trigger.trim())?['No motivating event is supplied; define its trigger and timing before executing the operator motion.']:[])]:[];
  const mapping=s.referenceAttachments.map((ref,index)=>({input:index+1,assetId:ref.id,role:ref.role,notes:ref.notes}));
  const camera=present([lens,has('angle')?preset('angle'):'',field('Shot size',s.shotSize),focus,has('composition')?preset('composition'):'',`Frame ${s.aspect}.`,field('Composition reference',s.referenceComposition),field('Reference attributes to borrow',s.referenceNotes),...(mapping.length?[`Reference input order and roles (literal data): ${quote(mapping)}. Supply the actual image/audio inputs in this order; each reference controls only its assigned role.`]:[]),...(cs?[`Capture language: ${cs.label}. ${cs.camera}`,...cs.notes]:[]),...timing]);
  const tone=present([field('Subject',s.subject||'[Subject not supplied]'),field('Action',s.action),field('Setting',s.environment),field('Tone',s.tone),field('Intent',s.intent),field('Time of day',s.timeOfDay),field('Weather',s.weather),field('Narrative contrast',s.storyContrast),field('Focal point',s.focalPoint),has('world')?`${preset('world')} Treatment strength: ${s.strength}.`:'',field('Identity reference',s.referenceIdentity),field('Must preserve',s.preserve),field('Exclusions',s.exclusions),...(s.output==='animation'?[field('Dialogue',s.dialogue),field('Sound',s.sound),field('Audio reference',s.referenceAudio),field('Audio role',s.audioNotes)]:[])]);
  const hasCustomLight=!!(s.lightSource.trim()||s.lightDirection.trim()||s.lightQuality.trim()),profile=has('lighting')?lightingProfiles[s.lighting]:{};
  const lightParts=hasCustomLight?[field('Source',s.lightSource||profile.source),field('Direction',s.lightDirection||profile.direction),field('Quality and key/fill',s.lightQuality||profile.quality)]:has('lighting')?[preset('lighting')]:[];
  const lighting=present([...lightParts,s.lightKelvin!==null?`Light color: ${s.lightKelvin} K.`:'',cs?.light||'',has('atmosphere')?preset('atmosphere'):'',field('Atmosphere reference',s.referenceAtmosphere),has('palette')?preset('palette'):'',s.paletteRoles?`Palette roles (literal data): ${quote(palette||s.paletteRoles)}.`:has('palette')&&palette?`Palette roles: ${quote(palette)}.`:'',s.customAccent?`Focal accent ${s.customAccent}.`: '']);
  const materialBehavior=s.materials.trim()&&has('material')&&!['pbr','worn'].includes(s.material)?'The explicit materials govern surface identity. Use physically appropriate roughness, metallicity and transmission for each stated material at real scale.':has('material')?preset('material'):'';
  const texture=present([field('Materials',s.materials),materialBehavior,field('Localized wear',s.wear),field('Small details',s.smallDetails),has('finish')?preset('finish'):'',...(cs?[`Capture finish: ${cs.imperfection}`]:[]),`Detail density: ${s.detail}. Add only details supported by the subject and story.`,field('Reject',s.reject),field('Acceptance criteria',s.acceptance)]);
  return {camera:camera||'Camera choices remain open; infer a coherent view from the subject without claiming a selected preset.',tone,lighting:lighting||'Lighting remains open; choose a motivated source for this scene and preserve the stated tone.',texture:texture||'Preserve material identity and story-appropriate surface scale.'};
}

export const styleTextKeys=['shotSize','lightSource','lightDirection','lightQuality'];
export function styleFromState(s){
  // Capture recipes transfer photographic treatment. Subject materials and wear remain variables.
  const selected=new Set(s.chosenGroups.filter(group=>group!=='material'));
  const settings={chosenGroups:[...selected],...Object.fromEntries(groups.filter(g=>selected.has(g)).map(g=>[g,s[g]])),strength:s.strength,detail:s.detail,captureStyle:s.captureStyle,...Object.fromEntries(styleTextKeys.filter(k=>s[k].trim()).map(k=>[k,s[k]])),...(s.lightKelvin!==null?{lightKelvin:s.lightKelvin}:{}),...(s.paletteRoles?{paletteRoles:{...s.paletteRoles}}:{}),...(s.customAccent?{customAccent:s.customAccent}:{})};
  return {schemaVersion:1,kind:'fieldwork-style',name:s.name,settings,source:{image:s.styleSource,prompt:s.generatingPrompt}};
}
export function stylePatch(style,current){
  if(!object(style)||style.schemaVersion!==1||style.kind!=='fieldwork-style'||!object(style.settings))throw new Error('Choose a Fieldwork style recipe.');
  const chosen=style.settings.chosenGroups;
  if(!Array.isArray(chosen)||chosen.some(g=>!groups.includes(g)))throw new Error('The style contains unknown visual sections.');
  const patch={chosenGroups:unique([...current.chosenGroups,...chosen])};
  for(const g of chosen){if(!find(g,style.settings[g]))throw new Error('The style contains an unknown visual choice.');patch[g]=style.settings[g];}
  // Imported recipes may deliberately bind materials; new extracted recipes never add those bindings.
  for(const key of [...styleTextKeys,'materials','wear','strength','detail','captureStyle','lightKelvin','paletteRoles','customAccent'])if(style.settings[key]!==undefined)patch[key]=style.settings[key];
  if(style.source!==undefined){
    if(!object(style.source)||!text(style.source.image??'',4000)||!text(style.source.prompt??'',300000))throw new Error('The style source must contain an image path/link and text prompt.');
    if(style.source.image?.trim())patch.styleSource=style.source.image;
    if(style.source.prompt?.trim())patch.generatingPrompt=style.source.prompt;
  }
  // Content, identity/audio references, timeline, journal and manual drafts belong to the target project.
  return patch;
}
