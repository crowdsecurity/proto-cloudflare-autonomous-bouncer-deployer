# CrowdSec Cloudflare Bouncer GUI

A web-based GUI for configuring and deploying the [CrowdSec Cloudflare Worker Bouncer](https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer) in autonomous mode.

## Features

- Deploy bouncer infrastructure to Cloudflare zones
- Select which zones to protect
- Real-time progress streaming
- Clear/remove all bouncer infrastructure
- No external dependencies - uses Cloudflare API directly

## Quick Start

### Prerequisites

- Node.js 18+

### Installation

```bash
git clone https://github.com/crowdsecurity/cloudflare-autonomous-bouncer-deployer.git cs-cloudflare-bouncer-gui
cd cs-cloudflare-bouncer-gui
npm install
```

### Development

```bash
npm run dev
```

Opens at http://localhost:5173

### Production

```bash
npm run build
npm start
```

Opens at http://localhost:3000

## Configuration

Create a `.env` file (optional):

```bash
PORT=3000
```

## Usage

1. **Select Action**: Choose Deploy or Clear
2. **Enter Credentials**: Provide Cloudflare API token and CrowdSec blocklist mirror credentials
3. **Select Zones**: Choose which Cloudflare zones to protect
4. **Deploy**: Watch real-time output as infrastructure is created

## Architecture

The GUI communicates directly with the Cloudflare API using the official Node.js SDK. No external binaries are required.

```
Browser (React) ←→ WebSocket ←→ Node.js (Express) ←→ Cloudflare API
```

### Deployed Resources

When you deploy, the following resources are created in your Cloudflare account:

- **KV Namespace**: `CROWDSECCFBOUNCERNS` - stores decisions and configuration
- **D1 Database**: `CROWDSECCFBOUNCERDB` - stores metrics (optional)
- **Main Worker**: `crowdsec-cloudflare-worker-bouncer` - handles incoming requests
- **Sync Worker**: `crowdsec-decisions-sync-worker` - syncs decisions from CrowdSec
- **Worker Routes**: Routes traffic through the bouncer for selected zones
- **Turnstile Widgets**: For captcha challenges (one per zone)

## Documentation

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for development documentation.

## License

MIT