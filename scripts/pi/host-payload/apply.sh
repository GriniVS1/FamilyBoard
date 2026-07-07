#!/usr/bin/env bash
# FamilyBoard host payload — runs ON THE PI HOST as root, invoked by the app
# container's scripts/host-sync.sh via nsenter after an OTA update.
#
# Why this exists: the OTA updater only swaps the app Docker image. Everything
# host-side (this updater, systemd units, compose override, sudoers, packages)
# was frozen into the flashed base image — unacceptable for shipped devices
# that can never be re-flashed. Each app image now carries this payload and the
# container syncs it onto the host at start, so 100% of the system updates
# remotely. See docs/ota-update-plan.md.
#
# Rules:
# - Idempotent: safe to re-run; host-sync only calls us when versions differ.
# - Atomic file swaps via mv (same filesystem) — the running updater keeps its
#   old inode, so replacing /usr/local/sbin/familyboard-updater mid-run is safe.
# - NEVER restart familyboard.service or familyboard-updater.service here:
#   the first would kill the container we're being driven from, the second
#   would kill the updater that may still be health-checking this very update.
#   Unit-file changes take effect on their next natural (re)start.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR=/var/lib/familyboard
DATA_LOG=/opt/familyboard/data/update.log
VERSION="$(cat "$SRC/version")"

log() {
  local m="[host-payload] $(date -u +%FT%TZ) $*"
  echo "$m"
  echo "$m" >> "$DATA_LOG" 2>/dev/null || true
}

# Atomic install: copy to a temp file next to the destination, then rename.
install_file() { # src dst mode
  local src="$1" dst="$2" mode="$3" tmp
  tmp="$(mktemp "${dst}.XXXXXX")"
  cp "$src" "$tmp"
  chown root:root "$tmp"
  chmod "$mode" "$tmp"
  mv -f "$tmp" "$dst"
}

log "applying host payload $VERSION"

# --- OTA updater script + units -------------------------------------------------
install_file "$SRC/familyboard-updater.sh"      /usr/local/sbin/familyboard-updater            750
install_file "$SRC/familyboard-updater.service" /etc/systemd/system/familyboard-updater.service 644
install_file "$SRC/familyboard-updater.timer"   /etc/systemd/system/familyboard-updater.timer   644
install_file "$SRC/familyboard-updater.path"    /etc/systemd/system/familyboard-updater.path    644
install_file "$SRC/familyboard.service"         /etc/systemd/system/familyboard.service         644

# --- compose override (picked up on the next `docker compose up`) ---------------
install_file "$SRC/docker-compose.pi.yml" /opt/familyboard/docker-compose.pi.yml 644

# --- updater config: only seed if missing (may carry per-device overrides) ------
if [[ ! -f /etc/familyboard/updater.env ]]; then
  install_file "$SRC/updater.env" /etc/familyboard/updater.env 644
fi

# --- sudoers: validate before activating — a bad file bricks sudo ---------------
SUDOERS_TMP="$(mktemp /etc/sudoers.d/.familyboard-network.XXXXXX)"
cp "$SRC/familyboard-network" "$SUDOERS_TMP"
chown root:root "$SUDOERS_TMP"
chmod 440 "$SUDOERS_TMP"
if visudo -c -f "$SUDOERS_TMP" >/dev/null 2>&1; then
  mv -f "$SUDOERS_TMP" /etc/sudoers.d/familyboard-network
else
  rm -f "$SUDOERS_TMP"
  log "WARNING: sudoers payload failed visudo check — keeping existing rules"
fi

# --- host packages (extend per release; guarded so re-runs are cheap) -----------
PACKAGES=()
MISSING=()
for p in "${PACKAGES[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 || MISSING+=("$p")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  log "installing packages: ${MISSING[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${MISSING[@]}"
fi

# --- activate unit changes (timer/path only — see header) ------------------------
systemctl daemon-reload
systemctl enable familyboard-updater.timer familyboard-updater.path >/dev/null 2>&1 || true
systemctl restart familyboard-updater.timer familyboard-updater.path 2>/dev/null || true

echo "$VERSION" > "$STATE_DIR/host-payload-version"
log "host payload $VERSION applied"
