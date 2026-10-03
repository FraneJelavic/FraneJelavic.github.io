(() => {
  const PHASES = [
    {
      id: "write",
      focus: "client",
      title: "1 · The write",
      outcome: "A client write reaches the primary member.",
      body: "The router has already chosen the shard. mongod on that primary receives the operation. Nothing is committed yet.",
      durationMs: 6500,
    },
    {
      id: "pair",
      focus: "pair",
      title: "2 · Two records",
      outcome: "The primary prepares a data change and an oplog entry.",
      body: "The data change updates the collection and its indexes. The oplog entry is the logical description a secondary can replay.",
      durationMs: 7000,
    },
    {
      id: "commit",
      focus: "commit",
      title: "3 · One commit",
      outcome: "WiredTiger commits both records, or it commits neither.",
      body: "They share one storage transaction. A document change on the primary cannot succeed without the oplog entry that describes it.",
      durationMs: 7500,
    },
    {
      id: "journal",
      focus: "journal",
      title: "4 · Journal",
      outcome: "The journal records the commit for crash recovery on this member.",
      body: "journal/ stores the recovery records. collection-*.wt and index-*.wt can stay unchanged until a later checkpoint.",
      durationMs: 7500,
    },
    {
      id: "local",
      focus: "local",
      title: "5 · This member",
      outcome: "The journal does not leave this server.",
      body: "Recovery replays this member's journal after its last checkpoint. Replication uses the oplog, not the journal.",
      durationMs: 7000,
    },
    {
      id: "copy",
      focus: "copy",
      title: "6 · Oplog copy",
      outcome: "A secondary copies the oplog entry on its own schedule.",
      body: "The copy is outside the primary's storage transaction. The secondary writes the entry into its own local.oplog.rs.",
      durationMs: 7500,
    },
    {
      id: "apply",
      focus: "apply",
      title: "7 · Its own engine",
      outcome: "The secondary applies the operation through its own WiredTiger.",
      body: "That WiredTiger has its own cache, journal, checkpoints, and collection files. The primary's *.wt files are a different database.",
      durationMs: 0,
    },
  ];

  const init = (root) => {
    if (root.dataset.wwReady === "true") {
      return;
    }
    root.dataset.wwReady = "true";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kicker = root.querySelector("[data-ww-kicker]");
    const caption = root.querySelector("[data-ww-caption]");
    const outcome = root.querySelector("[data-ww-outcome]");
    const playButton = root.querySelector('[data-ww-action="play"]');
    const railButtons = [...root.querySelectorAll("[data-ww-goto]")];

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
      const rail = root.querySelector(".wt-write__rail");
      railButtons.forEach((button) => {
        const active = button.dataset.wwGoto === phase.id;
        if (active) {
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
      const actionNode = origin.closest("[data-ww-action]");
      const gotoNode = origin.closest("[data-ww-goto]");
      if (actionNode) {
        const action = actionNode.dataset.wwAction;
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
        const target = PHASES.findIndex((phase) => phase.id === gotoNode.dataset.wwGoto);
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
    document.querySelectorAll(".wt-write").forEach(init);
  };

  boot();
  document.addEventListener("DOMContentLoaded", boot);
})();
