---
name: style
description: Extract and transfer an approved image-plus-prompt capture recipe while keeping its subject, action and location replaceable. Use for reusable visual styles rather than restoring a whole project.
argument-hint: "[approved image and producing prompt, or native scene]"
---

Inspect the approved image and retain the actual prompt that produced it when available. For a native scene record verified camera/light/material settings and its rendered evidence. If only an image or prose brief exists, label unknown optical/lighting values as hypotheses; do not claim the unavailable producing prompt or exact settings were recovered.

Save a concise recipe containing source paths/URLs and what was inspected; the original generating prompt and output; fixed capture traits (projection/lens/distance, framing, motivated light/falloff, palette and finish); variables (subject/action/location/props/wardrobe unless explicitly binding); and visible rejection criteria. Transfer the fixed traits to a different subject, inspect the result and record what remained stable before calling the recipe validated. A Markdown recipe is reusable context, not model-weight training.

Use `createStyle(state)` and `applyStyle(current,style)` from `dist/core.mjs` for style-only JSON transfer. These should leave the new subject, action, identity references, journal and manual prompt intact; changed visual choices mark the existing prompt stale. The UI's saved Directions restore whole-project snapshots, whereas Styles apply fixed visual choices. Do not silently use a snapshot as a style and bring the old character or setting into the new work.

Newly saved styles also leave physical material identities and localized wear with the target subject: a robot's metal and ankle scuffs must not replace a dog's fur and muddy paws. An explicitly authored/imported recipe can bind a material when that is intentional; check that distinction before applying it.

A capture recipe is coherent: close fisheye + low viewpoint + direct night flash + crooked framing + grain cannot be preserved by copying only its label onto an incompatible camera. Explicit user physical choices govern; adapt or omit conflicting traits and state the change. Retain clean diagnostic versions, but preserve intentional degraded/candid capture in the selected output. Do not bundle a creator's full recipe or imagery without appropriate reuse rights.
