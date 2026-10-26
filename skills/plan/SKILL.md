---
name: plan
description: Turn a subject or Scuff direction into scene-specific Camera, Tone, Lighting and Texture decisions and a concise generation prompt. Use before execution or when exploring alternatives.
disable-model-invocation: true
argument-hint: "[subject or exported-direction.json]"
---

Start with the user's actual subject, action, setting and intended feeling. Preserve the idea: do not invent props, characters or backstory to decorate it. Infer routine settings from context; where a creative choice matters, propose a few coherent scene-specific alternatives with their visible consequences. A ship on a mountain ridge calls for hiker, overhead-drone or distant-next-peak views rather than a generic menu. Do not turn this into a long questionnaire.

If the user should pick on the local site, follow `references/agent-choice-loop.md`. Seed a unique choice session from the conversation, make its page available, ask Done/Ignore through the current host, and read/wait for that session's final choices. No copy-paste or separate Queue build is needed to return the choices. Support the current agent, including Codex, Claude Code or Cursor, without spawning a different collaborator.

Resolve four linked decisions:

- **Camera:** capture device/language, projection/lens, viewpoint/distance, shot size/framing, focus, aspect and relevant movement. Film format is not lens focal length. Camera position changes perspective; a focal-length change from the same position changes coverage. Isometric uses parallel/orthographic projection. Fisheye is a distinct projection and needs engine support.
- **Tone:** feeling plus subject/action/setting, story state, time and weather. Optional narrative contrast is an unexpected situation, identity/attitude or emotion; it is not color contrast. A just-stranded ship and a decades-old wreck require different wear and details.
- **Lighting:** motivated source, direction, hard/soft quality and fill, atmosphere, color/Kelvin. Do not add beauty lights, haze or bloom by default.
- **Texture:** actual materials, localized wear, supporting small details and intentional capture finish. Several materials can coexist. Grain/blur/compression are appropriate only when the chosen capture calls for them.

Aesthetic languages and fixed palettes are optional starts. For new JSON use `freshDirection(medium)` from `dist/core.mjs` and mark only selected preset groups in `chosenGroups`; absence of a decision must not become dreamy/35mm/soft light. Legacy schema1 directions retain their explicit old choices. Normalize with `normalize(input,true)`; do not invent preset IDs. New free-text CTLT fields carry custom decisions without more preset buttons.

For a supplied export, compile it with `node compile.mjs "<absolute-input.json>"`. Preserve authored drafts; a stale-draft warning means reconcile the current settings with the user's edits before building. Generate two useful artifacts: a concise four-paragraph Camera/Tone/Lighting/Texture prompt (use `compileGeneratorPrompt`) and the fuller execution brief (`compilePrompt`) with scope, reference delivery, output and review requirements.

For image/video, resolve actual reference attachment and generator capabilities. Model comparisons use the same prompt/reference/settings and separate realism from instruction following; never hardcode the recording's historical model rankings or prices. Where supported, iterate a cheap draft, select the result and upscale only that result within the stated budget. Native Blender work instead records engine/hardware-aware render settings.

Use `../shot/SKILL.md` for camera sets or operator beats; `../references/SKILL.md` for real inputs; `../style/SKILL.md` for a reusable image-plus-prompt recipe. Planning prepares a direction; execute only within the user's requested scope. Keep the UI concise with optional details folded away and use the actual medium in the local URL, for example `http://127.0.0.1:8787/?medium=blender#direction`.
