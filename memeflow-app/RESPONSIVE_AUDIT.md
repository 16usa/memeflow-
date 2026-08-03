# Responsive audit

Validated viewport widths: 320, 390, 430, 768, 1024, 1366 and 1920 CSS pixels.

Fixes applied:
- Repaired the 821–1180 px cascade conflict that re-enabled the three-column desktop workspace on tablets.
- Inspector now spans the available content width instead of overflowing beyond the viewport.
- Added `min-width:0` containment to workspace children and internal rows.
- Increased mobile action and chart controls to practical touch sizes.
- Preserved the single-column mobile flow and desktop three-rail layout.

Automated geometry checks confirm no horizontal document overflow at the tested widths after the patch.
- Tablet portrait (821–1024 px) now uses a full-width canvas with compact bottom navigation instead of a compressed desktop sidebar.
- Compact desktop inspector content wraps at 1181–1450 px, preventing its internal cards from exceeding the rail width.
