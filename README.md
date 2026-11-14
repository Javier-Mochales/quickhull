# Quickhull

Interactive website about computing the **convex hull of a point cloud with the Quickhull algorithm**, with a SageMath applet that runs in the browser.

**Live site:** https://javier-mochales.github.io/quickhull/

Final project for *Computational Geometry* (iMAT, Universidad Pontificia Comillas, ICAI), 2026-2027.

**Authors:** Javier Martínez Berenguer, Javier Mochales López, Ignacio Mascarell Agundez.

## What is on the site

- **Introduction**: what a convex hull is (with a small board where you can drag the points), how Quickhull works in four moves, why it is correct, the signed-area test it relies on, its pseudocode and its complexity.
- **Instructions**: how to use the applet.
- **Interactive applet** ([applet.html](applet.html)):
  - *Quickhull step by step*: choose a point cloud (random distributions, the worst case of Quickhull, or your own points), optionally apply the Akl–Toussaint quadrilateral filter, and watch every step of the algorithm, playing it or going step by step.
  - *Quickhull versus Graham*: times both algorithms on growing clouds, checks that they return the same hull and estimates the empirical exponent of each one.
- **Discussion and real-world applications**, and **references**.

## How it works

The algorithms are written in SageMath and run on the public [SageMathCell](https://sagecell.sagemath.org) servers, so the site is plain static HTML and nothing needs to be installed. SageMath computes the hull and every step of Quickhull; the browser only draws them.

```
index.html                    main page
applet.html                   the applet
sage/core.sage                Quickhull, quadrilateral filter, Graham scan, point generators
sage/step_by_step.sage        step-by-step applet (sends the steps to the player)
sage/benchmark.sage           Quickhull versus Graham benchmark
assets/js/quickhull-player.js draws the steps computed by SageMath
assets/js/applet.js           loads the Sage files into SageMathCell
assets/js/hero-quickhull.js   animation of the front page
assets/js/hull-sandbox.js     interactive board of the introduction
assets/js/theme.js            light / dark mode
assets/css/style.css          styles
```

## Running it locally

The applet loads the `.sage` files with `fetch`, so open the site through a local web server rather than as a file:

```bash
python -m http.server 8000
```

and visit http://localhost:8000. An internet connection is needed for SageMathCell.
