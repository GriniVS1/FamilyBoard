# Cloudflare R2 setup for OTA updates

One-time setup so `updates.familyboard.ch` serves signed update manifests and
app bundles, and so the release CI (`.github/workflows/release.yml`) can publish
to it. See `docs/ota-update-plan.md` for the why.

## Prerequisite
`familyboard.ch` must be a zone in the **same** Cloudflare account (DNS on
Cloudflare) — required to attach `updates.familyboard.ch` as an R2 custom domain.
Disable DNSSEC at the current registrar **before** switching nameservers to
Cloudflare, or resolution breaks.

## 1. Enable R2
Cloudflare dashboard → **R2**. A payment method is required even for the free
tier. Our volume stays free (10 GB storage, no egress fees).

## 2. Create the bucket
**Create bucket** → name `familyboard-updates`, jurisdiction **EU**.

## 3. Public custom domain
Bucket → **Settings → Public access → Custom Domains → Connect Domain** →
`updates.familyboard.ch`. Cloudflare provisions DNS + TLS. Objects become public
at `https://updates.familyboard.ch/<key>`. Public is fine: integrity is
guaranteed by the Ed25519 manifest signature + the bundle SHA-256, not secrecy.

## 4. Cache headers
R2 custom domains go through Cloudflare's cache. The release CI already sets
per-object `Cache-Control`:
- `*.json` / `*.json.sig` → `max-age=300` (manifest changes per release/rollback)
- `app/*.tar.gz` → `max-age=31536000, immutable` (versioned filenames)

No manual cache rule needed as long as releases go through the workflow.

## 5. API token (for CI)
**R2 → Manage R2 API Tokens → Create API token** → permission **Object Read &
Write**, scoped to `familyboard-updates` only. Copy (shown once):
Access Key ID, Secret Access Key, and your Account ID. The S3 endpoint is
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## 6. GitHub Actions secrets/vars
Repo → **Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
|---|---|---|
| `R2_ACCOUNT_ID` | secret | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | secret | from step 5 |
| `R2_SECRET_ACCESS_KEY` | secret | from step 5 |
| `R2_BUCKET` | secret | `familyboard-updates` |
| `RELEASE_PRIVATE_KEY` | secret | contents of `.release-private.pem` (the offline Ed25519 key) |
| `OTA_MIN_BASE_VERSION` | variable (optional) | override for the update floor (default `v1.1.0`) |

## 7. Bucket layout (created by the workflow)
```
updates.familyboard.ch/
├─ stable.json        + stable.json.sig
├─ beta.json          + beta.json.sig     (beta channel)
└─ app/familyboard-vX.Y.Z.tar.gz
```

## 8. Cut a release
Push a tag: `git tag v1.2.0 && git push origin v1.2.0` (or `-beta.1` → beta
channel). The workflow cross-builds arm64, signs, and uploads.

Verify:
```bash
curl -I https://updates.familyboard.ch/stable.json      # 200 + Cache-Control
node tool/sign-release.mjs verify --in <(curl -s .../stable.json)   # optional local check
```
