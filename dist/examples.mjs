// Each section compares one fixed example scene. Tiles never depend on other selections.
// These generated illustrations explain a visual intention; they are not optical measurements.
const sheets = [
  {file:'language-atlas.png',columns:3,rows:2,scene:'A winding path through golden grass dunes',pin:'416301559310987717',groups:{world:['dreamy','brutalist','cyberpunk','maximalist','tactile','graphic']}},
  {file:'lens-atlas.png',columns:3,rows:3,scene:'A meadow with a spreading tree and layered landscape',pin:'647955465109369054',groups:{lens:['35','24','85','50','135','ortho','fisheye']}},
  {file:'angle-atlas.png',columns:3,rows:3,scene:'A concrete wall opening with palm fronds beyond',pin:'464011567875539429',groups:{angle:['threequarter','low','overhead','eye','high','dutch','isometric']}},
  {file:'focus-atlas.png',columns:2,rows:2,scene:'Sunlit ridges of mossy grass',pin:'789185534742575117',groups:{focus:['balanced','shallow','deep','miniature']}},
  {file:'composition-atlas.png',columns:2,rows:2,scene:'A seated ochre-cloaked figure in an overgrown forest passage',pin:'462393086767035895',groups:{composition:['thirds','center','space','frame']}},
  {file:'lighting-atlas.png',columns:3,rows:2,scene:'A figure at a table beside a cafe window',pin:'527765650101799752',groups:{lighting:['soft','golden','neon','hard','overcast','backlit']}},
  {file:'atmosphere-atlas.png',columns:2,rows:2,scene:'A small figure on rolling green hills beside a pine',pin:'95490454611031640',groups:{atmosphere:['clear','haze','fog','dust']}},
  {file:'palette-atlas.png',columns:3,rows:2,scene:'Painted exterior stairs with geometric walls',pin:'562527809706516884',groups:{palette:['moss','cyan','butter','plum','mono','sand']}},
  {file:'material-atlas.png',columns:3,rows:2,scene:'Angular concrete steps with a triangular plant opening',pin:'740490363779933934',groups:{material:['pbr','clay','metal','glass','organic','worn']}},
  {file:'finish-atlas.png',columns:2,rows:2,scene:'An umbrella and taxi on a rainy Japanese street',pin:'511088257712109819',groups:{finish:['clean','film','bloom','raw']}},
  {file:'detail-atlas.png',columns:3,rows:1,scene:'Grass growing along the edge of a concrete wall',pin:'535928424430447759',groups:{detail:['sparse','balanced','intricate']}}
];
const examples = new Map();
for(const sheet of sheets){
  let index=0;
  for(const [group,ids] of Object.entries(sheet.groups))for(const id of ids){
    examples.set(`${group}:${id}`,Object.freeze({src:`assets/examples/${sheet.file}`,scene:sheet.scene,referenceUrl:`https://www.pinterest.com/pin/${sheet.pin}/`,columns:sheet.columns,rows:sheet.rows,column:index%sheet.columns,row:Math.floor(index/sheet.columns)}));
    index++;
  }
}
export function exampleFor(group,id){return examples.get(`${group}:${id}`)||null;}
export function exampleNote(group,id){
  if(group==='lens')return 'Illustrative lens comparison; not a measured optical simulation.';
  if(group==='angle')return 'Illustrative viewpoint comparison.';
  if(group==='focus'&&id==='miniature')return 'Illustrative miniature focus effect.';
  if(group==='palette')return 'Preset color example; custom color roles belong to your brief.';
  return '';
}
