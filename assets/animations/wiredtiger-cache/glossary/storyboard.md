# WiredTiger cache: dirty pages and eviction

Audience: Readers of the accompanying MongoDB article who know what a write is and need a visual explanation of cache pressure.
Takeaway: A write dirties cached pages; journal records support recovery, while reconciliation and eviction handle page data and cache space. Past the dirty trigger, application threads must help with eviction and client latency rises.

Source of truth: `content/writing/wiredtiger-cache-dirty-pages-and-eviction/index.md` and the seven phases of the original `wiredtiger-cache` glossary. Visual reference: the 40-second `mongodb-glossary.mp4` supplied with the previous article.

Format: 49 seconds, 1600 × 900, 30 fps, silent H.264 MP4, plus a responsive editable HTML companion. Seven 7-second chapters; dark green background, restrained outlined panels, Lucide icons, cyan clean pages, orange dirty pages, green journal/reconciliation, purple pinned pages. The HTML also supports light mode.

| Time | Objects and action | Reading hold |
| --- | --- | --- |
| 0–7s | Client write travels into WiredTiger. Collection, index, and oplog pages appear dirty, grouped as one storage transaction. | 3.7–7s: one write, affected cached pages. |
| 7–14s | Dirty pages persist; a separate table-file object appears unchanged. | 10.9–14s: dirty means modified relative to the table file. |
| 14–21s | A recovery-record object travels to `journal/`. Only after its arrival does the flush/shield indicator appear. Table files remain unchanged. | 17.8–21s: journal durability and dirty pages coexist. |
| 21–28s | An illustrative meter rises from 4% to 8%, crossing the 5% target. Four background workers activate. A page's reconciled data travels to the table file, then its cache slot becomes free. A reader-pinned page is skipped. | 25.4–28s: background eviction frees space while application threads continue. |
| 28–35s | Two alternative outcomes for a dirty page: both reconcile and write data. Checkpoint leaves a clean cached page; eviction removes the page after its write completes. | 32.6–35s: clean cached page versus free slot. |
| 35–42s | The illustrative meter rises from 8% to 27%, crossing the 20% trigger. Application-thread work is redirected to eviction; the client-wait indicator follows. The pinned page remains skipped. | 39.4–42s: foreground eviction consumes application time. |
| 42–49s | Compare a saturated disk, where records queue, with busy workers and available disk capacity, where records arrive. | 46–49s: extra workers help only with available I/O capacity. |

## Boundaries and illustrative values

- Meter values 4%, 8%, and 27% illustrate transitions. They are percentages of total configured cache capacity, not percentages of occupied space, and are not production measurements. One write is not claimed to dirty 4% of a real cache.
- The 5% target, 20% trigger, and four default workers follow this article. They are version/configuration dependent. The fullness thresholds (80%/95%) and mitigation commands remain in the prose rather than adding another story to this glossary.
- Chapters compress events and omit real elapsed timings. A journal append is distinct from its durable flush. The shield appears after a conceptual flush; no write concern, acknowledgement, or precise journal interval is modeled.
- The journal receives recovery records, not reconciled page images. The clean page changes state only after the page-write arrival; the freed slot appears later still.
- Checkpoint and eviction are alternative outcomes, not consecutive writes of the same page. The checkpoint illustration shows a page remaining cached and does not attempt to depict its full timestamp/metadata protocol. Clean-page eviction can avoid a new page write and is outside this dirty-page example.
- Pinning is attached to a generic active reader, not permanently to the oplog. Release timing and other reasons a page cannot be evicted are omitted.
- The dirty meter is independent of cache fullness; it does not imply a full cache or flow control.
- No restaurant metaphor or extra human role is introduced. CPUs represent execution threads.

## Editing

Change chapter starts/titles/captions in `scene.js` together with `meta.duration` and the chapter clock if changing duration. Scene helper functions control objects, routes, and state timings. `runtime.js` owns palettes, heading, responsive caption wrapping, and chapter progress. `player.html` owns controls and playback. All visible animation is rendered by the same pure function for HTML and MP4.
