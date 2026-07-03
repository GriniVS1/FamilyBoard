#!/usr/bin/env bash
# FamilyBoard OTA updater — runs on the Pi host (not in the container).
# Pull-based: fetch a signed manifest, verify it, swap the app image, migrate,
# health-check, and roll back on failure. See docs/ota-update-plan.md.
#
# Triggered by familyboard-updater.timer (nightly) and familyboard-updater.path
# (when the app writes ./data/update-request). Never runs two copies at once
# (flock). Exit 0 = up-to-date or updated OK; non-zero = error (already rolled
# back if the swap had started).
set -euo pipefail

CONF=/etc/familyboard/updater.env
# shellcheck disable=SC1090
[[ -f "$CONF" ]] && . "$CONF"

BASE_URL="${UPDATE_BASE_URL:-https://updates.familyboard.ch}"
CHANNEL="${UPDATE_CHANNEL:-stable}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/familyboard}"
PUBKEY="${RELEASE_PUBKEY:-/etc/familyboard/release-pub.pem}"
STATE_DIR="${STATE_DIR:-/var/lib/familyboard}"
IMAGE="${IMAGE_NAME:-familyboard}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
KEEP_DB_BACKUPS="${KEEP_DB_BACKUPS:-3}"

VERSION_FILE="$STATE_DIR/current-version"
BAD_FILE="$STATE_DIR/bad-versions"
DATA_DIR="$COMPOSE_DIR/data"
COMPOSE=(docker compose -f "$COMPOSE_DIR/docker-compose.yml" -f "$COMPOSE_DIR/docker-compose.pi.yml")

log() { echo "[updater] $(date -u +%FT%TZ) $*"; }
die() { log "ERROR: $*"; exit 1; }

# Single-flight: the timer and the path unit both call us.
exec 9>"$STATE_DIR/updater.lock" || die "cannot open lock"
flock -n 9 || { log "another update run holds the lock; exiting"; exit 0; }

command -v docker >/dev/null || die "docker not found"
command -v openssl >/dev/null || die "openssl not found"
command -v jq >/dev/null || die "jq not found"
[[ -f "$PUBKEY" ]] || die "release public key missing: $PUBKEY"

# TLS needs a correct clock; the Pi has no RTC. The unit orders us After=
# time-sync.target, but guard anyway.
if command -v timedatectl >/dev/null; then
  timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -q yes \
    || log "warning: clock may not be NTP-synced yet"
fi

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

current_version() { [[ -f "$VERSION_FILE" ]] && cat "$VERSION_FILE" || echo "v0.0.0"; }
# strict-greater semver-ish compare via `sort -V` (strips leading v)
is_newer() {
  local a="${1#v}" b="${2#v}"
  [[ "$a" != "$b" ]] && [[ "$(printf '%s\n%s\n' "$a" "$b" | sort -V | tail -1)" == "$a" ]]
}

log "channel=$CHANNEL current=$(current_version) base=$BASE_URL"

# --- 1. fetch + verify manifest ------------------------------------------------
curl -fsS --max-time 30 "$BASE_URL/$CHANNEL.json"     -o "$WORK/manifest.json" || die "manifest fetch failed"
curl -fsS --max-time 30 "$BASE_URL/$CHANNEL.json.sig" -o "$WORK/manifest.sig"  || die "signature fetch failed"

base64 -d "$WORK/manifest.sig" > "$WORK/manifest.sig.bin" 2>/dev/null || die "signature not base64"
openssl pkeyutl -verify -pubin -inkey "$PUBKEY" -rawin \
  -in "$WORK/manifest.json" -sigfile "$WORK/manifest.sig.bin" >/dev/null 2>&1 \
  || die "manifest signature INVALID — refusing update"
log "manifest signature valid"

VERSION="$(jq -r '.version' "$WORK/manifest.json")"
BUNDLE_URL="$(jq -r '.appBundleUrl' "$WORK/manifest.json")"
BUNDLE_SHA="$(jq -r '.appBundleSha256' "$WORK/manifest.json")"
MIN_BASE="$(jq -r '.minBaseVersion // "v0.0.0"' "$WORK/manifest.json")"
[[ -n "$VERSION" && "$VERSION" != "null" ]] || die "manifest missing version"

# --- 2. decide -----------------------------------------------------------------
CURRENT="$(current_version)"
if ! is_newer "$VERSION" "$CURRENT"; then
  log "already up-to-date (manifest=$VERSION, current=$CURRENT)"; exit 0
fi
if [[ -f "$BAD_FILE" ]] && grep -qxF "$VERSION" "$BAD_FILE"; then
  log "skipping $VERSION — previously failed health check (bad-versions)"; exit 0
fi
if is_newer "$MIN_BASE" "$CURRENT"; then
  die "manifest requires base >= $MIN_BASE but device is $CURRENT — cannot chain"
fi
log "update available: $CURRENT -> $VERSION"

# --- 3. download + verify bundle ----------------------------------------------
curl -fsS --max-time 900 "$BUNDLE_URL" -o "$WORK/app.tar.gz" || die "bundle download failed"
ACTUAL_SHA="$(sha256sum "$WORK/app.tar.gz" | awk '{print $1}')"
[[ "$ACTUAL_SHA" == "$BUNDLE_SHA" ]] || die "bundle sha256 mismatch (want $BUNDLE_SHA got $ACTUAL_SHA)"
log "bundle sha256 verified"

# --- 4. swap image with rollback capability -----------------------------------
# Preserve the running image so we can restore it if the new one fails to boot.
docker image inspect "$IMAGE:latest" >/dev/null 2>&1 && \
  docker tag "$IMAGE:latest" "$IMAGE:previous"

# Back up the database before the new entrypoint runs migrate deploy.
BACKUP=""
if [[ -f "$DATA_DIR/app.db" ]]; then
  BACKUP="$DATA_DIR/app.db.pre-$VERSION.$(date -u +%Y%m%dT%H%M%SZ)"
  cp "$DATA_DIR/app.db" "$BACKUP"
  log "database backed up: $(basename "$BACKUP")"
fi

rollback() {
  log "rolling back to $CURRENT"
  if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
    docker tag "$IMAGE:previous" "$IMAGE:latest"
  fi
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    cp "$BACKUP" "$DATA_DIR/app.db"
    log "database restored from backup"
  fi
  "${COMPOSE[@]}" up -d || log "WARNING: compose up failed during rollback"
  echo "$VERSION" >> "$BAD_FILE"
  log "recorded $VERSION as bad; staying on $CURRENT"
}

if ! zcat "$WORK/app.tar.gz" | docker load; then
  rollback; die "docker load failed"
fi

if ! "${COMPOSE[@]}" up -d; then
  rollback; die "compose up failed"
fi

# --- 5. health check -----------------------------------------------------------
log "waiting for health (up to ${HEALTH_TIMEOUT}s)"
ok=0
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [[ "$ok" != 1 ]]; then
  rollback; die "health check failed after ${HEALTH_TIMEOUT}s"
fi

# --- 6. commit -----------------------------------------------------------------
echo "$VERSION" > "$VERSION_FILE"
log "update OK: now running $VERSION"

# prune: keep newest N db backups, drop the update-request flag, tidy images
ls -1t "$DATA_DIR"/app.db.pre-* 2>/dev/null | tail -n +$((KEEP_DB_BACKUPS + 1)) | xargs -r rm -f
rm -f "$DATA_DIR/update-request"
docker image rm "$IMAGE:previous" >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
log "done"
