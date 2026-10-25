(() => {
  "use strict";

  const DIRTY_TARGET = 5;
  const DIRTY_TRIGGER = 20;
  const STATES = {
    below: {
      title: "Below the dirty target",
      explanation: "Dirty content is at or below 5%. This example does not need dirty-page eviction.",
      workers: "No dirty-page eviction",
      application: "Serving requests",
      client: "Application threads stay on requests.",
      disk: "Waiting for reconciliation",
    },
    background: {
      title: "Workers handle eviction",
      explanation: "Dirty content is above 5%. Background workers reconcile dirty pages and free cache memory.",
      workers: "Reconcile and evict",
      application: "Serving requests",
      client: "Application threads stay on requests.",
      disk: "Workers write reconciled data",
    },
    foreground: {
      title: "Application threads join eviction",
      explanation: "Dirty content is above 20%. An application thread that encounters pressure performs eviction before continuing its request.",
      workers: "Reconcile and evict",
      application: "Evict before continuing",
      client: "Client waits while its thread evicts.",
      disk: "Workers and application threads write",
    },
  };

  /** Isolate the dirty thresholds; other eviction triggers are outside this model. */
  const pressureMode = (percentage) => {
    if (percentage > DIRTY_TRIGGER) return "foreground";
    if (percentage > DIRTY_TARGET) return "background";
    return "below";
  };

  const setText = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };

  const init = (root) => {
    if (root.dataset.wtpReady === "true") return;
    root.dataset.wtpReady = "true";

    const range = root.querySelector("[data-wtp-range]");
    const value = root.querySelector("[data-wtp-value]");
    const motionButton = root.querySelector("[data-wtp-motion]");
    const presets = [...root.querySelectorAll("[data-wtp-preset]")];
    const fields = {
      title: root.querySelector("[data-wtp-state]"),
      explanation: root.querySelector("[data-wtp-explanation]"),
      workers: root.querySelector("[data-wtp-workers]"),
      application: root.querySelector("[data-wtp-application]"),
      client: root.querySelector("[data-wtp-client]"),
      disk: root.querySelector("[data-wtp-disk]"),
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let motionPaused = false;

    // One state drives every lane so captions, routes, and thread activity agree.
    const render = () => {
      const percentage = Number(range.value);
      const mode = pressureMode(percentage);
      const state = STATES[mode];
      const formatted = `${percentage}%`;
      if (root.dataset.mode !== mode) root.dataset.mode = mode;
      range.style.setProperty("--wtp-percent", formatted);
      range.setAttribute("aria-valuetext", `${formatted} of configured cache capacity. ${state.title}.`);
      setText(value, formatted);
      for (const [key, node] of Object.entries(fields)) setText(node, state[key]);
      for (const preset of presets) {
        preset.setAttribute("aria-pressed", String(percentage === Number(preset.dataset.wtpPreset)));
      }
    };

    const updateMotion = () => {
      const reduced = reducedMotion.matches;
      root.dataset.motion = reduced || motionPaused ? "paused" : "running";
      motionButton.disabled = reduced;
      setText(motionButton, reduced ? "Motion reduced" : motionPaused ? "Resume motion" : "Pause motion");
    };

    range.addEventListener("input", render);
    for (const preset of presets) {
      preset.disabled = false;
      preset.addEventListener("click", () => {
        range.value = preset.dataset.wtpPreset;
        render();
      });
    }
    motionButton.addEventListener("click", () => {
      motionPaused = !motionPaused;
      updateMotion();
    });
    reducedMotion.addEventListener("change", updateMotion);
    range.disabled = false;
    render();
    updateMotion();
  };

  document.querySelectorAll("[data-wt-pressure]").forEach(init);
})();
