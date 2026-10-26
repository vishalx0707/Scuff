const p = (id, label, hint, direction, colors, extra = {}) => ({ id, label, hint, direction, colors, ...extra });
export const catalog = {
  world: {label:'Art direction', title:'Art direction', intro:'', options:[
    p('dreamy','Dreamy minimalism','Quiet space. A little impossible.','Sparse surreal forms, deliberate negative space, soft spatial depth and one focal gesture. Avoid empty generic plinth-and-sphere compositions.',['#E2DFC6','#B8D9DD','#E0A3A8']),
    p('brutalist','Brutalist poetry','Weight, rhythm and raw edges.','Monolithic geometry, human-readable architectural scale, raw concrete and precise shadows. Add one purposeful contrast instead of random industrial clutter.',['#686B66','#A9ACA2','#C4E95C']),
    p('cyberpunk','Cyberpunk after hours','Practical light. Dense atmosphere.','Layer technological detail at foreground, subject and distance. Motivate luminous accents with actual sources; preserve a readable silhouette and shadow detail. Avoid uniform neon everywhere.',['#16383F','#F36A42','#91D5D4']),
    p('maximalist','Playful maximalism','A lot happening. One clear idea.','Layer expressive objects, unusual scale relationships and bold color in a controlled rhythm. Keep one dominant silhouette, a supporting family and clear resting areas.',['#C9E649','#EA7095','#3159A2']),
    p('tactile','Tactile surrealism','Soft, slumped, pleasingly strange.','Use inflated, clay-like or slumped forms with carefully authored silhouette, convincing thickness, small contact deformations and tactile material variation. Avoid arbitrary noise posing as detail.',['#D7A5B6','#AFBF8C','#A65638']),
    p('graphic','Graphic color pop','A restrained world. A sharp interruption.','Build a sculptural, visually simple scene around one saturated accent and precise spatial relationships. Let framing and shadow make the statement.',['#29473D','#E8E7E0','#F15B43'])
  ]},
  lens: {label:'Lens', title:'Lens', intro:'', options:[
    p('35','Balanced context','35 mm · perspective','Use a 35 mm perspective lens on a 36 mm sensor. Move the camera to balance the subject with its environment; avoid exaggeration.',null,{mm:35}),
    p('24','Environmental wide','24 mm · perspective','Use a 24 mm rectilinear perspective lens on a 36 mm sensor. Use close foreground layers and visible spatial depth, with deliberate edge distortion management.',null,{mm:24}),
    p('85','Subject isolation','85 mm · perspective','Use an 85 mm perspective lens on a 36 mm sensor, moving back for the intended framing. Separate subject from background without removing all context.',null,{mm:85}),
    p('50','Natural frame','50 mm · perspective','Use a 50 mm perspective lens on a 36 mm sensor. Find a restrained, intentional camera distance and framing.',null,{mm:50}),
    p('135','Compressed layers','135 mm · perspective','Use a 135 mm perspective lens on a 36 mm sensor and move farther away for matched framing. Let the changed viewpoint create compressed layers.',null,{mm:135}),
    p('ortho','Graphic orthographic','Parallel lines · no lens perspective','Use orthographic projection. Set orthographic scale for the desired coverage, not focal length. Cycles supports orthographic depth of field; if wanted, test focus and blur at the actual scene scale.',null,{projection:'ORTHO'}),
    p('fisheye','Deliberate fisheye','Experimental · curved space','Use a Cycles panoramic fisheye projection with a suitable field of view near 150 degrees. A 12 mm perspective lens alone is not fisheye. Check engine support before building the camera.',null,{projection:'PANO'})
  ]},
  angle: {label:'Viewpoint', title:'Viewpoint', intro:'', options:[
    p('threequarter','Three-quarter','Depth without the drama.','View the subject from approximately 30–45 degrees off its front, at its relevant viewing height. Show the relationship between front, side and surroundings.'),
    p('low','Low and imposing','Small viewpoint. Bigger presence.','Place the camera low relative to the subject and aim upward. Preserve useful silhouette separation and deliberately manage converging verticals.'),
    p('overhead','Directly overhead','Graphic shapes and clear arrangement.','Aim the camera vertically down at the subject, with no horizon. Compose relationships as a deliberate flat spatial arrangement.'),
    p('eye','At subject level','A direct, grounded encounter.','Place the camera at the subject’s meaningful viewing height. For an object this is relative to that object, not an assumed human eye height.'),
    p('high','High and observant','Show the scene around the subject.','Look down from roughly 30–50 degrees above the subject, ensuring its top surfaces and surrounding context contribute to the composition.'),
    p('dutch','Dutch tilt','Unease through a tilted horizon.','Use a deliberate camera roll around 12 degrees. Keep the subject legible and the tilt motivated by the scene’s intended tension.'),
    p('isometric','Isometric','A composed, diagram-like world.','Use orthographic projection, about 45 degrees around the subject and about 35.264 degrees downward. Compose a clear graphic world with parallel projection.')
  ]},
  focus: {label:'Depth & focus', title:'Depth & focus', intro:'', options:[
    p('balanced','Balanced sharpness','The subject and useful context read.','Start around f/5.6–f/8, focus on the intended subject, and test focus at the real scene scale. Adjust to keep useful context.'),
    p('shallow','Selective focus','One important plane, quieter surroundings.','Start around f/1.8–f/2.8. Set an explicit focus target and check its full important shape remains readable. Adjust aperture for scale and subject depth.'),
    p('deep','Deep focus','Foreground, subject and distance connect.','Start around f/8–f/11 or disable depth of field where appropriate. Preserve near-to-far readability; inspect the actual preview rather than relying on the aperture label.'),
    p('miniature','Miniature effect','A narrow band makes the world feel small.','Create a deliberate tilt-shift-style focus effect with an explicit focus plane or masked compositor blur, documented separately from aperture. A small f-number alone does not reproduce tilt shift.')
  ]},
  composition: {label:'Composition', title:'Composition', intro:'', options:[
    p('thirds','Off-center balance','Let the surroundings have a role.','Place the focal subject near a thirds intersection, using counterweight and look room instead of automatically centering it.'),
    p('center','Deliberate symmetry','A strong, graphic focal point.','Use purposeful central framing or symmetry. Align the architecture and negative spaces so it feels authored rather than accidental.'),
    p('space','Negative space','Room for the image to breathe.','Give one region of the frame generous quiet space, with the focal element clearly separated and supported by its environment.'),
    p('frame','Frame within a frame','Use depth to guide attention.','Use a foreground opening or partial occlusion to frame the focal subject, preserving the subject’s readability and useful depth layers.')
  ]},
  lighting: {label:'Lighting', title:'Lighting', intro:'', options:[
    p('soft','Soft directional','Gentle gradients, visible form.','Establish one large soft source from the side, with restrained environmental fill. Use a clay preview to check shape and shadow gradients.',['#DADDD4','#8C9B90','#35463E']),
    p('golden','Low golden light','Warm edges and long shadows.','Use a low warm source motivated as late-day sunlight, cool readable fill and long purposeful shadows. Keep highlight detail.',['#EDD4A4','#AA7E59','#485A66']),
    p('neon','Motivated neon','Luminous accents in a darker world.','Use a small number of visible practical sources to motivate cyan/warm or other chosen accents. Support the focal subject without filling every surface with color.',['#163C43','#EC734E','#9AC9C6']),
    p('hard','Hard and graphic','Decisive shapes. Strong shadow.','Use a relatively small directional source and explicit negative fill where needed. Design the shadow as part of the composition and preserve important dark detail.',['#202426','#C9CDCB','#D8A189']),
    p('overcast','Open-sky softness','Broad, quiet illumination.','Use a broad overcast environment, with subtle direction and sufficient value separation. Avoid a flat uniform wash that erases material form.',['#DCE4E4','#94AAAF','#60756C']),
    p('backlit','Luminous backlight','Edges that glow, a readable subject.','Place the motivated source behind or behind-side of the subject. Use plausible bounce/fill to retain its front form and avoid a featureless silhouette.',['#ECE0B9','#AEA8BD','#615E71'])
  ]},
  atmosphere: {label:'Atmosphere', title:'Atmosphere', intro:'', options:[
    p('clear','Clear air','Crisp relationships.','Keep the air clear. Establish depth through geometry, value and lighting rather than adding haze by default.'),
    p('haze','Light haze','A little separation in the distance.','Add subtle bounded haze with a scale-aware density. Retain foreground clarity and test subject/background separation.'),
    p('fog','Layered fog','Soft depth, with readable silhouettes.','Use a volume treatment with broken boundaries and scale-aware density, not an opaque reflective plane. Check whether the camera is accidentally inside the densest region.'),
    p('dust','Lit particles','Small details reveal the light.','Use sparse dust or particles where a motivated light reveals them. Keep their scale and contrast subordinate to the subject.')
  ]},
  palette: {label:'Color relationship', title:'Color relationship', intro:'', options:[
    p('moss','Moss & rose','Organic depth, an unexpected warm note.','Use a restrained moss-green base and dusty rose accent with warm neutral support. Separate the subject by value as well as hue.',['#354E42','#D59CAE','#DFDBCC']),
    p('cyan','Cyan & ember','Cool space, a small warm spark.','Use cool cyan/teal surroundings with a controlled warm ember accent. Keep most surfaces less saturated than the focal accent.',['#244D59','#ED7951','#BBCED0']),
    p('butter','Butter & cobalt','Bright, sculptural, optimistic.','Balance a pale yellow field with a decisive cobalt focal accent and clean dark anchors. Protect highlight detail.',['#E3DA8F','#305BA5','#2A2C37']),
    p('plum','Plum & lime','Rich shadow, electric contrast.','Use a dark plum foundation, a sharply controlled lime accent and quieter intermediate neutrals. Keep color contrast intentional.',['#543B50','#CDDA71','#CBB9C4']),
    p('mono','Monochrome & red','Structure first. One interruption.','Establish strong monochrome value structure with one restrained red focal accent. Do not scatter red across competing details.',['#333735','#E0E2DC','#C54B3E']),
    p('sand','Sand & ultramarine','Material warmth, concentrated blue.','Use warm mineral neutrals against a concentrated ultramarine accent. Keep the warmth material-driven rather than a global yellow cast.',['#C4B8A3','#384E9A','#6C6C63'])
  ]},
  material: {label:'Surface direction', title:'Surface direction', intro:'', options:[
    p('pbr','Believable PBR','The material behaves like itself.','Choose physically appropriate material families, real scale and credible roughness. Separate base color, roughness and bump; avoid uniformly noisy surfaces.'),
    p('clay','Tactile clay','Soft forms, small imperfections.','Author matte clay-like surfaces with controlled small variation, soft edge behavior and intentional hand-finished character. Keep silhouette and contact convincing.'),
    p('metal','Polished metal','Reflections describe the form.','Use physically appropriate metallic shading and a designed reflection environment. Keep roughness variation restrained and avoid flat chrome without readable reflections.'),
    p('glass','Layered glass','Thickness, transmission and light.','Give glass plausible thickness, transmission and roughness. Render-test the object inside or behind it so reflections and refraction do not erase the focal subject.'),
    p('organic','Organic surfaces','Variation with a reason.','Use coherent organic material scales and directionality, with subtle color and roughness variation. Distribute detail by structure and visibility instead of uniform random noise.'),
    p('worn','Localized wear','Time leaves specific marks.','Start from a recognizable base material. Put wear at contact, exposed edges and water paths according to the story; avoid global corrosion or random grime.')
  ]},
  finish: {label:'Image finish', title:'Image finish', intro:'', options:[
    p('clean','Clean photographic','A considered, restrained final image.','Use an explicit color-managed view transform and restrained contrast. Keep a clean image without extra lens effects.'),
    p('film','Gentle film texture','A little grain, not a rescue filter.','Add restrained scale-aware film grain and gentle highlight treatment after the clean render. Save both versions; do not confuse sampling noise with intentional film grain.'),
    p('bloom','Soft luminous bloom','Highlights have a little atmosphere.','Add subtle thresholded highlight bloom after the clean render. Preserve local contrast and do not spread glow over the entire image.'),
    p('raw','Diagnostic clean','Expose problems before the grade.','Deliver a clean diagnostic render with no bloom, grain or stylized grade. Include a grayscale/value view to judge composition and material readability.')
  ]}
};
export const groups = Object.keys(catalog);
export const defaults = {
  schemaVersion:1, medium:'blender', name:'Untitled direction', subject:'', exclusions:'', references:'',
  world:'dreamy', lens:'35', angle:'threequarter', focus:'balanced', composition:'thirds',
  lighting:'soft', atmosphere:'clear', palette:'butter', material:'pbr', finish:'clean',
  strength:'balanced', aspect:'3:2', mode:'new', output:'still', quality:'preview', customAccent:'',
  review:true, intent:'',environment:'',focalPoint:'',preserve:'',reject:'',acceptance:'',referenceNotes:'',
  detail:'balanced',judgments:{},paletteRoles:null,journal:[],promptDraft:'',promptBasis:'',generatorDraft:'',generatorBasis:'',chosenGroups:[...groups],
  tone:'',action:'',timeOfDay:'',weather:'',storyContrast:'',shotSize:'',lightSource:'',lightDirection:'',lightQuality:'',lightKelvin:null,
  materials:'',wear:'',smallDetails:'',sound:'',dialogue:'',referenceAudio:'',audioNotes:'',generatingPrompt:'',styleSource:'',
  modelCandidates:'',draftResolution:'',finalResolution:'',budgetLimit:'',selectedCandidate:'',upscale:false,operatorTiming:'',
  cameraOperators:[],operatorBeats:[],shots:[],referenceAttachments:[],
  // Optional research extensions. These defaults compile to the original brief.
  workflow:'general', captureStyle:'none', cameraOperator:'none',
  animationSeconds:null, animationFps:null, animationEvent:'', animationRecovery:'',
  referenceIdentity:'', referenceComposition:'', referenceAtmosphere:'',
  natureTerrainM:null, natureScatterMax:null, natureSeed:null, natureFoliage:'', natureExclusions:'', natureFog:'none'
};
export const steps = [
  {id:'world',label:'World',groups:['world']},
  {id:'camera',label:'Camera',groups:['lens','angle','focus','composition']},
  {id:'light',label:'Light',groups:['lighting','atmosphere','palette']},
  {id:'surface',label:'Surface',groups:['material','finish']},
  {id:'brief',label:'Brief',groups:[]}
];
export const find = (group,id) => catalog[group]?.options.find(p=>p.id===id);
