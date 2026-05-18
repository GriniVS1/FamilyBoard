#!/usr/bin/env bash
set -euo pipefail

# Disable in lightdm autologin session (Raspberry Pi OS Desktop)
# The -s 0 flag disables the screen saver timeout; -dpms disables power management.
sudo mkdir -p /etc/lightdm
sudo tee /etc/lightdm/lightdm.conf > /dev/null <<'EOF'
[Seat:*]
xserver-command=X -s 0 -dpms
EOF

# Belt-and-suspenders: also push the xset calls into the LXDE autostart so
# they apply even if the display manager differs.
mkdir -p "$HOME/.config/lxsession/LXDE-pi"
AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"

# Guard against duplicate entries on re-runs
for CMD in "@xset s off" "@xset -dpms" "@xset s noblank"; do
  if ! grep -qF "$CMD" "$AUTOSTART" 2>/dev/null; then
    echo "$CMD" >> "$AUTOSTART"
  fi
done

echo "▸ Screen-blanking + DPMS disabled — display stays on until our app dims it."
