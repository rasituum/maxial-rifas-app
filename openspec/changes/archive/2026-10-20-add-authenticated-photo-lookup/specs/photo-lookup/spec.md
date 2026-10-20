# Spec Delta

## Purpose

Allow authenticated visitors to find and view pre-uploaded server photos using their numeric identifiers.

## ADDED Requirements

### Requirement: Numeric search and normalization
The system SHALL provide a number search form. After trimming surrounding whitespace, input SHALL contain one to four ASCII digits representing a value from 0 through 9999. Leading zeros SHALL be insignificant, and filenames SHALL contain exactly four digits followed by .png.

#### Scenario: Equivalent identifiers
- **WHEN** an authenticated visitor searches for 7, 07, or 0007
- **THEN** each search selects 0007.png

#### Scenario: Boundaries
- **WHEN** an authenticated visitor searches for 0 or 9999
- **THEN** the system selects 0000.png or 9999.png respectively

#### Scenario: Surrounding whitespace
- **WHEN** an authenticated visitor submits " 42 "
- **THEN** the system selects 0042.png

#### Scenario: Invalid search
- **WHEN** input is empty, contains non-digit characters, or contains more than four digits
- **THEN** the page displays a validation error and performs no photo lookup

### Requirement: Display existing photo
The system SHALL display the matching photo below the search form when a readable PNG exists in the configured server directory. Image responses SHALL use image/png and require authentication.

#### Scenario: Successful lookup
- **WHEN** an authenticated visitor submits 42 and 0042.png exists
- **THEN** the result page displays that image and keeps the form available for another search

### Requirement: Missing and unavailable photos
The system SHALL distinguish an absent photo from an unexpected read failure. Missing photos SHALL produce a clear not-found message; unexpected failures SHALL produce a generic availability message without exposing filesystem paths. Direct missing-image requests SHALL return HTTP 404 and unexpected read failures HTTP 500.

#### Scenario: Missing photo
- **WHEN** a valid identifier has no corresponding file
- **THEN** the search page reports that no photo exists for the number

#### Scenario: Unreadable photo
- **WHEN** the matching file exists but cannot be read
- **THEN** the visitor sees a generic availability error without internal path details

### Requirement: Filesystem confinement
The system SHALL serve photos only from the configured directory and SHALL reject access outside it, including through symbolic links. The directory SHALL NOT be exposed by public static hosting or directory listing.

#### Scenario: Traversal input
- **WHEN** a request supplies ../secret or an encoded path separator as an identifier
- **THEN** no file outside the photo directory is returned

#### Scenario: Escaping symbolic link
- **WHEN** a matching filename is a symbolic link to a file outside the configured directory
- **THEN** the system does not return the linked file
