/* Builds the SageMathCell cells with the code in the sage/ folder.
   This way the Sage code lives in a single place and can be read on its own. */
(function () {
  "use strict";

  // runLabel: name for the button that runs the interact once it is configured
  // (SageCell calls it "Update"; the interacts use auto_update=False)
  const CELLS = [
    { target: "#cell-step", files: ["sage/core.sage", "sage/step_by_step.sage"], runLabel: "Start" },
    { target: "#cell-benchmark", files: ["sage/core.sage", "sage/benchmark.sage"], runLabel: "Run benchmark" },
  ];

  function renameRunButton(sheet, label) {
    const rename = () => {
      sheet.querySelectorAll("button").forEach((b) => {
        if (b.textContent.trim() === "Update") {
          b.textContent = label;
          b.classList.add("sheet__run");
        }
      });
    };
    new MutationObserver(rename).observe(sheet, { childList: true, subtree: true });
  }

  async function load(files) {
    const texts = await Promise.all(files.map(async (path) => {
      const r = await fetch(path, { cache: "no-cache" });
      if (!r.ok) throw new Error(path + " (" + r.status + ")");
      return r.text();
    }));
    return texts.join("\n\n");
  }

  async function mount({ target, files, runLabel }) {
    const box = document.querySelector(target);
    // The white sheet only appears once the applet is launched
    const sheet = box.closest(".sheet");
    renameRunButton(sheet, runLabel);
    // (capture phase: SageCell stops the click from bubbling up)
    sheet.addEventListener("click", (e) => {
      if (e.target.closest(".sagecell_evalButton")) sheet.classList.remove("sheet--idle");
    }, true);
    try {
      const code = await load(files);
      const script = document.createElement("script");
      script.type = "text/x-sage";
      script.textContent = code;
      box.replaceChildren(script);
      sagecell.makeSagecell({
        inputLocation: target,
        evalButtonText: "Launch applet",
        hide: ["editor", "permalink", "fullScreen", "language", "files", "sageMode"],
        autoeval: false,
        linked: false,
      });
    } catch (e) {
      box.innerHTML =
        '<p class="sheet__notice">The Sage code could not be loaded (' + e.message + "). " +
        "Open the site from its GitHub Pages address or a local server, not as a file.</p>";
    }
  }

  if (typeof sagecell === "undefined") {
    CELLS.forEach(({ target }) => {
      document.querySelector(target).innerHTML =
        '<p class="sheet__notice">Could not connect to SageMathCell. Check your internet connection and reload the page.</p>';
    });
    return;
  }
  CELLS.forEach(mount);
})();
