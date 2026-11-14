# ===================================================================
#  QUICKHULL - "Step by step" applet
#  (runs after core.sage)
# ===================================================================

import ast
import json
import uuid


def fmt(p):
    return '(%.3g, %.3g)' % p


def parse_points(text):
    """Turns the text '[(x1, y1), (x2, y2), ...]' into a list of points."""
    try:
        data = ast.literal_eval(text.strip())
        pts = [(float(x), float(y)) for x, y in data]
    except Exception:
        raise ValueError('Write the points as [(x1, y1), (x2, y2), ...], '
                         'for example [(0, 0), (4, 1), (2, 5)].')
    if len(set(pts)) < 3:
        raise ValueError('At least 3 different points are needed.')
    return pts


def count_points(k):
    """'1 point', '2 points', ..."""
    return '%d point%s' % (k, '' if k == 1 else 's')


def explain(P, steps, hull, k):
    """Text explaining step k (k = len(steps) is the final result)."""
    if k >= len(steps):
        return ('Result: CH(S) has %d vertices (out of %s). Counter-clockwise: %s'
                % (len(hull), count_points(len(P)), ', '.join(fmt(v) for v in hull)))
    step = steps[k]
    if step[0] == 'start':
        E, subsets, discarded_start, with_filter = step[1], step[2], step[3], step[4]
        if with_filter and len(E) > 2:
            return ('Quadrilateral filter: the extreme points %s form a quadrilateral. '
                    'Its %s inside cannot be on CH(S) and are discarded '
                    '(%.0f%% of the cloud). %s points remain outside, split into %d subproblems.'
                    % (', '.join(fmt(v) for v in E), count_points(len(discarded_start)),
                       100.0 * len(discarded_start) / len(P),
                       ' + '.join(str(len(s)) for s in subsets), len(E)))
        return ('Find the extreme points: a = %s (minimum x) and b = %s (maximum x) are on CH(S). '
                'The line ab splits the cloud: %s to the right of ab (below) '
                'and %d to the right of ba (above).'
                % (fmt(E[0]), fmt(E[-1]), count_points(len(subsets[0])),
                   len(subsets[1]) if len(subsets) > 1 else 0))
    if step[0] == 'farthest':
        _, p, q, S, c = step
        return ('Subproblem Quickhull(p, q, S) with %s to the right of pq. '
                'The farthest one from the line pq is c = %s, which is a vertex of CH(S).'
                % (count_points(len(S)), fmt(c)))
    if step[0] == 'discard':
        _, p, q, c, interior, A, B = step
        gone = ('No point lies inside the triangle pcq. ' if not interior else
                'The %s inside the triangle pcq %s discarded. '
                % (count_points(len(interior)), 'is' if len(interior) == 1 else 'are'))
        return (gone + 'A = %s to the right of pc and B = %s to the right of cq: '
                'solve Quickhull(p, c, A) and Quickhull(c, q, B).'
                % (count_points(len(A)), count_points(len(B))))
    _, p, q = step
    return ('No point is left to the right of pq: '
            'the segment %s - %s is an edge of CH(S).' % (fmt(p), fmt(q)))


# ------------------------------------------------------------------
#  Player: SageMath computes everything (the hull, every step and its
#  explanation) and sends it as JSON to the page, where
#  assets/js/quickhull-player.js draws it smoothly in the browser:
#  as an animation (play / pause, speed, seek bar) or step by step
#  (previous / next), without asking the server again.
# ------------------------------------------------------------------
def player_data(P, steps, hull, box):
    """The steps of Quickhull as JSON, with points referred to by index."""
    index = {p: i for i, p in enumerate(P)}
    ids = lambda pts: [index[p] for p in pts]
    out = []
    for s in steps:
        if s[0] == 'start':
            out.append({'t': 'start', 'E': ids(s[1]), 'subsets': [ids(S) for S in s[2]],
                        'discarded': ids(s[3]), 'filter': bool(s[4])})
        elif s[0] == 'farthest':
            out.append({'t': 'farthest', 'p': index[s[1]], 'q': index[s[2]],
                        'S': ids(s[3]), 'c': index[s[4]]})
        elif s[0] == 'discard':
            out.append({'t': 'discard', 'p': index[s[1]], 'q': index[s[2]], 'c': index[s[3]],
                        'interior': ids(s[4]), 'A': ids(s[5]), 'B': ids(s[6])})
        else:
            out.append({'t': 'edge', 'p': index[s[1]], 'q': index[s[2]]})
    return json.dumps({
        'points': [[float(x), float(y)] for x, y in P],
        'steps': out,
        'hull': ids(hull),
        'box': [float(v) for v in box],
        'captions': [explain(P, steps, hull, k) for k in range(len(steps) + 1)],
        'colours': {'hull': HULL, 'vertex': VERTEX, 'discarded': DISCARDED,
                    'ink': INK, 'pending': PENDING, 'auxiliary': AUXILIARY},
    })


def quickhull_player(P, steps, hull, box):
    """HTML that shows the player in the cell output."""
    name = 'qh-player-%s' % uuid.uuid4().hex[:10]
    payload = player_data(P, steps, hull, box).replace('</', '<\\/')   # safe inside <script>
    return ('<div class="qh-player" id="%s"><script type="application/json">%s</script>'
            '<p>Loading the player...</p></div>'
            '<script>(function () {'
            '  var el = document.getElementById("%s");'
            '  if (window.QuickhullPlayer) { window.QuickhullPlayer.mount(el); }'
            '  else { el.lastChild.textContent = "The player only works inside the '
            'project website (it needs assets/js/quickhull-player.js)."; }'
            '})();</script>' % (name, payload, name))


def bounding_box(P):
    xs, ys = [p[0] for p in P], [p[1] for p in P]
    m = 0.14 * max(max(xs) - min(xs), max(ys) - min(ys), 1e-9)
    return (min(xs) - m, max(xs) + m, min(ys) - m, max(ys) + m)


CLOUD_OPTIONS = DISTRIBUTIONS + ['Points entered by hand']
MANUAL_EXAMPLE = '[(0, 0), (4, 1), (6, 4), (3, 6), (1, 4), (3, 3), (2, 2), (4, 3), (5, 2)]'


# Sage runs an interact once when it is created, even with auto_update=False.
# That first call only shows a hint: nothing is computed until Start is pressed.
_waiting_for_start = [True]


@interact
def quickhull_applet(
        cloud=selector(CLOUD_OPTIONS, default=CLOUD_OPTIONS[0], label='Point cloud'),
        n=slider(3, 300, 1, 25, label='Number of points n'),
        seed=input_box(1, label='Seed', width=8),
        manual=input_box(MANUAL_EXAMPLE, type=str, label='Points by hand', width=36),
        quad_filter=checkbox(False, label='Quadrilateral filter'),
        auto_update=False):          # runs only when the Start button is pressed

    if _waiting_for_start[0]:
        _waiting_for_start[0] = False
        print('Choose the settings and press Start.')
        return

    # 1. Point cloud
    try:
        if cloud == 'Points entered by hand':
            P = parse_points(manual)
        else:
            P = random_cloud(cloud, n, seed)
    except ValueError as error:
        print(error)
        return
    P = list(set((float(x), float(y)) for x, y in P))

    # 2. Quickhull recording its steps
    steps = []
    hull = quickhull(P, quad_filter=quad_filter, steps=steps)
    box = bounding_box(P)
    print('%d points, %d steps, CH(S) with %d vertices' % (len(P), len(steps), len(hull)))

    # 3. Player: plays the whole process or goes step by step, without
    #    asking the server again (everything is already computed)
    show(html(quickhull_player(P, steps, hull, box)))
