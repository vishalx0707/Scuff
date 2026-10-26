import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
import {normalize,compileGeneratorPrompt} from '../dist/core.mjs';
test('CLI preserves exported prompt edits, supports explicit regeneration and accepts extended briefs',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'direction-cli-'));
 try{const file=path.join(dir,'direction.json'),out=path.join(dir,'prompt.md');
 await writeFile(file,JSON.stringify({schemaVersion:1,subject:'A folded tower',promptDraft:'Keep my authored prompt',promptBasis:'old',journal:Array.from({length:30},(_,i)=>({id:String(i),at:'2026-10-24T18:00:00Z',issue:'A'.repeat(1800),change:'B'.repeat(1800),outcome:'pending'}))}));
 const result=await exec(process.execPath,['compile.mjs',file,out],{cwd:new URL('..',import.meta.url)});assert.match(result.stderr,/predates/);assert.equal((await readFile(out,'utf8')).trim(),'Keep my authored prompt');
 await exec(process.execPath,['compile.mjs',file,out,'--regenerate'],{cwd:new URL('..',import.meta.url)});assert.match(await readFile(out,'utf8'),/A folded tower/);assert.match(await readFile(out,'utf8'),/User-recorded review journal/);
 }finally{const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(tmpdir())||!path.basename(target).startsWith('direction-cli-'))throw Error('Refusing to remove an unexpected test directory.');await rm(target,{recursive:true,force:true});}
});
test('CLI keeps separate authored generator text and deliberately exports a content-free style',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'direction-cli-'));
 try{
  const file=path.join(dir,'direction.json'),state=normalize({schemaVersion:1,medium:'video',subject:'New dog on a train platform',tone:'Expectant',animationSeconds:5,animationFps:24,materials:'Dog fur',wear:'Muddy paws',generatorDraft:'My authored five-second prompt',generatorBasis:'old',styleSource:'approved.png',generatingPrompt:'The original producing prompt'});
  await writeFile(file,JSON.stringify(state));
  const preserved=await exec(process.execPath,['compile.mjs',file,'--generator'],{cwd:new URL('..',import.meta.url)});assert.equal(preserved.stdout.trim(),state.generatorDraft);assert.match(preserved.stderr,/predates/);
  const generated=await exec(process.execPath,['compile.mjs',file,'--generator','--regenerate'],{cwd:new URL('..',import.meta.url)});assert.equal(generated.stdout.trim(),compileGeneratorPrompt(state));assert.match(generated.stdout,/5 seconds/);assert.match(generated.stdout,/24 fps/);
  const recipe=JSON.parse((await exec(process.execPath,['compile.mjs',file,'--style'],{cwd:new URL('..',import.meta.url)})).stdout);assert.equal(recipe.kind,'fieldwork-style');assert.equal(recipe.source.prompt,state.generatingPrompt);assert.equal(recipe.settings.subject,undefined);assert.equal(recipe.settings.materials,undefined);assert.equal(recipe.settings.wear,undefined);assert.equal(recipe.settings.generatorDraft,undefined);
  await assert.rejects(exec(process.execPath,['compile.mjs',file,'--generator','--references'],{cwd:new URL('..',import.meta.url)}));
 }finally{const target=path.resolve(dir);if(path.dirname(target)!==path.resolve(tmpdir())||!path.basename(target).startsWith('direction-cli-'))throw Error('Refusing to remove an unexpected test directory.');await rm(target,{recursive:true,force:true});}
});
