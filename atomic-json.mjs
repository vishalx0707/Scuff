import {writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export async function saveJSON(file,value){
  const temp=file+'.'+randomUUID()+'.tmp';
  try {
    await writeFile(temp,JSON.stringify(value,null,2),'utf8');
    for(let attempt=0;;attempt++){
      try {await rename(temp,file);return;}
      catch(error){
        // Windows scanners can briefly deny replacement after a read. Retry the
        // atomic operation; never unlink the previous authoritative snapshot.
        if(process.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=5)throw error;
        await delay(20*2**attempt);
      }
    }
  } catch(error){await unlink(temp).catch(()=>{});throw error;}
}
