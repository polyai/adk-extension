# Contributing

## Running the extension locally

1. Open this `adk-extension` folder in VS Code (not a target agent project — the debug config lives here).
2. Press **F5** (or Run and Debug panel → ▶ "Run Extension", if F5 is intercepted by macOS Dictation — see below).
3. This compiles the extension and opens a separate **Extension Development Host** window with it loaded. `.vscode/launch.json` is configured to:
   - open `agent-deployments/agents` in that window automatically, so you can expand into whichever project you want to test against (e.g. `paratha/...`) — this assumes `agent-deployments` is checked out as a sibling of `adk-extension`; if yours lives elsewhere, update the path in `.vscode/launch.json`
   - disable the marketplace-installed copy of this extension (`--disable-extension=polyai.adk-extension`) in that window, so you're only ever testing your local changes, not a stale installed version shadowing them
   - run with **`noDebug: true`** by default (the "Run Extension" config) — see below for why
4. Run `yarn watch` in a terminal to recompile on save, then **Cmd+R** in the Extension Development Host window to reload with your changes.

### Why "Run Extension" skips the debugger

F5 normally attaches VS Code's Node debugger to the extension host, which requires a handshake to complete within ~10s or you get **"Extension host did not start in 10 seconds, it might be stopped on the first line and needs a debugger to continue."** On some machines this handshake is flaky and fails most/every launch, leaving the host permanently paused (it was launched with `--inspect-brk`, which blocks on line 1 until a debugger attaches — if the attach fails, nothing ever resumes it, so the extension never actually runs).

Since you don't need breakpoints for most manual testing, `.vscode/launch.json`'s default **"Run Extension"** config sets `"noDebug": true`, which skips the Node inspector/attach step entirely — no handshake, no race, no stuck-on-line-1 host. `console.log`/`debugLog` output still shows up in the Extension Host output channel.

If you *do* need to set breakpoints in the extension's TypeScript, use the **"Run Extension (with debugging)"** config from the Run and Debug dropdown instead (same setup, debugger attached as normal).

If a host ever does get stuck paused waiting for a debugger (e.g. you used the debug config and the attach failed), you can unstick it without restarting by sending the paused process a resume command directly over its inspector port, instead of retrying the attach:
```sh
# find the stuck process's inspector port from its command line (ps aux | grep inspect-brk),
# then get its websocket debugger URL and send it the resume command:
curl -s http://127.0.0.1:<port>/json   # read the "webSocketDebuggerUrl"
node -e "
const ws = new WebSocket('<webSocketDebuggerUrl>');
ws.onopen = () => ws.send(JSON.stringify({id: 1, method: 'Runtime.runIfWaitingForDebugger'}));
ws.onmessage = () => process.exit(0);
"
```

### macOS: F5 opens Dictation instead of debugging

On Mac laptops, bare `F5` is often bound system-wide to **Start Dictation** (System Settings → Keyboard → Dictation), which intercepts the key before VS Code sees it. Options:

- Disable/rebind the Dictation shortcut in System Settings → Keyboard → Dictation.
- Use `Fn+F5` instead of plain `F5`.
- Rebind VS Code's own shortcut (Code → Settings → Keyboard Shortcuts → "Debug: Start Debugging").
- Or just skip the key entirely: Run and Debug panel (`Cmd+Shift+D`) → click the green ▶ "Run Extension".

## Running tests

```sh
yarn test
```

This runs `vscode-test`: it downloads/launches a real headless VS Code instance and runs the Mocha suite in `src/test/*.test.ts` against it. It's non-interactive by design — for manually poking at the extension's behavior, use the F5 flow above instead.

If `yarn test` fails with a lockfile error, run `yarn install` first.

If it fails with `spawn .../Contents/MacOS/Electron ENOENT`, your `@vscode/test-electron` version is too old for the VS Code build it downloaded (VS Code renamed its macOS executable from `Electron` to `Code` in 1.110+). Make sure `@vscode/test-electron` is `^3.1.0` or newer in `package.json`, then `yarn install` again.

## Linting

```sh
yarn lint
```
