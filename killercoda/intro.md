# CrowdSec Cloudflare Worker Bouncer

Deploy CrowdSec protection to your Cloudflare zones using the autonomous worker bouncer.

## What This Does

The bouncer protects your Cloudflare zones by:
- Checking incoming IPs against CrowdSec decisions
- Applying remediations (ban, captcha) at the Cloudflare edge
- Syncing decisions automatically every 5 minutes

## Prerequisites

Have these ready before clicking Start:

1. **Cloudflare API Token** with permissions:
   - Account: Workers Scripts (Edit), Workers KV Storage (Edit), Workers Tail (Read), D1 (Edit), Account Settings (Read)
   - Zone: Workers Routes (Edit), Zone (Read)
   - User: User Details (Read)

2. **CrowdSec Blocklist Mirror URL + API Key** from [CrowdSec Console](https://app.crowdsec.net).

**Click Start when you see this in the terminal:**

```
ubuntu:~$
```
