/* ==========================================================
   Hero animation: Quickhull on a loop.
   It is only a JavaScript illustration; the real computation
   of the project is done in SageMath inside the applet.

   Cycle: a point cloud appears -> a and b are drawn ->
   for each subproblem the farthest point c is found and the
   points inside triangle acb are discarded -> the hull closes ->
   it holds -> it fades out -> new cloud.
   The whole drawing rotates slowly, like a loading icon, and the
   outer ring fills up as the algorithm progresses.
   ========================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Colours read from the CSS variables (light/dark mode) ---------- */
  let col = {};
  function readColours() {
    const s = getComputedStyle(document.documentElement);
    const v = (name) => s.getPropertyValue(name).trim();
    col = {
      ink: v("--ink"),
      line: v("--line"),
      hull: v("--hull"),
      veil: v("--hull-veil"),
      vertex: v("--vertex"),
      discarded: v("--discarded"),
      point: v("--point"),
    };
  }
  readColours();
  new MutationObserver(readColours).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"],
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColours);

  /* ---------- Canvas size, sharp on high-density screens ---------- */
  let side = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    side = r.width;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------- Geometry (mathematical coordinates, radius 1) ---------- */
  // Signed area (x2): > 0 if r is to the left of p->q, < 0 if to the right
  const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  function randomCloud() {
    const n = 16 + Math.floor(Math.random() * 9); // 16..24 points
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 2000) {
      tries++;
      const ang = Math.random() * 2 * Math.PI;
      const rad = 0.92 * Math.sqrt(Math.random()); // uniform in the disk
      const p = { x: rad * Math.cos(ang), y: rad * Math.sin(ang) };
      if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 0.16)) pts.push(p);
    }
    return pts.map((p) => ({ ...p, state: "free", delay: Math.random() }));
  }

  // List of Quickhull events (same notation as the lecture notes)
  function quickhullEvents(P) {
    const ev = [];
    let a = P[0], b = P[0];
    for (const p of P) {
      if (p.x < a.x || (p.x === a.x && p.y < a.y)) a = p;
      if (p.x > b.x || (p.x === b.x && p.y > b.y)) b = p;
    }
    ev.push({ type: "base", a, b });

    const rightOf = (S, p, q) => S.filter((r) => r !== p && r !== q && orient(p, q, r) < 0);

    function qh(a, b, S) {
      if (S.length === 0) { ev.push({ type: "edge", a, b }); return; }
      let c = S[0], dmax = -1;
      for (const r of S) {
        const d = Math.abs(orient(a, b, r));
        if (d > dmax) { dmax = d; c = r; }
      }
      const A = rightOf(S, a, c);
      const B = rightOf(S, c, b);
      const interior = S.filter((r) => r !== c && !A.includes(r) && !B.includes(r));
      ev.push({ type: "farthest", a, b, c });
      ev.push({ type: "discard", a, b, c, interior });
      qh(a, c, A);
      qh(c, b, B);
    }
    qh(a, b, rightOf(P, a, b));
    qh(b, a, rightOf(P, b, a));
    return ev;
  }

  /* ---------- Timeline ---------- */
  const DUR = { appear: 900, base: 650, farthest: 520, discard: 420, edge: 200, close: 700, hold: 1500, fade: 700 };

  let points, events, edges, polygon;
  let phase, iEvent, tPhase;

  function newCycle() {
    points = randomCloud();
    events = quickhullEvents(points);
    edges = [];
    polygon = events.filter((e) => e.type === "edge").map((e) => e.a);
    phase = "appear";
    iEvent = 0;
    tPhase = 0;
  }

  // Applies the permanent effect of an event when it finishes
  function completeEvent(e) {
    if (e.type === "base") { e.a.state = "vertex"; e.b.state = "vertex"; }
    if (e.type === "farthest") e.c.state = "vertex";
    if (e.type === "discard") e.interior.forEach((p) => (p.state = "out"));
    if (e.type === "edge") edges.push(e);
  }

  function advance(dt) {
    tPhase += dt;
    if (phase === "appear" && tPhase >= DUR.appear) { phase = "events"; tPhase = 0; }
    else if (phase === "events") {
      const e = events[iEvent];
      if (tPhase >= DUR[e.type]) {
        completeEvent(e);
        tPhase = 0;
        iEvent++;
        if (iEvent >= events.length) phase = "close";
      }
    }
    else if (phase === "close" && tPhase >= DUR.close) { phase = "hold"; tPhase = 0; }
    else if (phase === "hold" && tPhase >= DUR.hold) { phase = "fade"; tPhase = 0; }
    else if (phase === "fade" && tPhase >= DUR.fade) newCycle();
  }

  /* ---------- Drawing ---------- */
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  let scale = 1;
  const X = (p) => p.x * scale;
  const Y = (p) => -p.y * scale; // y axis pointing up

  function segment(p, q, t = 1, dashed = false) {
    ctx.setLineDash(dashed ? [5, 5] : []);
    ctx.beginPath();
    ctx.moveTo(X(p), Y(p));
    ctx.lineTo(X(p) + (X(q) - X(p)) * t, Y(p) + (Y(q) - Y(p)) * t);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function foot(a, b, c) { // projection of c onto the line ab
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  function drawPoint(p, globalAlpha) {
    let appear = 1;
    if (phase === "appear") appear = smooth(clamp01((tPhase / DUR.appear) * 1.6 - p.delay * 0.6));
    if (appear <= 0) return;
    const r0 = side * 0.011;
    ctx.globalAlpha = globalAlpha * appear;
    if (p.state === "vertex") {
      ctx.fillStyle = col.vertex;
      ctx.strokeStyle = col.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(X(p), Y(p), r0 * 1.45, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    } else if (p.state === "out") {
      ctx.globalAlpha = globalAlpha * 0.75;
      ctx.fillStyle = col.discarded;
      ctx.beginPath(); ctx.arc(X(p), Y(p), r0 * 0.95, 0, 2 * Math.PI); ctx.fill();
    } else {
      ctx.fillStyle = col.point;
      ctx.beginPath(); ctx.arc(X(p), Y(p), r0 * appear, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(angle) {
    ctx.clearRect(0, 0, side, side);
    scale = side * 0.4;
    ctx.save();
    ctx.translate(side / 2, side / 2);
    ctx.rotate(angle);

    let alpha = 1;
    if (phase === "fade") alpha = 1 - smooth(clamp01(tPhase / DUR.fade));

    // Progress ring, like a loading icon: fills up as Quickhull advances
    let progress = 0;
    if (phase === "events") progress = (iEvent + clamp01(tPhase / DUR[events[iEvent].type])) / events.length;
    else if (phase !== "appear") progress = 1;
    const ringRadius = scale * 1.12;
    ctx.lineWidth = 2;
    ctx.strokeStyle = col.line;
    ctx.globalAlpha = 0.25 * (phase === "fade" ? alpha : 1);
    ctx.beginPath(); ctx.arc(0, 0, ringRadius, 0, 2 * Math.PI); ctx.stroke();
    if (progress > 0) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col.hull;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + progress * 2 * Math.PI);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.globalAlpha = 1;

    // Hull fill once it is complete
    if (phase === "close" || phase === "hold" || phase === "fade") {
      const t = phase === "close" ? smooth(clamp01(tPhase / DUR.close)) : 1;
      ctx.globalAlpha = alpha * t;
      ctx.fillStyle = col.veil;
      ctx.beginPath();
      polygon.forEach((p, i) => (i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Current event (auxiliary lines)
    if (phase === "events") {
      const e = events[iEvent];
      const t = smooth(clamp01(tPhase / DUR[e.type]));
      ctx.strokeStyle = col.line;
      ctx.lineWidth = 1.2;
      if (e.type === "base") segment(e.a, e.b, t, true);
      if (e.type === "farthest") {
        segment(e.a, e.b, 1, true);
        ctx.strokeStyle = col.ink;
        segment(foot(e.a, e.b, e.c), e.c, t);
      }
      if (e.type === "discard") {
        ctx.globalAlpha = 1 - t * 0.6;
        segment(e.a, e.c, 1, true);
        segment(e.c, e.b, 1, true);
        segment(e.a, e.b, 1, true);
        ctx.globalAlpha = 1;
      }
      if (e.type === "edge") {
        ctx.strokeStyle = col.hull;
        ctx.lineWidth = 2.6;
        segment(e.a, e.b, t);
      }
    }

    // Confirmed hull edges
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col.hull;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    edges.forEach((e) => segment(e.a, e.b));
    ctx.globalAlpha = 1;

    points.forEach((p) => drawPoint(p, alpha));

    // While discarding, the points inside triangle acb slowly turn red
    if (phase === "events" && events[iEvent].type === "discard") {
      const t = smooth(clamp01(tPhase / DUR.discard));
      ctx.fillStyle = col.discarded;
      ctx.globalAlpha = t * 0.75;
      events[iEvent].interior.forEach((p) => {
        ctx.beginPath(); ctx.arc(X(p), Y(p), side * 0.011, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------- Main loop ---------- */
  const TURN_MS = 26000; // one full turn every 26 s
  let angle = 0, previous = null, visible = true, frameId = null;

  function frame(now) {
    frameId = null;
    if (previous === null) previous = now;
    const dt = Math.min(now - previous, 60); // avoids jumps when returning to the tab
    previous = now;
    angle -= (dt / TURN_MS) * 2 * Math.PI; // clockwise, like a loading icon
    advance(dt);
    draw(angle);
    if (visible) frameId = requestAnimationFrame(frame);
  }

  // With reduced motion: a single static hull, no loop
  function still() {
    newCycle();
    events.forEach(completeEvent);
    phase = "hold"; tPhase = 0;
    draw(0);
  }

  function start() {
    if (reducedMotion.matches) { still(); return; }
    if (!frameId) { previous = null; frameId = requestAnimationFrame(frame); }
  }

  // Pause while the hero is off screen (saves battery)
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) start();
  }).observe(canvas);

  reducedMotion.addEventListener("change", start);
  // Redraw the static hull if the theme changes with reduced motion
  new MutationObserver(() => reducedMotion.matches && draw(0))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  newCycle();
  start();
})();
