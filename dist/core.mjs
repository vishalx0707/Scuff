import {catalog, defaults, groups, find} from './presets.mjs';
import {research, researchKeys, dataBlock, researchStatus, researchSearchLines} from './workflows.mjs';
import {generatorPrompt,fullDirection} from './compiler.mjs';
import {extendedTextLimits,normalizeExtended,resolveChoices,captureDescription,styleFromState,stylePatch} from './direction.mjs';
const choices = {medium:['general','blender','image','video'],strength:['subtle','balanced','bold'], aspect:['3:2','16:9','1:1','9:16'],mode:['new','copy'],output:['still','animation'],quality:['preview','final'],detail:['sparse','balanced','intricate'],...Object.fromEntries(researchKeys.map(k=>[k,research[k].options.map(o=>o.id)]))};
const textLimits = {name:100,subject:4000,exclusions:3000,references:4000,intent:2000,environment:2000,focalPoint:1000,preserve:3000,reject:3000,acceptance:3000,referenceNotes:4000,promptDraft:300000,promptBasis:300000,animationEvent:1000,animationRecovery:1000,referenceIdentity:1000,referenceComposition:1000,referenceAtmosphere:1000,natureFoliage:2000,natureExclusions:2000,...extendedTextLimits};
// Optional numbers: null means not specified. Strict imports reject invalid values; interactive edits clamp finite numbers.
export const numberLimits = {animationSeconds:{min:0.5,max:600},animationFps:{min:1,max:120},natureTerrainM:{min:1,max:10000},natureScatterMax:{min:1,max:100000,integer:true},natureSeed:{min:0,max:2147483647,integer:true},lightKelvin:{min:1000,max:40000}};
const judgmentKeys=groups.flatMap(g=>[g,...catalog[g].options.map(o=>`${g}:${o.id}`)]);
export const paletteKeys=['environment','subject','accent','shadow','highlight'];
export function paletteFor(input){
  const s=normalize(input),c=find('palette',s.palette).colors;
  return s.paletteRoles||{environment:c[0],subject:c[2],accent:s.customAccent||c[1],shadow:'#252733',highlight:'#F1F2F5'};
}
export function normalize(input, strict=false) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Choose a Fieldwork direction JSON file.');
  if (strict && input.schemaVersion!==1) throw new Error('This file uses an unsupported direction format.');
  const result={...defaults,judgments:{},paletteRoles:null,journal:[]};
  for (const key of groups) {
    if (input[key]!==undefined) {
      if (!find(key,input[key])) {if(strict) throw new Error(`Unknown ${catalog[key].label.toLowerCase()} option.`);}
      else result[key]=input[key];
    }
  }
  for (const [key,allowed] of Object.entries(choices)) {
    if(input[key]!==undefined) {
      if(!allowed.includes(input[key])) {if(strict) throw new Error(`Unknown ${key} setting.`);}
      else result[key]=input[key];
    }
  }
  for(const [key,max] of Object.entries(textLimits)) {
    if(input[key]!==undefined) {
      if(typeof input[key]!=='string' || input[key].length>max) {if(strict) throw new Error(`${key} must be text of at most ${max} characters.`);}
      else result[key]=input[key];
    }
  }
  for(const [key,{min,max,integer}] of Object.entries(numberLimits)) {
    const value=input[key];
    if(value===undefined||value===null) continue;
    const finite=typeof value==='number'&&Number.isFinite(value);
    if(finite&&value>=min&&value<=max&&(!integer||Number.isInteger(value))) result[key]=value;
    else if(strict) throw new Error(`${key} must be ${integer?'a whole number':'a number'} from ${min} to ${max}, or null.`);
    else if(finite) result[key]=Math.min(max,Math.max(min,integer?Math.round(value):value));
  }
  if(typeof input.review==='boolean') result.review=input.review;
  if(typeof input.customAccent==='string' && /^#[0-9a-f]{6}$/i.test(input.customAccent)) result.customAccent=input.customAccent;
  else if(strict && input.customAccent) throw new Error('Use a six-digit hex color for the accent.');
  if(input.judgments!==undefined){
    if(!input.judgments||typeof input.judgments!=='object'||Array.isArray(input.judgments)){if(strict)throw new Error('Choice notes must be a text map.');}
    else for(const key of judgmentKeys){const value=input.judgments[key];if(value===undefined)continue;if(typeof value!=='string'||value.length>2000){if(strict)throw new Error('Each choice note must be text of at most 2000 characters.');}else result.judgments[key]=value;}
  }
  if(input.paletteRoles!==undefined&&input.paletteRoles!==null){
    const valid=typeof input.paletteRoles==='object'&&!Array.isArray(input.paletteRoles)&&paletteKeys.every(k=>typeof input.paletteRoles[k]==='string'&&/^#[0-9a-f]{6}$/i.test(input.paletteRoles[k]));
    if(!valid){if(strict)throw new Error('Supply all five palette roles as six-digit hex colors.');}
    else result.paletteRoles=Object.fromEntries(paletteKeys.map(k=>[k,input.paletteRoles[k]]));
  }
  if(input.journal!==undefined){
    if(!Array.isArray(input.journal)||input.journal.length>50){if(strict)throw new Error('The review journal must contain at most 50 entries.');}
    else for(const entry of input.journal){
      const valid=entry&&typeof entry==='object'&&['id','at','issue','change','outcome'].every(k=>typeof entry[k]==='string')&&entry.id.length<=100&&entry.at.length<=60&&entry.issue.length<=2000&&entry.change.length<=2000&&['pending','improved','mixed','rejected'].includes(entry.outcome);
      if(!valid){if(strict)throw new Error('A journal entry is malformed. Keep its date, issue, change and review outcome.');}
      else result.journal.push(Object.fromEntries(['id','at','issue','change','outcome'].map(k=>[k,entry[k]])));
    }
  }
  return normalizeExtended(input,result,strict);
}
export function freshDirection(medium='general'){return normalize({schemaVersion:1,medium,chosenGroups:[]});}
export function effectiveDirection(input){
  const normalized=normalize(input),d=resolveChoices({...normalized,output:effectiveOutput(normalized)});
  d.status=researchStatus(d.state,d.camera);
  d.status.activeGroups=d.activeGroups;
  d.status.inferredGroups=d.inferredGroups;
  d.status.capture=captureDescription(d,true);
  d.shots=d.state.shots.map(shot=>{
    const shotGroups=['lens','angle','focus','composition'].filter(key=>shot[key]!==undefined);
    const child=resolveChoices({...d.state,...shot,chosenGroups:[...new Set([...d.activeGroups,...shotGroups])],shots:[]});
    return {...shot,effectiveCamera:child.camera};
  });
  return d;
}
export function effectiveCamera(input){return effectiveDirection(input).camera;}
export function effectiveOutput(s){return s.medium==='video'?'animation':s.medium==='image'?'still':s.output;}
export function effectiveResearch(input){return effectiveDirection(input).status;}
export function compileGeneratorPrompt(input){const d=effectiveDirection(input);return generatorPrompt(d,paletteFor(d.state));}
export function compilePrompt(input){const d=effectiveDirection(input);return fullDirection(d,paletteFor(d.state));}
export function createStyle(input){return styleFromState(normalize(input));}
export function applyStyle(input,style){const current=normalize(input);return normalize({...current,...stylePatch(style,current)},true);}
export function referenceSearch(input) {
  const d=effectiveDirection(input),s=d.state,active=new Set(d.activeGroups);
  const selected=groups.filter(g=>active.has(g)).map(g=>`${catalog[g].label}: ${find(g,s[g]).label}.`);
  const medium=s.medium==='blender'?'creative 3D scene':s.medium==='video'?'video and motion':'visual';
  return [
    '# Fieldwork / reference-search brief',dataBlock('Subject',s.subject||'Not specified'),
    ...[['Action',s.action],['Tone',s.tone],['Setting',s.environment],['Time',s.timeOfDay],['Weather',s.weather]].filter(([,v])=>v.trim()).map(([k,v])=>dataBlock(k,v)),
    ...selected,...researchSearchLines(s),
    `Search for specific ${medium} references for this subject and the selected visual decisions. Unselected choices remain open. Inspect the actual images, prefer specific authorship and visual intent, and avoid generic lifestyle filler. Do not assume a pin was made in a particular tool.`,
    'For each reference retain its source URL, creator when known, the useful attribute and uncertainty. Keep camera settings as hypotheses unless metadata or source scene verifies them. Assign identity, composition, atmosphere or style roles independently.',
    'Verify reuse rights before bundling images in the app. Do not copy an artist’s scene wholesale or alter a personal account or recommendations without authorization. This text is a search plan; it does not execute a search.'
  ].join('\n\n');
}
export function exportBrief(input) {return {...normalize(input),exportedAt:new Date().toISOString(),generator:'Fieldwork 0.3.1'};}
export function safeFileName(name) {return (name||'direction').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'direction';}
