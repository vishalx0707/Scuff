import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dataDirectory} from '../storage.mjs';
const exec=promisify(execFile),bin=fileURLToPath(new URL('../bin/scuff.mjs',import.meta.url));

test('fresh installs use platform user-data directories outside the package',()=>{
  const home=path.join(os.tmpdir(),'scuff-user'),packageRoot=path.join(os.tmpdir(),'absent-scuff-install');
  assert.equal(dataDirectory({env:{},platform:'win32',home,packageRoot}),path.join(home,'AppData','Local','Scuff'));
  assert.equal(dataDirectory({env:{},platform:'darwin',home,packageRoot}),path.join(home,'Library','Application Support','Scuff'));
  assert.equal(dataDirectory({env:{},platform:'linux',home,packageRoot}),path.join(home,'.local','share','scuff'));
  const base=path.join(home,'custom-data');
  assert.equal(dataDirectory({env:{XDG_DATA_HOME:base},platform:'linux',home,packageRoot}),path.join(base,'scuff'));
});

test('explicit data settings take precedence and populated legacy source stores stay usable',async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'scuff-storage-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const old=path.join(folder,'.fieldwork-local'),env={SCUFF_DATA_DIR:path.join(folder,'new'),FIELDWORK_STORE:old};
  assert.equal(dataDirectory({env,packageRoot:folder}),env.SCUFF_DATA_DIR);
  assert.equal(dataDirectory({env:{FIELDWORK_STORE:old},packageRoot:folder}),old);
  await mkdir(path.join(old,'choices'),{recursive:true});await writeFile(path.join(old,'choices','saved.json'),'{}');
  assert.equal(dataDirectory({env:{},packageRoot:folder}),old);
});

test('public CLI reports its version, dispatches commands and rejects invalid server options',async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'scuff-cli-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const env={...process.env,SCUFF_DATA_DIR:path.join(folder,'persistent-data')};
  const run=args=>exec(process.execPath,[bin,...args],{env});
  assert.equal((await run(['--version'])).stdout.trim(),'0.4.0');
  assert.equal((await run(['data'])).stdout.trim(),env.SCUFF_DATA_DIR);
  assert.deepEqual(JSON.parse((await run(['jobs','list'])).stdout),[]);
  await assert.rejects(run(['serve','--port','nope']),/--port/);
  await assert.rejects(run(['serve','--port','80']),/1024/);
  await assert.rejects(run(['mcp','unexpected']),/takes no arguments/);
});
