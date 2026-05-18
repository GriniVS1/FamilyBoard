#!/usr/bin/env bash
# Build a flashable FamilyBoard image for commercial hardware bundles.
#
# Requirements on the build host:
#   - macOS or Linux with Docker installed
#   - ~30 GB free disk space
#   - curl, git
#
# Output:
#   ./dist/familyboard-vX.Y.Z.img.gz
#
# What it does:
#   1. Clones https://github.com/RPi-Distro/pi-gen at the Bookworm tag
#   2. Generates a custom stage-3 overlay that:
#        - installs docker.io, docker-compose-plugin, chromium-browser,
#          unclutter, avahi-daemon, log2ram, git, curl, jq, network-manager
#        - disables wpa_supplicant in favour of NetworkManager
#        - creates the familyboard system user + group
#        - clones the FamilyBoard repo to /opt/familyboard
#        - generates unique secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) per image
#        - copies sudoers + systemd unit files into place
#        - enables familyboard.service (Docker Compose) and avahi-daemon
#        - leaves WiFi unconfigured — buyer sets it at first boot via the
#          touchscreen (/setup/network step)
#        - disables the default pi user — vendor re-sets via Imager userconf
#          before reflashing if a shell is needed
#   3. Runs pi-gen via its docker-build.sh wrapper (~20 min on a fast host)
#   4. Renames and gzips the resulting image into ./dist/
#
# Usage:
#   ./scripts/pi/build-image.sh v1.2.0
#
# The resulting file is safe to distribute. WiFi credentials are NOT embedded.
# Each SD card has unique secrets generated at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

PI_GEN_REPO="https://github.com/RPi-Distro/pi-gen.git"
# Pin to the Bookworm release tag for reproducibility.
PI_GEN_TAG="arm64-2024-11-19"
PI_GEN_DIR="/tmp/pi-gen-familyboard"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>  (e.g. $0 v1.2.0)" >&2
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is required on the build host." >&2
  exit 1
fi

echo "Building FamilyBoard image $VERSION ..."
mkdir -p "$DIST_DIR"

# ---------------------------------------------------------------------------
# 1. Clone pi-gen
# ---------------------------------------------------------------------------
if [[ -d "$PI_GEN_DIR" ]]; then
  echo "Reusing existing pi-gen clone at $PI_GEN_DIR"
  git -C "$PI_GEN_DIR" fetch --tags
  git -C "$PI_GEN_DIR" checkout "$PI_GEN_TAG"
else
  git clone --depth 1 --branch "$PI_GEN_TAG" "$PI_GEN_REPO" "$PI_GEN_DIR"
fi

# ---------------------------------------------------------------------------
# 2. Write pi-gen config
# ---------------------------------------------------------------------------
cat > "$PI_GEN_DIR/config" << EOF
IMG_NAME="familyboard-${VERSION}"
RELEASE="bookworm"
DEPLOY_COMPRESSION=gz
LOCALE_DEFAULT="en_GB.UTF-8"
TARGET_HOSTNAME="familyboard"
KEYBOARD_KEYMAP="gb"
KEYBOARD_LAYOUT="English (UK)"
TIMEZONE_DEFAULT="Europe/London"
FIRST_USER_NAME="familyboard"
FIRST_USER_PASS="$(openssl rand -base64 12)"
ENABLE_SSH=1
# Disable pi-gen stages 4 (desktop extras) and 5 (recommend packages) —
# we ship a stripped image; Docker runs the actual app.
STAGE_LIST="stage0 stage1 stage2 stage3"
EOF

# ---------------------------------------------------------------------------
# 3. Skip default pi-gen stage3 and inject our custom overlay
# ---------------------------------------------------------------------------
touch "$PI_GEN_DIR/stage3/SKIP"

CUSTOM_STAGE="$PI_GEN_DIR/stage3/00-familyboard-install"
rm -rf "$CUSTOM_STAGE"
cp -r "$SCRIPT_DIR/pi-gen-stage/stage3/00-familyboard-install" "$CUSTOM_STAGE"

# Copy supporting files that the run-script expects in /tmp/pi-gen-files inside chroot.
mkdir -p "$CUSTOM_STAGE/files"
cp "$SCRIPT_DIR/sudoers.d/familyboard-network"  "$CUSTOM_STAGE/files/familyboard-network"
cp "$SCRIPT_DIR/familyboard.service"             "$CUSTOM_STAGE/files/familyboard.service"
cp "$SCRIPT_DIR/chromium-kiosk.service"          "$CUSTOM_STAGE/files/chromium-kiosk.service"

chmod +x "$CUSTOM_STAGE/00-run.sh"

# ---------------------------------------------------------------------------
# 4. Run pi-gen build via its Docker wrapper
# ---------------------------------------------------------------------------
cd "$PI_GEN_DIR"
bash build-docker.sh

# ---------------------------------------------------------------------------
# 5. Locate and publish the output image
# ---------------------------------------------------------------------------
LATEST_IMG="$(ls -t "$PI_GEN_DIR/deploy/"*.img.gz 2>/dev/null | head -1)"
if [[ -z "$LATEST_IMG" ]]; then
  echo "ERROR: pi-gen produced no .img.gz in $PI_GEN_DIR/deploy/" >&2
  exit 1
fi

OUT="$DIST_DIR/familyboard-${VERSION}.img.gz"
cp "$LATEST_IMG" "$OUT"

echo ""
echo "Image ready: $OUT"
echo "Flash with Raspberry Pi Imager or:"
echo "  gunzip -c \"$OUT\" | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync"
echo ""
echo "First-boot expected behavior:"
echo "  The display shows the WiFi-onboarding step at http://familyboard.local:3000/setup/network"
echo "  after the FamilyBoard container starts (~60–90 s from power-on)."
