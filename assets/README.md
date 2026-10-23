# HEIC capability probe

`heic-probe.heic` is a synthetic 64x32 gradient created for this project, not a user photo. It contains real HEVC-compressed pixels so startup can verify the actual HEIC decoder. Include this directory alongside `dist` in every release.

The fixture, `test/fixtures/primary-second.heic`, and `test/fixtures/oriented.heic` are dedicated to the public domain under CC0-1.0. They were generated with `scripts/generate-heic-fixture.c`, libheif 1.21.2 and x265 4.1. No third-party photographic content is included.

The second fixture contains two top-level photos; the second is primary and has an alpha auxiliary image. The third contains a 90-degree phone-style orientation transformation. Regeneration requires libheif development headers and an x265 encoder plugin; production requires only HEVC decoding.

```sh
cc scripts/generate-heic-fixture.c -o /tmp/maxial-heic-generator $(pkg-config --cflags --libs libheif)
/tmp/maxial-heic-generator assets/heic-probe.heic 1
/tmp/maxial-heic-generator test/fixtures/primary-second.heic 2
/tmp/maxial-heic-generator test/fixtures/oriented.heic 1 rotated
```
