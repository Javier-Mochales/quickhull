/* ==========================================================
   "Nails and rubber band" sandbox for the introduction.
   Drag the points, click an empty spot to add one and
   double-click a point to remove it: the convex hull
   (computed here with a small JavaScript Quickhull) follows.
   ========================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("sandbox-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const counter = document.getElementById("sandbox-count");
  const resetBtn = document.getElementById("sandbox-reset");

  const START = [[0.18, 0.62], [0.32, 0.22], [0.55, 0.15], [0.80, 0.30], [0.86, 0.66],
                 [0.62, 0.86], [0.30, 0.82], [0.45, 0.45], [0.62, 0.55], [0.40, 0.65], [0.68, 0.38]];
  let pts = START.map((p) => p.slice());

  /* ---------- Quickhull (same idea as the SageMath version) ---------- */
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  function hull(P) {
    if (P.length < 3) return P.slice();
    let a = P[0], b = P[0];
    P.forEach((p) => {
      if (p[0] < a[0] || (p[0] === a[0] && p[1] < a[1])) a = p;
      if (p[0] > b[0] || (p[0] === b[0] && p[1] > b[1])) b = p;
    });
    const out = [];
    const right = (S, p, q) => S.filter((r) => orient(p, q, r) < 0);
    function qh(p, q, S) {
      if (!S.length) { out.push(p); return; }
      let c = S[0];
      S.forEach((r) => { if (orient(p, q, r) < orient(p, q, c)) c = r; });
      qh(p, c, right(S, p, c));
      qh(c, q, right(S, c, q));
    }
    qh(a, b, right(P, a, b));
    qh(b, a, right(P, b, a));
    return out;
  }

  /* ---------- Drawing ---------- */
  let W = 0, H = 0;
  function colours() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    return { ink: v("--ink"), hull: v("--hull"), veil: v("--hull-veil"), vertex: v("--vertex"), point: v("--point") };
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  const sx = (p) => p[0] * W, sy = (p) => p[1] * H;

  function draw() {
    if (!W) return;
    const c = colours();
    const h = hull(pts);
    ctx.clearRect(0, 0, W, H);
    if (h.length >= 3) {
      ctx.beginPath();
      h.forEach((p, i) => (i ? ctx.lineTo(sx(p), sy(p)) : ctx.moveTo(sx(p), sy(p))));
      ctx.closePath();
      ctx.fillStyle = c.veil;
      ctx.fill();
      ctx.strokeStyle = c.hull;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    const onHull = new Set(h);
    pts.forEach((p) => {
      ctx.beginPath();
      if (onHull.has(p)) {
        ctx.arc(sx(p), sy(p), 7, 0, 2 * Math.PI);
        ctx.fillStyle = c.vertex;
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = c.ink;
        ctx.stroke();
      } else {
        ctx.arc(sx(p), sy(p), 5, 0, 2 * Math.PI);
        ctx.fillStyle = c.point;
        ctx.fill();
      }
    });
    counter.textContent = pts.length + " points, " + h.length + " on the hull";
  }

  /* ---------- Interaction ---------- */
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bestD = 18;
    pts.forEach((p) => {
      const d = Math.hypot(sx(p) - x, sy(p) - y);
      if (d < bestD) { bestD = d; best = p; }
    });
    return { point: best, x: Math.min(Math.max(x / W, 0.03), 0.97), y: Math.min(Math.max(y / H, 0.03), 0.97) };
  }
  let dragging = null;
  canvas.addEventListener("pointerdown", (e) => {
    const hit = pick(e);
    if (hit.point) {
      dragging = hit.point;
      canvas.setPointerCapture(e.pointerId);
    } else {
      pts.push([hit.x, hit.y]);
      draw();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const hit = pick(e);
    canvas.style.cursor = dragging ? "grabbing" : hit.point ? "grab" : "crosshair";
    if (!dragging) return;
    dragging[0] = hit.x;
    dragging[1] = hit.y;
    draw();
  });
  canvas.addEventListener("pointerup", () => { dragging = null; });
  canvas.addEventListener("dblclick", (e) => {
    const hit = pick(e);
    if (hit.point && pts.length > 3) {
      pts = pts.filter((p) => p !== hit.point);
      draw();
    }
  });
  resetBtn.addEventListener("click", () => { pts = START.map((p) => p.slice()); draw(); });

  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
})();
