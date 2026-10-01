#!/bin/sh
# Prints the timezone the app process should run in — runs INSIDE the app
# container at start (see Dockerfile CMD).
#
# The kiosk browser renders on the HOST, so the server must use the host's
# local time too, or "today" (chore completions, push digest, SSR dates) flips
# at UTC midnight instead of local midnight. The host's zone is read via the
# same nsenter capability host-sync.sh uses; anything unusable falls back to the
# image default ($TZ), so the app always starts.
set -u

FALLBACK="${TZ:-Europe/Zurich}"
ZONEINFO="${ZONEINFO_DIR:-/usr/share/zoneinfo}"

ns() {
  sudo -n /usr/bin/nsenter -t 1 -m -- "$@" 2>/dev/null
}

valid() {
  case "$1" in
    "" | /* | *..* | *[!A-Za-z0-9_+/-]*) return 1 ;;
  esac
  [ -f "$ZONEINFO/$1" ]
}

candidate="$(ns cat /etc/timezone | head -n 1 | tr -d '[:space:]')"
if ! valid "$candidate"; then
  link="$(ns readlink /etc/localtime)"
  candidate="${link#*zoneinfo/}"
fi

if valid "$candidate"; then
  printf '%s\n' "$candidate"
else
  printf '%s\n' "$FALLBACK"
fi
