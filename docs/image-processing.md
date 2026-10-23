# Image processing and native installation

Uploads accept one PNG, JPEG/JPG, or HEIC/HEIF original of at most **30,000,000 bytes**. Stored output is PNG and must be **strictly less than 100,000 bytes** (99,999 maximum). The server validates actual decoded content, not the filename or MIME header. AVIF, SVG, GIF and corrupt images are rejected.

## Native prerequisites

The application pins Sharp 0.35.5 and builds it against **libvips 8.18.7**, the minimum native version required by that Sharp release. A plain npm installation uses a prebuilt library without HEIC/HEVC support and is insufficient. The application deliberately fails startup if the real `assets/heic-probe.heic` cannot be decoded. Do not disable this check.

On Ubuntu 26.04, install build prerequisites and HEVC decoding support:

```sh
sudo apt-get update
sudo apt-get install --no-install-recommends build-essential meson ninja-build pkg-config \
  libglib2.0-dev libexpat1-dev libjpeg-turbo8-dev libpng-dev zlib1g-dev \
  libheif-dev libheif-plugin-libde265 libimagequant-dev libexif-dev curl xz-utils
```

Use an operator-owned build directory to download the upstream release, then install the native library to a versioned prefix:

```sh
curl -fL https://github.com/libvips/libvips/releases/download/v8.18.7/vips-8.18.7.tar.xz -o vips-8.18.7.tar.xz
tar -xf vips-8.18.7.tar.xz
meson setup vips-build vips-8.18.7 --prefix=/opt/maxial-vips-8.18.7 \
  -Dauto_features=disabled -Dcplusplus=true -Djpeg=enabled -Dpng=enabled \
  -Dheif=enabled -Dimagequant=enabled -Dexif=enabled -Dzlib=enabled \
  -Dintrospection=disabled -Dexamples=false
ninja -C vips-build -j 4
sudo ninja -C vips-build install
```

Set `PKG_CONFIG_PATH` to the installed `vips-cpp.pc` directory and `LD_LIBRARY_PATH` to the directory containing `libvips-cpp.so`. On Ubuntu amd64 these are normally:

```sh
export PKG_CONFIG_PATH=/opt/maxial-vips-8.18.7/lib/x86_64-linux-gnu/pkgconfig
export LD_LIBRARY_PATH=/opt/maxial-vips-8.18.7/lib/x86_64-linux-gnu
export SHARP_FORCE_GLOBAL_LIBVIPS=1
pkg-config --modversion vips-cpp
npm ci --ignore-scripts
npm explore sharp -- npm run build
npm run build
npm test
```

Adjust `lib/x86_64-linux-gnu` if Meson uses another libdir on the target architecture. Keep the native runtime available to the service through its environment or an operator-managed dynamic loader configuration. Set `LIBHEIF_PLUGIN_PATH` only if decoder plugins are installed outside the platform's normal plugin directory. No HEVC encoder is needed in production. Keep OS codec packages patched independently of npm audit.

The committed lockfile pins Sharp, Busboy, and the development tools (`node-addon-api` and `node-gyp`) required for explicit native compilation. Build the native addon and TypeScript before pruning development dependencies. Ship `assets/` beside `dist/`, and install releases built for the VM's architecture and Node version.

## Processing policy

Apply HEIF primary-image selection and encoded phone orientation before resizing. Preserve proportions within integer-pixel rounding, never crop or enlarge, preserve PNG transparency, normalize to sRGB, and strip source EXIF/GPS metadata. Originals are discarded after processing.

Try lossless PNG encoding at long-edge bounds 2048, 1600, 1280, then 1024. If necessary, try 256/128/64-colour palettes at long-edge bounds 1024, 768, 512, then 320. Stop at the first output below the byte ceiling. The small-file goal can substantially reduce photo detail. A conversion failure does not publish anything.

Bound work to one active upload/processing operation, 100 million decoded pixels, 120 seconds for receiving the body, and 60 seconds in a killable image-processing child. Concurrent attempts receive a retryable 503. The total HTTP body ceiling is 30,065,536 bytes to permit multipart overhead.

## Staging and publication

`.uploads` inside `PHOTO_DIRECTORY` is private (0700), with random exclusive temporary files (0600). Never expose it through the proxy. The server cleans its recognized temporary files after errors, cancellation, logout, expiry, and restart; it does not delete arbitrary operator files.

An absent target is created atomically without overwrite. Existing photos require a separate confirmation page with current and prepared previews. Tokens are single-use, tied to the current session, processed file, target number, and current target hash. Pending images expire after ten minutes or at session expiry, whichever comes first; there are at most ten pending globally and one per session. If the target changes, review and confirm again. Successful replacement atomically renames a complete file over the old file; failures before commit leave the old photo intact.

Run exactly one application process. Pause the service before operator file imports; other concurrent filesystem writers are unsupported. Back up numbered photos using your normal operating procedures. Uploads do not retain image history.

## iPhone Safari rollout checklist

Automated browser tests verify one upload form with one number field, one file selector, and one submit button, without a forced capture mode, plus file ingestion, private previews and confirmation. Before production, check on a physical iPhone:

- Sign in as administrator and activate **Choose a file**. If the native picker offers a camera source, choose it, take a portrait photo and upload it with a number using the same form.
- Activate the same **Choose a file** selector and select JPEG and original HEIC photos from the library or Files. Browser conversion to JPEG is acceptable, but separately test an original HEIC file through Files.
- Confirm upright orientation, no cropping, and successful lookup of the normalized number.
- Verify cancellation, confirmation, and the ordinary consultation account's lack of upload access.

The file input has no `capture` attribute. The browser and operating system determine which sources the native picker offers; a camera choice is not guaranteed on every device. Standard file selection remains available. Original HEIC decoding is independently covered by native tests.
