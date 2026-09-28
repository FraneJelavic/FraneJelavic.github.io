(() => {
  const PHASES = [
    {
      id: "idle",
      title: "Ready",
      outcome: "Table files stay quiet until a page is reconciled.",
      body: "A write is about to land on mongod. The collection and index files are not updated yet.",
      dirty: 3,
      durationMs: 2800,
    },
    {
      id: "mongod",
      title: "1 · mongod",
      outcome: "The collection change and the oplog entry are paired on mongod.",
      body: "mongod applies the collection write and creates the matching entry in local.oplog.rs. Both belong to one storage transaction.",
      dirty: 3,
      durationMs: 3800,
    },
    {
      id: "cache",
      title: "2 · Into cache",
      outcome: "Collection, index, and oplog pages now sit in cache.",
      body: "WiredTiger applies the collection change, the index update, and the oplog entry to in-memory B-tree pages.",
      dirty: 6,
      durationMs: 3600,
    },
    {
      id: "dirty",
      title: "3 · Dirty pages",
      outcome: "Modified, not reconciled. Cannot be dropped yet.",
      body: "Dirty means the page is modified in cache and not yet reconciled into its table file. It cannot be discarded until that write happens.",
      dirty: 12,
      durationMs: 4000,
    },
    {
      id: "fork",
      title: "4 · Two paths",
      outcome: "Two writers. Only eviction removes the page.",
      body: "Checkpoint writes table files on its timer. Eviction writes them when dirty cache has to be freed. The 5% mark is the background target. The 20% mark is where application threads join.",
      dirty: 12,
      durationMs: 4200,
    },
    {
      id: "checkpoint",
      title: "5 · Checkpoint",
      outcome: "Written by checkpoint. Still resident, now clean.",
      body: "Checkpoint reconciles a consistent snapshot into collection-*.wt and index-*.wt, including the oplog tables. The pages stay in cache and become clean.",
      dirty: 4,
      durationMs: 4600,
    },
    {
      id: "eviction",
      title: "6 · Past 20%",
      outcome: "Four workers write the page, then evict it.",
      body: "When later writes push the dirty share past about 20%, the default four eviction workers reconcile dirty pages and then remove them. A page pinned by an active operation is skipped until it is free.",
      dirty: 27,
      durationMs: 4800,
    },
    {
      id: "pressure",
      title: "7 · Application threads",
      outcome: "Request threads are helping eviction.",
      body: "Application threads join those four workers to free the cache. The time is spent on eviction IO, so operations on the primary see latency and stall.",
      dirty: 27,
      durationMs: 4800,
    },
    {
      id: "files",
      title: "8 · On disk",
      outcome: "Oplog and user data use the same kind of table file.",
      body: "Reconciled images land in collection-*.wt and index-*.wt for the user collection and for local.oplog.rs. The journal records durability between checkpoints. It does not populate these table files.",
      dirty: 8,
      durationMs: 4400,
    },
    {
      id: "done",
      title: "Complete",
      outcome: "Checkpoint keeps a clean page. Eviction removes it after the write.",
      body: "The collection write and the local.oplog.rs entry become dirty cache pages. Checkpoint can write them and leave them resident. Past about 20% dirty, the four eviction workers and then application threads write them out to free the cache, and client operations pay in latency. Extra eviction threads help only when the workers, not the disk, are the limit.",
      dirty: 8,
      durationMs: 0,
    },
  ];

  const init = (root) => {
    if (root.dataset.wtReady === "true") {
      return;
    }
    root.dataset.wtReady = "true";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kicker = root.querySelector("[data-wt-kicker]");
    const caption = root.querySelector("[data-wt-caption]");
    const outcome = root.querySelector("[data-wt-outcome]");
    const meter = root.querySelector("[data-wt-meter]");
    const readout = root.querySelector("[data-wt-dirty-readout]");
    const playButton = root.querySelector('[data-wt-action="play"]');
    const railButtons = [...root.querySelectorAll("[data-wt-goto]")];

    let index = 0;
    let playing = false;
    let timer = 0;

    if (reduced) {
      index = PHASES.length - 1;
    } else {
      const startId = root.dataset.start || "idle";
      const found = PHASES.findIndex((phase) => phase.id === startId);
      index = found >= 0 ? found : 0;
      playing = root.dataset.autoplay !== "false";
    }

    const current = () => PHASES[index];

    const render = () => {
      const phase = current();
      root.dataset.phase = phase.id;
      root.style.setProperty("--wt-dirty-pct", String(phase.dirty));
      if (kicker) {
        kicker.textContent = phase.title;
      }
      if (caption) {
        caption.textContent = phase.body;
      }
      if (outcome) {
        outcome.textContent = phase.outcome;
      }
      if (readout) {
        readout.textContent = `${phase.dirty}%`;
      }
      if (meter) {
        meter.setAttribute("aria-valuenow", String(phase.dirty));
      }
      const rail = root.querySelector(".wt-cache__rail");
      railButtons.forEach((button) => {
        const current = button.dataset.wtGoto === phase.id;
        if (current) {
          button.setAttribute("aria-current", "step");
          if (rail) {
            const left = button.offsetLeft - (rail.clientWidth - button.clientWidth) / 2;
            rail.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
          }
        } else {
          button.removeAttribute("aria-current");
        }
      });
      if (playButton) {
        playButton.textContent = playing ? "Pause" : "Play";
        playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
        playButton.setAttribute("aria-pressed", playing ? "true" : "false");
      }
    };

    const clearTimer = () => {
      window.clearTimeout(timer);
      timer = 0;
    };

    const schedule = () => {
      clearTimer();
      if (!playing || index >= PHASES.length - 1) {
        if (index >= PHASES.length - 1) {
          playing = false;
        }
        render();
        return;
      }
      timer = window.setTimeout(() => {
        index += 1;
        render();
        schedule();
      }, current().durationMs);
    };

    const go = (nextIndex) => {
      index = Math.min(PHASES.length - 1, Math.max(0, nextIndex));
      render();
      schedule();
    };

    const pause = () => {
      playing = false;
      clearTimer();
      render();
    };

    const play = () => {
      if (index >= PHASES.length - 1) {
        index = 0;
      }
      playing = true;
      render();
      schedule();
    };

    const elementFrom = (target) => {
      if (!target) {
        return null;
      }
      return target.nodeType === 1 ? target : target.parentElement;
    };

    root.addEventListener("click", (event) => {
      const origin = elementFrom(event.target);
      if (!origin) {
        return;
      }
      const actionNode = origin.closest("[data-wt-action]");
      const gotoNode = origin.closest("[data-wt-goto]");
      if (actionNode) {
        const action = actionNode.dataset.wtAction;
        if (action === "prev") {
          pause();
          go(index - 1);
        } else if (action === "next") {
          pause();
          go(index + 1);
        } else if (action === "play") {
          if (playing) {
            pause();
          } else {
            play();
          }
        } else if (action === "restart") {
          index = 0;
          playing = !reduced;
          render();
          schedule();
        }
      } else if (gotoNode) {
        const target = PHASES.findIndex((phase) => phase.id === gotoNode.dataset.wtGoto);
        if (target >= 0) {
          pause();
          go(target);
        }
      }
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        pause();
        go(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        pause();
        go(index - 1);
      } else if ((event.key === " " || event.key === "Spacebar") && event.target === root) {
        event.preventDefault();
        if (playing) {
          pause();
        } else {
          play();
        }
      }
    });

    render();
    schedule();
  };

  const boot = () => {
    document.querySelectorAll(".wt-cache").forEach(init);
  };

  boot();
  document.addEventListener("DOMContentLoaded", boot);
})();
