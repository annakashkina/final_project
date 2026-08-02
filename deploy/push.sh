#!/bin/bash
set -euo pipefail

# Quick update: ./push.sh [--env] <server-ip>
# Syncs code and restarts. No git needed.
# --env  also copy .env to the server (excluded by default)

SEND_ENV=false
if [[ "${1:-}" == "--env" ]]; then
    SEND_ENV=true
    shift
fi

SERVER="${1:?Usage: push.sh [--env] <server-ip>}"
PROTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

EXCLUDE_ENV=()
if [[ "$SEND_ENV" == false ]]; then
    EXCLUDE_ENV=(--exclude='.env')
fi

rsync -avz \
    --exclude='.git' \
    --exclude='data/' \
    "${EXCLUDE_ENV[@]}" \
    --filter='protect data/' \
    --delete \
    "$PROTO_DIR"/ root@"$SERVER":/opt/codeprobe/

ssh root@"$SERVER" 'bash -s' <<'REMOTE'
set -euo pipefail
chown -R codeprobe:codeprobe /opt/codeprobe
chmod 600 /opt/codeprobe/.env
# Ensure runtime Python deps are present. Cheap no-op if already installed.
python3 -c 'import lightgbm, numpy' 2>/dev/null \
    || pip3 install --break-system-packages numpy lightgbm
if [ -f /opt/codeprobe/validator_model.pkl ] && grep -q '^VALIDATOR_HMAC_KEY=' /opt/codeprobe/.env; then
    sudo -u codeprobe bash -c '
        set -a; . /opt/codeprobe/.env; set +a
        cd /opt/codeprobe && python3 validator.py --sign
    '
fi
systemctl restart codeprobe
REMOTE
echo "Updated and restarted."
