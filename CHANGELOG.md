# Changelog

## 1.2.0 — 2026-10-16
- Discover all registered OneComme frames, including disabled/unknown-site frames.
- Add per-frame rules keyed by stable IDs, with inheritance from site defaults.
- Preserve rules across renames and retain dormant rules for removed frames.
- Refresh frame names/lists without discarding unsaved voice selections.
- Display native external engine settings and document native integration steps.
- Read only the default engine name from config; omit stream URLs/config from status.
- Add frame-routing, privacy, inheritance and UI lifecycle checks. Real frame playback remains unverified.

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
