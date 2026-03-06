#!/bin/bash
set -euo pipefail

# First-time deploy:  ./deploy.sh <server-ip> <domain>
# Requires:
# 1. Domain and A record <domain> -> <server-ip>
# 2. SSH added to authorized keys: ssh-copy-id root@<server-ip>
# Example:            ./deploy.sh 1.2.3.4 codeprobe-app.dev

SERVER="${1:?Usage: deploy.sh <server-ip> <domain>}"
DOMAIN="${2:?Usage: deploy.sh <server-ip> <domain>}"
PROTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Validate domain (prevent shell injection)
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]]; then
    echo "Error: invalid domain name" >&2
    exit 1
fi

# Check .env exists locally
if [ ! -f "$PROTO_DIR/.env" ]; then
    echo "Error: $PROTO_DIR/.env not found. Copy .env.example and fill in your keys." >&2
    exit 1
fi

echo "==> Uploading to $SERVER"
ssh root@"$SERVER" "mkdir -p /opt/codeprobe"
rsync -az --exclude='.git' --exclude='data/' "$PROTO_DIR"/ root@"$SERVER":/opt/codeprobe/
scp "$PROTO_DIR"/.env root@"$SERVER":/opt/codeprobe/.env

echo "==> Running setup on server"
ssh root@"$SERVER" "chmod +x /opt/codeprobe/deploy/setup.sh && bash /opt/codeprobe/deploy/setup.sh $(printf '%q' "$DOMAIN")"

echo ""
echo "Deployed. Set DNS A record: $DOMAIN -> $SERVER"
