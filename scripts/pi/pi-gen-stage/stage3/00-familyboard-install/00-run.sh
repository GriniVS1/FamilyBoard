#!/bin/bash -e
# Runs inside the pi-gen chroot. Installs system deps, sets up the kiosk
# environment, and places all systemd + sudoers artefacts.

on_chroot << EOF

# ---------------------------------------------------------------------------
# System packages (listed in 00-packages, but apt-get here for explicit deps)
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
  network-manager \
  xserver-xorg \
  xinit \
  x11-xserver-utils \
  xserver-xorg-legacy \
  openbox

# Disable wpa_supplicant — NetworkManager handles WiFi exclusively.
systemctl disable wpa_supplicant || true
systemctl mask wpa_supplicant || true
systemctl enable NetworkManager

# ---------------------------------------------------------------------------
# familyboard user — pi-gen already created it via FIRST_USER_NAME; just add
# it to the docker group so it can call docker compose if needed.
# ---------------------------------------------------------------------------
usermod -aG docker familyboard || true

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
# X11 wrapper: allow the familyboard user to start X from the console
# ---------------------------------------------------------------------------
cat > /etc/X11/Xwrapper.config << 'XWRAP'
allowed_users=anybody
needs_root_rights=yes
XWRAP

# ---------------------------------------------------------------------------
# Console autologin for familyboard on tty1
# ---------------------------------------------------------------------------
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'AUTOLOGIN'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin familyboard --noclear %I \$TERM
AUTOLOGIN

# ---------------------------------------------------------------------------
# Kiosk dotfiles — written to both /etc/skel and /home/familyboard.
# /etc/skel covers a first-boot-recreated home; /home/familyboard covers the
# build-time home that pi-gen creates when FIRST_USER_NAME is set.
# Both destinations are populated so the correct files are present regardless
# of which path pi-gen took.
# ---------------------------------------------------------------------------

# .bash_profile: launch X automatically when logging in on tty1
cat > /etc/skel/.bash_profile << 'BASHPROFILE'
if [ -z "\${DISPLAY:-}" ] && [ "\$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor
fi
BASHPROFILE

# .xinitrc: minimal X session — blanking off, cursor hidden, openbox window
# manager, then Chromium kiosk once the app health endpoint responds.
cat > /etc/skel/.xinitrc << 'XINITRC'
#!/bin/sh
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &
openbox-session &
while ! curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
  sleep 2
done
exec chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --disable-translate --no-first-run \
  --start-fullscreen --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required --overscroll-history-navigation=0 \
  http://localhost:3000
XINITRC

# Mirror dotfiles into /home/familyboard if pi-gen created it at build time.
if [ -d /home/familyboard ]; then
  cp /etc/skel/.bash_profile /home/familyboard/.bash_profile
  cp /etc/skel/.xinitrc      /home/familyboard/.xinitrc
  chmod +x /home/familyboard/.xinitrc
  chown familyboard:familyboard /home/familyboard/.bash_profile /home/familyboard/.xinitrc
fi
chmod +x /etc/skel/.xinitrc

# ---------------------------------------------------------------------------
# Systemd units
# ---------------------------------------------------------------------------
cp /tmp/pi-gen-files/familyboard.service /etc/systemd/system/familyboard.service
systemctl enable familyboard.service

# First-boot secret generator — runs before familyboard.service and is
# idempotent (no-ops once both keys are present).
install -m 750 -o root -g root /tmp/pi-gen-files/firstboot-secrets.sh /usr/local/sbin/familyboard-firstboot
cp /tmp/pi-gen-files/familyboard-firstboot.service /etc/systemd/system/familyboard-firstboot.service
systemctl enable familyboard-firstboot.service

# Avahi for mDNS (familyboard.local)
systemctl enable avahi-daemon

# log2ram to reduce SD wear
systemctl enable log2ram || true

EOF
