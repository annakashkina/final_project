#!/bin/bash
set -euo pipefail

# Runs on the server as root. Do not run manually. Called by deploy.sh.

DOMAIN="${1:?Usage: setup.sh <domain>}"

echo "==> System update"
apt update && apt upgrade -y

echo "==> Swap (512MB safety net)"
if [ ! -f /swapfile ]; then
    fallocate -l 512M /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Install packages"
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

echo "==> Create app user"
id codeprobe &>/dev/null || useradd --system --create-home --home-dir /opt/codeprobe --shell /usr/sbin/nologin codeprobe

echo "==> Permissions"
mkdir -p /opt/codeprobe/data
chown -R codeprobe:codeprobe /opt/codeprobe
chmod 600 /opt/codeprobe/.env

echo "==> Caddy config (domain: $DOMAIN)"
cat > /etc/caddy/Caddyfile <<CADDYEOF
$DOMAIN {
    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server
    }

    # Defense-in-depth: block access to server-side files even if the
    # Python handler regresses. Paths that must never be served publicly.
    @forbidden {
        path /.env /.env.* /.token_secret
        path /data /data/*
        path /deploy /deploy/*
        path /__pycache__/*
        path *.py *.pkl *.pkl.sig *.jsonl *.service *.sh
    }
    respond @forbidden 404

    reverse_proxy localhost:3000
}
CADDYEOF
systemctl restart caddy

echo "==> Systemd service"
cp /opt/codeprobe/deploy/codeprobe.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now codeprobe

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "Done. Point DNS A record for $DOMAIN to this server."
echo "Caddy will auto-provision HTTPS once DNS propagates."
