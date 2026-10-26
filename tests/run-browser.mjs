import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
// Optional QA dependency only. This is not loaded by the application.
const {chromium}=require(process.env.FIELDWORK_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true});
let result;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 const code=await readFile(new URL('./browser-check.js',import.meta.url),'utf8');
 const run=new Function('return ('+code+')')();
 try{result=await run(page);}
 catch(error){
  // A failed assertion carries the checks that passed before it, so the report shows where the run stopped.
  result={failed:error.message,checks:error.checks||[],errors:error.errors||[],external:error.external||[]};
  if(!error.checks)result.stack=error.stack;
  process.exitCode=1;
 }
 console.log(JSON.stringify({passed:result.checks.length,failed:result.failed,errors:result.errors,external:result.external}));
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2));
}finally{await browser.close();}
