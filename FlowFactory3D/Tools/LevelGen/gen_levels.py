"""One-off authoring tool: generates levels 13-36 as ASCII specs for LevelCatalog.cs.

The output is committed as static data (the game never generates levels at runtime). Re-running with the same
seed reproduces the same levels. Every level is checked here (known solution works, initial state is not solved)
and again by the C# tests. Usage: python3 gen_levels.py > levels_13_36.txt
"""
import random, sys

N, E, S, W = 0, 1, 2, 3
DX = {N: 0, E: 1, S: 0, W: -1}
DY = {N: -1, E: 0, S: 1, W: 0}
OPP = lambda d: (d + 2) % 4
BASE = {"straight": {N, S}, "corner": {N, E}, "source": {N}, "target": {N}}


def openings(kind, rot):
    return {(d + rot) % 4 for d in BASE[kind]}


def validate(w, h, tiles, rots):
    """tiles: dict (x,y)->kind ; rots: dict (x,y)->rotation. Returns True if the route reaches the target."""
    src = next(p for p, k in tiles.items() if k == "source")
    pos, heading = src, next(iter(openings("source", rots[src])))
    for _ in range(w * h * 4 + 4):
        nx, ny = pos[0] + DX[heading], pos[1] + DY[heading]
        if not (0 <= nx < w and 0 <= ny < h) or (nx, ny) not in tiles:
            return False
        kind = tiles[(nx, ny)]
        if kind == "block":
            return False
        entry = OPP(heading)
        if entry not in openings(kind, rots[(nx, ny)]):
            return False
        if kind == "target":
            return True
        if kind == "source":
            return False
        heading = next(iter(openings(kind, rots[(nx, ny)]) - {entry}))
        pos = (nx, ny)
    return False


def random_path(rng, w, h, lo, hi):
    for _ in range(4000):
        start = (rng.randrange(w), rng.randrange(h))
        path = [start]
        seen = {start}
        target_len = rng.randint(lo, hi)

        def extend():
            if len(path) >= target_len:
                return True
            x, y = path[-1]
            dirs = [N, E, S, W]
            rng.shuffle(dirs)
            for d in dirs:
                nxt = (x + DX[d], y + DY[d])
                if 0 <= nxt[0] < w and 0 <= nxt[1] < h and nxt not in seen:
                    path.append(nxt)
                    seen.add(nxt)
                    if extend():
                        return True
                    path.pop()
                    seen.discard(nxt)
            return False

        if extend():
            return path
    raise RuntimeError("no path")


def dir_between(a, b):
    for d in (N, E, S, W):
        if (a[0] + DX[d], a[1] + DY[d]) == b:
            return d


CORNER_NAME = {0: "NE", 1: "ES", 2: "SW", 3: "WN"}
ARROW = {N: "^", E: ">", S: "v", W: "<"}


def build(rng, w, h, lo, hi, rot_prob, decoy_prob, block_prob, fixed_decoy_prob, zero_tap_prob):
    for _ in range(500):
        path = random_path(rng, w, h, lo, hi)
        tiles, sol, init, token = {}, {}, {}, {}
        turns = 0
        for i, p in enumerate(path):
            if i == 0:
                d = dir_between(p, path[1])
                tiles[p] = "source"; sol[p] = init[p] = d
                token[p] = "S" + ARROW[d]
            elif i == len(path) - 1:
                d = dir_between(p, path[-2])
                tiles[p] = "target"; sol[p] = init[p] = d
                token[p] = "T" + ARROW[d]
            else:
                a, b = dir_between(p, path[i - 1]), dir_between(p, path[i + 1])
                if OPP(a) == b:
                    tiles[p] = "straight"
                    horizontal = a in (E, W)
                    sol[p] = 1 if horizontal else 0
                    name = "H" if horizontal else "V"
                else:
                    turns += 1
                    tiles[p] = "corner"
                    want = {a, b}
                    sol[p] = next(r for r in range(4) if openings("corner", r) == want)
                    name = CORNER_NAME[sol[p]]
                rotatable = rng.random() < rot_prob
                if rotatable:
                    if tiles[p] == "straight":
                        taps = 0 if rng.random() < zero_tap_prob else 1
                    else:
                        taps = 0 if rng.random() < zero_tap_prob else rng.choice([1, 2, 3])
                    init[p] = (sol[p] - taps) % 4
                    token[p] = name + (":%d" % taps if taps else "")
                else:
                    init[p] = sol[p]
                    token[p] = name.lower()
        # decoys and crates on the other cells
        for y in range(h):
            for x in range(w):
                p = (x, y)
                if p in tiles:
                    continue
                r = rng.random()
                if r < block_prob:
                    tiles[p] = "block"; sol[p] = init[p] = 0; token[p] = "#"
                elif r < block_prob + decoy_prob:
                    kind = rng.choice(["straight", "corner"])
                    tiles[p] = kind
                    s = rng.randrange(4) if kind == "corner" else rng.randrange(2)
                    sol[p] = s
                    name = ("H" if s == 1 else "V") if kind == "straight" else CORNER_NAME[s]
                    if rng.random() < fixed_decoy_prob:
                        init[p] = s; token[p] = name.lower()
                    else:
                        taps = rng.choice([0, 1, 2, 3]) if kind == "corner" else rng.choice([0, 1])
                        init[p] = (s - taps) % 4
                        token[p] = name + (":%d" % taps if taps else "")
                else:
                    token[p] = "."
        needed = sum(1 for p in path[1:-1] if tiles[p] != "x" and init[p] != sol[p] and
                     openings(tiles[p], init[p]) != openings(tiles[p], sol[p]))
        if not validate(w, h, tiles, sol):
            continue
        if validate(w, h, tiles, init):
            continue
        if needed < 2 or turns < 2:
            continue
        rows = [" ".join(token[(x, y)] for x in range(w)) for y in range(h)]
        return rows, len(path), turns, needed
    raise RuntimeError("could not build")


TITLES = [
    "Overtime", "Night Shift", "Loading Bay", "Conveyor Maze", "Fast Lane", "Sorting Hall",
    "Detour", "Zig Zag", "Packing Line", "Mixed Up", "Tight Squeeze", "Grand Opening",
    "Second Wind", "Rush Order", "Back Alley", "Crossroads", "Spiral Stairs", "Long Haul",
    "Hidden Path", "Clockwork", "Double Back", "Foreman's Test", "Master Plan", "Factory Legend",
]
HINTS = [
    "Trace the route from the source first.", "Count the turns before you tap.",
    "Belts that are already right can be left alone.", "Crates never move. Plan around them.",
    "Some belts only look useful.", "Work backwards from the target.",
    "A long way round can be the only way.", "Fix the corners, then the straights.",
]


def main():
    rng = random.Random(20261104)
    out = []
    for i in range(24):
        world = 2 if i < 12 else 3
        t = (i % 12) / 11.0
        if world == 2:
            lo, hi = 8 + int(t * 3), 11 + int(t * 3)
            params = dict(rot_prob=0.80 + 0.12 * t, decoy_prob=0.30 + 0.20 * t, block_prob=0.08 + 0.04 * t, fixed_decoy_prob=0.30, zero_tap_prob=0.10)
        else:
            lo, hi = 11 + int(t * 3), 15 + int(t * 3)
            params = dict(rot_prob=0.92 + 0.08 * t, decoy_prob=0.50 + 0.30 * t, block_prob=0.06 + 0.04 * t, fixed_decoy_prob=0.20, zero_tap_prob=0.18)
        rows, length, turns, needed = build(rng, 5, 5, lo, hi, **params)
        out.append((TITLES[i], HINTS[i % len(HINTS)], rows, length, turns, needed))
    for title, hint, rows, length, turns, needed in out:
        print('            new Spec("%s", "%s", false,' % (title, hint))
        for j, row in enumerate(rows):
            print('                "%s"%s' % (row, "),\n" if j == len(rows) - 1 else ","))
        sys.stderr.write("%-18s path=%2d turns=%2d wrongTiles=%2d\n" % (title, length, turns, needed))


main()
