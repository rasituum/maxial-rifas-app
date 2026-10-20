# Spec Delta

## Purpose

Restrict photo searches and image delivery to visitors authenticated with the application's shared credentials.

## ADDED Requirements

### Requirement: Shared account login
The system SHALL provide a login form for one server-configured shared username and password. Valid credentials SHALL create an authenticated browser session; invalid credentials SHALL produce a generic error without granting access.

#### Scenario: Successful login
- **WHEN** a visitor submits the configured username and password
- **THEN** a new authenticated session is established and the visitor reaches the search page

#### Scenario: Invalid credentials
- **WHEN** a visitor submits an incorrect username or password
- **THEN** the login form displays the same generic failure message and no authenticated session is created

### Requirement: Protected resources
The system SHALL require a valid session for the search page and every photo response, including direct image requests. Unauthenticated access SHALL redirect to login without returning image bytes.

#### Scenario: Direct image access without authentication
- **WHEN** a visitor without a valid session requests an existing image URL
- **THEN** the response redirects to login and contains no photo content

#### Scenario: Search access without authentication
- **WHEN** a visitor without a valid session opens the search page
- **THEN** the response redirects to login

### Requirement: Session lifecycle
The system SHALL provide logout that invalidates the current session. Sessions SHALL expire after eight hours and SHALL NOT be accepted after server restart. Production session cookies SHALL use Secure, HttpOnly, and SameSite=Lax attributes. Protected responses SHALL prohibit caching.

#### Scenario: Logout
- **WHEN** an authenticated visitor logs out and requests a protected resource again
- **THEN** the former session no longer grants access

#### Scenario: Expiration or restart
- **WHEN** a session is eight hours old or its issuing server has restarted
- **THEN** a protected request requires a new login

#### Scenario: Production response privacy
- **WHEN** login succeeds over production HTTPS and a protected resource is returned
- **THEN** the session cookie has the required security attributes and the protected response uses Cache-Control: no-store

### Requirement: Login abuse and request protection
The system SHALL limit repeated login attempts per client address and reject cross-origin login and logout submissions. Secrets and submitted passwords SHALL NOT appear in application logs or responses.

#### Scenario: Repeated attempts
- **WHEN** a client submits more than ten login attempts within fifteen minutes
- **THEN** subsequent attempts receive HTTP 429 until the window expires

#### Scenario: Cross-origin submission
- **WHEN** a login or logout submission originates from a different origin
- **THEN** the system rejects the submission without changing authentication state
