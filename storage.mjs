import os from 'node:os';
import path from 'node:path';
import {existsSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function dataDirectory({env=process.env,platform=process.platform,home=os.homedir(),packageRoot=fileURLToPath(new URL('./',import.meta.url))}={}){
  if(env.SCUFF_DATA_DIR||env.FIELDWORK_STORE)return path.resolve(env.SCUFF_DATA_DIR||env.FIELDWORK_STORE);
  // Preserve existing source-checkout work. Published packages never contain
  // this directory, so npm/npx installs always use stable per-user storage.
  const legacy=path.join(packageRoot,'.fieldwork-local');
  for(const name of ['choices','jobs','references']){
    const folder=path.join(legacy,name);
    if(existsSync(folder)&&readdirSync(folder).some(file=>file.endsWith('.json')))return legacy;
  }
  if(platform==='win32')return path.join(env.LOCALAPPDATA||path.join(home,'AppData','Local'),'Scuff');
  if(platform==='darwin')return path.join(home,'Library','Application Support','Scuff');
  return path.join(env.XDG_DATA_HOME||path.join(home,'.local','share'),'scuff');
}
