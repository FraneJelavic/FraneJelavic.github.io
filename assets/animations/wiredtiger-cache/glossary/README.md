# WiredTiger cache animated glossary

A 49-second illustrated companion to the article about dirty pages and eviction. The article embeds the MP4 from its own `media` directory. This project contains the responsive HTML player and editable source.

The source lives under `assets/` so Hugo does not copy its editor and build templates into the published site. The article serves the MP4 and interactive dirty-cache control.

Open `index.html` directly to play, pause, replay, scrub, or change themes. The optional GSAP 3.13.0 script controls the clock when available; native browser playback works when it cannot load. Icons are inlined under the Lucide ISC license. No fonts or scene assets need network access. Reduced motion disables playback and leaves seeking available.

## Customize

- `scene.js`: chapter titles/captions/start times, objects, routes, colors for page states, event timings. `meta.duration` sets total length. The render function uses only the supplied time, so seeking and export produce the same scene.
- `runtime.js`: light/dark palettes, typography, heading, caption wrapping, and chapter timeline. Narrow screens reflow instead of shrinking a landscape diagram.
- `player.html`: controls, playback, responsive canvas sizing. Edit this template, then rebuild; `index.html` is generated.
- `storyboard.md`: source, scope, illustrative values, timed beats, and reading holds.
- `validation.md`: checks and limits of this delivery.
- `.tools/animate.cjs` and `.tools/package.json`: portable build/export helper and pinned drawing dependencies. No skill installation is required to rebuild.

## Rebuild

Requires Node.js 20+, npm, and FFmpeg with `libx264`. From this folder:

```sh
npm install --prefix .tools --no-audit --no-fund
node .tools/animate.cjs doctor . --ffmpeg /path/to/ffmpeg
node .tools/animate.cjs check .
node .tools/animate.cjs build . --theme dark
node .tools/animate.cjs render . --out review.png --time 33.5 --theme dark
node .tools/animate.cjs export . --out ../../../../content/writing/wiredtiger-cache-dirty-pages-and-eviction/media/wiredtiger-cache-glossary-v002.mp4 --theme dark --width 1600 --height 900 --fps 30 --ffmpeg /path/to/ffmpeg
```

If FFmpeg is on PATH, omit `--ffmpeg`. Existing compatible drawing dependencies can be used through the `ANIMATION_NODE_MODULES` environment variable. Keep machine-specific paths out of source files.

The helper refuses to overwrite videos or stills. Use a new version when revising, keep its matching source and manifest, and update the article's video shortcode to the new filename. The MP4 manifest includes source/video hashes and measured metadata with full-decode results. Exported dimensions, duration, frame count, H.264/yuv420p, and silence are verified during export.

The clean-folder rebuild was exercised on the current macOS host with existing dependencies; no fresh installation or other operating system is claimed.
