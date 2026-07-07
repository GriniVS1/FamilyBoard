#!/bin/sh
# FamilyBoard host-payload sync — runs INSIDE the app container at start.
#
# The container runs privileged + pid:host on the Pi (see docker-compose.pi.yml)
# and may run nsenter via sudo (see Dockerfile sudoers rule), which the app
# already uses for WiFi. We reuse that capability to keep the HOST side of the
# appliance (updater script, systemd units, compose override, sudoers, packages)
# in lockstep with the app image — making the whole system OTA-updatable, even
# on devices flashed with an old base image.
#
# Best-effort by design: any failure logs and exits 0 — the app must always
# start. Sync is retried on the next container start (reboot / next update).
set -u

DATA_LOG=/app/data/update.log
log() {
  m="[host-sync] $(date -u +%FT%TZ) $*"
  echo "$m"
  echo "$m" >> "$DATA_LOG" 2>/dev/null || true
}

ns() {
  sudo -n /usr/bin/nsenter -t 1 -m -u -i -n -- "$@"
}

VER="${APP_VERSION:-dev}"
[ "$VER" = "dev" ] && exit 0

# Appliance probe: on a plain Docker install (no pid:host / no privileges) the
# nsenter either fails or lands in our own namespaces where /etc/familyboard
# doesn't exist — both mean "not a Pi appliance", so do nothing.
ns test -d /etc/familyboard 2>/dev/null || exit 0

HOSTVER="$(ns cat /var/lib/familyboard/host-payload-version 2>/dev/null || true)"
[ "$HOSTVER" = "$VER" ] && exit 0

log "host payload out of sync (host=${HOSTVER:-none} app=$VER) — applying"

STAGING=/var/lib/familyboard/host-payload-staging
if ! tar -C /app/host-payload -cf - . | ns sh -c "rm -rf $STAGING && mkdir -p $STAGING && tar -xf - -C $STAGING"; then
  log "ERROR: staging host payload failed"
  exit 0
fi

if ns bash "$STAGING/apply.sh"; then
  log "host payload $VER applied"
else
  log "ERROR: apply.sh failed — host stays on ${HOSTVER:-none}, will retry next start"
fi

ns rm -rf "$STAGING" 2>/dev/null || true
exit 0
