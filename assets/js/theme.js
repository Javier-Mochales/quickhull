/* Light / dark mode toggle. By default it follows the system;
   if the user picks one, it is remembered in this browser. */
(function () {
  "use strict";
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function readSaved() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }
  function save(value) {
    try { localStorage.setItem("theme", value); } catch (e) { /* no storage */ }
  }

  const saved = readSaved();
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  const isDark = () =>
    root.getAttribute("data-theme") === "dark" ||
    (!root.hasAttribute("data-theme") && systemDark.matches);

  function updateButton(button) {
    const dark = isDark();
    button.textContent = dark ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", String(dark));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    updateButton(button);
    button.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      save(next);
      updateButton(button);
    });
    systemDark.addEventListener("change", () => updateButton(button));
  });
})();
