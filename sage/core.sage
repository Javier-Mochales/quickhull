# ===================================================================
#  QUICKHULL - Algorithm core
#  Final Project 4 - Computational Geometry - iMAT - Comillas ICAI
#  Authors: Javier Martínez Berenguer, Javier Mochales López,
#           Ignacio Mascarell Agundez
#
#  Points are handled as (x, y) tuples of Python floats: this is the
#  fastest representation in Sage for elementary operations
#  (vector() creates new Sage objects on every operation).
# ===================================================================

import math
from random import Random

# Website palette: each colour means the same thing on the site and in the applet
HULL      = '#1F8F6A'   # convex hull edges / Quickhull
VERTEX    = '#E3A90B'   # vertices of CH(S) / Quickhull with filter
DISCARDED = '#B8423C'   # discarded interior points
INK       = '#1C2B36'   # points of the current subproblem, text / Graham
PENDING   = '#A9B6BD'   # points not yet classified
AUXILIARY = '#6B808C'   # auxiliary lines (pq, triangles)


# ------------------------------------------------------------------
#  Geometric primitive: signed area
# ------------------------------------------------------------------
def orientation(p, q, r):
    """Twice the signed area of triangle pqr.
       > 0  if r lies to the LEFT of the directed line p -> q
       < 0  if r lies to the RIGHT
       = 0  if p, q, r are collinear."""
    px, py = p
    qx, qy = q
    rx, ry = r
    return (qx - px) * (ry - py) - (qy - py) * (rx - px)


def farthest(p, q, S):
    """Point of S farthest from the line pq.
       Every point of S lies to the right of p -> q (signed area < 0),
       so the farthest one is the one with the smallest signed area.
       Ties: if several points are equally far (collinear on a line
       parallel to pq), only the endpoints of that segment are vertices
       of CH(S); we take the one closest to p in the direction of pq."""
    (px, py), (qx, qy) = p, q
    dx, dy = qx - px, qy - py
    c, dc = S[0], orientation(p, q, S[0])
    for r in S:
        d = orientation(p, q, r)
        if d < dc or (d == dc and (r[0] - px) * dx + (r[1] - py) * dy
                                  < (c[0] - px) * dx + (c[1] - py) * dy):
            c, dc = r, d
    return c


# ------------------------------------------------------------------
#  Initial extreme points and quadrilateral filter (Akl-Toussaint)
# ------------------------------------------------------------------
def extreme_points(P, quad_filter):
    """Initial vertices of CH(S), in counter-clockwise order.
       Without filter: [a, b] = minimum and maximum x (as in the lecture notes).
       With filter: [min_x, min_y, max_x, max_y], the 4 extreme points
       that form the quadrilateral of the filter."""
    a = min(P)                                        # smallest x (ties: smallest y)
    b = max(P)                                        # largest x (ties: largest y)
    if not quad_filter:
        candidates = [a, b]
    else:
        bottom = min(P, key=lambda p: (p[1], -p[0]))  # smallest y (ties: largest x)
        top = max(P, key=lambda p: (p[1], -p[0]))     # largest y (ties: smallest x)
        candidates = [a, bottom, b, top]
    E = []
    for p in candidates:                              # drop repeats, keep the order
        if p not in E:
            E.append(p)
    return E


def partition(P, E):
    """Assigns each point of P to the side of polygon E that has it on its
       right (outside the polygon). A point cannot be to the right of two
       sides at once, so the first one is enough. Points that are to the
       right of no side are interior (or on the boundary) and are discarded."""
    k = len(E)
    sides = [(E[i], E[(i + 1) % k]) for i in range(k)]
    subsets = [[] for _ in sides]
    discarded = []
    corners = set(E)
    for r in P:
        if r in corners:
            continue
        for j, (p, q) in enumerate(sides):
            if orientation(p, q, r) < 0:
                subsets[j].append(r)
                break
        else:
            discarded.append(r)
    return sides, subsets, discarded


# ------------------------------------------------------------------
#  QUICKHULL
# ------------------------------------------------------------------
def quickhull(S, quad_filter=False, steps=None):
    """Convex hull CH(S) with Quickhull.

       S           : list of points (x, y).
       quad_filter : if True, the points inside the quadrilateral of the
                     4 extreme points are discarded before starting.
       steps       : if a list is given, it is filled with the steps of
                     the algorithm so they can be drawn (step-by-step applet).

       Returns the vertices of CH(S) in counter-clockwise order,
       starting with the one with the smallest x.

       This is the FUNCTION Quickhull(a, b, S) of the lecture notes, but with
       an explicit stack instead of recursion: in the worst case the recursion
       would reach depth n and Python stops it at around 1000 levels."""
    P = list(set((float(x), float(y)) for x, y in S))     # floats, no repeats
    if len(P) < 3:
        return sorted(P)

    E = extreme_points(P, quad_filter)
    if len(E) < 2:
        return E
    sides, subsets, discarded = partition(P, E)
    if steps is not None:
        steps.append(('start', E, [list(s) for s in subsets], discarded, quad_filter))

    hull = []
    # stack of subproblems (p, q, S): S are the points to the right of p -> q.
    # They are pushed in reverse so they are solved in hull order.
    stack = [(p, q, Sj) for (p, q), Sj in zip(sides, subsets)]
    stack.reverse()
    while stack:
        p, q, S = stack.pop()
        if not S:                                   # nothing outside: pq is an edge of CH(S)
            hull.append(p)
            if steps is not None:
                steps.append(('edge', p, q))
            continue
        c = farthest(p, q, S)                       # c belongs to CH(S)
        A, B = [], []                               # A: right of pc ; B: right of cq
        for r in S:
            if orientation(p, c, r) < 0:
                A.append(r)
            elif orientation(c, q, r) < 0:
                B.append(r)
        if steps is not None:
            interior = [r for r in S if r != c and r not in A and r not in B]
            steps.append(('farthest', p, q, S, c))
            steps.append(('discard', p, q, c, interior, A, B))
        stack.append((c, q, B))                     # solved afterwards
        stack.append((p, c, A))                     # solved first
    return hull


# ------------------------------------------------------------------
#  GRAHAM (for the benchmark)
# ------------------------------------------------------------------
def graham(S):
    """Convex hull with Graham's scan. Returns the vertices in
       counter-clockwise order, starting with the one with the smallest x."""
    P = list(set((float(x), float(y)) for x, y in S))
    if len(P) < 3:
        return sorted(P)
    o = min(P, key=lambda p: (p[1], p[0]))         # pivot: smallest y (ties: smallest x)
    ox, oy = o
    rest = [p for p in P if p != o]
    # angular order around the pivot; same angle: farthest first
    rest.sort(key=lambda p: (math.atan2(p[1] - oy, p[0] - ox),
                             -((p[0] - ox) ** 2 + (p[1] - oy) ** 2)))
    # on each ray only the farthest point can be a vertex
    unique, last = [], None
    for p in rest:
        angle = math.atan2(p[1] - oy, p[0] - ox)
        if angle != last:
            unique.append(p)
            last = angle
    stack = [o]
    for p in unique:
        while len(stack) > 1 and orientation(stack[-2], stack[-1], p) <= 0:
            stack.pop()                             # not a left turn
        stack.append(p)
    i = stack.index(min(stack))                     # start with the smallest x
    return stack[i:] + stack[:i]


# ------------------------------------------------------------------
#  Point cloud generators
# ------------------------------------------------------------------
DISTRIBUTIONS = ['Uniform in a square',
                 'Uniform in a disk',
                 'Gaussian',
                 'On a circle (all on the hull)',
                 'Quickhull worst case (parabola)']

def random_cloud(distribution, n, seed=1):
    """Returns n points (x, y) following the chosen distribution."""
    n = int(n)
    g = Random(int(seed))
    if distribution == DISTRIBUTIONS[0]:
        return [(g.uniform(-1, 1), g.uniform(-1, 1)) for _ in range(n)]
    if distribution == DISTRIBUTIONS[1]:
        pts = []
        for _ in range(n):
            r, t = math.sqrt(g.random()), g.uniform(0, 2 * math.pi)
            pts.append((r * math.cos(t), r * math.sin(t)))
        return pts
    if distribution == DISTRIBUTIONS[2]:
        return [(g.gauss(0, 0.4), g.gauss(0, 0.4)) for _ in range(n)]
    if distribution == DISTRIBUTIONS[3]:
        ts = [g.uniform(0, 2 * math.pi) for _ in range(n)]
        return [(math.cos(t), math.sin(t)) for t in ts]
    if distribution == DISTRIBUTIONS[4]:
        # Points (x, x^2) with x = 1, 1/2, 1/4, ... and the origin. All of them
        # are on CH(S) and the point farthest from each chord is always the
        # next one in the list, so every split leaves one side empty:
        # T(n) = T(n-1) + O(n)  =>  O(n^2).
        # With x = 2^-k the floating point computations are exact up to k ~ 300.
        n = min(n, 300)
        xs = [0.0] + [2.0 ** (-k) for k in range(n - 1)]
        return [(x, x * x) for x in xs]
    raise ValueError('Unknown distribution: %s' % distribution)
