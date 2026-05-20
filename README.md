# Mobium

Mobile-first MCP server and CLI for running automations on connected mobile devices through Appium and WebdriverIO.

Mobium discovers connected devices, starts a fresh Appium server, opens a mobile session, and exposes the same core flows through both CLI commands and MCP tools.

## Quick Start

```sh
npm install
npm run build
npm run config -- --action init
```

Use the local CLI through npm scripts during development:

```sh
npm run doctor
npm run devices
npm run devices -- --platform android
npm run config -- --action print
npm run mcp-config -- --client vscode
npm run start-session
npm run app -- --action state --app-package com.android.settings
npm run device-state -- --action isLocked
npm run permissions -- --action get --app-package com.example.app
npm run interact -- --action tap --ref m3
npm run mcp
npm run mcp -- --http --port 8931
```

Or link it as a real command:

```sh
npm run build
ln -s "$(pwd)/dist/cli.js" "$HOME/.local/bin/mobium"
```

Then run:

```sh
mobium doctor
mobium devices
mobium devices --platform android
mobium config --action init
mobium start-session
mobium app --action state --app-package com.android.settings
mobium mcp
mobium mcp --http --port 8931
```

## CLI Commands

```sh
mobium doctor
mobium devices
mobium devices --platform android
mobium devices --platform ios
mobium config --action print
mobium config --action example
mobium config --action init
mobium mcp-config --client vscode
mobium mcp-config --client claude --transport http
mobium start-session
mobium app --action state --app-package com.android.settings
mobium app --action activate --app-package com.android.settings
mobium app --action terminate --app-package com.android.settings
mobium app --action background --seconds 5
mobium app --action install --app /path/to/app.apk
mobium app --action remove --app-package com.example.app
mobium device-state --action isLocked
mobium device-state --action lock
mobium device-state --action unlock
mobium device-state --action setClipboard --content SGVsbG8=
mobium device-state --action getClipboard
mobium permissions --action get --app-package com.example.app
mobium permissions --action grant --app-package com.example.app --permissions android.permission.CAMERA
mobium permissions --action revoke --app-package com.example.app --permissions android.permission.CAMERA
mobium inspect
mobium inspect --action diff
mobium inspect --action screenshot
mobium inspect --action source
mobium inspect --action contexts
mobium inspect --action setContext --context WEBVIEW_com.example
mobium interact --action tap --ref m3
mobium interact --action type --ref m4 --text "hello"
mobium interact --action clear --ref m4
mobium interact --action wait --ref m5 --timeout 5000
mobium interact --action wait --accessibility-id Continue --timeout 5000
mobium interact --action pressKey --key Enter
mobium interact --action swipe --direction up
mobium interact --action scroll --direction down
mobium interact --action longPress --ref m3
mobium interact --action drag --from-ref m3 --to-x 200 --to-y 600
mobium bdd --feature "Checkout" --acceptance-criteria "User can pay by card" --risk "Payment authorization fails" --business-criticality high
mobium bdd --document-path ./checkout-requirements.md
mobium mcp
```

Mobium infers the platform from the connected device when `--platform` is omitted. If multiple real devices are connected, pass `--platform` or `--device-id`.

## Session Lifecycle

Mobium starts from a clean Appium state for each session start by default:

- Stops running Appium servers in its local port range.
- Starts a fresh Appium server.
- Discovers the connected device.
- Uses the configured app target, explicit CLI/tool app target, or Android Settings fallback.
- Connects WebdriverIO to the new server.

Start a session with automatic device and platform selection:

```sh
mobium start-session
```

Explicit device and app target:

```sh
mobium start-session \
  --platform android \
  --device-id 46240DLAQ004VD \
  --app-package com.android.settings \
  --app-activity .Settings
```

If another non-Appium process is already using `4723`, Mobium leaves it alone, picks the next available port, and connects to that new server.

## App Target Config

Set the default app target once in `mobium.config.json`:

```json
{
  "app": {
    "appPackage": "com.example.app",
    "appActivity": ".MainActivity"
  }
}
```

Now commands can omit app target flags:

```sh
mobium start-session
mobium app --action state
mobium app --action activate
```

Environment overrides are also supported:

```sh
export MOBIUM_APP_PACKAGE=com.example.app
export MOBIUM_APP_ACTIVITY=.MainActivity
mobium start-session
```

Supported app config fields:

- `app`
- `appPackage`
- `appActivity`
- `bundleId`
- `browserName`

Explicit command or tool inputs always win over config.

## Android Discovery

Mobium resolves `adb` in this order:

1. `MOBIUM_ADB_PATH`
2. `ANDROID_HOME/platform-tools/adb`
3. `ANDROID_SDK_ROOT/platform-tools/adb`
4. Common Android Studio SDK locations, such as `~/Library/Android/sdk/platform-tools/adb`
5. `adb` on `PATH`

If discovery reports `spawn adb ENOENT`, install Android platform tools or point Mobium directly at `adb`:

```sh
export MOBIUM_ADB_PATH="$HOME/Library/Android/sdk/platform-tools/adb"
mobium devices
```

## Configuration

Create a starter config:

```sh
mobium config --action init
```

Print the resolved config after file and environment overrides:

```sh
mobium config --action print
```

Print an example without writing a file:

```sh
mobium config --action example
```

## MCP Client Config

Add Mobium to an MCP client over stdio:

```json
{
  "mcpServers": {
    "mobium": {
      "command": "mobium",
      "args": ["mcp"]
    }
  }
}
```

For VS Code, use `.vscode/mcp.json`:

```json
{
  "servers": {
    "mobium": {
      "command": "mobium",
      "args": ["mcp"]
    }
  }
}
```

For HTTP transport, start the server:

```sh
mobium mcp --http --port 8931
```

Then add this server config:

```json
{
  "mcpServers": {
    "mobium": {
      "url": "http://127.0.0.1:8931/mcp"
    }
  }
}
```

Print a generic stdio MCP config:

```sh
mobium mcp-config
```

Print VS Code `.vscode/mcp.json` shape:

```sh
mobium mcp-config --client vscode
```

Use a custom stdio launch command:

```sh
mobium mcp-config --command node --args "--import tsx src/cli.ts mcp"
```

For individual argument values, use repeatable `--arg` flags:

```sh
mobium mcp-config --command node --arg=--import --arg tsx --arg src/cli.ts --arg mcp
```

Add a configurable working directory and environment values:

```sh
mobium mcp-config --client vscode --cwd . --env LOG_LEVEL=warn --env APPIUM_URL=http://127.0.0.1:4723
```

Print a Claude/Codex-style HTTP config:

```sh
mobium mcp-config --client claude --transport http
mobium mcp-config --client codex --transport http --url http://127.0.0.1:8931/mcp
```

If an MCP host logs `Unknown command: --caps`, rebuild or relink Mobium so the host runs a current CLI:

```sh
npm run build
```

Example `mobium.config.json`:

```json
{
  "appium": {
    "host": "127.0.0.1",
    "port": 4723,
    "basePath": "/",
    "autoStart": true,
    "command": "appium",
    "args": {}
  },
  "app": {
    "appPackage": "com.example.app",
    "appActivity": ".MainActivity"
  },
  "sessions": {
    "defaultTimeoutMs": 10000,
    "isolated": true,
    "maxSessions": 1
  },
  "artifacts": {
    "outputDir": "testing",
    "saveScreenshots": true,
    "saveSnapshots": true
  },
  "navGraph": {
    "enabled": true,
    "outputDir": "testing/graphs",
    "autoCapture": true
  },
  "capabilities": {
    "vision": false,
    "android": true,
    "ios": true
  },
  "tools": {
    "enabledGroups": ["all"]
  }
}
```

Tool groups can be narrowed for safer MCP deployments:

```json
{
  "tools": {
    "enabledGroups": ["doctor", "devices", "sessions", "inspect", "interactions"]
  }
}
```

Available groups:

- `all`
- `doctor`
- `devices`
- `sessions`
- `apps`
- `inspect`
- `interactions`
- `navGraph`
- `bdd`
- `vision`
- `deviceState`
- `permissions`

Environment override:

```sh
export MOBIUM_TOOL_GROUPS=doctor,devices,sessions,inspect,interactions
```

Mobium resolves the local Appium binary from its own dependencies before falling back to global `appium`.

## Safety

Mobium is local-first and does not expose arbitrary shell, `adb`, `xcrun`, or device command execution through MCP tools.

For safer MCP deployments, narrow enabled tool groups:

```json
{
  "tools": {
    "enabledGroups": ["doctor", "devices", "sessions", "inspect", "interactions"]
  }
}
```

Screenshots, source dumps, snapshots, logs, annotations, HTML reports, and Nav Graph files may contain sensitive data. Artifacts are written under `testing/` by default. Session artifacts are grouped by app key, for example `testing/android-com.example.app/sessions/default/`. Each session artifact folder includes an `index.html` report that links saved artifacts and previews screenshots, annotations, source, and snapshot files.

See [SECURITY.md](./SECURITY.md) for the restricted tool policy and HTTP exposure guidance.

## Release Check

Before publishing or tagging a release:

```sh
npm run release:check
```

## MCP Tools

Run the MCP server over stdio:

```sh
mobium mcp
```

Run the MCP server over streamable HTTP:

```sh
mobium mcp --http --port 8931
```

The HTTP transport exposes:

- health check: `http://127.0.0.1:8931/health`
- MCP endpoint: `http://127.0.0.1:8931/mcp`

- `mobile_doctor`: reports Node, Appium, Android, and iOS dependency health.
- `mobile_discover_devices`: lists Android devices/emulators and iOS simulators. Optional `platform` may be `android`, `ios`, or `both`; defaults to `both`.
- `mobile_device_info`: returns metadata for one discovered device.
- `mobile_session`: manages Appium/WebdriverIO sessions.
- `mobile_device_state`: manages lock state, clipboard, and supported network toggles.
- `mobile_permissions`: gets or changes Android app permissions.
- `mobile_app`: manages apps on a mobile session.
- `mobile_inspect`: captures accessibility snapshots, diffs, screenshots, source, and contexts.
- `mobile_interact`: taps, types, clears, waits, presses keys, swipes, scrolls, long presses, and drags.
- `mobile_nav_graph`: inspects, exports, or resets the persistent per-app Nav Graph.
- `mobile_bdd_generate`: generates prioritized BDD scenarios with risk-based, priority-based, boundary, negative, accessibility, regression, and platform coverage.
- `mobile_vision`: optional visual fallback tools when `capabilities.vision` is enabled.

### MCP Prompts

- `mobium_agent_workflow`: snapshot-first mobile automation workflow and safety rules.

Prompt arguments:

```json
{
  "sessionName": "default",
  "platform": "android",
  "appTarget": "com.example.app",
  "persistence": "end",
  "vision": "false"
}
```

### `mobile_device_info`

```json
{ "deviceId": "emulator-5554" }
```

### `mobile_session`

Start:

```json
{ "action": "start" }
```

Status:

```json
{ "action": "status" }
```

End:

```json
{ "action": "end", "sessionName": "default" }
```

Start with explicit target:

```json
{
  "action": "start",
  "platform": "android",
  "deviceId": "46240DLAQ004VD",
  "appPackage": "com.android.settings",
  "appActivity": ".Settings"
}
```

### `mobile_device_state`

Check lock state:

```json
{ "action": "isLocked" }
```

Set clipboard content:

```json
{ "action": "setClipboard", "content": "SGVsbG8=", "contentType": "plaintext" }
```

Supported actions:

- `lock`
- `unlock`
- `isLocked`
- `getClipboard`
- `setClipboard`
- `toggleAirplaneMode`
- `toggleData`
- `toggleWiFi`

Network toggles depend on platform, device, and Appium driver support.

### `mobile_app`

### `mobile_permissions`

Get granted permissions:

```json
{ "action": "get", "appPackage": "com.example.app", "permissionType": "granted" }
```

Grant a permission:

```json
{
  "action": "grant",
  "appPackage": "com.example.app",
  "permissions": "android.permission.CAMERA"
}
```

Supported actions:

- `get`
- `grant`
- `revoke`
- `set`

The `set` action can target Android `appops` with `permissionAction` values such as `allow`, `deny`, `ignore`, or `default`.

State:

```json
{ "action": "state", "appPackage": "com.android.settings" }
```

Activate:

```json
{ "action": "activate", "appPackage": "com.android.settings" }
```

Install:

```json
{ "action": "install", "app": "/path/to/app.apk" }
```

Supported actions:

- `install`
- `remove`
- `activate`
- `terminate`
- `state`
- `background`
- `reset`

`mobile_app` starts a named session automatically if one does not already exist.

### `mobile_inspect`

Snapshot:

```json
{ "action": "snapshot" }
```

Screenshot:

```json
{ "action": "screenshot" }
```

Diff from the previous snapshot:

```json
{ "action": "diff" }
```

Raw source:

```json
{ "action": "source" }
```

Contexts:

```json
{ "action": "contexts" }
```

Switch context:

```json
{ "action": "setContext", "context": "WEBVIEW_com.example" }
```

`mobile_inspect` starts a named session automatically if one does not already exist.

### `mobile_interact`

Tap by snapshot ref:

```json
{ "action": "tap", "ref": "m3" }
```

Type into a field:

```json
{ "action": "type", "ref": "m4", "text": "hello" }
```

Other supported actions:

- `clear`
- `wait`
- `pressKey`
- `swipe`
- `scroll`
- `longPress`
- `drag`

Refs come from `mobile_inspect` snapshot output. `mobile_interact` starts a named session automatically if one does not already exist.

When Nav Graph is enabled, snapshots include durable graph refs beside current snapshot refs:

```text
- button "Continue" [ref=m4] [graph=g7] [clickable]
```

Use current snapshot refs first. For repeated workflows or stale refs, pass a graph ref:

```json
{ "action": "tap", "graphRef": "g7" }
```

### `mobile_nav_graph`

Mobium automatically learns a per-app Nav Graph from observed screens, element fingerprints, and transitions during `mobile_inspect` and `mobile_interact` workflows. The graph is stored under `testing/graphs/<app-key>/` by default.

Status:

```json
{ "action": "status" }
```

Export JSON and Mermaid graph artifacts:

```json
{ "action": "export" }
```

Reset the current app graph:

```json
{ "action": "reset" }
```

### `mobile_bdd_generate`

Generate BDD scenarios from feature context, acceptance criteria, risks, roles, and platforms. Output can be `markdown`, `gherkin`, or `json`. You can pass fields directly or provide `inputDocument`; Mobium will infer the feature, story, acceptance criteria, risks, roles, platforms, business criticality, change risk, data sensitivity, and preferred output format where the document states them.

```json
{
  "inputDocument": "# Checkout\n\nAs a shopper, I want to pay for my basket.\n\nAcceptance Criteria:\n- User can pay by card\n- User sees an order confirmation\n\nRisks:\n- Payment authorization fails\n- Duplicate order is created\n\nP0 revenue-critical mobile flow on Android and iOS. Format: gherkin"
}
```

The generator adds priority tags such as `@p0`, risk tags such as `@risk-high`, and scenario types for happy path, negative, boundary, regression, accessibility, and platform checks.

### `mobile_vision`

Vision tools are disabled by default. Enable them in config:

```json
{
  "capabilities": {
    "vision": true
  }
}
```

Find visual candidates from accessibility-backed bounds:

```json
{ "action": "find", "query": "Continue" }
```

Save an annotated screenshot:

```json
{ "action": "annotatedScreenshot" }
```

Tap a visual candidate:

```json
{ "action": "tap", "candidateRef": "v1" }
```

Current visual candidates are derived from the accessibility snapshot and screen bounds. They are intended as a safer bridge to coordinate fallback, not as a replacement for snapshot refs.

See [plan.md](./plan.md) for the full build plan.
