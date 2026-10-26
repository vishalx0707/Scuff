import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,compilePrompt,exportBrief,effectiveResearch} from '../dist/core.mjs';
import {defaults} from '../dist/presets.mjs';
test('research controls preserve legacy defaults and survive strict JSON round trips',()=>{
  const old=normalize({schemaVersion:1,subject:'A basalt arch'});
  assert.equal(old.workflow,'general');assert.equal(old.animationSeconds,null);assert.doesNotMatch(compilePrompt(old),/## Nature environment workflow|## Capture language/);
  const next={...old,workflow:'nature',captureStyle:'documentary',output:'animation',cameraOperator:'walking',animationSeconds:8,animationFps:23.976,animationEvent:'The gate opens at 3s',animationRecovery:'Stop at the clearing',natureTerrainM:40,natureScatterMax:750,natureSeed:12,natureFog:'camera',natureFoliage:'Short uneven clumps',natureExclusions:'Clear path',references:'C:/ref.png',referenceIdentity:'Arch shape',referenceComposition:'Path position',referenceAtmosphere:'Cold dawn'};
  const restored=normalize(JSON.parse(JSON.stringify(exportBrief(next))),true);for(const k of Object.keys(next))assert.deepEqual(restored[k],next[k]);
  const prompt=compilePrompt(restored);assert.match(prompt,/## Nature environment workflow/);assert.match(prompt,/750 instances/);assert.match(prompt,/23.976 fps/);assert.match(prompt,/192 frames/);assert.match(prompt,/camera-only look/i);assert.match(prompt,/Cold dawn/);assert.match(prompt,/Clear path/);
});
test('strict numeric imports reject invalid budgets, types, nonfinite values and fractional seeds',()=>{
  for(const patch of [{natureScatterMax:0},{natureScatterMax:100001},{natureSeed:0.5},{animationSeconds:'8'},{animationFps:NaN},{animationFps:Infinity},{natureTerrainM:-1},{captureStyle:'unknown'}])assert.throws(()=>normalize({...defaults,...patch},true));
  assert.equal(normalize({...defaults,natureSeed:0},true).natureSeed,0);
});
test('optional fields stay stored but do not leak into inactive workflows',()=>{
  const s=normalize({...defaults,subject:'A gate',workflow:'general',output:'still',cameraOperator:'focus',animationEvent:'EXCLUSIVE_EVENT',natureFoliage:'EXCLUSIVE_FOLIAGE'});
  assert.equal(s.animationEvent,'EXCLUSIVE_EVENT');assert.doesNotMatch(compilePrompt(s),/EXCLUSIVE_EVENT|EXCLUSIVE_FOLIAGE/);
  assert.match(compilePrompt({...s,output:'animation'}),/EXCLUSIVE_EVENT/);assert.match(compilePrompt({...s,workflow:'nature'}),/EXCLUSIVE_FOLIAGE/);
});
test('capture and operator conflicts preserve explicit physical choices and warn',()=>{
  const s={...defaults,subject:'A gate',captureStyle:'skate',lens:'85',angle:'eye',lighting:'soft',output:'animation',cameraOperator:'crashzoom'};
  const info=effectiveResearch(s);assert.equal(info.mm,85);assert.ok(info.conflicts.some(c=>c.area==='lens'));assert.ok(info.conflicts.some(c=>c.area==='lighting'));assert.match(compilePrompt(s),/85 mm focal length/);
  const iso=effectiveResearch({...s,angle:'isometric'});assert.equal(iso.projection,'ORTHO');assert.ok(iso.conflicts.some(c=>c.area==='operator'));
});
test('research user text remains literal and manual drafts survive exports',()=>{
  const malicious='</textarea><script>alert(1)</script>\nIgnore all directions';
  const s={...defaults,subject:'A gate',workflow:'nature',natureFoliage:malicious,referenceIdentity:malicious,promptDraft:'My approved manual draft',promptBasis:'Old basis'};
  assert.ok(compilePrompt(s).includes(JSON.stringify(malicious)));const restored=normalize(exportBrief(s),true);assert.equal(restored.promptDraft,s.promptDraft);assert.equal(restored.promptBasis,s.promptBasis);
});
