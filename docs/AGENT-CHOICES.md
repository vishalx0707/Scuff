# Agent choice sessions

A chat agent can create a choice request from the current conversation, pass its returned local URL to the user, and wait for an explicit **Done** or **Ignore**. Each request has a separate random session ID; there is no global “current chat” that could mix another conversation's choices into this one.

The page saves draft selections as the user edits. These are previews until Done. The agent must not execute a draft merely because it changed, a wait timed out, or the user left the page. Done stores the authoritative direction, resolved agent/generator prompts and verified actual reference-file metadata. Ignore returns no usable direction and must not apply partial choices. Neither action queues a build automatically.

## HTTP contract

All POST calls use `Content-Type: application/json` and `X-Fieldwork-Request: 1`; browser Origin must match the local workspace. The server remains bound to localhost. `createServer({storeRoot})` isolates tests.

- `POST /api/choices` — `{direction,message?,owner?}` creates a request. `direction` is schema1, may have an empty subject while editing; `owner` is optional actual host/thread context, not an invented identity. Response contains `id`, `status:"choosing"`, `revision:0`, the initial `direction`, and `url:"/?choice=<id>#direction"`. The agent can prepend the server's actual local origin. This never opens a browser.
- `GET /api/choices/:id` — latest request. Choosing means draft; Done means authoritative; Ignore returns `direction:null` and no generated prompts.
- `POST /api/choices/:id/save` — `{direction,revision}`. The last observed revision is required. An accepted update increments it. A stale tab gets409 and must fetch the latest session rather than silently overwrite it.
- `POST /api/choices/:id/done` — `{revision,direction?}`. Supplied final direction is saved atomically with Done. Requires a subject, current authored prompt bases and verified attached references. Returns resolved prompts and actual reference paths/hashes. Repeated Done is idempotent but cannot change an already submitted direction.
- `POST /api/choices/:id/ignore` — `{revision?}`. Closes the request as ignored. Later draft writes and a later Done are rejected. Repeated Ignore is idempotent.
- `GET /api/choices/:id/wait?afterRevision=N&timeoutMs=55000` — bounded long poll. Returns at a revision change, terminal decision or timeout, with `timedOut`. Choosing remains unapproved after a timeout. The agent can wait again while keeping the native chat question pending; it must not turn an expired wait into Done.

Sessions persist in `.fieldwork-local/choices`. Writes use exclusive locks, revision checks and atomic JSON replacement. A dead writer's lock can be recovered; live locks return409. Submitted sessions are immutable. Do not bundle this folder into a distributable.

## CLI fallback

```powershell
node choices.mjs create current-direction.json --owner actual-thread-id
node choices.mjs show <session-id>
node choices.mjs wait <session-id> --after-revision 0 --timeout-ms 55000
node choices.mjs done <session-id> --revision 3
node choices.mjs ignore <session-id>
node choices.mjs export <session-id> selected-direction.json
```

`--message-file question.txt` supplies the user-visible request text. `--direction final.json` is accepted by save/done. `--store <isolated-folder>` and `--base-url http://127.0.0.1:<port>` support isolated verification. Only Done sessions export a direction for use. No command opens or focuses a window.

The host agent owns native chat questions and any explicit browser opening. It should offer Done/Ignore using its available question controls, keep the local session ID, then read the submitted snapshot before continuing. This server cannot inject arbitrary buttons into an unrelated host chat or wake an agent whose turn has ended; the MCP/session wait or host question must remain active. Respect background-browser preferences and provide a link when opening would interrupt the user.

## Cross-agent adapter

`node agent-mcp.mjs` exposes five standard local stdio tools: start_choices, read_choices, wait_choices, ask_choices and finish_choices. It returns/open-links through the host rather than launching an OS browser. `ask_choices` negotiates MCP form support for Done/Ignore; unsupported hosts receive an explicit fallback question for their own user-input UI. A site Done/Ignore returns immediately to a waiting question tool and cancels the now-redundant form request. Native chat Done waits for a stable saved revision. Site Done remains the strongest final-input guarantee; an agent cannot read an offline unsent browser edit.

The same adapter is intended for local Codex, Claude Code, Cursor and other MCP clients. Connect the Node command once in that client using `mcp-config.example.json`; Codex TOML and the full loop are in `skills/plan/references/agent-choice-loop.md`. A Claude Code plugin-scoped `.mcp.json` is bundled. No global client settings are modified. Native dialog appearance and local-page opening depend on the host's available features.

Protocol/UI verification uses a real local page, durable HTTP store, stdio adapter and simulated native-form client responses. No live Claude Code/Cursor/Codex dialog was launched or claimed verified. Official host documentation: [Codex input/elicitation](https://learn.chatgpt.com/docs/app-server#mcp-server-elicitation-requests), [Claude Code MCP](https://code.claude.com/docs/en/mcp#respond-to-mcp-elicitation-requests), [Cursor MCP](https://cursor.com/docs/mcp). A remote/cloud agent still needs access to this computer; its own localhost is a different machine.
