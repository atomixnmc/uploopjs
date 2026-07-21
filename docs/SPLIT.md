# SPLIT — Uploop Server Extracted

> **Date:** 2026-07-21  
> **Version:** v0.10.0

## What Happened

`@uploop/sst` and `server-examples/` were extracted into [Uploop Server](https://github.com/atomixnmc/uploop-server) ("Olympus") — a standalone top-level project at `Sources/uploop-server/`.

## Remaining in UploopJS

| Package | Status |
|---|---|
| `@uploop/core` | ✅ Engine |
| `@uploop/html` | ✅ Templates |
| `@uploop/schema` | ✅ Validation |
| `@uploop/store` | ✅ State |
| `@uploop/flows` | ✅ Execution |
| `@uploop/stream` | ✅ Binary |
| `@uploop/auth` | ✅ Auth |
| `@uploop/state-machine` | ✅ FSM |
| `@uploop/router` | ✅ Routing (stays) |
| `@uploop/css` | ✅ CSS |
| `@uploop/bundler` | ✅ Build |
| `@uploop/lint` | ✅ Lint |
| `@uploop/devutils` | ✅ Dev |
| **`@uploop/sst`** | ➡️ **Moved to uploop-server** |

## Why

Server framework concerns (HTTP, WebSocket, middleware, hooks, transports, SSR, adapters) are a distinct domain from engine primitives (loops, graphs, signals, components). The split:

- Separates dependency trees (engine never depends on server)
- Allows independent release cadences
- Gives each project a clear identity and audience
- Follows the existing i2c pattern (`uploop-bridges`, `uploop-ge`, `uploop-vided`, etc.)

## No User Impact

The package name `@uploop/sst` is unchanged. Imports remain identical:

```js
import { createServer, renderToString } from '@uploop/sst'
```

Only the repository location changed.

## See Also

- [Uploop Server README](https://github.com/atomixnmc/uploop-server)
- [Uploop Server SPLIT.md](https://github.com/atomixnmc/uploop-server/blob/main/docs/SPLIT.md)
