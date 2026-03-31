# Usage Widget

Windows/macOS floating widget showing Claude and Codex subscription usage (5h/7d progress bars).

## Features

- Mini/Card dual-mode floating window (always on top)
- Claude: 5h and 7d usage via OAuth API
- Codex: 5h and 7d usage from local JSONL session files
- System tray with show/hide, refresh, auto-launch, quit
- Exponential backoff on API rate limits (429)
- Window position persistence with multi-monitor support

## Screenshots

**Mini Mode** — compact floating bar showing 7d usage

```
┌────────────────────────────────────┐
│ ☁ Claude  ████████░░  38%  ▼      │
│ ⌘ Codex   ███░░░░░░░   4%  ▼     │
└────────────────────────────────────┘
```

**Card Mode** — expanded view with 5h/7d details and reset times

```
┌──────────────────────────────────────┐
│  Usage Monitor               [—] [×] │
├──────────────────────────────────────┤
│  ☁ Claude                            │
│  5h   ████████████░░░░  72%         │
│       重置于 14:30 (2h 5m)           │
│  7d   ██████░░░░░░░░░░  38%         │
│       重置于 04/04                    │
├──────────────────────────────────────┤
│  ⌘ Codex                            │
│  5h   ███░░░░░░░░░░░░░   3%         │
│       重置于 15:00 (4h 35m)          │
│  7d   ████░░░░░░░░░░░░   4%         │
│       重置于 04/04                    │
├──────────────────────────────────────┤
│  更新于 06:25          🔄 刷新       │
└──────────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://claude.ai/code) logged in (`claude auth login`)
- [Codex CLI](https://github.com/openai/codex) (optional, for Codex usage display)

## Install & Run

```bash
git clone https://github.com/aysuio/codex-claude-usage-plugin.git
cd codex-claude-usage-plugin
npm install
npm start
```

## Build Installer

### Windows

```bash
npm run build
```

Output: `dist/Usage Widget Setup 1.0.0.exe`

Double-click to install. The app installs to `%LOCALAPPDATA%\Usage Widget\` and launches automatically.

### macOS

```bash
npm run build
```

Output: `dist/Usage Widget-1.0.0.dmg`

Open the `.dmg` and drag to Applications.

> Note: macOS `.dmg` can only be built on macOS. Windows `.exe` can only be built on Windows. Cross-compilation is not supported by electron-builder for these targets.

## Data Sources

| Source | Method | Path |
|--------|--------|------|
| Claude | OAuth API (`api.anthropic.com/api/oauth/usage`) | Token from `~/.claude/.credentials.json` (Windows) or Keychain (macOS) |
| Codex | Local JSONL parsing | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` |

## Configuration

Preferences are stored in:
- Windows: `%APPDATA%/codex-claude-usage-plugin/config.json`
- macOS: `~/Library/Application Support/codex-claude-usage-plugin/config.json`

## Tests

```bash
npm test
```

## License

MIT
