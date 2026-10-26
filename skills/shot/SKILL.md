---
name: shot
description: Build event-driven camera behavior combinations and same-scene camera sets in Blender or a generated video direction, preserving spatial identity and readable recovery.
argument-hint: "[direction.json, camera alternatives or shot idea]"
---

Read the subject, action, story state, scene geography, starting frame and ending first. Compile JSON with `node compile.mjs "<file>"`. Use the medium's resolved instructions and preserve manual edits; resolve stale choices before execution. Capture language describes the observer/device; camera operators describe behavior through time. One coherent capture language can include several compatible operator behaviors.

Use `cameraOperators` for a selected bundle and `operatorBeats` for timed entries (`id`, `startSeconds`, `endSeconds`, `trigger`, `recovery`), with `animationEvent`, `animationRecovery` and `operatorTiming` for scene-specific context. The legacy single `cameraOperator` remains supported. Choose a principal behavior and add a secondary only where the event motivates it. Overlapping techniques must retain a readable subject and a plausible observer.

- Handheld: low-amplitude correlated movement plus an event-driven flinch/correction, not uniform random jitter.
- Crash zoom: quick focal-length magnification from a near-fixed position, possible overshoot and focus recovery; not a dolly. With orthographic, use scale and label it rapid reframing rather than an optical zoom. Verify fisheye field-of-view support before promising that adaptation.
- Concealed observation: persistent real cover and a lean/reveal/retreat; no fake vignette standing in for geometry.
- Whip pan: continuous fast rotation toward an offscreen event with overshoot/recovery; check the space swept through the view.
- Walking backward: real translation/parallax and restrained step rhythm; an orthographic view cannot reproduce perspective parallax.
- Obstruction: a near-lens object enters and clears with continuous identity/action behind it.
- Exposure adaptation: a visible dark-to-bright transition causes temporary clipping and recovery. In Blender animate exposure; the engine does not meter automatically.
- Focus failure: a brief miss followed by reacquisition. Deep focus may make the miss imperceptible; do not silently change an approved aperture.

For native motion keep the clean camera path on its own rig and reversible imperfections on a separate action/modifier. Inspect start, trigger, peak, recovery and ending frames, then a short actual clip for jitter, temporal noise, occlusion and continuity. Do not force a source video's advertised model/resolution or a universal camera-shake amplitude.

For a `shots` set, reuse one approved scene and identity. Each entry names a camera variant and may override lens/viewpoint/focus/composition/shot size plus a scene-specific description. Record actual transforms and settings, save each render and create a comparison sheet. Do not rebuild the subject independently for each camera. For matched-framing lens comparisons move the camera and record distance; fixed-position zoom is a field-of-view test, not a perspective test.

Native camera copying and timeline markers use the documented helper in `../nature/references/scene-tools.md`. Remove animation only from the new copied camera when appropriate. Scatter masks must cover every camera/path sample plus margin; the helper checks only the current frame. Follow `../direct/SKILL.md` for actual visual inspection and result receipts.
