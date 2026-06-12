#!/bin/bash -e
# Runs inside the pi-gen chroot. Installs system deps, creates the familyboard
# system user/group, and places all systemd + sudoers artefacts.

on_chroot << EOF

# ---------------------------------------------------------------------------
# System packages
# ---------------------------------------------------------------------------
apt-get update -qq
apt-get install -y --no-install-recommends \
  docker.io \
  docker-compose-plugin \
  chromium-browser \
  unclutter \
  avahi-daemon \
  log2ram \
  git \
  curl \
  jq \
  network-manager

# Disable wpa_supplicant — NetworkManager handles WiFi exclusively.
systemctl disable wpa_supplicant || true
systemctl mask wpa_supplicant || true
systemctl enable NetworkManager

# ---------------------------------------------------------------------------
# familyboard system user + group
# ---------------------------------------------------------------------------
groupadd --system familyboard || true
useradd --system --gid familyboard --no-create-home --shell /usr/sbin/nologin familyboard || true

# The default pi user is disabled on bundle images; the container runs as root
# inside Docker which is constrained by NET_ADMIN cap only.

# ---------------------------------------------------------------------------
# Sudoers: allow familyboard group to run nmcli without password
# ---------------------------------------------------------------------------
install -m 440 -o root -g root /tmp/pi-gen-files/familyboard-network /etc/sudoers.d/familyboard-network
visudo -c -f /etc/sudoers.d/familyboard-network

# ---------------------------------------------------------------------------
# Clone the FamilyBoard repo
# ---------------------------------------------------------------------------
git clone https://github.com/GriniVS1/FamilyBoard.git /opt/familyboard
chown -R familyboard:familyboard /opt/familyboard

# Write non-secret defaults only. Secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) are
# generated at first boot by familyboard-firstboot.service so that every device
# that is flashed from this image gets its own unique AES-256-GCM key.
cat > /opt/familyboard/.env << 'ENVEOF'
NEXTAUTH_URL=http://familyboard.local:3000
DATABASE_URL=file:/app/data/app.db
ENVEOF

chmod 600 /opt/familyboard/.env
chown familyboard:familyboard /opt/familyboard/.env

# ---------------------------------------------------------------------------
# Systemd units
# ---------------------------------------------------------------------------
cp /tmp/pi-gen-files/familyboard.service /etc/systemd/system/familyboard.service
systemctl enable familyboard.service

# First-boot secret generator — runs before familyboard.service on every boot
# and is idempotent (no-ops once both keys are present).
install -m 750 -o root -g root /tmp/pi-gen-files/firstboot-secrets.sh /usr/local/sbin/familyboard-firstboot
cp /tmp/pi-gen-files/familyboard-firstboot.service /etc/systemd/system/familyboard-firstboot.service
systemctl enable familyboard-firstboot.service

# Avahi for mDNS (familyboard.local)
systemctl enable avahi-daemon

# log2ram to reduce SD wear
systemctl enable log2ram || true

EOF
