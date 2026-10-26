# Workflow 0.3

The source-driven changes restore Camera, Tone, Lighting and Texture without making the visible page a questionnaire. Subject/action/Tone lead; presets can remain unselected. Additional lighting/material/wear/framing controls, timed operator combinations, same-scene shot sets and generation-comparison settings live in optional panels.

## Local reference and execution boundary

`GET /api/capabilities` reports `queue:true`, `referenceUpload:true` and `automaticExecution:false`. A connected agent is responsible for executing jobs. The server never executes submitted code or launches a model from a browser request.

All writes require `x-fieldwork-request: 1`; if Origin is supplied it must match the local workspace. The server accepts localhost/127.0.0.1 Host values and binds 127.0.0.1. No cross-origin API is enabled.

- `POST /api/references`: raw PNG/JPEG/WebP/GIF (20MB max) or WAV/MP3/Ogg/M4A (40MB max), with `Content-Type`, `X-File-Name: encodeURIComponent(filename)` and `X-Reference-Role` (identity/composition/atmosphere/style/audio). Format signatures, plain filename and role/mime pairing are checked. Returns an ID, role, name, SHA-256 and same-origin file URL.
- `GET /api/references`: list uploaded metadata. `GET /api/references/:id/file`: actual verified bytes. A changed file/hash is rejected rather than silently substituted.
- `POST /api/jobs`: JSON `{direction}` validated with strict schema1. Resolves each `referenceAttachments` ID to the actual stored reference. Requires an explicit medium and subject. Stale agent or generator drafts are rejected with409; current authored drafts are preserved.
- `GET /api/jobs` and `GET /api/jobs/:id`: queue status, full direction, agent brief, generator prompt, actual reference paths/hashes, registered artifacts, inspection and limitations.
- `node jobs.mjs claim <id> [agent-name]`: exclusive local claim. References are reverified. Only queued work becomes running.
- `node jobs.mjs complete <id> <receipt.json>`: requires real nonempty output files, inspection confirmation, actual inspection text, and reference inspection/use evidence. Image/video jobs additionally require confirmation that every uploaded input reached the generator. Copies and hashes outputs before marking completed. See the direct skill reference for receipt shape.
- `node jobs.mjs fail <id> "reason"`: records a failure for running work.
- `GET /api/jobs/:id/artifacts/:artifact-id`: only registered, hash-verified output copies are served. No arbitrary local path is accepted. Video/audio byte ranges are supported.

The default store is `.fieldwork-local` beside the plugin. Tests can pass `createServer({storeRoot})`, `createJobStore(root)` or CLI `--store <folder>` to isolate state. Keep that folder out of distributable packages.

## Compatibility and truthful claims

Schema1 legacy directions retain their old chosen presets. Fresh directions track `chosenGroups`, so undecided values do not become accidental style requirements. Preserved manual prompts are not silently rewritten; adopting current choices requires a deliberate prompt action. Project snapshots and transferable styles are separate operations.

New Styles preserve the target subject's physical materials and localized wear. Explicit material bindings in an authored/imported recipe remain supported. The approved image and its producing prompt stay provenance, rather than becoming a request to repeat the old subject.

`node compile.mjs direction.json --generator` exports the concise CTLT prompt; `--regenerate` rebuilds the selected artifact deliberately. `--style` exports transferable style JSON. The default output is the agent execution brief. Each prompt retains its own manual draft and staleness basis.

One resolved semantic layer should govern Blender, image and video exports. The concise generator prompt is distinct from the agent execution brief. The chosen output—not a queued job or a compiled prompt—is the evidence of execution. A filesystem receipt can verify files/transport, but cannot itself prove an agent's visual judgment; the recorded inspection must be honest.

The local page cannot automatically receive chat context or invoke its host agent. Setting the medium in a URL, queuing real inputs and processing them through the connected agent is the supported end-to-end boundary. If no agent or generator is connected, show a waiting/failure state instead of simulating a result.
