#!/usr/bin/env bash
set -euo pipefail

# log2ram is already apt-installed by install.sh. Just enable it.
# Default config writes /var/log to a 40MB tmpfs and syncs to SD hourly +
# on shutdown. That's enough for a wall display.
sudo systemctl enable --now log2ram.service
echo "▸ log2ram enabled — /var/log now in RAM, syncs hourly to SD."
