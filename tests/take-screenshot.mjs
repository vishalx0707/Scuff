import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.FIELDWORK_PLAYWRIGHT_MODULE||'playwright');
const server=createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try {
 await mkdir(new URL('../docs/images/',import.meta.url),{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await page.goto(`http://127.0.0.1:${server.address().port}/?medium=blender#camera`);
 await page.locator('[data-option="lens:35"]').click();
 await page.locator('.example-image').first().evaluate(async image=>{if(!image.complete)await new Promise(resolve=>image.addEventListener('load',resolve,{once:true}));});
 await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);});
 await page.screenshot({path:fileURLToPath(new URL('../docs/images/workspace.png',import.meta.url))});
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
