#!/bin/bash
set -euo pipefail

# Quick update: ./push.sh <server-ip>
# Syncs code and restarts. No git needed.

SERVER="${1:?Usage: push.sh <server-ip>}"
PROTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

rsync -avz \
    --exclude='.git' \
    --exclude='data/' \
    --filter='protect data/' \
    --delete \
    "$PROTO_DIR"/ root@"$SERVER":/opt/codeprobe/

ssh root@"$SERVER" "chown -R codeprobe:codeprobe /opt/codeprobe && chmod 600 /opt/codeprobe/.env && systemctl restart codeprobe"
echo "Updated and restarted."
