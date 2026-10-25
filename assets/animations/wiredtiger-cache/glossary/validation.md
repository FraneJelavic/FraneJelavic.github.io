# Delivery verification: v001

Verified on 25 October 2026. The adjacent MP4 manifest records exact hashes and media measurements.

| Check | Result | Evidence |
| --- | --- | --- |
| Story and scope | PASS | The seven original beats are preserved. Journal records and page data are separate; checkpoint keeps a clean cached page; dirty-page eviction writes before freeing memory; pinned pages are skipped; trigger precedes foreground work and client delay. |
| Media | PASS | 49.00 seconds, 1600 × 900, 30 fps, H.264, yuv420p, no audio streams, 1,470 decoded frames. Export includes a complete FFmpeg decode with errors treated as failures. |
| Source identity | PASS | SHA-256 hashes of `scene.js`, `runtime.js`, and the MP4 match the final export manifest. HTML was rebuilt from the same sources and starts in the matching dark theme. |
| Determinism | PASS | 72 repeated frame checks: nine checkpoint times, four sizes, light/dark themes. |
| Authored visuals | PASS | Inspected opening, dirty state, journal arrival, a page in transit, background eviction result, both checkpoint/eviction outcomes, trigger, and final hold. Reviewed all seven chapters at 360 × 640, including light mode. |
| Encoded visuals | PASS | Inspected PNG frames decoded from the actual MP4 at 0, 2, 12, 17, 18.5, 24.5, 26, 33.5, 39.5, 46, and 48.5 seconds. Caption contrast, connectors, arrival-before-state-change, skipped pinned page, branch results, and final hold checked. |
| Browser controls | PASS | In-app browser: play advances time, pause stops playback, scrub to 33.5s and 39.5s changes the chapter, replay returns to the start, light/dark switching changes the rendered theme. |
| Responsive HTML | PASS | Desktop viewBox 960 × 540; at a 390 × 844 viewport, the scene reflows to 360 × ~718. Document width 375px, no horizontal overflow. Mobile trigger state inspected by browser screenshot. |
| Article integration | PASS | Hugo draft build succeeds. Article loads the page-resource MP4 with native controls and a caption. Browser reports duration 49s and readyState 4. Native MP4 playback starts successfully. Only the glossary shortcode was changed in the existing article body. |
| Independent rebuild | PASS | Copied the complete source folder to a clean directory; its included helper passed checks and rebuilt HTML with existing dependencies, then exported and fully decoded a separate two-second, 640 × 360, 30 fps sample. No installed skill was required. |
| Reduced motion | NOT TESTED in browser | The player detects `prefers-reduced-motion`, disables play, and allows scrubbing; this branch was reviewed in source. The available browser API has no media-preference emulation. |
| Native timing fallback | NOT TESTED in browser | The requestAnimationFrame fallback is retained, but CDN failure was not emulated. |

Node 26.12.0, Lucide 1.8.0, and Sharp 0.35.5 were used. FFmpeg with libx264 was obtained in a temporary tools folder, not added to the repository. The portable helper pins the same drawing dependency versions. A fresh dependency install, another operating system, and exhaustive device coverage were not tested.

The initial review found a connector crossing the pinned-page card and a mobile caption spacing issue; both were corrected before the final build/export. A failed selector for the theme label was replaced with the observed select ID and theme switching then passed. Temporary review PNGs and sample exports are outside the tracked source.

The legacy glossary shortcode, its JS/CSS, and its conditional stylesheet include were removed after confirming no remaining callers. The article now uses the site's existing generic video shortcode, matching the previous MongoDB article. No publication or deployment was performed.
