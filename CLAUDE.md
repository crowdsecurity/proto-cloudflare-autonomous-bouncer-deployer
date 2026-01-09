# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GUI application for configuring and deploying the CrowdSec Cloudflare Worker Bouncer in **autonomous mode**. The bouncer protects Cloudflare zones by checking incoming IPs against CrowdSec decisions stored in Cloudflare KV, applying remediations (ban, captcha) at the edge.

Related repository: https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer

## User Workflow

The GUI implements a multi-step wizard:

### Step 1: Action Selection
- **Deploy**: Set up autonomous bouncer infrastructure
- **Clear**: Remove all deployed bouncer infrastructure

### Step 2: Credentials Input
- Cloudflare API token (required for both actions)
- If Deploy: CrowdSec Blocklist Mirror URL + authentication token

### Step 3a: Clear Flow
- Confirmation dialog
- Execute clear operation
- Display success/exit page

### Step 3b: Deploy Flow
- List all Cloudflare zones (with pagination support)
- Zone selection (select all / deselect all, individual selection)
- Optional: JavaScript filter by zone name
- Generate YAML configuration
- Deploy as autonomous mode
- Success message (future: mini-test and helpful links)

## Bouncer Integration

The GUI interacts with the bouncer binary (`crowdsec-cloudflare-worker-bouncer`) via CLI:

| Operation | Command |
|-----------|---------|
| Generate config from token | `-g <token> -o <output_path>` |
| Deploy autonomous mode | `-S -c <config_path>` |
| Clear infrastructure | `-d -c <config_path>` |
| Test config validity | `-t -c <config_path>` |

## Configuration Structure

The bouncer uses YAML configuration with these key sections:
- `crowdsec_config`: Blocklist mirror URL, API key, update frequency
- `cloudflare_config.accounts[]`: Cloudflare account tokens and zone configurations
- `cloudflare_config.accounts[].zones[]`: Zone ID, actions (ban/captcha), turnstile settings
- `cloudflare_config.decisions_sync_worker.cron`: Sync schedule (default: `*/5 * * * *`)

## Deployment Environment

The GUI runs on a pre-configured infrastructure (KillerCoda, AWS, or similar) where:
- The Go bouncer binary (`crowdsec-cloudflare-worker-bouncer`) is pre-installed and available in PATH
- The GUI backend executes bouncer commands via subprocess when users interact with the UI
- Command output is streamed back to the frontend in real-time

## Configuration

Environment variables (`.env` file for development):

```bash
# Path to the Go bouncer binary
# - Development: full path to local build
# - Production: just the binary name (assumes it's in PATH)
BOUNCER_BINARY_PATH=crowdsec-cloudflare-worker-bouncer

# Example for local development:
# BOUNCER_BINARY_PATH=/home/julien/workspace/crowdsec/cs-cloudflare-worker-bouncer/crowdsec-cloudflare-worker-bouncer-v0.0.14-23-g3c6f267/crowdsec-cloudflare-worker-bouncer
```

The `.env` file is gitignored. Copy `.env.example` to `.env` for local development.

## Architecture

```
┌─────────────────┐     HTTP/WS      ┌─────────────────┐     subprocess     ┌─────────────────┐
│   Browser       │ ◄──────────────► │  Node.js API    │ ◄────────────────► │  Go Bouncer     │
│   (React/Vue)   │                  │  (Express)      │                    │  CLI Binary     │
└─────────────────┘                  └─────────────────┘                    └─────────────────┘
```

The Node.js backend:
- Receives user actions from the frontend
- Spawns bouncer commands via `child_process`
- Streams command output back to browser (WebSocket or SSE)
- Handles exit codes for success/failure feedback

## React Best Practices

### Avoid useEffect when possible

Follow the React guidelines from [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect). Only use `useEffect` for synchronizing with external systems.

**When NOT to use useEffect:**
- Transforming data for rendering (calculate during render instead)
- Handling user events (use event handlers)
- Updating state based on props/state changes (use callbacks from hooks)
- Chaining effects that trigger each other

**When useEffect IS appropriate:**
- Subscribing to external systems (WebSocket, browser APIs)
- Setting up/tearing down connections

**Patterns used in this codebase:**
- `useSocket` hook accepts `onCommandComplete` and `onZonesLoaded` callbacks instead of consumers using useEffect to watch state changes
- Auto-scroll uses a ref callback on the last element instead of useEffect watching output changes

## Documentation Maintenance

**Important**: Keep `docs/DEVELOPER.md` up to date when making changes:
- Document new features, components, or modules added
- Update API endpoints when backend routes change
- Add setup instructions for new dependencies or tools
- Document architectural decisions and their rationale
- Keep the build/run commands current

This file serves as the main reference for contributors to understand the codebase.