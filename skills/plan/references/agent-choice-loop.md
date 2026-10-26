# Agent ↔ local choices

Use this for the interactive selection step in any local agent chat, including Codex, Claude Code, Cursor or another MCP/CLI-capable host. The implementation is agent-neutral. Host-specific browser and question tools stay with that host; do not invoke an excluded collaborator just because its client is supported.

## With the optional MCP adapter

1. Call `start_choices` with schema1 direction data inferred from the conversation. Preserve subject/action/Tone, actual medium, explicit selections and constraints. For a new direction start with `freshDirection(medium)` and leave unchosen groups unresolved. Pass the actual chat/task ID as owner when the host exposes it; otherwise keep the returned session ID in this conversation. The result contains a unique local URL, session ID and question wording.
2. Make that URL available using the host's browser/page tool. Use an existing or built-in page when requested. Respect background-only browsing and do not launch an OS browser unconditionally. If the host cannot open the page, provide the link; do not claim it opened. No browser launch occurs in the MCP adapter itself.
3. Ask the native chat question **Done / Ignore**. Use `ask_choices` when the client supports MCP form elicitation. It uses the client's own form UI, whose exact button appearance varies. If elicitation is unavailable, the tool returns `nativeQuestionDisplayed:false`; use the host's own user-input tool instead. If neither exists, give the link and wait for a normal user reply. Do not invent a native question or run the task while the user is choosing.
4. While the user works, `read_choices` returns the latest saved draft and `wait_choices` waits for a revision or terminal status. The page auto-saves in this scoped session, independent of the browser's normal direction. Drafts are provisional. A timeout, preselected native answer, dismissed form or open page does not mean Done.
5. **Site Done** flushes the latest state and submits a final snapshot. The tool response contains `status:done`, current settings, resolved agent/generator prompts and verified actual reference-file metadata. Continue the original task from that snapshot without copy-paste or another redundant confirmation. Do not execute beyond the original authorized scope merely because choices were submitted.
6. **Chat Done** is an explicit user response: let pending autosave settle, read the latest revision, then call `finish_choices` with decision `done`. An optimistic-revision conflict means the page changed: reread, resolve the final pending change and retry. The MCP form path checks for a stable saved revision first; the page flushes pending edits on blur. Only site Done guarantees inclusion of the very last local edit, including an edit not yet delivered to the server. If the site already submitted, use its final snapshot. Missing subject, invalid values, stale authored prompts or unavailable reference files must be corrected rather than silently discarded. Untouched generated drafts can be rebuilt from current selections.
7. **Ignore** skips only this selection step. Call `finish_choices` with decision `ignore` when the response came through the host question; the ignored response withholds draft choices. Continue with the original conversation context if the task remains authorized. It does not cancel the whole task or approve a partial direction. A dismissed/cancelled question remains pending unless the user explicitly says to skip.

The choice step does not create a render/build job. Once selections are final, execute through the appropriate workflow or create a queued build if the task uses the result page. Model calls, rendering, billing and publication retain their existing task scope.

## Without MCP registration

The same store is available to any agent that can run Node:

```text
node choices.mjs create direction.json --owner <actual-task-id>
node choices.mjs show <session-id>
node choices.mjs wait <session-id> --after-revision <N> --timeout-ms 55000
node choices.mjs done <session-id> --revision <N>
node choices.mjs ignore <session-id> --revision <N>
node choices.mjs export <session-id> final-direction.json
```

Start `node server.mjs` in the background if it is not already running, then open or link the returned URL through the host. Offer the host's question UI and use the commands above to read/complete the session. The CLI and server must use the same store; tests use `--store`. Never read a global “latest choices” file or consume another conversation's session.

## Connecting clients

`agent-mcp.mjs` is a local stdio MCP server. It uses the existing local HTTP server or starts one on the configured localhost origin without opening a window. `FIELDWORK_URL` defaults to `http://127.0.0.1:8787`; `FIELDWORK_AUTOSTART=0` disables that local server startup. `mcp-config.example.json` gives the portable command/args configuration for MCP clients; replace the path placeholder with the real plugin path. Configure it in the intended client's MCP settings, not in unrelated applications.

For Codex, the equivalent TOML entry is:

```toml
[mcp_servers.fieldwork]
command = "node"
args = ["C:/absolute/path/to/Scuff/agent-mcp.mjs"]
```

Cursor and Claude Code accept `mcpServers` JSON configuration with the same command and absolute script path. The package's `.mcp.json` additionally bundles the adapter for Claude Code's plugin loader using that loader's root-path variable; it does not invoke Claude during development. Use the portable example or host-specific TOML in other clients. No global client configuration is changed by this package.

Clients need Node20+ and access to the same computer/store. A remote/cloud agent cannot reach the user's `127.0.0.1` without an explicit host connection; do not promise remote access or publish the local server as a workaround.

MCP form elicitation and host questions return data into the requesting tool/agent turn. If an agent ends its turn instead of waiting, the local site cannot wake it or inject a new chat message by itself; it can read the durable result when resumed. Do not install a watcher, scheduler or chat automation as part of this feature.
