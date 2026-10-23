# photo-upload Specification

## Purpose

Allow administrators to upload phone photos, optimize them for private numeric lookup, and safely replace existing images with explicit consent.

## Requirements

### Requirement: Single native photo picker
The system SHALL provide one administrator-only upload form with one number field, one native file input, and one submit action. The interface SHALL NOT provide separate camera and library forms or force capture mode. The browser and operating system SHALL determine the source choices available through the native picker.

#### Scenario: Single upload form
- **WHEN** an administrator opens the upload page
- **THEN** one upload form provides a number field, a file selector, and an upload button

#### Scenario: Mobile native source choices
- **WHEN** an administrator activates the file selector on a mobile browser that offers camera and photo-library sources
- **THEN** the administrator can choose either source through the native picker and submit the resulting photo using the same form

#### Scenario: Standard file selection
- **WHEN** the native picker does not offer camera capture
- **THEN** the administrator can still select an existing photo using the same file input

### Requirement: Number and input validation
The system SHALL accept exactly one PNG, JPEG/JPG, or HEIC/HEIF photo per upload, up to and including 30,000,000 bytes. It SHALL validate decoded content rather than trust names or MIME headers. The number SHALL follow existing one-to-four-digit normalization. Invalid submissions SHALL leave stored photos unchanged and show an actionable error.

#### Scenario: Supported inputs
- **WHEN** an administrator submits a decodable photo in any supported format within the input limit with number 7, 07, or 0007
- **THEN** the upload targets 0007.png regardless of the source filename

#### Scenario: File size boundary
- **WHEN** an original exceeds 30,000,000 bytes
- **THEN** the upload is rejected as too large without changing stored photos

#### Scenario: Invalid or deceptive content
- **WHEN** the number is invalid, the file is missing, multiple files are submitted, or content is corrupt or unsupported despite an allowed extension
- **THEN** the upload is rejected with a relevant validation message

### Requirement: Image normalization
The system SHALL apply encoded image orientation, preserve displayed aspect ratio without cropping or enlargement, and convert accepted content into a single PNG image. Output SHALL omit source EXIF and location metadata. For a multi-image HEIF container, the primary still photo SHALL be used.

#### Scenario: Portrait phone photo
- **WHEN** a phone photo uses orientation metadata
- **THEN** the stored PNG displays upright with its oriented proportions preserved and without source EXIF or location metadata

#### Scenario: Multi-image phone container
- **WHEN** a valid HEIF container includes a primary photo and auxiliary images
- **THEN** only the primary still photo is stored as PNG

### Requirement: Output size limit
Every newly published upload SHALL be strictly smaller than 100,000 bytes. Processing SHALL attempt dimension reduction before colour reduction while preserving proportions without cropping. If bounded processing cannot produce compliant output, the system SHALL reject the upload and preserve any existing photo.

#### Scenario: Successful optimization
- **WHEN** a large supported phone image can be optimized within processing limits
- **THEN** the saved file is a decodable PNG of at most 99,999 bytes with proportions preserved

#### Scenario: Processing failure
- **WHEN** decoding, optimization, or the processing time limit fails
- **THEN** no new photo is published and an existing photo remains unchanged

### Requirement: Explicit replacement consent
If a target photo exists, the system SHALL show a replacement confirmation identifying its number before changing it. Confirmation SHALL be bound to the administrator session, prepared image, and existing target version. Cancellation, expiration, or a changed target SHALL prevent replacement; a changed target SHALL require renewed confirmation.

#### Scenario: Confirm replacement
- **WHEN** the administrator confirms replacement of the unchanged photo 0007
- **THEN** the prepared photo replaces 0007.png

#### Scenario: Cancel or expire
- **WHEN** the administrator cancels or the pending confirmation expires
- **THEN** the existing photo stays unchanged and the pending image is discarded

#### Scenario: Concurrent modification
- **WHEN** the target changes after confirmation is offered
- **THEN** the stale confirmation cannot overwrite it and a new confirmation is required

### Requirement: Atomic private publication
Publication SHALL make only a fully processed PNG available at the normalized filename. Readers SHALL see a complete previous or new photo during replacement. Temporary files SHALL remain private and be cleaned up after failure, cancellation, expiry, or restart. Source filenames and symbolic links SHALL NOT permit writes outside the configured photo directory.

#### Scenario: First upload
- **WHEN** processing and publication succeed for an absent number
- **THEN** authenticated lookup can immediately retrieve the completed PNG under its four-digit filename

#### Scenario: Storage failure
- **WHEN** a write or commit fails
- **THEN** the application reports failure without truncating or removing an existing target

#### Scenario: Path manipulation
- **WHEN** a source filename contains path components or a target is a symbolic link
- **THEN** no file outside the photo directory is written and an unsafe target is rejected

### Requirement: Bounded upload work
The system SHALL bound upload bytes, decoded pixels, concurrent processing, processing duration, and pending confirmations. Over-capacity requests SHALL receive a retryable error. Invalid or rejected uploads SHALL NOT be published or expose source data to consultation users.

#### Scenario: Capacity exceeded
- **WHEN** the upload processing slot or pending-image capacity is exhausted
- **THEN** the request is rejected with a retryable error without changing existing photos

#### Scenario: Oversized decoded image
- **WHEN** compressed content expands beyond the configured pixel limit
- **THEN** processing stops and the upload is rejected without publication
