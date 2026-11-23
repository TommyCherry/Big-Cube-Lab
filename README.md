# L2C Lab

A browser-based lab for practicing and solving the last two centers on 5x5 and 6x6 cubes.

- 5x5 case library, pattern filters, and optimal algorithms.
- Trainer with saved sessions, timing, and spaced repetition.
- Redux and Yau modes; Yau preserves FL, DL, and BL edges.
- 6x6 move-optimal and ergonomic searches, random cases, and last-bar filters.
- Ergonomic slice notation, setup blocks, and finishing commutators.

## Run locally

Requires Python 3. No package installation is needed.

```sh
git clone https://github.com/TommyCherry/L2C-Lab.git
cd L2C-Lab
python3 build.py
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/output/cube-interface.html in your browser.
Stop the server with Ctrl+C. Rebuild and refresh after editing source files.

The generated interface is standalone. Serving it locally gives browser workers and persisted pattern tables a consistent origin. Trainer sessions and pattern tables are stored in your browser.

## Tests

Requires a recent Node.js version supporting `structuredClone`.

```sh
for test in tests/*.test.cjs; do
  node "$test" || break
done
```

Some exhaustive solver tests take a while. Bidirectional BFS exists only as an independent test oracle.

## Source layout

- `layout.html`, `app.css`: interface and styling.
- `solver.js`, `expanded-solver.js`, `yau.js`: 5x5 solving.
- `six.js`, `six-ida.js`, `six-cache.js`, `six-notation.js`: 6x6 model, search, caching, and notation.
- `case-library.js`, `case-browser.js`, `trainer.js`: library and training.
- `data/`: precomputed 5x5 case libraries.
- `scripts/`: case-library generation tools.
- `tests/`: model, optimality, UI, and regression checks.
- `output/`: generated standalone app files.

Keep both files in `output/` in the repository: `build.py` also reads the bootstrap/model code outside the generated markers in `output/cube-centers.html`.

Optimality is within the selected search grammar and move-count convention. A time/depth limit does not establish an optimal solution or imply that a case is unsolvable.

## Vercel deployment

Import this repository with the repository root as the Root Directory. The checked-in `vercel.json` serves the prebuilt `output/` directory and maps `/` to `cube-interface.html`. No hosting build step is required.

After source changes, run `python3 build.py` and commit both generated HTML files before pushing. Vercel can then deploy the updated app automatically from `main`.

## Community algorithms and votes

The 5x5 trainer's **Show solutions** panel and library case panels show up to five
non-equivalent optimal algorithms, the five most-voted algorithms, and verified
community submissions. Cases with fewer than five optimal alternatives show only
those alternatives. Rankings start empty; no votes are seeded. Redux and Yau
rankings are separate. Algorithms apply to the displayed reference orientation;
trainer alignment is shown separately.

Votes are anonymous, with one removable vote per algorithm per browser cookie.
Clearing cookies or using another browser creates a new voter; this is not an
account-based anti-fraud system. Equivalent full-cube effects share vote totals.
Submissions must solve the reference centers; Yau also validates the other centers
and FL/DL/BL edges. Community submissions need not be move-optimal or follow the
solver's setup-block grammar.

### Shared storage on Vercel

1. In the L2C-Lab project, open **Storage** and connect a free Upstash Redis database.
2. Ensure the project's server environment contains `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`, or the Marketplace defaults `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` (the full-access token, not the read-only token).
3. Redeploy after connecting. These variables stay server-side; never put them in HTML.
4. Optionally set a stable random `VOTE_COOKIE_SECRET`; otherwise the Redis token
   signs anonymous cookies. Rotating that signing secret resets browser identities.

Without Redis, optimal algorithms remain available and the UI explicitly reports
that community voting is not connected. It does not pretend that data is saved.

For local API development (Node 22+), copy `.env.example` to `.env`, fill the two
Redis settings, then run:

```sh
python3 build.py
node --env-file=.env scripts/dev-server.cjs
```

Open http://127.0.0.1:8001/. The Python-only static server still works for the
solver/trainer, but cannot serve the shared voting API.

To regenerate and replay-verify the optimal alternatives after solver changes:

```sh
node scripts/generate-optimal-alternatives.cjs
python3 build.py
```


## 4x4 L4C Yau prototype

Open the **4x4 L4C Yau** tab (or `/#four`). Input accepts only `Rw`, `3Rw`,
`l`, `U`, primes, and doubles; each costs one move. All these turns preserve the
L/R centers and every FL/DL/BL edge piece.

Choose one of three solution approaches:

- **Half centers:** find a shortest route to the cube-left bars on F, D and B in
  any of the four cyclic color arrangements around the fixed L/R axis, then the
  shortest Rw/U finish to that rotated solved state, preserving the bars. The
  resulting face colors are shown with the solution. Arbitrary color swaps or
  reversed color order are not accepted.
- **Full 1st center:** solve one full center in its original face position in the
  fewest moves, then find the shortest unrestricted finish from that endpoint.
  The solver automatically chooses whichever of U, F, D or B is quickest. An already solved
  center needs zero first-stage moves. The finish may temporarily disturb it.
- **Globally optimal** (the default): minimize total moves over the whole solution,
  to the original face colors, without requiring a half-center or full-center
  milestone first.

The staged modes select the first shortest stage-1 route found; ties are not
ranked by finish length. They guarantee a shortest first stage and a shortest
finish from the selected endpoint, not a globally shortest combined solution.
Stage boundaries are retained when reporting move counts and previews.

The solver builds an exact Rw/U finish table (18,900 states per solved
orientation, 75,600 for Half centers) and single-color pattern distances. Half-center search uses admissible distances to partial color targets;
first-center search uses the minimum exact distance to an eligible solved center.
The global search uses increasing total-move bounds and admissible single-color
bounds. Its finish-table shortcut does not force an early phase boundary: either
part can be empty, so it can find a full solution entirely in the search prefix.

Optimality is within the twelve-turn Rw/3Rw/l/U move set, not all cube moves.
The interface has no time or move limit. Cancel terminates the worker without an
optimality claim. Changing the approach cancels any
running search and clears the previous results. Optional internal limits remain
available for tests and benchmarks. This is an initial implementation, without a
case library or deep-case performance guarantee.

## Roadmap ideas

- **4x4 Yau L8E conjugacy class classifier.**
- **4x4 L8E optimal solver** constrained to AUFs and traditional inserts, with
  optional support later for additional algorithms such as
  `Rw2 D Rw' U2 Rw D' Rw' U2 Rw'` and commutators.
- **4x4 Yau solver with per-step optimality**, including steps such as F3E.
- **OPA-aware L4C solver** that factors OPA into the search.
- **5x5 F2C optimal solution finder.**

- **"Optimal human-findable" L4C solutions** that account for what a solver can
  reasonably recognize as centers enter their field of view, including which
  center adjustments they can identify to preserve a bar.
