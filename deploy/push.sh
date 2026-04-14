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

ssh root@"$SERVER" 'bash -s' <<'REMOTE'
set -euo pipefail
chown -R codeprobe:codeprobe /opt/codeprobe
chmod 600 /opt/codeprobe/.env
if [ -f /opt/codeprobe/validator_model.pkl ] && grep -q '^VALIDATOR_HMAC_KEY=' /opt/codeprobe/.env; then
    sudo -u codeprobe bash -c '
        set -a; . /opt/codeprobe/.env; set +a
        cd /opt/codeprobe && python3 validator.py --sign
    '
fi
systemctl restart codeprobe
REMOTE
echo "Updated and restarted."
