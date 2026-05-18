#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/GriniVS1/FamilyBoard.git"
INSTALL_DIR="/opt/familyboard"
STEP=""

die() {
  echo "ERROR: step '${STEP}' failed — $*" >&2
  exit 1
}

step() {
  STEP="$1"
  echo "▸ $1"
}

# ---------------------------------------------------------------------------
# Step 1: Architecture guard
# ---------------------------------------------------------------------------
step "Checking architecture"
ARCH="$(uname -m)"
if [[ "$ARCH" != "aarch64" && "$ARCH" != "armv7l" ]]; then
  die "This script is for Raspberry Pi (aarch64 / armv7l). Detected: $ARCH"
fi
echo "  Architecture: $ARCH — OK"

# ---------------------------------------------------------------------------
# Step 2: Detect existing install
# ---------------------------------------------------------------------------
step "Checking for existing installation"
FORCE=false
UPDATE=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --update) UPDATE=true ;;
  esac
done

if [[ -d "$INSTALL_DIR" && "$FORCE" == false && "$UPDATE" == false ]]; then
  echo "  FamilyBoard is already installed at $INSTALL_DIR."
  echo "  Run with --update to pull latest code, or --force to reinstall."
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 3: System packages
# ---------------------------------------------------------------------------
step "Updating apt index"
sudo apt-get update -qq

step "Installing system packages"
sudo apt-get install -y --no-install-recommends \
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Step 4: Docker group membership
# ---------------------------------------------------------------------------
step "Adding $USER to docker group"
if ! groups "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "  WARNING: You have been added to the docker group."
  echo "  You MUST log out and back in before Docker commands work without sudo."
else
  echo "  Already in docker group."
fi

# ---------------------------------------------------------------------------
# Step 4b: familyboard group + sudoers for nmcli (WiFi onboarding)
# ---------------------------------------------------------------------------
step "Creating familyboard group and granting nmcli sudo access"

if ! getent group familyboard > /dev/null 2>&1; then
  sudo groupadd --system familyboard
  echo "  Created group: familyboard"
else
  echo "  Group familyboard already exists."
fi

if ! groups "$USER" | grep -qw familyboard; then
  sudo usermod -aG familyboard "$USER"
  echo "  Added $USER to group familyboard."
else
  echo "  $USER is already in group familyboard."
fi

SUDOERS_SRC="$SCRIPT_DIR/sudoers.d/familyboard-network"
SUDOERS_DST="/etc/sudoers.d/familyboard-network"

if [[ ! -f "$SUDOERS_SRC" ]]; then
  die "sudoers file not found at $SUDOERS_SRC"
fi

sudo cp "$SUDOERS_SRC" "$SUDOERS_DST"
sudo chmod 440 "$SUDOERS_DST"
sudo chown root:root "$SUDOERS_DST"

if ! sudo visudo -c -f "$SUDOERS_DST" > /dev/null 2>&1; then
  sudo rm -f "$SUDOERS_DST"
  die "visudo validation failed — sudoers file removed for safety"
fi

echo "  sudoers rule installed and validated: $SUDOERS_DST"

# ---------------------------------------------------------------------------
# Step 5: Sub-scripts
# ---------------------------------------------------------------------------
step "Configuring log2ram"
bash "$SCRIPT_DIR/setup-log2ram.sh"

step "Configuring mDNS (avahi)"
bash "$SCRIPT_DIR/configure-mdns.sh"

step "Disabling screen blanking"
bash "$SCRIPT_DIR/disable-blanking.sh"

# ---------------------------------------------------------------------------
# Step 6: Clone or update the repo
# ---------------------------------------------------------------------------
step "Installing FamilyBoard source to $INSTALL_DIR"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  sudo git -C "$INSTALL_DIR" pull --ff-only
else
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
fi
sudo chown -R "$USER":"$USER" "$INSTALL_DIR"

# ---------------------------------------------------------------------------
# Step 7: Generate .env interactively
# ---------------------------------------------------------------------------
ENV_FILE="$INSTALL_DIR/.env"

step "Configuring environment"
if [[ -f "$ENV_FILE" && "$FORCE" == false ]]; then
  echo "  $ENV_FILE already exists — skipping generation."
  echo "  Delete it or use --force to regenerate."
else
  echo "  Generating secrets..."
  NEXTAUTH_SECRET="$(openssl rand -base64 32)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"

  echo ""
  echo "  Google OAuth credentials are OPTIONAL — you can add them later in settings."
  read -rp "  GOOGLE_CLIENT_ID (press Enter to skip): " GOOGLE_CLIENT_ID
  read -rp "  GOOGLE_CLIENT_SECRET (press Enter to skip): " GOOGLE_CLIENT_SECRET

  echo ""
  echo "  Firebase service account is OPTIONAL — only needed for FCM push notifications."
  read -rp "  FIREBASE_SERVICE_ACCOUNT_PATH (press Enter to skip): " FIREBASE_SERVICE_ACCOUNT_PATH

  # Determine the public-facing URL for OAuth callbacks
  HOSTNAME_VAL="$(hostname -f 2>/dev/null || hostname)"
  DEFAULT_URL="http://${HOSTNAME_VAL}:3000"
  read -rp "  NEXTAUTH_URL (default: ${DEFAULT_URL}): " NEXTAUTH_URL_INPUT
  NEXTAUTH_URL="${NEXTAUTH_URL_INPUT:-$DEFAULT_URL}"

  cat > "$ENV_FILE" <<EOF
# Generated by scripts/pi/install.sh
# Do not commit this file.

NEXTAUTH_URL=${NEXTAUTH_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
DATABASE_URL=file:/app/data/app.db
EOF

  if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
    echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" >> "$ENV_FILE"
  fi
  if [[ -n "$GOOGLE_CLIENT_SECRET" ]]; then
    echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" >> "$ENV_FILE"
  fi
  if [[ -n "$FIREBASE_SERVICE_ACCOUNT_PATH" ]]; then
    echo "FIREBASE_SERVICE_ACCOUNT_PATH=${FIREBASE_SERVICE_ACCOUNT_PATH}" >> "$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE"
  echo "  .env written to $ENV_FILE (mode 600)."
fi

# ---------------------------------------------------------------------------
# Step 8: Systemd units
# ---------------------------------------------------------------------------
step "Installing systemd units"

sudo cp "$SCRIPT_DIR/familyboard.service" /etc/systemd/system/familyboard.service

# User unit directory for the kiosk service
USER_SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$USER_SYSTEMD_DIR"
cp "$SCRIPT_DIR/chromium-kiosk.service" "$USER_SYSTEMD_DIR/chromium-kiosk.service"

sudo systemctl daemon-reload
sudo systemctl enable familyboard.service

# Enable user lingering so the user service starts at boot without an interactive login
sudo loginctl enable-linger "$USER"

systemctl --user daemon-reload
systemctl --user enable chromium-kiosk.service

echo "  systemd units installed and enabled."

# ---------------------------------------------------------------------------
# Step 9: Success
# ---------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "  FamilyBoard install complete!"
echo "=========================================="
echo ""
echo "  App directory : $INSTALL_DIR"
echo "  Environment   : $ENV_FILE"
echo "  System service: familyboard.service  (starts Docker Compose at boot)"
echo "  Kiosk service : chromium-kiosk.service  (user service, opens browser)"
echo "  LAN address   : http://familyboard.local:3000  (after reboot)"
echo ""
echo "  To start now (without rebooting):"
echo "    cd $INSTALL_DIR && docker compose up -d --build"
echo ""

if groups "$USER" | grep -qw docker; then
  echo "  Docker group: active."
else
  echo "  IMPORTANT: Log out and back in for Docker group membership to take effect,"
  echo "  then run: cd $INSTALL_DIR && docker compose up -d --build"
fi

echo ""
read -rp "Reboot now? [y/N] " REBOOT_ANSWER
if [[ "${REBOOT_ANSWER,,}" == "y" ]]; then
  sudo reboot
fi
