#!/bin/bash -e
# pi-gen stage2 substage. This preamble runs on the HOST; the on_chroot block
# below runs inside the chroot. ${ROOTFS_DIR} is the target rootfs on the host
# and CWD is this substage dir, so files/ resolves to the support files that
# build-image.sh copied in. pi-gen never populates /tmp inside the chroot, so
# we stage our files into ${ROOTFS_DIR}/tmp/pi-gen-files here, let the chroot
# block install them with the right owner/mode, then delete them afterwards so
# they never ship inside the image.
install -d "${ROOTFS_DIR}/tmp/pi-gen-files"
install -m 644 files/familyboard-network           "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-network"
install -m 644 files/familyboard.service           "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard.service"
install -m 644 files/familyboard-avahi.service     "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-avahi.service"
install -m 644 files/firstboot-secrets.sh          "${ROOTFS_DIR}/tmp/pi-gen-files/firstboot-secrets.sh"
install -m 644 files/familyboard-firstboot.service "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-firstboot.service"
install -m 644 files/docker-compose.pi.yml         "${ROOTFS_DIR}/tmp/pi-gen-files/docker-compose.pi.yml"
install -m 644 files/familyboard-updater.sh        "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-updater.sh"
install -m 644 files/familyboard-updater.service   "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-updater.service"
install -m 644 files/familyboard-updater.timer     "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-updater.timer"
install -m 644 files/familyboard-updater.path      "${ROOTFS_DIR}/tmp/pi-gen-files/familyboard-updater.path"
install -m 644 files/updater.env                   "${ROOTFS_DIR}/tmp/pi-gen-files/updater.env"
install -m 644 files/release-pub.pem               "${ROOTFS_DIR}/tmp/pi-gen-files/release-pub.pem"
install -m 644 files/current-version               "${ROOTFS_DIR}/tmp/pi-gen-files/current-version"

# Bake the prebuilt arm64 app image into the rootfs so the first boot can load
# it with no network. familyboard.service's ExecStartPre runs `docker load` on
# it before bringing the stack up.
install -d "${ROOTFS_DIR}/var/lib/familyboard"
install -m 644 files/familyboard-image.tar.gz "${ROOTFS_DIR}/var/lib/familyboard/familyboard-image.tar.gz"

on_chroot << EOF

# ---------------------------------------------------------------------------
# Docker CE + Compose v2 plugin from Docker's official repo.
# Debian's docker.io ships no compose-v2 plugin, and docker-compose-plugin is
# not in the Debian/RPi repos — so install the whole Docker stack from
# download.docker.com. Every other package (chromium, X stack, avahi, …) is
# installed by the 00-packages list from the base repos before this runs.
# ---------------------------------------------------------------------------
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# NetworkManager is the WiFi manager, but it uses wpa_supplicant as its backend
# (started on demand via D-Bus). wpa_supplicant must therefore NOT be masked —
# masking it leaves NM unable to scan and wlan0 stuck "unavailable" even though
# the radio, firmware and rfkill are all fine. Just keep the standalone service
# from auto-starting (NM activates it itself) and enable NetworkManager.
systemctl disable wpa_supplicant || true
systemctl enable NetworkManager

# ---------------------------------------------------------------------------
# familyboard user — pi-gen already created it via FIRST_USER_NAME; just add
# it to the docker group so it can call docker compose if needed.
# ---------------------------------------------------------------------------
usermod -aG docker familyboard || true

# ---------------------------------------------------------------------------
# Swap headroom. The app image is prebuilt off-device so nothing compiles here,
# but a 2 GB swap file keeps the running stack (Next.js server + Chromium
# kiosk) comfortable on a 4 GB Pi 4 and absorbs memory spikes.
# ---------------------------------------------------------------------------
sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
systemctl enable dphys-swapfile

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

# Use this build's pi compose override (host networking + privileges for the
# nsenter-based WiFi control) instead of whatever the cloned main branch ships.
cp /tmp/pi-gen-files/docker-compose.pi.yml /opt/familyboard/docker-compose.pi.yml
chown familyboard:familyboard /opt/familyboard/docker-compose.pi.yml

# Write non-secret defaults only. Secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) are
# generated at first boot by familyboard-firstboot.service so that every device
# that is flashed from this image gets its own unique AES-256-GCM key.
cat > /opt/familyboard/.env << 'ENVEOF'
NEXTAUTH_URL=http://familyboard.local:3000
DATABASE_URL=file:/app/data/app.db
ENVEOF

chmod 600 /opt/familyboard/.env
chown familyboard:familyboard /opt/familyboard/.env

# The app container runs as uid:gid 1001:1001 (nextjs:nodejs in the Dockerfile)
# and bind-mounts ./data -> /app/data. Pre-create the host data dir owned by
# 1001 so SQLite can open /app/data/app.db on first boot. Without this Docker
# creates the dir as root and the non-root container cannot write to it, so
# `prisma db push` fails with "unable to open database file".
install -d -o 1001 -g 1001 /opt/familyboard/data

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
# Re-run under a D-Bus session bus so the on-screen keyboard (onboard), AT-SPI
# accessibility and gsettings work in this minimal openbox session. Guarded so
# the kiosk still boots if dbus-run-session is somehow absent.
if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ] && command -v dbus-run-session >/dev/null 2>&1; then
  exec dbus-run-session -- "$0"
fi
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &
openbox-session &

# On-screen keyboard for pages our in-app React keyboard can't reach (e.g. the
# Google OAuth login form). onboard auto-shows over focused text fields via
# AT-SPI; Chromium exposes that tree because --force-renderer-accessibility is
# set below and at-spi2-core is running. All best-effort — never block the
# kiosk if the OSK stack is missing.
if command -v onboard >/dev/null 2>&1; then
  gsettings set org.onboard auto-show.enabled true 2>/dev/null || true
  gsettings set org.onboard.window.docking enabled true 2>/dev/null || true
  gsettings set org.onboard start-minimized true 2>/dev/null || true
  onboard &
fi

while ! curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; do
  sleep 2
done
exec chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble --disable-translate --no-first-run \
  --start-fullscreen --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required --overscroll-history-navigation=0 \
  --force-renderer-accessibility \
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

# Avahi for mDNS (familyboard.local) + _familyboard._tcp service advert so the
# mobile app can re-discover the board after a DHCP lease change.
systemctl enable avahi-daemon
install -d -m 755 /etc/avahi/services
install -m 644 -o root -g root /tmp/pi-gen-files/familyboard-avahi.service /etc/avahi/services/familyboard.service

# ---------------------------------------------------------------------------
# OTA updater — host script + config + release public key + systemd units.
# Pulls signed updates from updates.familyboard.ch, verifies with openssl,
# swaps the app image, health-checks, and rolls back. See docs/ota-update-plan.md.
# ---------------------------------------------------------------------------
install -m 750 -o root -g root /tmp/pi-gen-files/familyboard-updater.sh /usr/local/sbin/familyboard-updater
install -d -m 755 /etc/familyboard
install -m 644 -o root -g root /tmp/pi-gen-files/updater.env      /etc/familyboard/updater.env
install -m 644 -o root -g root /tmp/pi-gen-files/release-pub.pem   /etc/familyboard/release-pub.pem
# Seed the running version so the updater only applies strictly newer releases.
install -m 644 -o root -g root /tmp/pi-gen-files/current-version   /var/lib/familyboard/current-version
# Seed the host-payload version too: this base already carries these host files,
# so the app container's host-sync (scripts/host-sync.sh) skips the first boot.
install -m 644 -o root -g root /tmp/pi-gen-files/current-version   /var/lib/familyboard/host-payload-version
cp /tmp/pi-gen-files/familyboard-updater.service /etc/systemd/system/familyboard-updater.service
cp /tmp/pi-gen-files/familyboard-updater.timer   /etc/systemd/system/familyboard-updater.timer
cp /tmp/pi-gen-files/familyboard-updater.path    /etc/systemd/system/familyboard-updater.path
systemctl enable familyboard-updater.timer
systemctl enable familyboard-updater.path

EOF

# Remove the staged support files so they are not baked into the shipped image.
rm -rf "${ROOTFS_DIR}/tmp/pi-gen-files"
