# Security

Mobium is a local-first mobile automation server. It can install apps, control active mobile sessions, change app permissions, and interact with device state when those tool groups are enabled.

## Restricted Tool Policy

Mobium does not expose arbitrary shell, `adb`, `xcrun`, or device command execution through MCP tools.

Potentially sensitive capabilities are separated into explicit tool groups:

- `apps`: install, remove, activate, terminate, reset, and query app state
- `permissions`: get or change Android app permissions
- `deviceState`: lock/unlock, clipboard, and supported network toggles
- `navGraph`: inspect, export, or reset persistent per-app screen and element graph data
- `vision`: coordinate fallback and annotated visual workflows

For safer MCP deployments, narrow tool groups in `mobium.config.json`:

```json
{
  "tools": {
    "enabledGroups": ["doctor", "devices", "sessions", "inspect", "interactions"]
  }
}
```

Or set:

```sh
export MOBIUM_TOOL_GROUPS=doctor,devices,sessions,inspect,interactions
```

## Network Exposure

The default MCP transport is stdio. If you run streamable HTTP, bind to localhost unless you intentionally need remote access:

```sh
mobium mcp --http --host 127.0.0.1 --port 8931
```

Do not expose the HTTP MCP endpoint to untrusted networks without an external authentication and authorization layer.

## Artifacts

Screenshots, snapshots, source dumps, logs, annotations, HTML reports, and Nav Graph files may contain sensitive application data. By default they are written under `testing/`, with session artifacts grouped under each app key.

Keep `testing/` out of source control and clear artifacts before sharing logs or reproduction packages.

## Reporting Issues

Report security issues privately to the project owner instead of opening a public issue.
