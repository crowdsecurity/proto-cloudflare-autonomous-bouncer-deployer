# Developer Guide

This document provides instructions for setting up and developing the CrowdSec Cloudflare Bouncer GUI.

## Prerequisites

- Node.js 18+
- npm

## Project Setup

```bash
# Clone the repository
git clone https://github.com/crowdsecurity/cs-cloudflare-bouncer-gui.git
cd cs-cloudflare-bouncer-gui

# Install dependencies
npm install

# Optional: Copy environment file
cp .env.example .env
```

The `.env` file is optional and only needed to customize the port:

```bash
PORT=3000
```

## Development

Start both the backend and frontend in development mode:

```bash
npm run dev
```

This runs concurrently:
- **Frontend (Vite)**: http://localhost:5173
- **Backend (Express)**: http://localhost:3000

The Vite dev server proxies API requests to the Express backend.

### Individual Commands

```bash
npm run dev:client    # Start Vite dev server only
npm run dev:server    # Start Express server only (with hot reload)
npm run typecheck     # Run TypeScript type checking
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
```

## Building for Production

```bash
npm run build         # Build both client and server
npm start             # Run production server
```

The production build:
- Compiles React app to `dist/client/`
- Compiles Express server to `dist/server/`
- Copies worker bundles to `dist/server/assets/workers/`
- Express serves the static React build

## Project Structure

```
src/
├── client/                     # React frontend
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Main wizard component
│   ├── index.css              # Tailwind CSS
│   ├── types.ts               # TypeScript types
│   ├── hooks/
│   │   └── useSocket.ts       # WebSocket hook for real-time communication
│   └── components/
│       ├── Header.tsx         # App header
│       ├── ActionSelect.tsx   # Step 1: Deploy/Clear selection
│       ├── CredentialsForm.tsx # Step 2: Token input
│       ├── ClearConfirm.tsx   # Step 3a: Clear confirmation
│       ├── ZoneSelect.tsx     # Step 3b: Zone selection
│       ├── CommandOutput.tsx  # Real-time command output
│       └── SuccessScreen.tsx  # Completion screen
│
└── server/                     # Express backend
    ├── index.ts               # Server entry point + WebSocket setup
    ├── config.ts              # Environment configuration
    ├── routes.ts              # REST API routes
    ├── assets/
    │   └── workers/           # Cloudflare Worker bundles
    │       ├── index.ts       # Worker script loader
    │       ├── metrics-schema.ts # D1 metrics table schema
    │       ├── main-worker-bundle.js         # Main bouncer worker
    │       └── decisions-sync-worker-bundle.js # Sync worker
    └── services/
        ├── session.ts         # In-memory session management
        └── cloudflare/        # Cloudflare API service modules
            ├── index.ts       # Main orchestrator (CloudflareService)
            ├── client.ts      # API client factory
            ├── types.ts       # TypeScript interfaces and constants
            ├── zones.ts       # Zone discovery
            ├── kv.ts          # KV namespace operations
            ├── d1.ts          # D1 database operations
            ├── workers.ts     # Worker upload/delete
            ├── routes.ts      # Worker route operations
            └── turnstile.ts   # Turnstile widget operations
```

## Architecture

The GUI uses the official [Cloudflare Node.js SDK](https://github.com/cloudflare/cloudflare-node) to interact with the Cloudflare API directly. No external binaries are required.

```
┌─────────────────┐     WebSocket    ┌─────────────────┐     HTTPS        ┌─────────────────┐
│   Browser       │ ◄──────────────► │  Node.js API    │ ◄──────────────► │  Cloudflare API │
│   (React)       │                  │  (Express)      │                  │                 │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

### Session Management

State is stored in-memory per WebSocket connection:
- Cloudflare token and credentials
- Discovered accounts and zones
- Zone selection state
- Deployment state (created resource IDs)

Sessions are automatically cleaned up on disconnect.

### Worker Bundles

The Cloudflare Worker scripts are bundled JavaScript files copied from the [cs-cloudflare-worker-bouncer](https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer) repository:

- `main-worker-bundle.js` - Main bouncer worker that handles incoming requests
- `decisions-sync-worker-bundle.js` - Sync worker that fetches decisions from CrowdSec

**To update the worker bundles:**
1. Build the Go repository: `cd cs-cloudflare-worker-bouncer && make build`
2. Copy the bundles:
   - `pkg/cloudflare/worker/dist/main.js` → `main-worker-bundle.js`
   - `pkg/cloudflare/decisions-sync-worker/dist/main.js` → `decisions-sync-worker-bundle.js`

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |

> Note: All operations are handled via WebSocket for real-time progress streaming.

### WebSocket Events

**Client → Server:**

| Event | Payload | Description |
|-------|---------|-------------|
| `generate-config` | `{ cloudflareToken }` | Discover zones from Cloudflare |
| `get-zones` | - | Request zones from session |
| `update-zones` | `{ selectedZoneIds }` | Update selected zones |
| `deploy` | `{ crowdsecLapiUrl, crowdsecLapiKey }` | Deploy bouncer infrastructure |
| `clear` | - | Clear all infrastructure |

**Server → Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `command-output` | `{ type, data, code? }` | Real-time progress output |
| `zones-loaded` | `{ zones }` | Zone list response |
| `zones-updated` | `{ success }` | Zone update confirmation |
| `zones-error` | `{ error }` | Zone operation error |

## Cloudflare Resources

### Deploy Sequence

1. Clean up existing infrastructure (idempotent)
2. Create KV namespace: `CROWDSECCFBOUNCERNS`
3. Create D1 database: `CROWDSECCFBOUNCERDB` (for metrics)
4. Write ban template to KV
5. Upload main worker with bindings
6. Create worker routes per zone (`*zone.com/*`)
7. Upload decisions sync worker with bindings
8. Create cron trigger (`*/5 * * * *`)
9. Create Turnstile widgets per zone
10. Write Turnstile config to KV

### Clear Sequence

1. Delete Turnstile widgets
2. Delete worker routes
3. Delete worker scripts
4. Delete KV namespace
5. Delete D1 database

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, Socket.IO, TypeScript
- **Cloudflare SDK**: `cloudflare` npm package (official SDK)
- **Build**: Vite (frontend), tsc (backend)
- **Runtime**: Node.js 18+

## KillerCoda Scenario

The `killercoda/` directory contains an interactive tutorial for [KillerCoda](https://killercoda.com).

### Structure

```
killercoda/
├── index.json      # Scenario configuration
├── intro.md        # Introduction page (prerequisites)
├── finish.md       # Setup page (shown after Start)
├── background.sh   # Installs Node.js and builds GUI
└── foreground.sh   # Shows setup progress in terminal
```

### Flow

1. **Intro**: User reads prerequisites, clicks Start
2. **Finish**: Scripts run, terminal shows progress, user clicks GUI link when ready

### Key Configuration

- `index.json`: Defines intro → finish flow (no steps)
- `background.sh`: Spawns setup as detached process to avoid KillerCoda timeout
- `foreground.sh`: Waits for `/tmp/.setup-complete` and shows progress
- GUI link uses `{{TRAFFIC_HOST1_3000}}` variable (replaced by KillerCoda at runtime)

### Testing Locally

KillerCoda scenarios can only be tested on the platform. Push changes to a GitHub repository and link it to KillerCoda.

### Logs

When running on KillerCoda:
- Setup logs: `/var/log/setup.log`
- GUI server logs: `/var/log/bouncer-gui.log`