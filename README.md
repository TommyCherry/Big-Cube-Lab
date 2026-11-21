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
