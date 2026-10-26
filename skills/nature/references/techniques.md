# Nature techniques and decision points

Use the user's story and approved camera as the authority. These methods adapt the videos linked in `../../../docs/RESEARCH.md`; they do not reproduce the creators' exact scenes or require their paid assets.

**Terrain.** Establish metres and a scale proxy. Size a subdivided plane, apply object scale, then tune broad Clouds displacement and deliberate rises/hollows. Keep the noise size and amplitude editable. A.N.T. Landscape is optional and version dependent. At hero trunks, shape modest root mounds and inspect soil contact from the camera; snapping to the ground alone does not create convincing contact.

**Ground.** Match texture tile size to real dimensions. Break repetition with variations in mapping, masks or mixed scales. Choose map size and geometric displacement from the final pixel footprint, not a blanket 4K/8K rule. Bevel authored hard edges where appropriate. Concentrate litter, chips and surface detail near the focal area, leaving quieter regions.

**Scatter.** Separate source assets from the emitter and output. Start with a read-only inventory and a bounded preview (`scene-tools.md`). Use instancing, a density mask, seed, hard cap and exclusions for paths, subject and water. Inspect mask polarity. For animated cameras, the mask must cover the union of swept views plus a margin, not one initial frame. Keep fine hero assets near camera and lower-detail background assets in separate collections. Avoid blanket uniform placement; clump species and vary height/color with restrained authored rules.

The bundled helper generates a static point layout and Geometry Nodes instances. Editing its stored JSON property alone does not resample it. Keep the original, preview changed parameters, and create a new named output for a controlled comparison. It does not supply plant assets or automate biome ecology, wind or root mounds. A hand-authored Geometry Nodes graph with Distribute Points on Faces → Instance on Points is an alternative when live procedural editing is needed.

**Light.** Judge key/fill ratio, source direction and value separation under fixed exposure/view transform. Rotate HDRIs through their mapping. Sun strengths 25–35 and world 0.3 in Onur's scene are examples, not a preset. A sky texture and an HDRI are alternatives; don't assume both are needed. Put lighting variants in separate collections and compare from the same camera.

**Air.** Use a bounded physical volume when scene light, shadows and reflections should interact with the medium. Density depends on path length and scale; tune from small previews. The camera-only Cycles alternative multiplies Is Camera Ray by density into Volume Scatter. It changes the camera's view while excluding other ray types; it can still cost render time and cause noise. Label it a look adjustment. Keep the chosen Fast GI Approximation state fixed while tuning fog.

**Gobo.** Noise → Color Ramp → plane-material alpha can break the sun into patches. Put the plane between source and scene. If it enters the frame, disable camera visibility while retaining shadow contribution; `hide_render` removes its shadows too. Test transparency and bounce limits in the actual engine. This is optional light shaping, not a required decoration.

**Layers.** Separate foreground, vegetation scatter, background trees and distant scenery. A distant image card is a 2.5D shortcut: check rights, matching light/sky and the full camera path for parallax failures. Camera/shadow visibility and emission should be deliberate. Emission primarily preserves the photographed appearance; a distant card is not a reliable scene key light.

**Motion.** Use plant-specific wind with anchored roots and varied phase/speed; ground litter stays still unless the story requires it to move. Test representative frames before a full sequence. Use `../../shot/SKILL.md` for camera timing and multi-camera review. Additional cameras can expose missing scatter or cards; inspect each view.

When no suitable local asset exists, build and identify a procedural placeholder. Do not label it a scan, a particular commercial asset or a species match. Preserve approved work and compare bounded revisions under identical controls.
