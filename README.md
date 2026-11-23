# Big Cube Lab

A browser-based lab for center solving, edge pairing, and practice on 4x4, 5x5, and 6x6 cubes. Tools are grouped by cube size.

- 4x4 Yau L4C and F3E solvers, L8E pairing, and example solutions by cycle class.

- 5x5 case library, pattern filters, and optimal algorithms.
- Trainer with saved sessions, timing, and spaced repetition.
- Redux and Yau modes; Yau preserves FL, DL, and BL edges.
- 6x6 move-optimal and ergonomic searches, random cases, and last-bar filters.
- Ergonomic slice notation, setup blocks, and finishing commutators.

## Run locally

Requires Node.js (with npm) and Python 3. No package installation is needed.

```sh
git clone https://github.com/TommyCherry/L2C-Lab.git
cd L2C-Lab
npm run dev
```

Open http://localhost:8001/output/cube-interface.html in your browser.
Port 8001 is the local default (8000 is reserved for Synapse). Override it with `PORT=8002 npm run dev`. The local server also supports the community API.
Stop the server with Ctrl+C. Startup builds the site once; after editing source files, run `npm run build` and refresh. There is no automatic rebuild.
If port 8001 is occupied by an earlier local server, stop that server first.

The generated interface is standalone. Serving it locally gives browser workers and persisted pattern tables a consistent origin. Trainer sessions and pattern tables are stored in your browser.

## Colors and orientation

The shared color controls choose the colors held on U and F on every page.
L2C always uses U/F, L4C uses U/F/D/B, F3E uses the cross color on L, and L8E uses the cross color on D.
Only the 24 rotations of the standard color scheme are offered; opposite
colors cannot be selected as adjacent faces. Preferences persist locally.

Changing the frame recolors the current case and its labels, including trainer
and library diagrams, solution previews, cross checks, and accessibility text.
It does not apply a rotation or change move notation. Algorithms are executed
in the displayed grip. Search states, cached tables and saved cases retain
canonical color identities internally, so solver results and optimality are
independent of the selected colors. `orientation.js` owns the frame mapping
and presentation adapter, including dynamically rendered results and popups.

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

## 4x4 F3E Yau solver

Open **4x4 F3E Yau** (or `/#f3e`). This page provides scramble input, a full
six-face 2D net, optional white-edge highlighting, and live goal checking.
Choose between two approaches:

- **Three-stage (preserve solved edges)**, the default: find a shortest first
  edge, then a shortest compatible second edge, then the third. Once selected,
  an edge stays solved in its slot after every subsequent move.
- **Globally optimal:** minimize the total move count to any valid F3E goal.
  Edges may be moved or unpaired during the solution; no intermediate edge locks
  apply. The final three edges must be paired and correctly ordered.

The reference orientation is L white, R yellow, F green, D orange, B blue and
U red. Input accepts only `U`, `F`, `D`, `B`, `3Rw`, `Rw`, `R` and `L`, with primes and
doubles. All 24 turns preserve the solved L/R centers. Each Apply starts from the
solved reference. Random cases first sample a well-mixed white-wing state using
an internal 96-move random walk. The generator then restores all four white edges
and inverts that restoration to produce a short displayed scramble (typically
around 15 moves). A replay check requires all eight white wings, including their
orientations, to exactly match the sampled state. Both L/R centers stay solved;
other pieces may differ because they do not affect F3E.

The internal walk alternates axes, chooses axes equally among those different
from the preceding axis, and favors Rw on the R/L axis (8:1 relative to each of
R, L and 3Rw) to split wing pairs. Move weights are state-independent and
symmetric between inverses. This approximates a well-mixed reachable-state
distribution, not exact uniform sampling. Individual solved or paired edges
are retained; only completely finished F3E cases are regenerated.

Displayed scrambles minimize each commuting same-axis run, including wide/outer
turn combinations. Different moves on the same axis can remain when both are
necessary, but redundancies such as `B F' B` become `F' B2`. Explicit-length
calls to `model.scramble(length, random)` retain the raw axis-alternating walk
for tests and experiments; normal UI generation uses the short representation.

Run `node scripts/benchmark-f3e-mixing.cjs --solutions` to compare the old short
walk, the current generator and a 1,024-move reference, including exact one-edge
statistics and sampled solution lengths. The recorded seeded results are in
`data/f3e-mixing-benchmark.json`; statistical agreement is not a proof of exact
uniform sampling.

An F3E goal requires two matching wings at each of FL, DL and BL, with white
facing L on all six wings. The side colors must be one of these ordered triples:

| FL | DL | BL |
| --- | --- | --- |
| Green | Orange | Blue |
| Orange | Blue | Red |
| Blue | Red | Green |
| Red | Green | Orange |

For example, white-green at FL requires white-orange at DL, not BL or UL.
Any of white-red, white-green, white-orange or white-blue may be the unrestricted
fourth edge. All four white edges are highlighted wherever their wings move,
including white-red. The other centers, corners and non-target
edges need not be solved. Relative order is independent of the scrambled colors
currently on the F/D/B center stickers.

`f3e.js` supplies the sticker model, move parser, all 24 sticker permutations and
inverses, full-state encoding, goal patterns and checker. Its `searchKey` tracks
both stickers of the eight white wings in fixed slots; move permutations can act
on this reduced state directly. L/R center preservation is an invariant of the
allowed moves and remains part of the full-state goal check.

`f3e-search.js` runs in a cancellable worker. It tracks the eight white wings in
two 24-position orbits. In three-stage mode, each stage excludes every move that would disturb
a previously selected edge. Exact reverse BFS tables for a single edge under
that restricted move set determine the shortest stage and reconstruct its moves.
The first stage chooses any color and any of FL/DL/BL; later stages choose the
quickest remaining target consistent with that cyclic color order. Ties use the
first minimum found, without looking ahead to the cost of later stages.

Global mode uses IDA* with exact two-edge pattern tables for FL/DL, FL/BL and
DL/BL. Its lower bound is the maximum of those distances for each cyclic goal
orientation, minimized across all four orientations. Increasing total-move
bounds therefore prove the returned solution globally shortest in the allowed
move set. Only consecutive turns of the same generator are pruned; different
moves on the same axis remain searchable.

Each listed turn, prime or double, costs one move. Three-stage mode guarantees
only stage optimality under its preservation constraints; global mode guarantees
minimum total length. The UI has no search time or move limit, provides Cancel,
stage previews for the staged approach and a solved preview for global mode.
It independently replays every solution, including per-move edge preservation
checks in staged mode. Changing the approach or applied scramble cancels search
and clears old results. Internal time/depth limits are available for tests
(depth is per stage in staged mode, total depth in global mode).

## Roadmap ideas

- **4x4 Yau L8E conjugacy class classifier:** implemented for wing-pairing cycle types; orientation-aware refinements remain future work.
- **4x4 L8E optimal solver** constrained to AUFs and traditional inserts, with
  optional support later for additional algorithms such as
  `Rw2 D Rw' U2 Rw D' Rw' U2 Rw'` and commutators.
- **4x4 Yau solver with per-step optimality**, including steps such as F3E.
- **OPA-aware L4C solver** that factors OPA into the search.
- **5x5 F2C optimal solution finder.**

- **"Optimal human-findable" L4C solutions** that account for what a solver can
  reasonably recognize as centers enter their field of view, including which
  center adjustments they can identify to preserve a bar.

### 4x4 L8E scrambles

The `#l8e` page uses csTimer's existing `444l8e` random-state generator, bundled
as `cstimer_module` 0.1.5 (GPL-3.0; see [vendor attribution](vendor/cstimer/README.md)).
It runs in a cancellable local Web Worker. This pinned release protects the U
cross; the adapter restores the center reference frame and maps U to D. Every result is replayed and checked for all 24 center stickers and all
16 stickers of the four D cross edges, including side-color alignment.
The other sixteen wings and the corners are randomized by csTimer. Naturally
paired edges are allowed; no difficulty rejection filter is applied. Manual
input remains available and displays center/cross validity. A heuristic pairing solution finder is available below the classification.

### L8E pairing-cycle classification

Applying or generating an L8E scramble automatically displays its pairing cycle
type, for example `2E 2E 2E 2E` or `8E`, with groups listed largest first.
`1E` denotes a dedge whose two wings have matching edge colors, regardless of
its final position or orientation. All eight dedges are included, so the
numbers always sum to eight. The page lists the slots and edge types belonging
to each group, and a table shows the two wing types in every slot.

The classifier builds a degree-two multigraph: vertices are the eight non-D
slots and each edge joins the locations of the two wings of one color pair.
Connected-component sizes give the pairing cycle type, including loops for
`1E` and parallel edges for `2E`. This is the pairing relation requested by the
UI's conjugacy-class label, not the conjugacy class of the full cube's cubie
permutation; paired-dedge destinations, flips, and corners are excluded.
Classification is unavailable unless all six centers and the aligned D cross
are solved. The classifier does not estimate solution length; the separate pairing finder searches actual move sequences.

### L8E pairing solution finder

The L8E page searches a toolbox of standalone U/U2/U' and Uw/Uw2/Uw' turns,
traditional U-turn inserts (including R U R' with top-turn variants), and
their inverses and rotations around the U/D axis. Standalone sledges such as
R' F R F' and L F' L' F are excluded from both heuristic and exact search;
they are permitted only within the complete flipping algorithms. Difficult
finishes can use Uw' R' F R F' R U' R' Uw and rotated/inverse variants.
Each macro is checked to preserve the D cross at its boundary. Temporary
cross movement inside an insert is allowed; centers may be temporarily sliced.

A beam search favors three-pair E-layer slice setups and useful replacements
before restoring the slice. This supports 6-2-style and slice-first 3-2-3-style
pairing without forcing either exact schedule. It scores current pairs,
unsliced pairs, next-slice opportunities, and move cost; it compares solutions
in the first successful block-depth layer by move cost. It is heuristic, not
move-optimal or exhaustive. Its default budgets are 30 seconds, 2 million
visits, 40 blocks, and a beam width of 900. Limits are reported as search failure,
not proof of unsolvability. The worker can be cancelled.

Every returned block is necessary in the limited sense that deleting it from
the returned sequence no longer achieves the goal; repeated block-deletion
passes remove dispensable inserts and adjustments. This is not a claim that
no shorter replacement exists. Adjacent turns of the same face are combined
in the complete algorithm. Block previews show the original unsimplified
steps, their pair counts, affected slots, and center restoration status.
The frontend independently replays the complete algorithm and every block:
all six centers, the aligned D cross, and all eight fully paired dedges must
be correct at the finish. Corners and final 3x3 dedge positions are unrestricted.

L8E solution notation replaces back-face inserts with y/y' setup rotations and
R/L inserts (for example, B U' B' becomes y R U' R' y'). Each block restores
the original grip, so slot labels and previews remain in the same frame.
Cube rotations are accepted by the L8E parser and reported separately from
face/wide-turn move counts. The search still operates on equivalent canonical
blocks; the ergonomics rewrite does not change the pairing result.

### Exact L8E block-cost mode

Choose **Optimal block cost (30 seconds)** to search the same block toolbox
with weighted IDA*. Each complete block is one branch, with cost equal to its
written face/wide turns: R U R' costs 3, an AUF or Uw turn costs 1, and rotations
cost 0. This additive cost is measured **before cancellations between blocks**;
the simplified display's move count is separate. The proof is for minimum
block cost in this toolbox, not global move optimality or minimum block count.

The total 30-second budget includes an initial candidate search (up to four
seconds). A shared reverse-Dijkstra table supplies exact projected distances
for the two wings of one edge; the maximum over eight edges is an admissible
bound. Exact search explores increasing cost thresholds without the heuristic
beam, insertion-purpose filter, or sliced-center-pattern restriction. Positive
block costs and per-iteration state/cost dominance provide safe pruning;
transposition-table eviction only removes pruning. No visit/depth cap is used
by the UI's exact mode. All centers and the aligned D cross must be restored,
and all eight dedges must be paired at the finish.

A result is labeled proven only after cheaper block sequences are excluded
(or a candidate matches the proven lower bound). A timeout can return the
verified candidate with its lower bound and **optimality not proven**. With
no candidate, it reports incomplete search rather than unsolvability. Changing
modes cancels the old worker and clears its results. Exact shallow cases are
checked against an independent uniform-cost search in the test suite.

### L8E worked examples

Open **L8E examples** (`#l8e-examples`) for all 22 partitions of eight, including
already paired `1E` components. The checked-in catalog contains 132 representative spatial subclasses, 133
legal training scrambles and 150 solution routes. Subclasses cover every
component U/E layer split, the six 2E layer/adjacency relationships, and
selected additional arrangements within a layer split. These are
constructed cases for learning patterns, not a random-difficulty benchmark.

Each class has practical pairing guidance. Each example shows its scramble,
solution, exact block-cost proof status, full cube net, and clickable block
previews with pair counts and restored-center cycle types. Cases can be loaded
into the interactive solver. The shared color frame applies to this page too.

The guide deliberately does not assign one optimal recipe to an entire class:
the 3E examples have proven costs 5 and 6, the 2E examples compare a proven
8-cost insert finish with a 9-cost flipping route, and the 4E examples show
proven 9-cost finishes without a flip. Composite components can share setup
and slicing work. Unproved solutions are labeled verified rather than optimal.

Regenerate the base cases with `node scripts/generate-l8e-examples.cjs`, then
expand them with `node scripts/generate-l8e-spatial-examples.cjs`, then run
`node scripts/generate-l8e-upper-examples.cjs`, and finally
run `npm run build`. The generator uses a deterministic seed and legal pairing
blocks, verifies every route, and attempts exact proofs for up to 10 seconds
per case (`L8E_EXAMPLE_PROOF_MS` overrides that budget). Runtime page visits
only read the catalog; they do not launch searches. Tests independently check
all 22 class signatures, each scramble's centers/D cross, complete solutions,
and every preview block.

### Spatial subclasses

The examples page separates cycle type from component placement. A spatial
subclass records which U-layer slots (UF/UR/UB/UL) and E-layer slots
(FR/BR/BL/FL) belong to each nontrivial cycle. Whole y rotations have the same
footprint key; wing orientation and the matching order inside a cycle are
intentionally outside this subclass definition. This is a representative
teaching catalog, not an enumeration of all possible wing states.

For 2E, choose adjacent E/E, opposite E/E, shared-side E/U, separated-side E/U,
adjacent U/U, or opposite U/U. Other classes cover all 109 component layer
profiles across the 22 cycle types, with selected additional spatial
relationships. Component slot lists and inter-component contact counts show
where neighboring or shared-side positions can affect setup choices. Guidance
is specific to the selected placement; it is not an optimality assertion for
all states in that placement.

The spatial generator moves whole dedges with legal AUFs/U-turn inserts,
retaining centers and the D cross, then verifies the resulting class and
footprint. It first constructs a guaranteed finish, then tries exact search
(default 500 ms per new case) and heuristic improvement (default 1 second).
`L8E_SPATIAL_PROOF_MS` and `L8E_SPATIAL_SEARCH_MS` override these budgets.
Proof labels apply only to the individual verified example. Geometry tests
enumerate all 4,140 set partitions of the eight slots to check layer-profile
coverage, y-rotation invariance, and inter-component relationships.

### Optional direct U-layer pairing blocks

Enable **Allow U-layer pairing algorithms (Rw / D / U2)** in the L8E solver
to include these complete blocks in either search mode:

- `Rw2 D Rw' U2 Rw D' Rw' U2 Rw'` for adjacent U-layer wings.
- `x Rw2 D2 Rw U2 Rw' D2 Rw U2 Lw` for opposite U-layer wings.

The supplied `Rw2'` spelling is also accepted and is equivalent to `Rw2`.
Inverses and whole-y conjugates yield 16 extra verified transitions. Both
families already restore the center frame, D cross, and every non-U wing at
the end of the block. Intermediate D turns are allowed within the block.
Each costs nine face/wide turns; x/y/z cube rotations cost zero and are
reported separately. The parser accepts all three rotation axes.

The option defaults off. Changing it cancels pending work and clears stale
results. Exact search constructs its lower-bound table from the selected
macro set, and result labels identify the basic or extended toolbox. The
examples gallery has its own checkbox above the class selectors. It switches
between precomputed basic and expanded-toolbox routes, proof labels and previews.
Expanded-toolbox proofs are computed separately; a basic proof is never reused
as an expanded proof. Some routes remain unchanged when the extra blocks do not
improve the found solution. Loading an example into the solver carries over the
selected toolbox.
