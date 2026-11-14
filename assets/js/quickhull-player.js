/* ==========================================================
   Quickhull player.
   SageMath computes Quickhull and every one of its steps (see
   step_by_step.sage); this script only draws those steps in the
   browser, smoothly. The same player works as an animation
   (play / pause, in a loop; restart, speed, seek bar) and step by step
   (previous / next: each step is drawn growing, or undone
   backwards; also with the arrow keys). Sage sends the data as
   JSON inside the cell output and calls QuickhullPlayer.mount(element).
   ========================================================== */
(function () {
  "use strict";

  // Duration of each kind of step at 1x speed (ms)
  const DURATION = { start: 1400, farthest: 1000, discard: 900, edge: 600 };
  const INTRO = 700, OUTRO = 1200;
  const LOOP_PAUSE = 1500;                    // time on the final hull before starting again
  const MAX_TOTAL = 45000, MIN_STEP = 120;   // long runs are compressed to ~45 s at 1x
  const SPEEDS = [0.5, 1, 2, 4];

  const ease = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function blend(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return "rgb(" + A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(",") + ")";
  }

  function stepLabels(s) {
    if (s.t === "start") {
      return s.E.length > 2
        ? s.E.map((i, j) => [i, ["min x", "min y", "max x", "max y"][j]])
        : [[s.E[0], "a"], [s.E[s.E.length - 1], "b"]];
    }
    if (s.t === "farthest" || s.t === "discard") return [[s.p, "p"], [s.q, "q"], [s.c, "c"]];
    return [[s.p, "p"], [s.q, "q"]];
  }

  function mount(root) {
    const data = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    const C = data.colours, P = data.points, steps = data.steps, n = P.length;

    /* ---------- When each point becomes a vertex / is discarded ---------- */
    const vertexAt = new Array(n).fill(Infinity);
    const discardAt = new Array(n).fill(Infinity);
    const edges = [];
    steps.forEach((s, k) => {
      if (s.t === "start") {
        s.E.forEach((i) => (vertexAt[i] = Math.min(vertexAt[i], k)));
        s.discarded.forEach((i) => (discardAt[i] = Math.min(discardAt[i], k)));
      } else if (s.t === "farthest") {
        vertexAt[s.c] = Math.min(vertexAt[s.c], k);
      } else if (s.t === "discard") {
        s.interior.forEach((i) => (discardAt[i] = Math.min(discardAt[i], k)));
      } else if (s.t === "edge") {
        edges.push({ p: s.p, q: s.q, k });
      }
    });

    /* ---------- Timeline ---------- */
    let durations = steps.map((s) => DURATION[s.t]);
    const sum = durations.reduce((a, b) => a + b, 0);
    if (sum > MAX_TOTAL) durations = durations.map((d) => Math.max(MIN_STEP, (d * MAX_TOTAL) / sum));
    const starts = [];
    let acc = INTRO;
    durations.forEach((d) => { starts.push(acc); acc += d; });
    const stepsEnd = acc, total = acc + OUTRO;

    function locate(T) {               // -> [k, t]; k = -1 intro, k = steps.length outro
      if (T < INTRO) return [-1, T / INTRO];
      if (T >= stepsEnd) return [steps.length, clamp01((T - stepsEnd) / OUTRO)];
      let lo = 0, hi = steps.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= T) lo = mid; else hi = mid - 1;
      }
      return [lo, clamp01((T - starts[lo]) / durations[lo])];
    }

    /* ---------- Interface ---------- */
    root.innerHTML =
      '<canvas class="qh-player__canvas" role="img" aria-label="Quickhull animation computed by SageMath"></canvas>' +
      '<div class="qh-player__controls">' +
      '  <button type="button" class="qh-player__prev" aria-label="Previous step">◀ Previous</button>' +
      '  <button type="button" class="qh-player__play">Pause</button>' +
      '  <button type="button" class="qh-player__next" aria-label="Next step">Next ▶</button>' +
      '  <button type="button" class="qh-player__restart">Restart</button>' +
      '  <label class="qh-player__speed">Speed <select>' +
      SPEEDS.map((s) => '<option value="' + s + '"' + (s === 1 ? " selected" : "") + ">" + s + "×</option>").join("") +
      "  </select></label>" +
      '  <span class="qh-player__counter" aria-live="polite"></span>' +
      '  <input class="qh-player__seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Position in the animation">' +
      "</div>" +
      '<p class="qh-player__caption"></p>';
    root.tabIndex = 0;                       // so the arrow keys work once it is clicked
    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const playBtn = root.querySelector(".qh-player__play");
    const prevBtn = root.querySelector(".qh-player__prev");
    const nextBtn = root.querySelector(".qh-player__next");
    const restartBtn = root.querySelector(".qh-player__restart");
    const speedSel = root.querySelector("select");
    const seek = root.querySelector(".qh-player__seek");
    const counter = root.querySelector(".qh-player__counter");
    const caption = root.querySelector(".qh-player__caption");

    /* ---------- Coordinates ---------- */
    let W = 0, scale = 1, ox = 0, oy = 0;
    const [xmin, xmax, ymin, ymax] = data.box;
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(W * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(W / (xmax - xmin), W / (ymax - ymin));
      ox = (W - (xmax - xmin) * scale) / 2;
      oy = (W - (ymax - ymin) * scale) / 2;
      render();
    }
    const X = (i) => ox + (P[i][0] - xmin) * scale;
    const Y = (i) => W - oy - (P[i][1] - ymin) * scale;

    /* ---------- Drawing helpers ---------- */
    function segment(x1, y1, x2, y2, t) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
      ctx.stroke();
    }
    const seg = (i, j, t) => segment(X(i), Y(i), X(j), Y(j), t);
    function fillPolygon(ids, colour, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ids.forEach((i, j) => (j ? ctx.lineTo(X(i), Y(i)) : ctx.moveTo(X(i), Y(i))));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    function dot(i, r, fill, stroke, lw) {
      ctx.beginPath();
      ctx.arc(X(i), Y(i), r, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    }

    // Auxiliary lines of a step at progress t, with transparency alpha
    function layer(s, t, alpha) {
      if (!s || alpha <= 0) return;
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = C.auxiliary;
      ctx.setLineDash([5, 5]);
      if (s.t === "start") {
        if (s.E.length > 2) {
          fillPolygon(s.E, C.discarded, 0.10 * t * alpha);
          ctx.globalAlpha = alpha;
          s.E.forEach((i, j) => seg(i, s.E[(j + 1) % s.E.length], t));
        } else {
          ctx.globalAlpha = alpha;
          seg(s.E[0], s.E[1], t);
        }
      } else if (s.t === "farthest") {
        ctx.globalAlpha = alpha;
        seg(s.p, s.q, 1);
        // perpendicular from the line pq to c, growing towards c
        const [px, py] = P[s.p], [qx, qy] = P[s.q], [cx, cy] = P[s.c];
        const dx = qx - px, dy = qy - py;
        const u = ((cx - px) * dx + (cy - py) * dy) / (dx * dx + dy * dy);
        const fx = ox + (px + u * dx - xmin) * scale, fy = W - oy - (py + u * dy - ymin) * scale;
        ctx.setLineDash([]);
        ctx.strokeStyle = C.ink;
        segment(fx, fy, X(s.c), Y(s.c), t);
      } else if (s.t === "discard") {
        fillPolygon([s.p, s.c, s.q], C.discarded, 0.12 * t * alpha);
        ctx.globalAlpha = alpha;
        seg(s.p, s.q, 1);
        seg(s.p, s.c, t);
        seg(s.q, s.c, t);
      }
      ctx.restore();
    }

    /* ---------- One frame at time T ---------- */
    let T = 0, lastK = null;
    function render() {
      if (!W) return;
      const [k, t] = locate(T);
      const te = ease(t);
      const s = k >= 0 && k < steps.length ? steps[k] : null;
      const before = Math.max(k, 0);           // what was known before this step
      const r = Math.max(2.4, W * 0.0068);
      ctx.clearRect(0, 0, W, W);

      if (k === steps.length && data.hull.length >= 3) fillPolygon(data.hull, C.hull, 0.15 * te);
      if (s && k > 0 && steps[k - 1].t !== "edge") layer(steps[k - 1], 1, 1 - te);
      layer(s, te, 1);

      // hull edges
      ctx.save();
      ctx.strokeStyle = C.hull;
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      edges.forEach((e) => { if (e.k < before) seg(e.p, e.q, 1); });
      if (s && s.t === "edge") seg(s.p, s.q, te);
      ctx.restore();

      // points
      const isNew = new Set(), turning = new Set(), current = new Set();
      let redFrom = C.pending;
      if (s && s.t === "start") { s.E.forEach((i) => isNew.add(i)); s.discarded.forEach((i) => turning.add(i)); }
      if (s && s.t === "farthest") { isNew.add(s.c); s.S.forEach((i) => current.add(i)); }
      if (s && s.t === "discard") {
        s.interior.forEach((i) => turning.add(i));
        s.A.forEach((i) => current.add(i));
        s.B.forEach((i) => current.add(i));
        redFrom = C.ink;
      }
      const end = k === steps.length;
      for (let i = 0; i < n; i++) {
        const vertex = end ? vertexAt[i] < Infinity : vertexAt[i] < before;
        const gone = end ? discardAt[i] < Infinity : discardAt[i] < before;
        if (vertex || isNew.has(i)) continue;          // drawn on top later
        if (k === -1) { ctx.globalAlpha = te; dot(i, r * te, C.pending); ctx.globalAlpha = 1; }
        else if (gone) dot(i, r, C.discarded);
        else if (turning.has(i)) dot(i, r, blend(redFrom, C.discarded, te));
        else if (current.has(i)) dot(i, r * 1.1, C.ink);
        else dot(i, r, C.pending);
      }
      for (let i = 0; i < n; i++) {
        const vertex = end ? vertexAt[i] < Infinity : k >= 0 && vertexAt[i] < before;
        if (vertex) dot(i, r * 1.75, C.vertex, C.ink, 1.2);
      }
      isNew.forEach((i) => dot(i, r * (1.1 + 0.65 * te), blend(C.ink, C.vertex, te), C.ink, 1.2 * te));

      // labels of the current step
      if (s) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, 2 * te);
        ctx.fillStyle = C.ink;
        ctx.font = "italic " + Math.round(r * 5.2) + "px Literata, Georgia, serif";
        stepLabels(s).forEach(([i, name]) => ctx.fillText(name, X(i) + r * 2.2, Y(i) - r * 2.2));
        ctx.restore();
      }

      // texts
      if (k !== lastK) {
        lastK = k;
        counter.textContent = k === -1 ? n + " points"
          : end ? "Final result" : "Step " + (k + 1) + " of " + steps.length;
        caption.textContent = data.captions[Math.min(Math.max(k, 0), steps.length)];
      }
      seek.value = String(Math.round((T / total) * 1000));
    }

    /* ---------- Stops: the moment each step is complete ---------- */
    // Just before the next step starts, so the finished step is what is shown.
    const EPS = 0.5;
    const stops = [INTRO - EPS]
      .concat(starts.map((s, k) => s + durations[k] - EPS))
      .concat([total]);

    /* ---------- Playback ----------
       moving    : the time T is advancing (or going back)
       target    : null = play to the end; a number = stop at that time
       direction : +1 forwards, -1 backwards (undoing a step)          */
    let moving = false, target = null, direction = 1, previous = null, speed = 1;
    let waited = 0;                           // time spent on the final hull while looping

    function updateButton() {
      playBtn.textContent = moving ? "Pause" : "Play";
    }
    function move(to, dir) {
      target = to;
      direction = dir;
      if (!moving) { moving = true; previous = null; requestAnimationFrame(tick); }
      updateButton();
    }
    function stop() {
      moving = false;
      updateButton();
    }
    function tick(now) {
      if (!moving || !root.isConnected) return;
      const elapsed = previous === null ? 0 : now - previous;
      const dt = elapsed * speed;
      previous = now;
      if (target === null) {
        // Playing: loops forever, with a short pause on the final hull
        if (T >= total) {
          waited += elapsed;
          if (waited >= LOOP_PAUSE) { T = 0; lastK = null; waited = 0; }
        } else {
          T = Math.min(total, T + dt);
        }
        render();
        requestAnimationFrame(tick);
        return;
      }
      // Stepping: goes to the target time and stops there
      T = direction > 0 ? Math.min(target, T + dt) : Math.max(target, T - dt);
      render();
      if (T === target) stop();
      else requestAnimationFrame(tick);
    }

    function play() {
      waited = 0;
      move(null, 1);
    }
    function next() {                       // draw the next step and stop when it is complete
      const to = stops.find((s) => s > T + 1);
      if (to !== undefined) move(to, 1);
    }
    function prev() {                       // undo the current step, backwards
      const earlier = stops.filter((s) => s < T - 1);
      move(earlier.length ? earlier[earlier.length - 1] : 0, -1);
    }

    playBtn.addEventListener("click", () => (moving ? stop() : play()));
    nextBtn.addEventListener("click", next);
    prevBtn.addEventListener("click", prev);
    restartBtn.addEventListener("click", () => { T = 0; lastK = null; render(); move(null, 1); });
    speedSel.addEventListener("change", () => { speed = parseFloat(speedSel.value); });
    seek.addEventListener("input", () => {        // dragging the bar jumps directly
      stop();
      T = (parseInt(seek.value, 10) / 1000) * total;
      render();
      updateButton();
    });
    root.addEventListener("keydown", (e) => {
      if (e.target.closest("select, input")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === " " && !e.target.closest("button")) {
        e.preventDefault();
        moving ? stop() : play();
      }
    });

    new ResizeObserver(resize).observe(canvas);
    resize();
    play();
  }

  window.QuickhullPlayer = { mount };
})();
