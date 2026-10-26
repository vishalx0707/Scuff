import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults} from '../dist/presets.mjs';
import {normalize,compilePrompt,exportBrief,referenceSearch,effectiveOutput} from '../dist/core.mjs';

test('medium survives strict imports and exports; legacy briefs stay Blender',()=>{
  for(const medium of ['general','blender','image','video']){
    const s=normalize({...defaults,medium,subject:'A quiet courtyard'},true);
    assert.deepEqual(normalize(exportBrief(s),true),s);
  }
  const {medium,...legacy}=defaults;
  assert.equal(normalize(legacy,true).medium,'blender');
  assert.throws(()=>normalize({...defaults,medium:'unknown'},true));
});

test('image and video handoffs do not send users into Blender',()=>{
  for(const medium of ['image','video']){
    const text=compilePrompt({...defaults,medium,subject:'A courtyard',workflow:'nature',natureScatterMax:100,animationSeconds:8,animationFps:24,animationEvent:'Reveal the arch',cameraOperator:'walking',referenceIdentity:'Source A',reject:'Unreadable silhouette',paletteRoles:{environment:'#111111',subject:'#222222',accent:'#333333',shadow:'#444444',highlight:'#555555'}});
    assert.match(text,new RegExp('^# '+(medium==='image'?'Image':'Video')+' generation direction'));
    assert.doesNotMatch(text,/Blender|MCP|\.blend|shader|100 foliage instances/);
    assert.match(text,/Source A/);assert.match(text,/Unreadable silhouette/);assert.match(text,/#333333/);
    if(medium==='video'){assert.match(text,/Reveal the arch/);assert.match(text,/8 seconds/);assert.match(text,/24 fps/);assert.match(text,/Camera movement:/);}
    else assert.doesNotMatch(text,/Reveal the arch|## Motion|Camera movement:/);
  }
});

test('general keeps context unresolved and manual drafts remain recoverable across modes',()=>{
  assert.match(compilePrompt({...defaults,medium:'general'}),/Infer the intended medium from the conversation/);
  const original=compilePrompt({...defaults,subject:'An arch'});
  const s=normalize({...defaults,medium:'image',subject:'An arch',promptDraft:'Keep my manual edit',promptBasis:original},true);
  assert.equal(exportBrief(s).promptDraft,'Keep my manual edit');assert.notEqual(compilePrompt(s),s.promptBasis);
  assert.match(referenceSearch(s),/visual references/);
});

test('switching generation medium never destroys the Blender deliverable',()=>{
  const animation={...defaults,output:'animation',animationEvent:'Reveal the arch'};
  const image=normalize({...animation,medium:'image'},true);
  assert.equal(effectiveOutput(image),'still');assert.equal(image.output,'animation');
  const restored=normalize({...image,medium:'blender'},true);
  assert.equal(effectiveOutput(restored),'animation');assert.match(compilePrompt(restored),/Reveal the arch/);
  assert.equal(effectiveOutput({...defaults,medium:'video'}),'animation');
  assert.doesNotMatch(compilePrompt({...defaults,medium:'video'}),/not specified seconds|not specified fps/);
  for(const lighting of ['soft','hard','neon'])for(const atmosphere of ['clear','haze','fog','dust']){
    assert.doesNotMatch(compilePrompt({...defaults,medium:'image',lighting,atmosphere}),/clay preview|volume treatment|scale-aware density|densest region/);
  }
});
