# Changelog

## 1.1.0 — 2026-10-16
- Add per-site normal and Japanese voice selectors, with an option to use the normal voice for all text.
- Add persistent settings, voice discovery and immediate renderer updates.
- Carry site metadata per utterance; identical queued text from different sites remains separate.
- Bypass external engines and retain legacy Japanese voice settings.
- Add routing, persistence, error and cleanup tests. Original switching is user-verified; new per-site playback remains unverified.

## 1.0.1 — 2026-10-16
- Prepare the experimental public distribution, MIT license, installation guide and standalone tests.
- Add Windows CI and public package metadata. Keep the original plugin UID for existing installations.
- Real OneComme playback remains unverified.
