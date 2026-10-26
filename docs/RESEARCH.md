# Blender research: nature scenes, photoreal craft and layered landscapes

Reviewed 25 October 2026 for the Scuff creative-direction plugin. This is an original synthesis. It paraphrases the sources and records on-screen values; it does not reproduce transcripts, project files or any creator's reusable style file.

**How to read the values.** Every number below was used by one creator in one scene, at one scale, under one exposure and view transform. Treat them as **scene-dependent examples**, not defaults. Each value is marked by how it is known:

- **visible**: read from a full-resolution frame of the local video;
- **caption**: stated in the automatic captions only (captions garble numbers, especially in the Hindi track);
- **visible + caption**: both agree.

## Contents

1. Sources and coverage
2. Onur Erdurak: a fast nature scene (priority source)
3. Extra 3d: photorealism craft
4. vfx world: landscape layering (Hindi narration)
5. What the two earlier sources contribute
6. Cross-source synthesis
7. Visible and stated values (scene-dependent)
8. Claims that need correction or caution
9. Research → plugin feature map
10. Gaps and open hypotheses
11. Evidence record

---

## 1. Sources and coverage

| # | Video | Creator | Length | Narration source used | Role here |
|---|---|---|---|---|---|
| 1 | [How I Make Realistic AI Videos with Blender + Claude](https://www.youtube.com/watch?v=0It5N3kHldE) | Aidan Stanik | 14:08 | English auto-captions (earlier analysis) | CTLT brief, render → inspect → revise, per-camera review |
| 2 | [How I Make Realistic AI Videos with Seedance 2.5](https://www.youtube.com/watch?v=2hJsvDSPWYM) | Dan Kieft | 20:27 | English auto-captions (earlier analysis) | Capture styles, operator behaviors, reference roles, style abstraction |
| 3 | [Making A Realistic Nature Scene in MINUTES!](https://www.youtube.com/watch?v=bT2nfjP6IK0) | Onur Erdurak | 9:30 | English auto-captions, complete | **Priority**: terrain, scatter budget, light, fog, gobo, wind, cameras, story |
| 4 | [Photorealistic Renders In Blender](https://www.youtube.com/watch?v=oBQ91yoNzV4) | Extra 3d | 9:00 | English auto-captions, complete | References, scale, assets, micro-detail, camera optics, motivated light |
| 5 | [Blender Landscape For Beginners](https://www.youtube.com/watch?v=advpjWa16hY) | vfx world | 21:29 | Original Hindi auto-captions, complete | Landscape layers, mask inversion, background cards, volume fog, sky, render settings |

**What was examined for sources 3–5**

- Metadata (title, creator, chapters, description) and the complete timed caption track for each video, read in bounded passes. Sources 3 and 4 use English automatic captions; source 5 uses the original Hindi automatic captions, which mix Hindi and English technical terms and often garble numbers.
- Six-second contact sheets covering the full length of each video (95, 90 and 215 sampled frames) were visually reviewed during this research session.
- For the Claude write-up, 37 targeted 1920 × 1080 frames were extracted from the local files and 32 of them were inspected to read interface values (listed in §11). The session's `demonstration-evidence.jpg` in this folder collects three of the key moments (fog shader 5:51, bounded volume 16:22, output size 7:59).
- A separate Codex inspection checked further frames (bT2 4:21, 5:47, 6:52; advpj 15:09, 17:39; oBQ 7:53, 7:59) and official Blender documentation. Its corrections are integrated here and marked **parent check**.
- All three local files contain audio. The audio was **not** listened to continuously; narration coverage comes from the captions. This is not a claim that every frame was examined or that the full audio was independently assessed.
- Sources 1 and 2 were analysed earlier in this project. Their findings are summarised from those analyses (§5), not re-reviewed.

**Not available:** project `.blend` files (source 5 sells one), the original packaged fog asset, add-on source code, final render settings for any showcase render, and any post-production grade.

**Blender versions visible:** 3.6.0 (source 3), 4.3.2 (sources 4 and 5). Several workflows depend on add-ons or relocated features, so check the installed version before reusing a step.

---

## 2. Onur Erdurak: a fast nature scene (priority source)

Onur frames the video around deadline pressure on a short film: make convincing nature quickly with high-quality assets instead of modelling everything. He has scanned and modelled his own assets before, but here speed matters more. The closing argument is that realism alone is no longer the point; the scene exists to tell a story.

### Timeline

| Time | What happens | Technique worth keeping |
|---|---|---|
| [0:00](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=0s) | Intro: high-quality assets beat hand-modelling under deadline | Use existing assets first; custom work is a choice, not a prerequisite |
| [0:46](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=46s) | Shape the ground: plane, scale, subdivide, Displace modifier with a Clouds texture, shade smooth | Displacement depends on whether scale has been applied (see below) |
| 1:14 | Proportional editing to pull up selected areas; scroll wheel sets the falloff radius | Author the large landforms by hand after the noise pass |
| [1:25](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=85s) | CC0 ground material from his asset browser (Poly Haven / ambientCG); texture too large, so he raises the mapping scale; repetition appears; he swaps the Mapping node for an anti-tiling node group from a Blender Guru video | Texture scale and repetition breakup are separate problems |
| [2:15](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=135s) | Adds Botaniq trees; notes that trees raise the ground they grow on, so he lifts the terrain at each trunk with proportional editing; says geometry nodes could automate this but he hasn't learned how | Root mounds sell contact |
| 2:43 | Positions the camera with fly/walk navigation (Shift + backtick, WASD, Q/E) | Camera before scatter |
| [3:12](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=192s) | Geo-Scatter (paid, with optional paid packs; a free alternative is mentioned but unused). Warns that a large plane with applied scale will be filled densely and can stall the machine; "cheat your camera angle" because the visible set is small | Density budget follows what the camera sees |
| 3:43 | Paints a vertex group, applies it as a mask to the scatter layers (Alt applies to all); the mask has to be flipped before plants appear only in the painted region | Explicit include mask; check its polarity |
| [4:15](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=255s) | "Your sunlight is too weak": he has recently used sun strength 25–35 | A relative key/fill check, not a universal value |
| [4:27](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=267s) | HDRI via World Properties: hover the color socket, press E for Environment Texture, open a Poly Haven HDRI | Fast world setup |
| 4:49 | Duplicates a second hill; links the material to it (Ctrl+L → Link Materials) | Reuse materials rather than recreating them |
| [5:10](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=310s) | Usually drops the HDRI to 0.3; rotates it in the world node tree with Node Wrangler's Ctrl+T mapping | World as fill; rotation controls where sky light comes from |
| [5:27](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=327s) | "Secret sauce" fog: a node group from his other video; scaled to enclose the whole scene; first thickness 0.1 | A camera-ray look-cheat, not physical fog (see below) |
| [6:06](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=366s) | Shape the light: a plane with Noise → Color Ramp (contrast crushed) → material Alpha; sunlight passes through the gaps to make cloud-like patterns | A gobo/cookie that must keep casting shadows |
| 6:55 | Thicker fog, looking toward the sun, gives visible god rays | Gobo + volume = shafts |
| [7:06](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=426s) | Wind: Geo-Scatter for foliage, Botaniq's animation for trees | Separate wind systems per asset type |
| 7:29 | Depth of field and a little camera movement | Slow motivated camera |
| [7:34](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=454s) | Second camera: copy the camera, bind each to a timeline marker with Ctrl+B, delete the copied keyframes on the second camera, change its angle | Marker-bound cameras; remove copied motion |
| 7:57 | Suggests adding a character (affiliate product mentioned) | Out of scope for the plugin |
| [8:14](https://www.youtube.com/watch?v=bT2nfjP6IK0&t=494s) | Closing thoughts: realism is a solved tool; story is the point; his example is a swing on a tree and an old man looking at it | Story-first priority |

### Technique notes

**Ground and applied scale.** The visible Displace modifier uses **Local** coordinates, **Strength 0.310**, **Midlevel 0.5** (visible, 1:03; scene-dependent). Because the procedural texture is evaluated in the object's local coordinates, applying scale changes the result. Applying scale while the plane is small, then scaling up, stretches a few broad noise features across the larger area (and scales their height with the object). Applying scale after enlarging gives local coordinates in real metres, so more, smaller features appear at the strength set in metres. Practical rule for the plugin: **decide terrain dimensions in metres, apply scale, then tune noise size and strength in metres, and record them.** Proportional edits then create the readable hills; the noise only roughens them.

**Ground texture: metric scale and repetition.** He raises the mapping scale until the texture "isn't too big," judged by eye. The anti-tiling node group visible in the material is labelled *Poliigon Uber Mapping*, with values such as Scale 7.9 and Mosaic Rotation 5.9, later 9.8 (visible, 2:12 and 4:05). Its internals are not shown. A repeatable rule is better than eyeballing: when a texture's real-world size is known (many CC0 libraries publish it), map one tile to that size using metric coordinates; otherwise calibrate against a known-size object. Onur's scene contains a human proxy named *Man*, which serves the same purpose. Then break repetition with rotation/offset variation or a second-scale mask, and judge it from the actual camera distance.

**Root mounds.** Trees placed on a flat surface look pasted. He pulls the ground up around each trunk. Botaniq also exposes a *Snap to Ground* operator (visible tooltip, 7:16), which drops assets onto the ground but does not create a mound. A plugin workflow should check every hero trunk at the camera: buried root flare, a slight mound or debris, and no floating gap.

**Camera-first scatter budget.** His warning is the most useful performance lesson in the video: the scatter fills whatever surface you give it. Two controls bring it back under control: a small, camera-facing set and an explicit painted mask. The visible Geo-Scatter panel shows two grass systems, a *Vertex-Group* mask enabled and a *Culling Mask* section (visible, 4:05). For the plugin this becomes: choose and approve cameras first; restrict instances to what those cameras see across the full animated range, plus a margin; exclude paths and clearings explicitly; cap the total; fix the seed; and check mask polarity before trusting a count.

**Sun 25–35 and world 0.3 are not universal.** The sun field is mid-edit at 4:19 (angle 0.526°) and reads **25.0** at 4:21 (visible, parent check); his narrated range is 25–35. The HDRI (*kloppenheim_06_4k*) runs at **Strength 0.300** with a world rotation of **Z −112°** (visible, 5:56). What transfers is the *ratio*: a strong direct key against a dimmed sky fill, judged under the actual exposure and view transform. Another HDRI, a Nishita sky, a different exposure or a different view transform needs different numbers.

**Fog: a camera-ray look-cheat.** The node group (*fog_basic*, on a cube scaled to enclose the scene) exposes **Fog Color**, **Fog Thickness** and **Anisotropy 0.850**; thickness goes from **0.1** at 5:55 (caption) to **0.010** for the god-ray shot (visible, 6:57). Opened at 5:51, the group is four built-in nodes: *Light Path → Is Camera Ray* and the Thickness input feed a Math **Multiply** (clamp off), whose result drives **Volume Scatter** density; Color and Anisotropy pass straight to the Volume Scatter (visible, 5:51). The caption's "the second one is connected outside" is the Thickness input. This is a visible node arrangement, not a downloaded recipe file, and the group's asset-library packaging was not inspected.

Why it looks good: with density multiplied by *Is Camera Ray*, only rays leaving the camera see the medium. Shadow rays toward the sun see zero density, so light reaching the ground is not dimmed. Occluders such as trees and the gobo plane still block those shadow rays, so camera rays scattering in the volume reveal shafts. This avoids volume attenuation on those lighting paths. Camera rays still traverse and scatter in the medium; render cost and noise do not disappear.

What it gives up: the fog does not attenuate light reaching surfaces, does not appear in reflections, refractions or indirect bounces, and behaves as a Cycles light-path trick that other engines may not reproduce. A **physical** alternative is a Principled Volume or Volume Scatter without ray gating, which affects all light transport, renders darker and slower, and needs the light rebalanced. The plugin should make this an explicit choice, `camera-only look` vs `physical volume`, and name it in the brief.

**Light gobo that keeps its shadows.** The gobo is a scaled plane (*Plane.002*) with a Noise Texture that starts at Blender's defaults (Scale 5, Detail 2, Roughness 0.5, Distortion 0; visible, 6:24) and is later adjusted (Scale 4.6 at 6:52, parent check), feeding a Color Ramp whose stops are pushed together (one stop at 0.327 is visible at 6:40), driving the Principled Alpha. The video keeps it out of frame and does not show its visibility settings. If such a plane could appear in frame or in reflections, **disable its camera ray visibility; do not disable rendering.** Hiding it from render removes its shadows, and the shaped light goes with it. Gobo transparency also depends on the transparent bounce limit.

**Wind.** He enables Geo-Scatter wind on foliage and Botaniq's *Add Animation* on trees (Botaniq panel visible, 7:16). No wind values are legible. The general rules are confirmed by source 5: vary phase and speed per species or instance so plants don't move in unison; keep roots and trunk bases anchored, so deformation increases with height; and keep ground litter still.

**Multiple cameras.** Visible at 7:40–7:45: *Camera* and *Camera.001*, both **100 mm**, clip **0.1–1000 m**, depth of field on a **Focus Master** empty at **f/2.8**, blades 0, a wide letterbox frame, a timeline in timecode with keyframes at the start and around 2.5 s, and a marker bound to *Camera* at frame 0. Duplicating an animated camera duplicates its motion, which is why he deletes the second camera's keyframes. A plugin check: list the markers and their bound cameras, confirm each camera's own action, and confirm that both cameras sharing one focus object is intended.

**Story first.** The closing advice is a priority rule, not a style: decide the subject and narrative read before spending time on leaf translucency or grass microdetail. His swing-and-old-man example is his, not a default subject.

**Scene and tools visible:** Blender 3.6.0; Botaniq, Geo-Scatter, Node Wrangler, an asset browser with material and fog libraries, plus panels for other commercial add-ons. The description contains affiliate and discount links. None of these are required by the plugin.

---

## 3. Extra 3d: photorealism craft

A compact tour of four "techniques" plus render settings, demonstrated on a book still-life and a darker second shot, then a recap. The creator promotes free Patreon assets and a paid compositor; the description contains affiliate links.

### Timeline

| Time | What happens | Technique worth keeping |
|---|---|---|
| [0:00](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=0s) | Renders showcase | — |
| 0:24–1:10 | Intro; photorealism means renders that mimic real life | — |
| [1:10](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=70s) | Chapter 1, references: study how light behaves in conditions; don't copy one photo. Book references are organised into three groups. Unsplash and PureRef | References explain behavior, not a target to clone |
| 1:57 | Match real-world size; he uses the Rigify human metarig as a scale proxy. Wrong size changes how light and depth of field behave | Scale proxy in every scene |
| [2:19](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=139s) | Chapter 2, assets: scanned assets (Fab/Megascans, Sketchfab, RealityCapture or phone scans); says 4K or 8K PBR textures are "necessary"; 3D-print files as high-poly untextured meshes | Scans optional; resolution claim corrected in §8 |
| 3:21 | Demo scene: wood displaced with Displace + Subdivision modifiers; scattered wood chips and rocks; dust and hair particles via geometry nodes | Micro-detail and contact debris |
| 4:00 | Don't model everything; if you do, bevel the mesh | Bevelled edges catch light |
| [4:22](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=262s) | Chapter 3, camera: read angle, focal length (~70–80 mm) and depth of field from the references; fly mode; optional Lens Sim add-on; default camera works: focal length, **blades 8, ratio 2** for close-ups, pick focus, lower f-stop until it matches the reference | Optics follow the reference; bokeh shape is optional |
| 5:12 | Handheld: Camera Shakify add-on, or keyframe rotation and add a Graph Editor Noise modifier, then Copy to Selected | Small, motivated camera noise (see §8) |
| [5:39](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=339s) | Chapter 4, lighting: window light for the bookshop via an area light; 3D cursor placed on the subject and used as the rotation pivot so the light orbits while facing it; reduce **Spread** for sharper light; raise strength to match | Separate beam cone from source size (see below) |
| 6:33 | Second shot had no references; very dark looked good but unreal; a low-strength HDRI as fill fixed it. EXR from Poly Haven; low resolution if lighting only, 4K if visible in render; keep lights in collections to toggle | Natural fill prevents black voids |
| [7:29](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=449s) | Chapter 5, render settings: noise threshold **0.075**, samples **1000**, resolution **200%** | Creator's settings, not defaults |
| [8:06](https://www.youtube.com/watch?v=oBQ91yoNzV4&t=486s) | Recap: references → assets → PBR with displacement (modifier or material) → micro-details → camera/depth of field → lighting experiments → render | Same order as the plugin's build loop |

### Technique notes

**References with jobs.** The useful idea is to collect references to learn *how light behaves* in comparable conditions and to read camera and lighting choices from them, not to make a near-copy. Later chapters use references separately for camera setup (angle, focal length, depth of field) and lighting direction and softness. This maps onto Scuff's reference roles. A reference is assigned a job; it is never "the same scene."

**Scale proxy.** A human metarig is a quick check. A wrong overall scale changes light falloff from area and point lights, depth of field at a given f-stop, and procedural texture size. Both this video and Onur's scene keep a human proxy.

**Micro-detail.** Displacement with sufficient subdivision, scattered chips and rocks, and dust and hair geometry where the camera is close. These are contact details. They belong near the focal area, scaled to the camera's resolving power, not spread uniformly.

**Optics.** Visible at 5:07: focus distance **0.7567 m**, **f/2.8**, blades 0, **Ratio 2.000** being set (Blender 4.3.2). Ratio 2 stretches bokeh, an anamorphic-style choice whose orientation should be checked in the render; blades 8 gives octagonal highlights. Both are stylistic options for close-ups, not realism requirements.

**Handheld noise.** Visible at 5:33: an F-Curve **Noise** modifier on the camera's keyed rotation, Blend *Replace*, **Scale 70**, **Strength 1.0**, Offset 0, **Phase 1.0**. *Copy to Selected* places identical settings on every rotation channel. Rotation curves are in radians, so strength 1 corresponds to tens of degrees of sway before reduction. Identical phase makes all three axes move in lockstep. The plugin's guidance: keep amplitude small, use different phase or offset per channel, keep the motion low-frequency, and tie it to an operator event (see shot workflow).

**Area light: spread vs size.** Visible at 6:20: area light **Power 10 W**, **Square 1 m**, **Spread 2.8°**. In Blender, *Size* is the emitting surface; *Spread* limits the angle each point emits into. A narrow spread confines the lit region (like a honeycomb grid) and also makes shadows sharper, because each receiving point sees less of the source. Use size for intended softness and spread for the beam footprint. Test both in the render; a window-sun read might be better served by a sun or a small source.

**HDRI as fill.** A dim world fill is the realistic answer to unmotivated black. Download resolution follows visibility: low resolution for lighting only, high resolution only when the HDRI is seen in frame.

**Render settings.** Visible at 7:53–8:00: render noise threshold **0.0750**; Max Samples reads 100 at 7:53 (parent check) and is mid-edit at 7:55, while the narration says **1000**; OpenImageDenoise with albedo and normal passes; resolution **1920 × 1080 at 200%**, which renders 3840 × 2160; 24 fps; frames 1–120. Distinguish the narrated recommendation from the transient field value. An on-screen caption also tells viewers to set the pixel width to 1.00 px (the pixel filter width); this is not narrated. 200% renders four times as many pixels. These are one creator's final-quality settings; the plugin always previews first.

---

## 4. vfx world: landscape layering (Hindi narration)

A beginner-friendly forest built in Blender 4.3.2 from free and paid add-ons. The narration is Hindi with English terms. The creator says this is his first time using Geo-Scatter on the channel, and admits at 19:03 that the intro render looks different because it used different settings, although the process was the same.

### Timeline

| Time | What happens | Technique worth keeping |
|---|---|---|
| [0:00](https://www.youtube.com/watch?v=advpjWa16hY&t=0s) | Intro; the process can be adapted to different scenes and camera angles | — |
| [0:20](https://www.youtube.com/watch?v=advpjWa16hY&t=20s) | A.N.T. Landscape from Add → Mesh. If missing: search Preferences for "landscape"; in newer Blender, install it as an extension (free) | Version-dependent; verify availability |
| 1:35 | Enlarges the landscape for a vast set, applies scale, pushes it in Z, tilts it slightly in X to suit the planned camera | Terrain shaped for the camera |
| [2:15](https://www.youtube.com/watch?v=advpjWa16hY&t=135s) | Camera to view (Ctrl+Alt+Numpad 0); focal length **35 mm** | Camera early |
| [3:00](https://www.youtube.com/watch?v=advpjWa16hY&t=180s) | Geo-Scatter; the same biome browser as Biome-Reader; picks a forest-ground biome from The Plant Library (free, per the creator); it applies to the whole landscape and is very heavy | Biome scatter is heavy by default |
| 4:06 | Optimisation: create a vertex group mask, paint only where vegetation is needed **considering the planned camera animation**; enabling the layers shows the opposite area, so he inverts the mask; the scene becomes light. "Save, it can crash." | Mask covers the animated camera's view; check inversion |
| 5:08 | Wind: enable layers one at a time; per layer, Waves and Turbulence; small turbulence strength; a second plant gets different strength and speed because identical wind looks fake; no wind on the forest-floor leaves | Varied wind; static litter |
| 7:16 | Trees from a tree add-on (Forestation panel visible; Biome-Reader or BlenderKit are alternatives); **high-poly for close foreground, low-poly for background**; place non-uniformly, sink slightly into ground, randomise variants; high-poly assets can crash the session | Detail tiers by distance |
| [9:08](https://www.youtube.com/watch?v=advpjWa16hY&t=548s) | Cycles on GPU; no HDRI, a sky texture instead; render region to limit preview cost | Cheap preview region |
| [10:00](https://www.youtube.com/watch?v=advpjWa16hY&t=600s) | Background: first move foreground trees and scatter into separate collections; duplicate the landscape, reset rotation, push it back and down, stretch it, apply scale; new **BG** collection with three low-poly trees | Separate FG / scatter / BG collections |
| 11:35 | Hair particle system on the BG landscape: **Number 250**, Render As Collection (BG), rotation on, velocity none, random scale; trims the populated area, pushes trees back for depth and up to hide the forest floor; tries seeds; scales single trees and checks them from the camera | Legacy particle instancing (see GN fallback) |
| 13:30 | Rotates the camera up to show less ground | Recompose after layering |
| 13:47 | Extreme background: Shift+A → Image → Mesh Plane with a downloaded mountain photo; keep it outside the scatter area; disable its **shadow** visibility; scale to fill; Roughness 0 and **IOR 1** to kill reflections; connect the texture to Emission at strength 1–2 | 2.5D photo card for distant scenery |
| [15:20](https://www.youtube.com/watch?v=advpjWa16hY&t=920s) | Fog: a cube scaled to about 50 (caption), shown as wire in the viewport; Principled BSDF replaced with **Principled Volume**; density reduced after a first try that was too dense; anisotropy raised; "many fog add-ons exist, the default is fine" | Bounded physical volume |
| [16:27](https://www.youtube.com/watch?v=advpjWa16hY&t=987s) | Lighting via sky texture: sun elevation and rotation chosen so the background mountains stay readable; a small bluish volume emission lifts the fog | Light direction serves layer separation |
| 17:16 | A spotlight in the dense fog reads as a torch beam once its power is raised (captions: 1500; the field reads **15000 W** at 17:39, parent check); suggested for a night scene with a handheld shot; then deleted | Temporary demonstration only |
| 18:05 | Larger sun size for softer shadows; more *Air* for a warmer tone; strength up for a harsher light | Sky controls change mood |
| [18:21](https://www.youtube.com/watch?v=advpjWa16hY&t=1101s) | Depth of field focused on the front trees; viewport limits shown; f-stop toward **1.2** (caption) | Shallow depth on a wide landscape is a choice |
| 19:03 | Admits the intro render used different settings; adds a small temple via File → Import → glTF (.glb), scaled down and rotated 90°; its position and scale must match the scene so it has meaning | Story anchor; consistent scale |
| [19:47](https://www.youtube.com/watch?v=advpjWa16hY&t=1187s) | Render settings: toggling Fast GI Approximation changes the fog colors a lot; decide whether it is on before lighting, and keep that choice | Keep the approximation state consistent |
| 20:21 | Persistent Data on (otherwise each frame reloads); motion blur "definitely" on; AgX with Medium Low Contrast, exposure slightly down, gamma slightly up for a flat image; the rest of the grade is done in After Effects (not shown) | Animation performance; flat master for grading |
| [21:00](https://www.youtube.com/watch?v=advpjWa16hY&t=1260s) | Render with some camera animation; the project file is sold on Gumroad | — |

### Technique notes

**Camera-aware mask with inversion.** The visible Geo-Scatter biome *Forest 01* has seven layers (Nettle, Plant, Seedlings, Clover, Weed, Branches, Dead Leaves) and a group culling mask on a vertex group named *Vgroup* with an invert toggle (visible, 4:52). He paints for the *animated* camera, not one frame. The plugin rule: a mask must cover the union of what the camera sees over the shot plus a margin, and its polarity must be checked once with a count or a viewport check.

**Varied wind, still litter.** Visible at 5:40: Turbulence strength **0.200**, speed being dragged (caption: 5). At 6:10, a second plant shows Turbulence strength **0.600** (caption speed 2), plus Waves speed 1.0, strength 1.0 and a fixed direction of 50°. Dead leaves and branches get no wind. These numbers are tuned by eye per asset; the transferable rule is variation between species, low amplitude, and stillness for ground litter.

**Detail tiers and collections.** High-poly hero trees near camera, low-poly variants in the background, a 2.5D photo card at the extreme distance. The outliner shows **FG**, **Geo-Scatter** and **BG** collections, with *American beech*, *Pine* and *Pink locust* low-poly trees in BG (visible, 11:43). Separate collections let you hide heavy layers while working and render-test each.

**Background instancing: legacy hair vs geometry nodes.** The visible particle settings are a *Hair* system with **Number 250**, Seed 0 and Hair Length 4 m, rendering the BG collection (visible, 11:43). This legacy route still exists in 4.3, but current Blender's general-purpose path is geometry nodes: Distribute Points on Faces → Instance on Points with a Collection Info (separate children, pick instance), random rotation and scale from a fixed seed, and a cap. The plugin should use the geometry-nodes path, or the project helper if it implements one, and mention the particle route only for legacy files.

**The mountain card is 2.5D.** Visible at 15:19: object *pexels-pixabay-270756* (a stock-photo name), Principled **Roughness 0.000**, **IOR 1.000**, alpha from the image, emission color from the image. With IOR 1, specular reflection vanishes regardless of roughness. Emission makes the card show its photographed lighting instead of being reshaded. Its contribution as a light source depends on size, distance and strength; it is not a reliable illumination tool. The card works because the camera move is small. A large parallax move, a different time of day or a sky that doesn't match will expose it. Check the photo's licence before using such a card.

**Physical fog with visible values.** Visible: density typed as **.02** at 16:11, then **0.010** at 16:22–16:30; anisotropy **0.800**. The captions for these numbers are garbled ("02", "one", "8"). He also says **0.1** makes the environment very dark. Density is per unit distance, so the same value reads differently in a scene with different depth. Confirm fog values against the rendered image, never from captions. Render settings visible at 19:55 include volume bounces **0**, so the look is single-scatter.

**Sky controls.** Visible (Nishita sky): at 16:30, sun size 0.545°, elevation being set to **45**; at 18:16, sun size **5°**, elevation **50°**, rotation **22°**, Air **4.781** (raised from 1.0), Dust 1.0, Ozone 1.0, strength being dragged (caption: 1.2). Caption values differ from the visible ones (rotation "90" vs 22°). The transferable rule: choose sun direction to separate layers (here, to keep the mountains readable), sun size for shadow softness, *Air* for warmth, and treat them as a set.

**Depth of field.** Visible at 18:42: **35 mm**, clip 0.1–1000 m, viewport display size **5 m** with limits shown, passepartout 0.5, focus distance **4.2 m**, f-stop **2.8** (caption: going to 1.2). f/1.2 on a 35 mm landscape is a strong stylistic choice and an example, not a recommendation.

**Approximation and performance toggles.** Visible at 19:55: render noise threshold **0.01**, max samples **4096**, denoise on; light paths total 12, diffuse 4, glossy 4, transmission 12, volume 0, transparent 8; indirect clamp 10; caustics on; Fast GI Approximation tooltip shown. At 20:24–20:34: Persistent Data off, then on; tiling 2048; view transform **AgX**, look **Medium Low Contrast**. Motion blur is unchecked in the inspected frames, even though the narration says to turn it on. Persistent Data speeds up multi-frame renders by keeping scene data in memory, at the cost of higher RAM use. Motion blur should be tested against the actual motion, not enabled by rule.

**Post-grade not shown.** The final look depends on an After Effects grade that the video does not show. A flat master is a deliberate hand-off to that grade, and is not comparable with a graded showcase frame.

---

## 5. What the two earlier sources contribute

**Aidan Stanik (Blender + Claude, CTLT).** CTLT (Camera, Tone, Lighting, Texture) turns an idea into explicit photographic decisions before building. The workflow is scene idea → brief → editable scene → preview → *actual image inspection* → bounded revision → alternate cameras. A camera reused for a new view exposes unfinished geometry and fog problems, so per-camera review is part of the method ([2:16 camera sheet](https://www.youtube.com/watch?v=0It5N3kHldE&t=136s), [12:08 comparison](https://www.youtube.com/watch?v=0It5N3kHldE&t=728s), [12:52 alternate views](https://www.youtube.com/watch?v=0It5N3kHldE&t=772s)). The creator's CTLT file and build scripts were not available.

**Dan Kieft (capture-driven realism, generative video).** No Blender is shown. The transferable ideas are: one coherent capture language ([11:53](https://www.youtube.com/watch?v=2hJsvDSPWYM&t=713s)); references with explicit roles such as identity versus scene ([11:53–14:30](https://www.youtube.com/watch?v=2hJsvDSPWYM&t=713s)); reusable style files that keep camera, light and finish fixed while subject, action and location change, tested on a different subject ([14:30](https://www.youtube.com/watch?v=2hJsvDSPWYM&t=870s)); story contrast ([15:27](https://www.youtube.com/watch?v=2hJsvDSPWYM&t=927s)); and eight event-driven operator behaviors with a trigger and a recovery ([17:16](https://www.youtube.com/watch?v=2hJsvDSPWYM&t=1036s)). The Blender translation keeps a clean master and makes each imperfection separately editable.

---

## 6. Cross-source synthesis

1. **Story and focal read first.** Onur's closing argument, CTLT's Tone and Dan's contrast all put the narrative read ahead of microdetail. Detail goes where the story and the camera need it.
2. **Camera before content.** All three nature workflows position the camera early and budget geometry to it: a cheated angle and painted masks (3), "cheat your camera angle" and real-scale optics (4), and a mask painted for the animated camera with per-tree checks from the camera (5).
3. **Scale is a control, not an afterthought.** Applied scale changes displacement; real-world scale changes light falloff and depth of field; texture tiles need a metric size; fog density is per metre. Every scene needs a scale proxy and recorded dimensions.
4. **Layer by distance.** Hero foreground (high detail, contact, root mounds, debris), midground scatter (masked, capped, seeded), background (low-poly instances), extreme background (photo card or sky), each in its own collection.
5. **Atmosphere is a decision with consequences.** Camera-ray fog (bright, cheap, non-physical) and a physical volume (darker, slower, consistent) are different tools. Approximation toggles and volume bounces change the look. Pick early, record it, and rebalance light when it changes.
6. **Light is relative and shaped.** Sun-to-sky ratios, sky controls as a set, gobo planes that cast shadows but stay hidden from camera rays, area lights with size and spread treated separately, a dim natural fill against black voids.
7. **Motion is motivated and varied.** Wind varies by species and anchors at the roots; litter stays still. Handheld noise is small, decorrelated across axes and tied to an event. Duplicated cameras carry copied motion until it is removed. Markers bind cameras to time.
8. **Inspect real renders, compare approved views.** No source proves quality from a tool call. Render, open the image, compare it to approved views under fixed settings, and keep a clean master separate from finishing (grade, grain, bloom).

---

## 7. Visible and stated values (scene-dependent)

None of these are defaults. They are the creators' choices in specific scenes.

| Source / time | Control | Value | How known | How the plugin should treat it |
|---|---|---|---|---|
| bT2 1:03 | Displace (Local coords) strength / midlevel | 0.310 / 0.5 | visible | Tune in metres after applying scale |
| bT2 2:12, 4:05 | Anti-tiling node Scale; Mosaic Rotation | 7.9; 5.9 → 9.8 | visible | Prefer metric tile size + breakup |
| bT2 4:15–4:21 | Sun strength | 25.0 (narrated range 25–35; angle 0.526°) | visible (parent check) + caption | Set relative to world fill and exposure |
| bT2 5:10, 5:56 | HDRI strength; world rotation Z | 0.3; −112° | visible + caption | Fill level depends on HDRI and view transform |
| bT2 5:55 → 6:57 | Fog thickness (camera-ray group) | 0.1 → 0.010 | caption → visible | Per-metre density; confirm visually |
| bT2 5:56 | Fog anisotropy | 0.850 | visible | Forward scattering for shafts toward the sun |
| bT2 6:24 → 6:52 | Gobo noise (scale, detail, roughness) | 5 / 2 / 0.5 → 4.6 / 2 / 0.5 | visible (6:52 parent check) | Shape by eye from the camera |
| bT2 7:40 | Camera focal length; f-stop; clip | 100 mm; 2.8; 0.1–1000 m | visible | Shot-specific |
| oBQ 5:07 | Focus distance; f-stop; ratio | 0.7567 m; 2.8; 2.0 | visible | Close-up example; ratio is stylistic |
| oBQ 5:04 | Bokeh blades / ratio | 8 / 2 | caption (ratio visible) | Optional stylistic bokeh |
| oBQ 5:33 | F-curve noise scale / strength / phase | 70 / 1.0 / 1.0 | visible | Too strong for rotation as shown; reduce, vary phase |
| oBQ 6:20 | Area light power / size / spread | 10 W / 1 m square / 2.8° | visible | Spread ≠ softness alone; test |
| oBQ 7:53–8:00 | Noise threshold / samples / resolution % | 0.075 / 1000 narrated (field shows 100, mid-edit) / 200% of 1920 × 1080 | caption + visible | Final-quality example; preview first |
| advpj 2:15, 18:42 | Focal length | 35 mm | caption + visible | Wide landscape example |
| advpj 5:40 | Turbulence strength (plant 1) | 0.200 (speed caption: 5) | visible / caption | Vary per species |
| advpj 6:10 | Turbulence strength (plant 2) | 0.600 (speed caption: 2) | visible / caption | Vary per species |
| advpj 11:43 | BG instance count / seed / hair length | 250 / 0 / 4 m | visible | Cap and seed; GN fallback |
| advpj 15:19 | Card roughness / IOR / emission strength | 0 / 1.0 / "1 or 2" | visible / caption | Card-only material; not a light |
| advpj 15:41 | Fog cube scale | ~50 | caption | Must enclose the camera view |
| advpj 16:11 → 16:22 | Principled Volume density | .02 → 0.010 | visible (captions garbled) | Confirm in render; scale-dependent |
| advpj 16:22 | Volume anisotropy | 0.800 | visible | — |
| advpj 16:30, 18:16 | Sun elevation / rotation / size / Air | 45 → 50° / 22° / 5° / 4.781 | visible (captions differ) | Set as a related group |
| advpj 17:34–17:39 | Spotlight power | 15000 W (caption: 1500) | visible (parent check) / caption | Temporary demo; deleted |
| advpj 18:42 | Focus distance / f-stop | 4.2 m / 2.8 → 1.2 | visible / caption | Strong stylistic example |
| advpj 19:55 | Noise threshold / max samples / volume bounces | 0.01 / 4096 / 0 | visible | Creator's final settings |
| advpj 20:34 | View transform / look | AgX / Medium Low Contrast | visible | Flat master for later grade |

---

## 8. Claims that need correction or caution

- **"4K or 8K PBR textures are necessary" (oBQ 2:39).** Texture resolution should follow on-screen texel density: roughly as many texture pixels across the visible surface as the render pixels it covers, with some margin for close-ups. A 4K tile on a background rock is waste; even 8K can be too little on an extreme close-up of a large surface. Never prescribe 4K/8K regardless of footprint.
- **"Scanned assets" as a requirement.** Scans help; well-authored procedural or modelled assets with correct scale, bevels and contact can also read as real. Scans are optional.
- **Sun 25–35, HDRI 0.3, fog 0.1/0.01, density 0.01, samples 1000 (or the 4096 visible in source 5), threshold 0.075, 200%, f/1.2, spotlight 15000 W.** All scene- and exposure-dependent (§7).
- **Camera-ray fog as "fog."** It is a look adjustment that excludes non-camera ray types while still affecting camera rays. Call it that, and offer a physical volume as the alternative.
- **Gobo visibility.** Turning off render visibility removes the shadows that make the gobo work. Use camera ray visibility.
- **"Emission illuminates from the background" (advpj 15:21).** Physically true but usually negligible at distance. The card's job is appearance, not lighting.
- **Handheld noise as shown.** Strength 1 on radian channels with identical phase on all axes is too large and too uniform. Keep it small, decorrelated and event-driven.
- **"Motion blur definitely on" / "Persistent Data on."** Useful for animation, but test motion blur against actual motion and render cost; Persistent Data trades RAM for speed.
- **Intro renders vs tutorial settings.** Source 5's creator states the intro render used different settings. Showcase frames from any source cannot be used to validate the tutorial's values.
- **Hidden grades.** Source 5's final look includes an After Effects grade that is not shown. Source 4 promotes a paid compositor. Neither grade is reproducible from the videos.
- **Add-ons.** Geo-Scatter, Botaniq, Lens Sim, Camera Shakify, Forestation and similar tools are optional. Several are paid. The plugin must never install, buy or assume them. Check what is installed first, and use built-in geometry nodes otherwise.
- **A.N.T. Landscape.** Bundled through Blender 4.1; from 4.2 it is a separate free extension with limited support (extensions.blender.org, checked in the parent pass). Check before relying on it, never install it automatically, and use a subdivided plane with displacement as the always-available fallback.

---

## 9. Research → plugin feature map

Schema fields are from the core partner's final contract (`work/collaboration/core-contract.md`, schema version 1, all optional). The native helper is present in `scripts/blender_scene_tools.py`; its limits and tested behavior are documented in `skills/nature/references/scene-tools.md`.

| Research finding | Plugin feature |
|---|---|
| Story/focal read before microdetail (bT2 8:14; CTLT; contrast) | `/scuff:plan` asks for subject and focal read first; detail density stays subordinate |
| Optional nature workflow: inventory existing assets first, fall back to procedural assets | `/scuff:nature`; `workflow: "nature"` |
| Terrain in metres; applied scale affects displacement; root mounds | `nature` terrain step; `natureTerrainM`; root-contact check |
| Metric texture scale + repetition breakup | `nature` ground-material step |
| Camera-masked instancing with density budget, cap, seed, path margins, exclusions | `nature` scatter step; `natureScatterMax`, `natureSeed`, `natureExclusions`, `natureFoliage`; native scatter preview/create actions |
| Separate FG/scatter/BG collections; high/low detail tiers; photo card | `nature` layering step |
| Sun/sky ratios are scene-based | Light guidance phrased as ratios and checks, never fixed numbers |
| Camera-only fog vs physical volume; approximation toggle consistency | `natureFog` (`camera` or `physical`); `nature` atmosphere step; native fog creation action |
| Gobo keeps shadows: hide from camera, not render | `nature` light-shaping check (also in the compiled nature section) |
| Wind varied by species, roots anchored, litter static | `nature` + `shot` animation checks |
| Multiple cameras, markers, copied motion | `/scuff:shot`; native camera-marker action |
| Capture styles and operator behaviors with event and recovery | `/scuff:shot`; `captureStyle`, `cameraOperator`, `animationSeconds`, `animationFps`, `animationEvent`, `animationRecovery` |
| Reusable style: fixed camera/light/finish vs variables; test on a new subject | `/scuff:style` (saved looks remain the in-app record) |
| Reference roles: identity, composition, atmosphere; references teach light behavior | `/scuff:references`; `referenceIdentity`, `referenceComposition`, `referenceAtmosphere` |
| Render → inspect → compare approved views; clean master; budgets | `/scuff:direct` loop, shared by all workflows |
| Persistent Data, motion blur, approximation toggles | `shot` and `direct` render-budget notes (test, don't auto-enable) |

---

## 10. Gaps and open hypotheses

- **Fog node group (bT2).** The four-node graph is visible at 5:51, but not the material's other settings (volume sampling and interpolation) or how the asset is stored in his library. Its behavior in EEVEE, or with ray types other than those reasoned about in §2, was not tested.
- **Gobo plane visibility (bT2).** The video does not show whether the plane was hidden from the camera; it is out of frame in the inspected shots.
- **Geo-Scatter densities, wind values and Botaniq animation settings (bT2).** Not legible in the inspected frames.
- **Onur's render engine settings, exposure and view transform.** Viewport sample counters suggest Cycles; final settings are not shown.
- **The three reference groups (oBQ 1:33).** The frame shows the book photos but not legible group labels; the later chapters use references for camera and lighting, which supports reading them as functional groups.
- **advpj speed values and the 1.2 f-stop.** Caption-only; the visible fields were mid-edit.
- **advpj volume emission strength.** A very small value is visible but not legible with confidence.
- **Camera Shakify and other add-on effects.** Mentioned or visible as panels; not demonstrated in detail.
- **Root-mound automation with geometry nodes.** Onur speculates it is possible; not shown. It remains a manual or sculpt step unless implemented and tested.
- **All final showcase renders.** Their settings, grades and compositing are unknown and can differ from the tutorial steps.

---

## 11. Evidence record

- Captions: bT2 220 timed lines (English auto); oBQ 220 lines (English auto); advpj 596 lines (Hindi original auto). All read completely in bounded passes.
- Contact sheets: six-second sampling at 480 px width, 6 + 6 + 14 sheets (95 + 90 + 215 frames), reviewed visually during this session.
- Targeted full-resolution frames inspected for this write-up (32):
  - bT2nfjP6IK0: 1:03, 2:12, 4:05, 4:19, 5:44, 5:51 (plus an enlarged crop of its node editor), 5:56, 6:24, 6:40, 6:57, 7:16, 7:40, 7:45
  - oBQ91yoNzV4: 1:33, 5:07, 5:33, 6:20, 7:55, 8:00
  - advpjWa16hY: 4:52, 5:40, 6:10, 11:43, 15:19, 16:11, 16:22, 16:30, 18:16, 18:42, 19:55, 20:24, 20:34
- Extracted but not inspected: bT2 0:48, 3:59, 5:11; advpj 15:00, 17:00.
- Local media: 1920 × 1080 video with an audio stream for all three; durations 569.8 s, 540.3 s and 1289.1 s.
- The Claude analysis pass made no network requests or Blender changes. The parent research pass fetched the supplied videos/captions and checked official documentation. Separate plugin validation later used an isolated factory-startup background Blender scene; the user's open projects were not changed.

Machine-readable summary: `evidence.json` in this folder.
