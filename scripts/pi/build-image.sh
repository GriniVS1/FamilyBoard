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
#   2. Injects a custom substage into stage2 (99-familyboard-install) that:
#        - installs Docker CE + compose plugin (from Docker's official repo),
#          chromium-browser, unclutter, avahi-daemon, git, curl, jq,
#          network-manager, xserver-xorg, xinit, openbox + supporting X11 pkgs
#        - disables wpa_supplicant in favour of NetworkManager
#        - adds the pi-gen-created familyboard user to the docker group
#        - clones the FamilyBoard repo to /opt/familyboard
#        - secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) are generated at first boot
#        - copies sudoers + systemd unit files into place
#        - enables familyboard.service (Docker Compose) and avahi-daemon
#        - configures tty1 autologin as familyboard + .xinitrc kiosk launch
#        - leaves WiFi unconfigured — buyer sets it at first boot via the
#          touchscreen (/setup/network step)
#   3. Runs pi-gen via its docker-build.sh wrapper (~20 min on a fast host)
#   4. Renames and gzips the resulting image into ./dist/
#
# Usage:
#   ./scripts/pi/build-image.sh v1.2.0
#
# The resulting file is safe to distribute. WiFi credentials are NOT embedded.
# Secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY) are generated at first boot on each
# device, so every unit is unique even when one image is flashed to many cards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

PI_GEN_REPO="https://github.com/RPi-Distro/pi-gen.git"
# Pin to a real pi-gen Bookworm arm64 release tag for reproducibility.
# Tag format is <date>-raspios-<release>-<arch> (verify with
# `git ls-remote --tags https://github.com/RPi-Distro/pi-gen.git`).
PI_GEN_TAG="2024-11-19-raspios-bookworm-arm64"
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
# Password for the 'familyboard' Linux user. Defaults to a random value; set
# FAMILYBOARD_PI_PASS to pin a known password for debugging a test unit via SSH
# or a TTY. It is printed at the end of the build either way. The kiosk itself
# autologins on tty1 and never needs it.
FIRST_USER_PASS="${FAMILYBOARD_PI_PASS:-$(openssl rand -base64 12)}"

cat > "$PI_GEN_DIR/config" << EOF
IMG_NAME="familyboard-${VERSION}"
RELEASE="bookworm"
DEPLOY_COMPRESSION=gz
LOCALE_DEFAULT="en_GB.UTF-8"
TARGET_HOSTNAME="familyboard"
KEYBOARD_KEYMAP="ch"
KEYBOARD_LAYOUT="German (Switzerland)"
TIMEZONE_DEFAULT="Europe/Zurich"
FIRST_USER_NAME="familyboard"
FIRST_USER_PASS="${FIRST_USER_PASS}"
ENABLE_SSH=1
DISABLE_FIRST_BOOT_USER_RENAME=1
# Build only the lite base — our stage2 substage adds docker + the kiosk stack.
# stage3 and above are desktop environments we do not need.
STAGE_LIST="stage0 stage1 stage2"
EOF

# ---------------------------------------------------------------------------
# 3. Inject our overlay as a late substage of stage2 so it is baked into
#    the exported lite image. Substages sort lexicographically; 99-… runs
#    after all default stage2 work is complete.
# ---------------------------------------------------------------------------
CUSTOM_STAGE="$PI_GEN_DIR/stage2/99-familyboard-install"
rm -rf "$CUSTOM_STAGE"
cp -r "$SCRIPT_DIR/pi-gen-stage/stage3/00-familyboard-install" "$CUSTOM_STAGE"

# Copy supporting files that the run-script expects in /tmp/pi-gen-files inside chroot.
mkdir -p "$CUSTOM_STAGE/files"
cp "$SCRIPT_DIR/sudoers.d/familyboard-network"      "$CUSTOM_STAGE/files/familyboard-network"
cp "$SCRIPT_DIR/familyboard.service"               "$CUSTOM_STAGE/files/familyboard.service"
cp "$SCRIPT_DIR/firstboot-secrets.sh"              "$CUSTOM_STAGE/files/firstboot-secrets.sh"
cp "$SCRIPT_DIR/familyboard-firstboot.service"     "$CUSTOM_STAGE/files/familyboard-firstboot.service"
# The Pi compose override is baked from this working tree (not the cloned main)
# so the device gets the host-networking + nsenter privileges the WiFi setup needs.
cp "$REPO_ROOT/docker-compose.pi.yml"              "$CUSTOM_STAGE/files/docker-compose.pi.yml"

chmod +x "$CUSTOM_STAGE/00-run.sh"

# ---------------------------------------------------------------------------
# 3b. Cross-build the arm64 app image on THIS host (which has internet) and
#     bake it into the stage as a loadable tarball. The Pi loads it at first
#     boot, so the device never builds or pulls anything over the network —
#     essential because WiFi is configured later inside the app, leaving the
#     very first boot with no connectivity at all.
#
#     A dedicated docker-container buildx builder is used because it reliably
#     supports exporting to a tar (-o type=docker) regardless of the host's
#     Docker image-store configuration.
# ---------------------------------------------------------------------------
if ! docker buildx version &> /dev/null; then
  echo "ERROR: 'docker buildx' is required to cross-build the arm64 app image." >&2
  echo "       Install Docker Desktop (bundles buildx) or the buildx plugin." >&2
  exit 1
fi

if ! docker buildx inspect familyboard-builder &> /dev/null; then
  docker buildx create --name familyboard-builder --driver docker-container >/dev/null
fi

echo "Cross-building arm64 app image (several minutes; longer on Intel Macs) ..."
docker buildx build --builder familyboard-builder --platform linux/arm64 \
  --build-arg APP_VERSION="$VERSION" \
  -t familyboard:latest \
  -o "type=docker,dest=$CUSTOM_STAGE/files/familyboard-image.tar" \
  "$REPO_ROOT"

echo "Compressing app image into the stage ..."
gzip -f "$CUSTOM_STAGE/files/familyboard-image.tar"

# ---------------------------------------------------------------------------
# 4. Run pi-gen build via its Docker wrapper
# ---------------------------------------------------------------------------
cd "$PI_GEN_DIR"
# pi-gen refuses to start if a container from a previous (often failed) run is
# still around. Remove it for a clean build so a failed attempt never blocks
# the next one. (The stage cache lives in this container, so this forces a
# from-scratch build — acceptable given how fast the build reaches our stage.)
docker rm -v pigen_work >/dev/null 2>&1 || true
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
echo "  First boot loads the prebuilt app image from the SD card (~2-4 min; the"
echo "  screen is black meanwhile), then shows the WiFi-onboarding step at"
echo "  http://familyboard.local:3000/setup/network. Later boots start in ~60-90 s."
echo "  No network is needed until the user configures WiFi in the app."
echo ""
echo "Debug / SSH login for this image:"
echo "  user: familyboard   password: ${FIRST_USER_PASS}"
echo "  (random per build unless FAMILYBOARD_PI_PASS=... was set; the tty1 kiosk"
echo "   autologin does not need it. SSH works once the device has network.)"
