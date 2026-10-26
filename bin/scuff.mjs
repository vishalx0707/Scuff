#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dataDirectory} from '../storage.mjs';

const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const args=process.argv.slice(2);
try {
  if(args.includes('--version')||args.includes('-v'))console.log(version);
  else if(args.includes('--help')||args.includes('-h')||args[0]==='help'){
    console.log(`Scuff ${version}\n\nUsage: scuff [serve] [--port 8787] [--store <folder>]\n       scuff mcp\n       scuff choices <command> [...options]\n       scuff jobs <command> [...options]\n       scuff compile <direction.json> [...options]\n       scuff data\n\nThe local site stays on localhost. No browser window or model is launched.\nData stays in your user-data folder, outside npm's installation/cache.\nSCUFF_DATA_DIR overrides storage; FIELDWORK_STORE remains supported.`);
  } else {
    const command=args[0]&&!args[0].startsWith('-')?args.shift():'serve';
    const storeIndex=args.indexOf('--store');
    if(storeIndex>=0){const value=args[storeIndex+1];if(!value||value.startsWith('--'))throw Error('Supply a folder after --store.');process.env.SCUFF_DATA_DIR=path.resolve(value);args.splice(storeIndex,2);}
    if(command==='data'){if(args.length)throw Error('scuff data takes no arguments.');console.log(dataDirectory());}
    else {
      const modules={serve:'server.mjs',mcp:'agent-mcp.mjs',choices:'choices.mjs',jobs:'jobs.mjs',compile:'compile.mjs'};
      if(!Object.hasOwn(modules,command))throw Error(`Unknown command: ${command}. Use scuff --help.`);
      if(command==='serve'){
        if(args.length){if(args.length!==2||args[0]!=='--port'||!/^\d+$/.test(args[1]))throw Error('Use scuff serve --port <1024–65535>.');args.splice(0,1);}
      } else if(command==='mcp'&&args.length)throw Error('scuff mcp takes no arguments. Use SCUFF_URL and SCUFF_DATA_DIR for configuration.');
      const moduleURL=new URL('../'+modules[command],import.meta.url);
      process.argv=[process.execPath,fileURLToPath(moduleURL),...args];
      await import(moduleURL.href);
    }
  }
} catch(error){console.error('Scuff: '+error.message);process.exitCode=1;}
