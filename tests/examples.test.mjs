import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog} from '../dist/presets.mjs';
import {exampleFor,exampleNote} from '../dist/examples.mjs';

const sections={...Object.fromEntries(Object.entries(catalog).map(([group,data])=>[group,data.options.map(o=>o.id)])),detail:['sparse','balanced','intricate']};
const sectionExamples=Object.entries(sections).map(([group,ids])=>({group,ids,examples:ids.map(id=>exampleFor(group,id))}));

test('every option has one in-bounds unique tile and its section keeps a fixed scene',()=>{
  let covered=0;
  for(const {group,ids,examples} of sectionExamples){
    assert.ok(examples.every(Boolean),`${group}: missing example`);
    assert.equal(new Set(examples.map(e=>e.src)).size,1,`${group}: options must share one scene atlas`);
    assert.equal(new Set(examples.map(e=>e.scene)).size,1,`${group}: options must retain their scene identity`);
    const cells=new Set();
    examples.forEach((example,i)=>{
      assert.match(example.src,/^assets\/examples\/[a-z]+-atlas\.png$/);
      for(const key of ['columns','rows'])assert.ok(Number.isInteger(example[key])&&example[key]>0,`${group}:${ids[i]} invalid ${key}`);
      assert.ok(Number.isInteger(example.column)&&example.column>=0&&example.column<example.columns,`${group}:${ids[i]} column outside atlas`);
      assert.ok(Number.isInteger(example.row)&&example.row>=0&&example.row<example.rows,`${group}:${ids[i]} row outside atlas`);
      assert.ok(!cells.has(`${example.column}:${example.row}`),`${group}: two options share the same illustration tile`);
      cells.add(`${example.column}:${example.row}`);covered++;
    });
  }
  assert.equal(covered,57);
  assert.equal(exampleFor('lens','not-an-option'),null);
  assert.equal(exampleFor('__proto__','constructor'),null);
});

test('each section has its own distinct scene and source asset',()=>{
  assert.equal(sectionExamples.length,11);
  assert.equal(new Set(sectionExamples.map(s=>s.examples[0]?.src)).size,11,'A new section must not reuse another section’s atlas');
  assert.equal(new Set(sectionExamples.map(s=>s.examples[0]?.scene)).size,11,'Each section needs a distinct example subject');
  assert.match(exampleNote('lens','35'),/not a measured optical simulation/);
  assert.match(exampleNote('focus','miniature'),/Illustrative/);
});

test('each mapped source is a real PNG with enough pixels for its atlas grid',async()=>{
  for(const {group,examples} of sectionExamples){
    const example=examples[0],bytes=await readFile(new URL('../dist/'+example.src,import.meta.url));
    assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),`${group}: not a PNG`);
    assert.equal(bytes.toString('ascii',12,16),'IHDR');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    assert.ok(width/example.columns>=300&&height/example.rows>=160,`${group}: atlas cells are too small for clear section previews (${width}x${height})`);
  }
});

test('installed images match eleven distinct reference-fed generation records',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../dist/assets/examples/provenance.json',import.meta.url),'utf8'));
  assert.equal(manifest.entries.length,11);
  assert.equal(new Set(manifest.entries.map(e=>e.inputSHA256)).size,11);
  assert.equal(new Set(manifest.entries.map(e=>e.inputPin)).size,11);
  for(const {group,examples} of sectionExamples){
    const entry=manifest.entries.find(e=>e.group===group);assert.ok(entry,group);
    assert.equal(entry.actualReferencePassed,true);
    assert.match(entry.inputPin,/^https:\/\/www\.pinterest\.com\/pin\/\d+\/$/);
    assert.match(entry.inputSHA256,/^[a-f0-9]{64}$/);
    assert.ok(examples[0].src.endsWith('/'+entry.file));
    const bytes=await readFile(new URL('../dist/'+examples[0].src,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.outputSHA256,group+': selected output differs from the inspected reference-based generation');
  }
});
