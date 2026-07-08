---
title: "DELETE /api/photos/[id] never unlinks the file on disk — prefix mismatch means only the DB row is removed"
severity: P2
area: backend
owner: backend-developer
status: fixed
slice: mobile photo library (shared read/write photos lib)
created: 2026-07-08T19:33:19Z
---

## Reproduction

1. `src/app/api/photos/route.ts` `POST` stores the photo path with the `/api/photos-stream/`
   prefix:
   ```ts
   path: `/api/photos-stream/${filename}`,
   ```
2. `src/app/api/photos/[id]/route.ts` `DELETE` derived the filename by stripping a **different**
   prefix:
   ```ts
   const filename = photo.path.startsWith("/photos-stream/")
     ? photo.path.slice("/photos-stream/".length)
     : null;
   ```
3. Every real row's `path` starts with `/api/photos-stream/...`, not `/photos-stream/...`, so
   `startsWith("/photos-stream/")` is always `false` for actual data — `filename` is always
   `null`, the `unlink()` branch never runs, and the file silently stays on disk forever while the
   DB row (and therefore the UI listing) disappears.

## Expected

Deleting a photo removes both the `Photo` row and the underlying file in `getPhotosDir()`.

## Actual

Only the DB row is removed. The file is orphaned on every delete, permanently, on every install —
this is a slow disk-space leak on the Pi's SD card/eMMC with no visible symptom until storage
fills up.

## Evidence

```text
$ grep -n "photos-stream" src/app/api/photos/route.ts src/app/api/photos/\[id\]/route.ts
src/app/api/photos/route.ts:      path: `/api/photos-stream/${filename}`,
src/app/api/photos/[id]/route.ts:  const filename = photo.path.startsWith("/photos-stream/")
```

Confirmed live: uploaded a photo via `curl -F` to `POST /api/photos`, noted the returned
`path` (`/api/photos-stream/<hex>.png`) and the file appearing in `data/photos/`, then called
`DELETE /api/photos/<id>` — before the fix the DB row vanished but `ls data/photos/` still
showed the file; after the fix the file is gone too.

## Fix

Extracted the prefix-stripping into `extractPhotoFilename()` in the new shared
`src/lib/photos-store.ts`, which accepts **both** the current `/api/photos-stream/` prefix and
the historical `/photos-stream/` form (in case any pre-existing DB rows on a running install were
written before the route moved under `/api/`), and still requires the result to match
`PHOTO_FILENAME_RE` before unlinking — same filename-validation rigor as before, just matching
the prefix that's actually written.

`deletePhotoById()` (also in `src/lib/photos-store.ts`) is now the single code path used by both
`DELETE /api/photos/[id]` (wall) and the new `DELETE /api/mobile/photos/[id]` (mobile): it looks
up the photo, 404s as `PHOTO_NOT_FOUND` if missing (or, for mobile, if it belongs to a different
family), deletes the DB row, then unlinks the file via `extractPhotoFilename` +
`unlinkPhotoFile()` (ENOENT swallowed, any other error logged without leaking a stack trace or
path outside the photos dir).

### Verification

- Live smoke (see PR/task notes): uploaded a photo, confirmed file on disk, called wall
  `DELETE /api/photos/<id>`, confirmed both the DB row and the disk file were gone
  (`ls data/photos/` no longer lists it). Repeated for `DELETE /api/mobile/photos/<id>`.
- `node node_modules/typescript/lib/tsc.js --noEmit` clean.
- Prod build (`NEXT_PHASE=phase-production-build NODE_ENV=production next build`) succeeds.
