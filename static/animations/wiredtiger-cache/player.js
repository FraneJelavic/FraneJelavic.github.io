(() => {
  const PHASES = [
    {
      id: "write",
      focus: "mongod",
      title: "1 · The write",
      outcome: "One client write becomes a collection change and an oplog entry.",
      body: "mongod applies both in one storage transaction. Nothing has entered the cache yet.",
      dirty: 4,
      durationMs: 6500,
    },
    {
      id: "dirty",
      focus: "cache",
      title: "2 · Dirty pages",
      outcome: "The write is a dirty page in cache. It cannot be dropped yet.",
      body: "WiredTiger updates the collection page, the index page, and the oplog page in memory. Dirty means modified and not yet reconciled into the table file. One write leaves the dirty share near 4%, under the 5% target.",
      dirty: 4,
      durationMs: 7000,
    },
    {
      id: "journal",
      focus: "disk",
      title: "3 · Journal",
      outcome: "The journal records the write. The table files stay unchanged.",
      body: "journal/ holds the durability record between checkpoints. It does not fill collection-*.wt or index-*.wt.",
      dirty: 4,
      durationMs: 6500,
    },
    {
      id: "target",
      focus: "cache",
      title: "4 · Past 5%",
      outcome: "Background eviction starts. Application threads stay out.",
      body: "More writes push the dirty share past the 5% target. The default four eviction workers reconcile pages. Request threads do not help at this mark.",
      dirty: 8,
      durationMs: 7000,
    },
    {
      id: "endings",
      focus: "endings",
      title: "5 · Two endings",
      outcome: "Checkpoint leaves the page in cache. Eviction removes it after the write.",
      body: "Both writers reconcile into the table files. Checkpoint keeps the page and marks it clean. Eviction frees the slot. A page pinned by an open operation stays dirty until that operation lets go.",
      dirty: 8,
      durationMs: 8000,
    },
    {
      id: "threads",
      focus: "threads",
      title: "6 · Past 20%",
      outcome: "Request threads join the four workers, and the client stalls.",
      body: "Later writes push the dirty share past about 20%. Application threads spend their time on eviction IO, so operations on the primary wait. The pinned page is still skipped.",
      dirty: 27,
      durationMs: 7500,
    },
    {
      id: "limit",
      focus: "limits",
      title: "7 · The limit",
      outcome: "More eviction threads help only when the workers are the limit.",
      body: "If the disk is saturated, extra threads wait on the same IO. If the four workers are busy and the disk can take more writes, extra threads help.",
      dirty: 27,
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

    const startId = root.dataset.start || "write";
    const found = PHASES.findIndex((phase) => phase.id === startId);
    index = found >= 0 ? found : 0;
    playing = !reduced && root.dataset.autoplay === "true";

    const current = () => PHASES[index];

    const render = () => {
      const phase = current();
      root.dataset.phase = phase.id;
      root.dataset.focus = phase.focus;
      root.style.setProperty("--wt-dirty-pct", String(phase.dirty));
      root.querySelectorAll("[data-from]").forEach((node) => {
        const fromIndex = PHASES.findIndex((item) => item.id === node.dataset.from);
        node.hidden = fromIndex < 0 || fromIndex > index;
      });
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
      const fill = root.querySelector(".wt-meter__fill");
      if (fill) {
        fill.style.width = `${phase.dirty}%`;
      }
      const rail = root.querySelector(".wt-cache__rail");
      railButtons.forEach((button) => {
        const current = button.dataset.wtGoto === phase.id;
        if (current) {
          button.setAttribute("aria-current", "step");
          if (rail) {
            const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
            const railRect = rail.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            const left = Math.min(
              max,
              Math.max(
                0,
                rail.scrollLeft + buttonRect.left - railRect.left - (railRect.width - buttonRect.width) / 2,
              ),
            );
            if (max > 0 && Math.abs(rail.scrollLeft - left) >= 1) {
              const pageX = window.scrollX;
              const pageY = window.scrollY;
              rail.scrollTo({ left, behavior: "auto" });
              if (window.scrollX !== pageX || window.scrollY !== pageY) {
                window.scrollTo(pageX, pageY);
              }
            }
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
          playing = !reduced && root.dataset.autoplay === "true";
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
