(() => {
  const storageKey = "frane-color-theme";
  const preferences = ["system", "light", "dark"];
  const root = document.documentElement;
  const button = document.querySelector("[data-theme-toggle]");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  if (!button) {
    return;
  }

  const readPreference = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "light" || stored === "dark" ? stored : "system";
    } catch (error) {
      return "system";
    }
  };

  const writePreference = (preference) => {
    try {
      if (preference === "system") {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, preference);
      }
    } catch (error) {
      // Theme selection still works for this page when storage is unavailable.
    }
  };

  const effectiveTheme = (preference) => {
    if (preference === "system") {
      return systemTheme.matches ? "dark" : "light";
    }
    return preference;
  };

  let preference = readPreference();

  const render = () => {
    if (preference === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = preference;
    }

    const nextIndex = (preferences.indexOf(preference) + 1) % preferences.length;
    const nextPreference = preferences[nextIndex];
    const label = preference.charAt(0).toUpperCase() + preference.slice(1);
    const effective = effectiveTheme(preference);

    button.textContent = `Theme: ${label}`;
    button.setAttribute(
      "aria-label",
      `Color theme is ${label.toLowerCase()} (${effective}). Activate to use ${nextPreference}.`,
    );
    button.hidden = false;
    window.dispatchEvent(
      new CustomEvent("frane:themechange", {
        detail: { effectiveTheme: effective, preference },
      }),
    );
  };

  button.addEventListener("click", () => {
    const nextIndex = (preferences.indexOf(preference) + 1) % preferences.length;
    preference = preferences[nextIndex];
    writePreference(preference);
    render();
  });

  systemTheme.addEventListener("change", () => {
    if (preference === "system") {
      render();
    }
  });

  render();
})();
