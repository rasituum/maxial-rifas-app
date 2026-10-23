# Proposal

## Why

Administrators need to add phone photos through the web interface instead of copying files onto the VM. Uploads must preserve private access, protect existing photos, and produce small images compatible with numeric lookup.

## What Changes

- Add a second shared account with administrator rights while retaining the existing consultation account and login form.
- Provide one administrator-only upload form with a number field and a single native file picker; the browser and operating system determine available camera and library choices.
- Accept PNG, JPEG/JPG, and HEIC/HEIF originals up to 30 MB and validate actual image content.
- Apply phone orientation, convert to PNG, preserve proportions without cropping, and reduce dimensions before colours until output is strictly below 100 kB.
- Publish images under the existing four-digit filename convention, with explicit confirmation before replacement and no loss of the old image on failure.
- Update VM storage permissions, native image-codec installation, configuration, and tests.

## Capabilities

### New Capabilities

- `photo-upload`: Administrator upload interface, input validation, image processing, safe publication, and replacement confirmation.

### Modified Capabilities

- `shared-authentication`: Support distinct consultation and administrator credentials, session roles, and administrator-only access.

## Impact

Affected areas include `src/config.ts`, `src/app.ts`, `src/state.ts`, `src/views.ts`, filesystem helpers, tests, README, and systemd deployment configuration. Proposed dependencies are a streaming multipart parser and Sharp with a system libvips build supporting HEIC/HEVC decoding. No database, external image service, individual user accounts, batch uploads, gallery, deletion, image history, or GCP infrastructure provisioning is included. Existing photos are not recompressed; lookup behavior remains unchanged.
