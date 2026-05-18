#!/usr/bin/env bash
set -euo pipefail

# Set hostname to "familyboard" so the LAN can find us at familyboard.local
sudo hostnamectl set-hostname familyboard

# Guard against duplicate entries on re-runs
if ! grep -q "familyboard" /etc/hosts; then
  echo "127.0.1.1 familyboard" | sudo tee -a /etc/hosts > /dev/null
fi

sudo systemctl enable --now avahi-daemon
echo "▸ mDNS configured — wall reachable at familyboard.local on the LAN."
