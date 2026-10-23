# Spec Delta

## MODIFIED Requirements

### Requirement: Shared account login
The system SHALL provide one login form for two server-configured shared accounts with distinct usernames: consultation and administrator. Valid credentials SHALL create a session carrying the matching role. Invalid credentials SHALL produce a generic error without granting access. Both roles SHALL reach the search page after login.

#### Scenario: Successful login
- **WHEN** a visitor submits the configured username and password
- **THEN** a new authenticated session is established and the visitor reaches the search page

#### Scenario: Invalid credentials
- **WHEN** a visitor submits an incorrect username or password
- **THEN** the login form displays the same generic failure message and no authenticated session is created

#### Scenario: Administrator login
- **WHEN** a visitor submits the configured administrator username and password
- **THEN** a new administrator session is established and the visitor reaches the search page with access to uploading

### Requirement: Login abuse and request protection
The system SHALL limit repeated login attempts per client address and reject cross-origin login, logout, upload, and replacement submissions. Secrets and submitted passwords SHALL NOT appear in application logs or responses.

#### Scenario: Repeated attempts
- **WHEN** a client submits more than ten login attempts within fifteen minutes
- **THEN** subsequent attempts receive HTTP 429 until the window expires

#### Scenario: Cross-origin submission
- **WHEN** a login or logout submission originates from a different origin
- **THEN** the system rejects the submission without changing authentication state

#### Scenario: Cross-origin upload
- **WHEN** an upload or replacement confirmation originates from a different origin
- **THEN** the system rejects it without publishing or replacing any photo

## ADDED Requirements

### Requirement: Administrator authorization
The system SHALL require an administrator session for upload pages, upload requests, and replacement confirmation. Consultation users SHALL retain search and image access but receive HTTP 403 for administrator resources. Unauthenticated visitors SHALL be redirected to login. Authorization SHALL be checked server-side before file parsing or processing.

#### Scenario: Consultation access denied
- **WHEN** a consultation user requests an upload page, submits a file, or confirms a replacement
- **THEN** the server returns HTTP 403 without storing or processing the submitted photo

#### Scenario: Anonymous upload
- **WHEN** a visitor without a valid session requests an administrator resource
- **THEN** the response redirects to login without accepting the upload

#### Scenario: Administrator retains consultation access
- **WHEN** an administrator searches a number or requests its image
- **THEN** the existing protected lookup behavior remains available
