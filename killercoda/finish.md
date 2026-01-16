# Setting Up Environment

The environment is being prepared. This takes **1-2 minutes**.

Watch the terminal for progress. When you see **"READY"**, open the GUI:

**[Open Bouncer GUI]({{TRAFFIC_HOST1_3000}})**

## Using the GUI

1. Select **Deploy**
2. Enter your Cloudflare API token and CrowdSec credentials
3. Select zones to protect
4. Click **Deploy**

## Troubleshooting

```bash
cat /var/log/setup.log       # Setup logs
cat /var/log/bouncer-gui.log # GUI logs
```