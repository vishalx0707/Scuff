# Verification — Scuff 0.3.1

Checked 26 October 2026 before publication. Browser work stayed headless. No external collaborator or model was invoked.

| Boundary | Result | Coverage |
| --- | --- | --- |
| Compiler, local server and stdio MCP | 60 Node tests passed | Effective camera/CTLT semantics, strict import/export, literal user data, actual reference bytes, canonical artifact containment, exclusive job claims, session revisions, Done/Ignore and malformed MCP requests |
| Blender helper without Blender | 4 Python tests passed | Seed determinism, instance budgets, masks/exclusions and invalid requests |
| Workspace in Chromium | 121 checks passed | Navigation, choices, example image loading, prompts, saved directions/styles, references, queue/result UI and responsive layout; no runtime errors or external requests |
| Isolated choice UI | 31 checks passed | Agent seed, autosave, final-keystroke page Done, Ignore, conflicts, manual prompts, recovery and mobile controls |
| Browser → HTTP store → stdio MCP | 12 checks passed | Scoped conversations, real selections, page Done to a waiting tool, deliberately delayed autosave before chat Done, Ignore without partial settings and no accidental build |
| Native Blender 5.2.1 LTS | Background smoke passed | Factory-startup inventory, deterministic 70-instance scatter, masks/exclusions, fog nodes, camera copies/markers, rollback and an actual diagnostic render/native file |

Run `npm test`, `npm run test:python` and `npm run test:browser`. Optional browser dependencies and installation are described in the root README. Outputs stay under the ignored `test-results/` folder. Blender diagnostics run separately with a resolved absolute output path.

## Corrections before publication

- Malformed JSON-RPC envelopes, including JSON `null`, return an error instead of crashing the adapter.
- Native chat Done waits for several stable server snapshots instead of the first unchanged read before a delayed browser save. A regression deliberately delays that save.
- MCP test and screenshot paths use `fileURLToPath`, preserving spaces and Windows drive letters.
- Browser suites use project-relative imports and isolated outputs, with a pinned optional Playwright dependency and lockfile.
- Blender render output paths are resolved before use, preventing relative diagnostic renders escaping to the drive root.
- Artifact containment resolves both the store and output paths, accepting Windows short names and store junctions while refusing files outside the store. Encoded backslashes are rejected consistently on Windows and Linux.
- Atomic JSON replacement retries brief Windows file-lock errors without deleting the previous saved state.
- Public source excludes private stores, personal machine paths, videos, chat logs, migration records and obsolete previews. Commissioner includes its open font license; Satoshi binaries remain local.

## Limits

Native MCP form answers in the round-trip checks come from a simulated host. This verifies the protocol and actual local page/store, not native question appearance in every agent application. Each host needs its MCP connection configured once. A cloud agent cannot reach another computer's localhost without an explicit host connection.

Chat Done can use only server-saved choices. Offline text or text delayed beyond the bounded save window cannot be inferred; wait for Saved or use page Done when the final edit must be included atomically. Timeouts and dismissed questions never approve a direction. Neither Done nor Ignore automatically starts a render.

The Blender render is a small technical diagnostic, not artistic acceptance. Example images are illustrative rather than calibrated optical simulations. Earlier reference-image, style-transfer and editable Blender/animation evidence remains in the owner's local research archive; it is not a live-provider test of this public checkout. External AI video, voice and upscale providers were not executed in this publication check.

Source-video inspection limits remain in [CTLT-SOURCES.md](CTLT-SOURCES.md), with additional research in [RESEARCH.md](RESEARCH.md).
