# Raspberry Pi Setup — FamilyBoard Wall Display

From a fresh Raspberry Pi 5 to a live, wall-mounted family dashboard in under 30 minutes.

---

## Commercial hardware bundles (vendor workflow)

This section is for the vendor (you) producing pre-flashed SD cards for the
FamilyBoard hardware bundle. Skip to "Manual setup" if you are an open-source
self-hoster bringing your own hardware.

### Build a flashable image

On your Mac or Linux build server (requires Docker, ~30 GB free):

```bash
./scripts/pi/build-image.sh v1.2.0
# Output: ./dist/familyboard-v1.2.0.img.gz
```

The script:
1. Clones `pi-gen` at the pinned Bookworm tag.
2. Injects the `scripts/pi/pi-gen-stage/stage3/00-familyboard-install/` overlay.
3. Produces a minimal Bookworm image with Docker, NetworkManager, the FamilyBoard
   repo at `/opt/familyboard`, unique secrets, and the sudoers rule for `nmcli`.
4. WiFi is **not** pre-configured — the buyer sets it at first boot.

Build takes ~20 minutes. Re-run for each release tag.

### Flash the SD card

```bash
# With Raspberry Pi Imager (recommended)
# Open Imager → "Use custom" → select familyboard-v1.2.0.img.gz
# No advanced options needed — secrets are already in the image.
# The default user is "familyboard" with a random password; SSH is enabled.

# Or with dd (Linux/macOS):
gunzip -c ./dist/familyboard-v1.2.0.img.gz | sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
```

If you want to give the buyer SSH access, use Raspberry Pi Imager's "Edit settings"
to set a known password before flashing, or document the random password generated
during the build.

### First boot expected behavior

1. Pi boots Raspberry Pi OS (Bookworm, 64-bit).
2. `familyboard.service` starts Docker Compose which builds and starts the container
   (~60–90 s on first boot while the image is built).
3. `chromium-kiosk.service` opens Chromium in fullscreen kiosk mode once the app
   is healthy.
4. The buyer sees the WiFi-onboarding step at `/setup/network`. They pick their
   home network via the touchscreen (on-screen keyboard) or scan the QR code to
   join the temporary `FamilyBoard-Setup` hotspot from their phone and configure
   WiFi there.
5. Once connected, the normal setup wizard continues (`/setup`).

### Technical notes

- The container runs with `network_mode: host` and `cap_add: NET_ADMIN`.
- `/usr/bin/nmcli` and `/var/run/dbus` are bind-mounted from the host so the
  app can call `sudo nmcli` to manage WiFi without installing NetworkManager inside
  the Docker image.
- The `%familyboard` group has passwordless `sudo /usr/bin/nmcli` via
  `/etc/sudoers.d/familyboard-network`.

---

## Manual setup on an existing Pi

> For open-source self-hosters who bring their own hardware and want to run the
> install script on a Pi they have already set up.

---

## 1. What you need

**Hardware**

| Item | Notes |
|---|---|
| Raspberry Pi 5 (8 GB) | 4 GB works; 8 GB leaves headroom for Docker |
| 32 GB+ Class-10 / A2 SD card | Samsung Endurance or SanDisk Max Endurance last longer in always-on use |
| Official Pi 5 power supply (27 W USB-C) | Cheap chargers cause undervoltage throttling |
| 21–27" HDMI touchscreen | See recommendations below |
| HDMI cable (full-size, ≤ 1 m) | Pi 5 has 2× micro-HDMI; use an adapter or micro-HDMI cable |
| Optional: UPS HAT | PiSugar 3 Plus or Geekworm X1200 for graceful shutdown on power loss |
| Optional: VESA mount / enclosure | Pi 5 fits most 75×75 mm VESA cases |

**Tested touchscreen recommendations**

- **WaveShare 21.5" HDMI IPS Touch** (model 21.5inch-HDMI-LCD-H) — 1920×1080, USB-HID touch, no driver needed
- **WaveShare 15.6" HDMI IPS Touch** — compact option, same USB-HID touch
- **Elecrow 10.1"** — good for kitchen counter (smaller footprint)
- **Official Raspberry Pi 7" Touch** — works but 800×480 is cramped at 1080p scale

All USB-HID touch screens work out of the box on Raspberry Pi OS. Avoid screens that require proprietary USB-to-GPIO touch drivers.

---

## 2. Flash the OS

1. Download **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Select device: **Raspberry Pi 5**
3. Select OS: **Raspberry Pi OS (64-bit)** — the full Desktop version, not Lite
4. Select your SD card
5. Click the gear icon (Advanced Options) **before** writing:
   - Set hostname: `familyboard`
   - Set username + password (remember these — you'll SSH in with them)
   - Configure WiFi SSID + password if using wireless
   - Enable SSH (Use password authentication)
6. Write the card, insert it into the Pi, connect display + power.

> Raspberry Pi OS Lite (no desktop) does not include an X server, which the Chromium kiosk requires. Use the full Desktop image.

---

## 3. First boot + SSH

Boot takes about 60 seconds. Find the Pi's IP address via:

- Your router's admin page (look for `familyboard` or `raspberrypi`)
- Or on another machine: `arp -a | grep -i raspberry` or `ping familyboard.local`

Connect:

```bash
ssh <your-username>@familyboard.local
# or
ssh <your-username>@<ip-address>
```

Accept the host-key fingerprint when prompted.

---

## 4. One-line install

Paste this into the SSH session:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/GriniVS1/FamilyBoard/main/scripts/pi/install.sh)
```

The script takes 3–10 minutes depending on your SD card and internet speed. It will:

1. Verify you're on an ARM (aarch64 / armv7l) host — refuses otherwise.
2. Check whether FamilyBoard is already installed (idempotent — safe to re-run).
3. Install: `docker`, `docker-compose-plugin`, `chromium-browser`, `unclutter`, `avahi-daemon`, `log2ram`, `git`, `curl`, `jq`.
4. Add your user to the `docker` group.
5. Enable `log2ram` — `/var/log` lives in RAM, synced hourly to SD, to extend card life.
6. Set hostname to `familyboard` and enable Avahi so the board is reachable at `familyboard.local` on your LAN.
7. Disable X11 screen blanking and DPMS so the display never goes dark from the OS (the app handles its own screensaver).
8. Clone the FamilyBoard repo to `/opt/familyboard`.
9. Generate `/opt/familyboard/.env` interactively (secrets are generated; you can optionally enter Google OAuth credentials now or later).
10. Install and enable the two systemd units (`familyboard.service` + `chromium-kiosk.service`).
11. Offer to reboot.

---

## 5. Setting up `.env`

The install script generates `/opt/familyboard/.env` with auto-generated secrets. You can review or edit it at any time:

```bash
nano /opt/familyboard/.env
```

| Variable | What it is | Where to get it |
|---|---|---|
| `NEXTAUTH_URL` | Public-facing base URL of the app | Set to `http://familyboard.local:3000` for local-only, or your domain if you expose externally |
| `NEXTAUTH_SECRET` | Random 32-byte base64 string — signs session cookies | Auto-generated by install script |
| `ENCRYPTION_KEY` | 32-byte hex key — encrypts Google refresh tokens at rest | Auto-generated by install script |
| `DATABASE_URL` | Path to the SQLite database inside the container | Leave as `file:/app/data/app.db` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | See below |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | See below |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to FCM service account JSON | Only needed for mobile push notifications |

**Getting Google OAuth credentials**

1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID**, type: *Web application*
3. Authorized redirect URI: `http://familyboard.local:3000/api/auth/callback/google`
   (use your actual hostname or IP if not using mDNS)
4. Enable the **Google Calendar API** for the same project
5. Copy the client ID and secret into `.env`

Google credentials are optional for initial setup — you can connect members to Google Calendar after the family is created, from the Settings page.

---

## 6. Reboot + first launch

After the install script completes and you reboot:

- `familyboard.service` starts Docker Compose, which pulls the image and starts the container (allow 1–3 min on first boot while the image is built)
- `chromium-kiosk.service` polls `http://localhost:3000/api/health` every 2 seconds until the app responds, then opens Chromium in fullscreen kiosk mode
- The browser lands on `/setup` — the first-run wizard that creates your family, members, and admin PIN

To check service status:

```bash
# Docker app
sudo systemctl status familyboard.service

# Kiosk browser (runs as your user)
systemctl --user status chromium-kiosk.service

# Logs
sudo journalctl -u familyboard.service -f
journalctl --user -u chromium-kiosk.service -f
```

---

## 7. Common issues

**Chromium kiosk does not start / stays black**

- Check that user lingering is enabled: `loginctl show-user "$USER" | grep Linger`
  - If `Linger=no`: `sudo loginctl enable-linger "$USER"` then reboot
- Verify the graphical session is running: `echo $DISPLAY` should return `:0`
- Check the health loop: `curl -v http://localhost:3000/api/health`
  - If it times out, Docker may still be building the image — wait and retry

**`docker: permission denied`**

- The install script adds you to the `docker` group, but group membership only takes effect after a new login session
- Fix: `sudo systemctl stop familyboard.service && newgrp docker` then restart, or just reboot

**Screen goes blank after a few minutes**

- Run `bash /opt/familyboard/scripts/pi/disable-blanking.sh` then reboot
- Also check `~/.config/lxsession/LXDE-pi/autostart` contains the three `@xset` lines

**`avahi-daemon` not resolving `familyboard.local`**

- Ensure avahi is running: `sudo systemctl status avahi-daemon`
- mDNS resolution on Windows requires Bonjour (installed with iTunes or as a standalone package from Apple)
- On Linux clients, install `avahi-daemon` and `libnss-mdns`

**Google OAuth redirect URI mismatch**

- The redirect URI in Google Cloud Console must exactly match `NEXTAUTH_URL` + `/api/auth/callback/google`
- If you changed the hostname, update both the `.env` and the Google Cloud Console entry

---

## 8. Updating

```bash
cd /opt/familyboard
git pull
docker compose up -d --build
```

The `--build` flag rebuilds the image to pick up dependency updates. Running containers are replaced with zero manual steps. The SQLite database and uploaded photos in `./data/` are preserved (bind-mounted volume).

To update with the install script (re-runs idempotently):

```bash
bash /opt/familyboard/scripts/pi/install.sh --update
```

---

## 9. Backups

Everything that matters is in `/opt/familyboard/data/`:

- `app.db` — the SQLite database (all family data, events, chores, notes, etc.)
- `uploads/` — photo screensaver images

**Manual backup**

```bash
# On the Pi — copy data to a USB drive or NAS
sudo cp -r /opt/familyboard/data /media/usb/familyboard-backup-$(date +%Y%m%d)
```

**Automated daily backup via cron**

```bash
crontab -e
```

Add:

```
# Daily backup of FamilyBoard data at 3:00 AM
0 3 * * * rsync -a /opt/familyboard/data/ /media/usb/familyboard-backup/ >> /var/log/familyboard-backup.log 2>&1
```

Replace `/media/usb/familyboard-backup/` with your target (NAS, external drive, or remote host via `rsync -a --rsh=ssh`).

**Restore**

```bash
sudo systemctl stop familyboard.service
sudo cp -r /media/usb/familyboard-backup/. /opt/familyboard/data/
sudo systemctl start familyboard.service
```
