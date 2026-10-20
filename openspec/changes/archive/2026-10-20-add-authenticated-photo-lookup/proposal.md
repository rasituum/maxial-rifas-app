# Proposal

## Why

Users need to retrieve an existing photo by its number through a web application. Access must be restricted by a shared login instead of exposing the server's photo directory publicly.

## What Changes

- Introduce a Node.js and TypeScript application with server-rendered login and search pages.
- Authenticate users with one shared username and password, with browser sessions and logout.
- Normalize a submitted number to four digits and display its matching PNG from a configurable server directory.
- Handle invalid input, missing photos, and filesystem errors explicitly.
- Protect both the search page and image responses with authentication.
- Document local operation and deployment behind HTTPS on a GCP VM.

## Capabilities

### New Capabilities

- `shared-authentication`: Shared credentials, session lifecycle, and access protection.
- `photo-lookup`: Numeric search, four-digit filename normalization, and private filesystem image delivery.

### Modified Capabilities

None; there are no existing specifications.

## Impact

The repository currently has no application code, dependencies, or tests. This change introduces the application scaffold, configuration, automated tests, and operating instructions. Photos remain on the VM filesystem. No database, upload interface, user registration, individual accounts, or GCP infrastructure provisioning is included.
