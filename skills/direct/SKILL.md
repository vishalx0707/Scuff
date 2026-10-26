---
name: direct
description: Execute a Scuff direction or queued build with the available Blender or image/video tools, inspect actual outputs and report bounded revisions and artifacts.
disable-model-invocation: true
argument-hint: "[queued job ID, exported-direction.json or creative brief]"
---

For a queued job, read `references/queued-execution.md`, claim it once and use its stored direction, actual reference files and resolved prompts. For a JSON file compile with `node compile.mjs "<absolute-input.json>"`; keep manual prompt edits and resolve a stale-draft warning before execution. For prose, use `../plan/SKILL.md` when the scene-specific CTLT decisions remain open. Infer medium from the user/context: native Blender animation is `blender`; image/video generation uses the relevant generator. Resolve `general` before running tools.

## References and generator handoff

Inspect every actual supplied image/audio input before claiming to use it. Preserve roles: identity controls the subject; layout controls framing/pose; atmosphere controls light/air/color; style controls photographic treatment. An audio reference controls specified voice/accent/cadence, not unrequested reuse of its words. A multi-view identity sheet is one subject. Do not copy identities from unrelated layout or atmosphere references.

For generation, supply the actual reference files to the generator as well as the concise CTLT prompt. A URL or image description in prompt text alone does not attach its bytes. Record tool input paths/IDs or another concrete delivery receipt and inspect the generated identity. If an input or generator is unavailable, report the precise limitation, retain the usable direction and fail the queued run honestly. Do not invent a successful attachment or output.

Keep the user's event, scene and emotional intent. Do not universalize camera shake, grain, low resolution or polish. If the request includes model comparison, hold prompt/reference/settings fixed, compare actual results against acceptance criteria and only upscale the selected draft within the authorized budget. Save the chosen model/settings with outputs; unsupported controls remain explicit limitations.

## Native Blender

Check the actual MCP family/tool availability, Blender version, engine and hardware. Inspect existing camera, geometry, materials, lights, scale and color management. For existing work, save a versioned copy; for a new scene use a separate project and preserve unrelated open scenes. Background factory-startup Blender is an isolated fallback when appropriate; it is not proof of a live MCP connection.

An add-on status/version helper can fail independently of scene execution. If that happens, record the specific helper error and probe actual Blender/tool availability with a harmless `bpy` version/background/filepath query before declaring the connection unavailable. Do not change external MCP configuration merely to suppress a status-tool error.

Resolve one effective camera. Isometric is orthographic and uses scale, not an active perspective focal length; fisheye needs a supported panoramic camera. For matched-size lens comparisons move the camera and record both lens and distance. Keep capture traits compatible with explicit physical choices; omit incompatible assumptions and acceptance checks rather than stacking contradicting instructions. For motion and same-scene alternatives use `../shot/SKILL.md`.

Establish silhouette, spatial scale, camera and motivated key light before fine detail. Keep material identity separate from wear; place wear and small details where story and physical contact explain them. Preview atmosphere against readable depth layers: the source video's water-like fog is a known failure, not a target. Keep controls editable and named, and store scripts, versioned `.blend` files and renders together. For nature assets and budgets read `../nature/SKILL.md`.

## Inspect, revise and report

Render/generate a preview suited to the actual tool and machine, then open it. Check first read, intended feeling/action/story state, subject identity, framing/focus, value separation, materials/wear, contact/intersections and atmosphere. For video inspect representative frames AND the temporal clip for continuity, trigger, peak, recovery and ending. A render exit code or static thumbnail does not establish motion quality.

Identify the largest visible mismatch, make one bounded repair or related repair group and compare against the baseline with approved choices fixed. More rust/noise/detail is not automatically better. Stop after two stalled revisions and report the unresolved issue. Deliver actual editable native files where applicable, selected renders/clips and a concrete inspection note with settings and limitations. Complete a queued job only after its actual artifacts and reference delivery evidence exist. Do not purchase, publish, send messages or alter unrelated work beyond the user's scope. Never use a collaborator the user has excluded.
