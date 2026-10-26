import {readFile,writeFile} from 'node:fs/promises';
import {normalize,compilePrompt,compileGeneratorPrompt,referenceSearch,createStyle} from './dist/core.mjs';
const args=process.argv.slice(2),refs=args.includes('--references'),regenerate=args.includes('--regenerate'),generator=args.includes('--generator'),style=args.includes('--style');
const flags=['--references','--regenerate','--generator','--style','--help'],unknown=args.filter(x=>x.startsWith('--')&&!flags.includes(x)),pos=args.filter(x=>!flags.includes(x));
if(args.includes('--help')||!pos[0]){console.log('Usage: node compile.mjs direction.json [output] [--generator | --references | --style] [--regenerate]\nDefault: agent execution brief. --generator: concise CTLT generation prompt. --style: transferable style JSON.\nSaved manual drafts are preserved; --regenerate deliberately rebuilds the selected prompt.');process.exit(args.includes('--help')?0:1);}
try{
  if(unknown.length)throw new Error('Unknown option: '+unknown[0]);
  if(pos.length>2)throw new Error('Supply an input file and at most one output file.');
  if([refs,generator,style].filter(Boolean).length>1)throw new Error('Choose one output: --generator, --references or --style.');
  if(regenerate&&(refs||style))throw new Error('--regenerate applies only to an agent or generator prompt.');
  const text=await readFile(pos[0],'utf8');if(Buffer.byteLength(text)>2097152)throw new Error('Direction file must be smaller than 2 MB.');
  const state=normalize(JSON.parse(text),true);if(!state.subject.trim()&&!style)throw new Error('The direction needs a subject before it can be compiled.');
  let result;
  if(refs)result=referenceSearch(state);
  else if(style)result=JSON.stringify(createStyle(state),null,2);
  else{
    const generated=generator?compileGeneratorPrompt(state):compilePrompt(state),draft=generator?state.generatorDraft:state.promptDraft,basis=generator?state.generatorBasis:state.promptBasis;
    result=!regenerate&&draft?draft:generated;
    if(!regenerate&&draft&&basis!==generated)console.error('Note: this saved prompt predates the current choices. It is preserved as edited. Use --regenerate to rebuild it.');
  }
  if(pos[1])await writeFile(pos[1],result+'\n','utf8');else console.log(result);
}catch(error){console.error(`Fieldwork: ${error.message}`);process.exitCode=1;}
