#!/bin/bash
set -euo pipefail

ENV_FILE="/opt/familyboard/.env"

# Create the file with non-secret defaults if it is missing entirely.
# This is a safety net; 00-run.sh should have written it during image build.
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'DEFAULTS'
NEXTAUTH_URL=http://familyboard.local:3000
DATABASE_URL=file:/app/data/app.db
DEFAULTS
fi

# Append NEXTAUTH_SECRET only if absent — each device gets its own random value.
if ! grep -q "^NEXTAUTH_SECRET=" "$ENV_FILE"; then
  echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> "$ENV_FILE"
fi

# Append ENCRYPTION_KEY only if absent — 64 hex chars = 32-byte AES-256-GCM key.
if ! grep -q "^ENCRYPTION_KEY=" "$ENV_FILE"; then
  echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> "$ENV_FILE"
fi

# Re-assert permissions every boot so accidental chmod/chown changes are healed.
chmod 600 "$ENV_FILE"
chown familyboard:familyboard "$ENV_FILE"
