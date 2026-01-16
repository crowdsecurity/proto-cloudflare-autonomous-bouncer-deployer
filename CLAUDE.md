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
- Deploy bouncer infrastructure
- Success message (future: mini-test and helpful links)

## Architecture

The GUI uses the official Cloudflare Node.js SDK to interact with the Cloudflare API directly. No external binaries are required.

```
┌─────────────────┐     WebSocket    ┌─────────────────┐     HTTPS        ┌─────────────────┐
│   Browser       │ ◄──────────────► │  Node.js API    │ ◄──────────────► │  Cloudflare API │
│   (React)       │                  │  (Express)      │                  │                 │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

The Node.js backend:
- Receives user actions from the frontend via WebSocket
- Calls Cloudflare API using the official `cloudflare` npm package
- Streams progress back to browser in real-time
- Manages session state in-memory (per WebSocket connection)

## Deployed Resources

When deploying, the following Cloudflare resources are created:
- **KV Namespace**: `CROWDSECCFBOUNCERNS` - stores decisions, ban template, and Turnstile config
- **D1 Database**: `CROWDSECCFBOUNCERDB` - stores metrics (optional)
- **Main Worker**: `crowdsec-cloudflare-worker-bouncer` - handles incoming requests
- **Sync Worker**: `crowdsec-decisions-sync-worker` - syncs decisions from CrowdSec on cron
- **Worker Routes**: Routes traffic through the bouncer (`*zone.com/*`)
- **Turnstile Widgets**: For captcha challenges (one per zone)

## Worker Bundles

The Cloudflare Worker scripts are pre-built bundles from the Go repository:
- `src/server/assets/workers/main-worker-bundle.js`
- `src/server/assets/workers/decisions-sync-worker-bundle.js`

To update: rebuild cs-cloudflare-worker-bouncer and copy from `pkg/cloudflare/*/dist/main.js`.

## Configuration

Environment variables (`.env` file, optional):

```bash
PORT=3000
```

The `.env` file is gitignored.

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