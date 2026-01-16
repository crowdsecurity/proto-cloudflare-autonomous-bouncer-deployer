#!/bin/bash

# Spawn the actual setup as a detached process and exit immediately
# This prevents KillerCoda from timing out on long-running background scripts

nohup bash -c '
exec > /var/log/setup.log 2>&1
set +e

echo "=== Background setup started at $(date) ==="

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# Install Go
echo "Installing Go..."
GO_VERSION="1.22.0"
curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o /tmp/go.tar.gz
rm -rf /usr/local/go
tar -C /usr/local -xzf /tmp/go.tar.gz
export PATH=$PATH:/usr/local/go/bin
echo "export PATH=\$PATH:/usr/local/go/bin" >> /root/.bashrc
go version

# Clone and build the Go bouncer
echo "Building CrowdSec Cloudflare Worker Bouncer..."
cd /root
git clone https://github.com/crowdsecurity/cs-cloudflare-worker-bouncer.git
cd cs-cloudflare-worker-bouncer
make build-worker-js
make release

# Install the built binary
BOUNCER_DIR=$(ls -d crowdsec-cloudflare-worker-bouncer-v* 2>/dev/null | head -1)
if [ -n "$BOUNCER_DIR" ]; then
    cp "${BOUNCER_DIR}/crowdsec-cloudflare-worker-bouncer" /usr/local/bin/
    chmod +x /usr/local/bin/crowdsec-cloudflare-worker-bouncer
    echo "Bouncer installed from ${BOUNCER_DIR}"
fi

# Clone and build the GUI
echo "Setting up Bouncer GUI..."
cd /root
git clone https://github.com/julienloizelet/cs-cloudflare-bouncer-gui.git
cd /root/cs-cloudflare-bouncer-gui
npm install
npm run build

# Create environment file
cat > .env << ENVEOF
BOUNCER_BINARY_PATH=crowdsec-cloudflare-worker-bouncer
NODE_ENV=production
ENVEOF

# Start the server
echo "Starting server..."
NODE_ENV=production nohup npm start > /var/log/bouncer-gui.log 2>&1 &

# Wait for server
for i in {1..30}; do
    curl -s http://localhost:3000/api/health > /dev/null 2>&1 && break
    sleep 1
done

touch /tmp/.setup-complete
echo "=== Setup Complete ==="
' &

# Exit immediately so KillerCoda sees success
exit 0