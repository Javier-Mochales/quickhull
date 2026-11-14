# ===================================================================
#  QUICKHULL - "Quickhull vs Graham" applet
#  (runs after core.sage)
# ===================================================================

from time import perf_counter


def best_time(function, P, repetitions):
    """Best time (in ms) over several runs: the minimum is the measurement
       least affected by other processes on the server."""
    best = float('inf')
    for _ in range(int(repetitions)):
        t0 = perf_counter()
        function(P)
        best = min(best, perf_counter() - t0)
    return 1000 * best


def sizes_for(cloud, n_max):
    """Cloud sizes to test: 8 values evenly spaced on a logarithmic scale
       (for the worst case, at most 300 points: see random_cloud)."""
    if cloud == DISTRIBUTIONS[4]:
        return [25, 50, 100, 150, 200, 250, 300]
    lo, hi = math.log10(100), math.log10(n_max)
    return sorted(set(int(round(10 ** (lo + (hi - lo) * i / 7.0))) for i in range(8)))


def empirical_exponent(ns, ts):
    """Slope of the least-squares line on a log-log scale:
       if t ~ C n^k, the slope is k (about 1 for n log n, about 2 for n^2)."""
    xs = [math.log(n) for n in ns]
    ys = [math.log(max(t, 1e-6)) for t in ts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return (sum((x - mx) * (y - my) for x, y in zip(xs, ys))
            / sum((x - mx) ** 2 for x in xs))


# Sage runs an interact once when it is created, even with auto_update=False.
# That first call only shows a hint: nothing is measured until the button is pressed.
_waiting_for_run = [True]


@interact
def benchmark(
        cloud=selector(DISTRIBUTIONS, default=DISTRIBUTIONS[0], label='Point cloud'),
        n_max=selector([1000, 10000, 50000, 100000], default=10000, buttons=True,
                       label='Maximum n'),
        repetitions=slider(1, 5, 1, 3, label='Repetitions'),
        with_filter=checkbox(True, label='Include Quickhull with filter'),
        scale=selector(['Logarithmic', 'Linear'], buttons=True, label='Scale'),
        seed=input_box(1, label='Seed', width=8),
        auto_update=False):          # runs only when the Run benchmark button is pressed

    if _waiting_for_run[0]:
        _waiting_for_run[0] = False
        print('Choose the settings and press Run benchmark.')
        return

    algorithms = [('Quickhull', HULL, lambda P: quickhull(P))]
    if with_filter:
        algorithms.append(('Quickhull with filter', VERTEX, lambda P: quickhull(P, quad_filter=True)))
    algorithms.append(('Graham', INK, graham))

    sizes = sizes_for(cloud, n_max)
    times = {name: [] for name, _, _ in algorithms}
    rows = []
    for n in sizes:
        P = [(float(x), float(y)) for x, y in random_cloud(cloud, n, seed)]
        hull = quickhull(P)
        row = [n, len(hull)]
        for name, _, function in algorithms:
            t = best_time(function, P, repetitions)
            times[name].append(t)
            row.append('%.2f' % t)
        # check: all methods must return exactly the same vertices
        same = set(hull) == set(graham(P)) and (not with_filter or
                                               set(hull) == set(quickhull(P, quad_filter=True)))
        if with_filter:
            Pu = list(set(P))
            _, _, inside = partition(Pu, extreme_points(Pu, True))
            row.append('%.0f%%' % (100.0 * len(inside) / len(Pu)))
        row.append('yes' if same else 'NO')
        rows.append(row)

    # --- plot ---
    G = Graphics()
    for name, colour, _ in algorithms:
        G += line(list(zip(sizes, times[name])), color=colour, thickness=2.2,
                  marker='o', markersize=5, legend_label=name)
    G.set_legend_options(loc='upper left', font_size=11, frameon=False)
    G.show(scale='loglog' if scale == 'Logarithmic' else 'linear',
           axes_labels=['n (number of points)', 'time (ms)'],
           frame=True, axes=False, gridlines=True, figsize=[7.5, 4.5])

    # --- table ---
    header = ['n', 'h = |CH(S)|'] + ['%s (ms)' % name for name, _, _ in algorithms]
    if with_filter:
        header.append('discarded by filter')
    header.append('same result')
    show(table([header] + rows, header_row=True, align='center'))

    # --- summary ---
    n = sizes[-1]
    qh, gr = times['Quickhull'][-1], times['Graham'][-1]
    if qh <= gr:
        print('For n = %d, Quickhull is %.1f times faster than Graham.' % (n, gr / qh))
    else:
        print('For n = %d, Quickhull is %.1f times slower than Graham.' % (n, qh / gr))
    print('Empirical exponent k (time ~ n^k): ' + ', '.join(
        '%s %.2f' % (name, empirical_exponent(sizes, times[name]))
        for name, _, _ in algorithms))
    print('Reference: n log n gives k slightly above 1; n^2 gives k = 2.')
