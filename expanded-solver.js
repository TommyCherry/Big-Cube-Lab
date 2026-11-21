// Expanded setup blocks are recognized during search, before accepting a solution.
// Every block must consume a face turn from the normalized result.
function createExpandedSolver(model, { yau = false } = {}) {
  const key = s => s.p.join(',') + '/' + s.n.join(',');
  const home = model.solved();
  const allSlots = new Map(home.map((s, i) => [key(s), i]));
  const centers = home.filter(s => s.p.filter(v => Math.abs(v) === 2).length === 1);
  const orbits = [2, 1, 0].map(count => centers.filter(s => s.p.filter(v => Math.abs(v) === 1).length === count));
  const suffixes = ['', '', '2', "'"];
  const inverse = token => token.endsWith('2') ? token : token.endsWith("'") ? token.slice(0, -1) : token + "'";
  // x-axis runs: independent rotations of the left pair, middle, right pair.
  const axisBases = yau ? [
    ['Rw', [0, 0, 3]], ['3Rw', [0, 3, 3]], ['4Rw', [3, 3, 3]], ['M', [0, 1, 0]]
  ] : [
    ['Rw', [0, 0, 3]], ['Lw', [1, 0, 0]], ['M', [0, 1, 0]],
    ['3Rw', [0, 3, 3]], ['3Lw', [1, 1, 0]], ['x', [3, 3, 3]]
  ];
  const encodeAxis = v => v[0] + 4 * v[1] + 16 * v[2];
  const axisWords = Array(64).fill(null);
  axisWords[0] = [];
  const queue = [0];
  for (let i = 0; i < queue.length; i++) {
    const state = queue[i], v = [state & 3, (state >> 2) & 3, state >> 4];
    for (const [base, delta] of axisBases) for (const turns of [1, 2, 3]) {
      const next = encodeAxis(v.map((n, j) => (n + delta[j] * turns) % 4));
      if (axisWords[next] !== null) continue;
      axisWords[next] = [...axisWords[state], base + suffixes[turns]];
      queue.push(next);
    }
  }
  const moves = [...axisWords.slice(1).map((tokens, i) => ({ tokens, axis: 'X', axisCode: i + 1 })),
    ...(yau ? ['U'] : ['U', 'F']).flatMap(axis => [1, 2, 3].map(t => ({ tokens: [axis + suffixes[t]], axis })))];
  for (const move of moves) {
    move.cost = move.tokens.length;
    const allCopy = home.map(s => ({ ...s, p: [...s.p], n: [...s.n] }));
    move.fullPermutation = model.apply(allCopy, model.parse(move.tokens.join(' '))).map(s => allSlots.get(key(s)));
    if (yau && home.some((s, i) => s.p[0] === -2 && s.p[1] !== 2 && s.p.filter(v => Math.abs(v) === 2).length === 2 && move.fullPermutation[i] !== i)) throw new Error('Yau move disturbs F3E');
    move.permutations = orbits.map(orbit => {
      const slots = new Map(orbit.map((s, i) => [key(s), i]));
      const copy = orbit.map(s => ({ ...s, p: [...s.p], n: [...s.n] }));
      return model.apply(copy, model.parse(move.tokens.join(' '))).map(s => slots.get(key(s)));
    });
  }
  moves.sort((a, b) => a.cost - b.cost);
  function encode(stickers) {
    const bySlot = new Map(stickers.map((s, i) => [key(s), yau && s.color === 'gray' && home[i].n[1] === -1 ? 'yau-down' : yau && s.color === 'gray' && home[i].n[2] === -1 ? 'yau-back' : s.color]));
    return orbits.flatMap(orbit => (yau ? ['green', 'orange', 'yau-down', 'yau-back'] : ['green', 'orange']).map(color => orbit.reduce((mask, s, i) => mask | (bySlot.get(key(s)) === color ? 1 << i : 0), 0)));
  }
  const blockRules = [
    { setup: 'Rw', inner: ['Lw', 'M', 'U'] },
    { setup: "3Lw'", inner: ['Lw', 'M', 'U'] },
    { setup: '3Rw', inner: ['Rw', 'M', 'U'] },
    { setup: "Lw'", inner: ['Rw', 'M', 'U'] },
    { setup: 'M', inner: ['Rw', 'Lw', 'F'] },
    { setup: "M'", inner: ['Rw', 'Lw', 'U'] }
  ];
  return { moves, goal: encode(model.solved()), encode, blockRules, unrestricted: yau, colorCount: yau ? 4 : 2, rotatedGoals: yau ? ['', '4Rw', '4Rw2', "4Rw'"].map(t => encode(model.apply(model.solved(), model.parse(t)))) : undefined };
}

function createSetupGrammar(rules) {
  // 0 = between blocks, 1..6 = setup but no face turn yet,
  // 7..12 = inside a block that has consumed a real face turn.
  const inverse = token => token.endsWith("'") ? token.slice(0, -1) : token + "'";
  const add = (a, b) => ((a + b) & 3) | (((((a >> 2) & 3) + ((b >> 2) & 3)) & 3) << 2) | (((((a >> 4) & 3) + ((b >> 4) & 3)) & 3) << 4);
  const axisCode = token => {
    const base = token.replace(/(?:2|')$/, '');
    const turns = token.endsWith('2') ? 2 : token.endsWith("'") ? 3 : 1;
    const vectors = { Rw: [0, 0, -1], Lw: [1, 0, 0], M: [0, 1, 0], '3Rw': [0, -1, -1], '3Lw': [1, 1, 0] };
    return vectors[base].reduce((code, value, index) => code | (((value * turns + 4) % 4) << (2 * index)), 0);
  };
  const edges = Array.from({ length: 13 }, () => []);
  rules.forEach((rule, i) => {
    edges[0].push({ to: 1 + i, token: rule.setup, kind: 'open' });
    // The first move after setup must be the perpendicular face turn.
    for (const state of [7 + i]) {
      for (const base of rule.inner.filter(b => b !== 'U' && b !== 'F')) for (const suffix of ['', "'", '2']) {
        edges[state].push({ to: state, token: base + suffix, kind: 'inner' });
      }
    }
    // No exit exists until a face turn has been consumed.
    edges[7 + i].push({ to: 0, token: inverse(rule.setup), kind: 'close' });
  });
  const closures = [], routes = [];
  for (let source = 0; source < 13; source++) {
    const paths = Array(13 * 64).fill(null), masks = new Uint16Array(64);
    paths[source * 64] = [];
    const queue = [source * 64];
    for (let q = 0; q < queue.length; q++) {
      const id = queue[q], state = Math.floor(id / 64), code = id % 64;
      masks[code] |= 1 << state;
      for (const edge of edges[state]) {
        const next = edge.to * 64 + add(code, axisCode(edge.token));
        if (paths[next] !== null) continue;
        paths[next] = [...paths[id], edge];
        queue.push(next);
      }
    }
    closures.push(masks); routes.push(paths);
  }
  function closure(contexts, code) {
    let result = 0;
    for (let state = 0; state < 13; state++) if (contexts & (1 << state)) result |= closures[state][code];
    return result;
  }
  function faceState(state, face) {
    // U/F adjustments are legal outside a setup block as well.
    if (state === 0) return 0;
    const index = (state - 1) % 6;
    return rules[index].inner.includes(face) ? 7 + index : -1;
  }
  function advance(contexts, move) {
    if (move.axis === 'X') return closure(contexts, move.axisCode);
    const ready = closure(contexts, 0);
    let result = 0;
    for (let state = 0; state < 13; state++) if (ready & (1 << state)) {
      const next = faceState(state, move.axis);
      if (next !== -1) result |= 1 << next;
    }
    return result;
  }
  function witness(moves) {
    let options = new Map([[0, []]]);
    function expand(code) {
      const result = new Map();
      for (const [from, actions] of options) for (let to = 0; to < 13; to++) {
        const route = routes[from][to * 64 + code];
        if (route === null) continue;
        const candidate = [...actions, ...route];
        if (!result.has(to) || candidate.length < result.get(to).length) result.set(to, candidate);
      }
      options = result;
    }
    for (const move of moves) {
      expand(move.axis === 'X' ? move.axisCode : 0);
      if (move.axis === 'X') continue;
      const next = new Map();
      for (const [state, actions] of options) {
        const to = faceState(state, move.axis);
        if (to === -1) continue;
        const candidate = [...actions, { kind: state === 0 ? 'adjustment' : 'face', token: move.tokens[0] }];
        if (!next.has(to) || candidate.length < next.get(to).length) next.set(to, candidate);
      }
      options = next;
    }
    expand(0);
    const actions = options.get(0);
    if (!actions) return null;
    const blocks = [];
    let block = [];
    for (const action of actions) {
      if (action.kind === 'adjustment') { blocks.push(action.token); continue; }
      if (action.kind === 'open') block = [];
      block.push(action.token);
      if (action.kind === 'close') blocks.push(block.join(' '));
    }
    return blocks;
  }
  return { advance, accepts: contexts => Boolean(closure(contexts, 0) & 1), witness };
}

function randomL2CState(goal, random = Math.random, colorCount = 2) {
  // Four green corner-centers and four green edge-centers must stay in their
  // own orbits. The two fixed centers retain their original colors.
  const choices = [0, colorCount].map(part => {
    const positions = Array.from({ length: 24 }, (_, i) => 1 << i).filter(bit => (goal[part] | goal[part + 1]) & bit);
    const masks = [];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++)
      for (let c = b + 1; c < 8; c++) for (let d = c + 1; d < 8; d++) masks.push(positions[a] | positions[b] | positions[c] | positions[d]);
    return masks;
  });
  const solvedIndex = choices[0].indexOf(goal[0]) * 70 + choices[1].indexOf(goal[colorCount]);
  let index = Math.floor(random() * 4899);
  if (index >= solvedIndex) index++;
  const state = [...goal];
  for (const [part, choice] of [[0, Math.floor(index / 70)], [colorCount, index % 70]]) {
    state[part] = choices[part / colorCount][choice];
    state[part + 1] = (goal[part] | goal[part + 1]) ^ state[part];
  }
  return state;
}

// Compare actual transformations, not spellings or the final two-color image.
// This retains distinct solutions while collapsing equivalent wide-turn forms.
function solutionEffectKey(path) {
  let permutation = Array.from({ length: 150 }, (_, i) => i);
  for (const move of path) permutation = permutation.map(position => move.fullPermutation[position]);
  return permutation.join(',');
}

function searchExpandedSolutions({ moves, goal, start, startVariants, goalVariants, unrestricted = false, colorCount = 2, blockRules, nearOptimal = false, optimalOnly = false, resultLimit = 5 }, progress = () => {}) {
  const moveCount = moves.length;
  const masks = [];
  for (let a = 0; a < 24; a++) for (let b = a + 1; b < 24; b++)
    for (let c = b + 1; c < 24; c++) for (let d = c + 1; d < 24; d++) masks.push((1 << a) | (1 << b) | (1 << c) | (1 << d));
  const indices = new Map(masks.map((m, i) => [m, i]));
  const centerMasks = Array.from({ length: 6 }, (_, i) => 1 << i);
  const centerIndices = new Map(centerMasks.map((m, i) => [m, i]));
  const transitions = [0, 1, 2].map(orbit => {
    progress(`Preparing ${['corner', 'edge', 'fixed-center'][orbit]} move tables...`);
    const source = orbit === 2 ? centerMasks : masks;
    const index = orbit === 2 ? centerIndices : indices;
    const table = new Uint16Array(source.length * moveCount);
    for (let g = 0; g < moveCount; g++) {
      const p = moves[g].permutations[orbit];
      for (let i = 0; i < source.length; i++) {
        let bits = source[i], result = 0;
        while (bits) {
          const bit = bits & -bits;
          result |= 1 << p[31 - Math.clz32(bit)];
          bits ^= bit;
        }
        table[i * moveCount + g] = index.get(result);
      }
    }
    return table;
  });
  const stateOf = input => input.map((mask, i) => (i < 2 * colorCount ? indices : centerIndices).get(mask));
  const targets = (goalVariants || [goal]).map(stateOf), target = targets[0], initials = (startVariants || [start]).map(stateOf);
  if (initials.some(state => state.some(i => i === undefined))) return { solutions: [], visited: 0 };
  function advance(state, g) { return state.map((s, i) => transitions[Math.floor(i / colorCount)][s * moveCount + g]); }
  const stateKey = state => state.join(',');
  const targetKeys = new Set(targets.map(stateKey));
  // Four exact single-color pattern databases; each ignores the other colors.
  const distances = Array.from({length: 2 * colorCount}, (_, i) => i).map(part => {
    const table = transitions[Math.floor(part / colorCount)];
    const distance = new Uint8Array(masks.length).fill(255);
    const buckets = [[...new Set(targets.map(t => t[part]))]];
    for (const seed of buckets[0]) distance[seed] = 0;
    for (let cost = 0; cost < buckets.length; cost++) for (const state of buckets[cost] || []) {
      if (distance[state] !== cost) continue;
      for (let g = 0; g < moveCount; g++) {
        const next = table[state * moveCount + g], candidate = cost + moves[g].cost;
        if (distance[next] <= candidate) continue;
        distance[next] = candidate;
        (buckets[candidate] ||= []).push(next);
      }
    }
    return distance;
  });
  // Joint fixed centers detect impossible relative color orientations.
  const centerDistances = new Uint8Array(36).fill(255);
  const centerBuckets = [[...new Set(targets.map(t => t[2 * colorCount] * 6 + t[2 * colorCount + 1]))]];
  for (const seed of centerBuckets[0]) centerDistances[seed] = 0;
  for (let cost = 0; cost < centerBuckets.length; cost++) for (const pair of centerBuckets[cost] || []) {
    if (centerDistances[pair] !== cost) continue;
    for (let g = 0; g < moveCount; g++) {
      const a = transitions[2][Math.floor(pair / 6) * moveCount + g], b = transitions[2][(pair % 6) * moveCount + g];
      const next = a * 6 + b, candidate = cost + moves[g].cost;
      if (centerDistances[next] <= candidate) continue;
      centerDistances[next] = candidate;
      (centerBuckets[candidate] ||= []).push(next);
    }
  }
  function heuristic(state) {
    return Math.max(...distances.map((d, i) => d[state[i]]), centerDistances[state[2 * colorCount] * 6 + state[2 * colorCount + 1]]);
  }
  if (initials.every(state => heuristic(state) === 255)) return { solutions: [], visited: 0 };
  // Exact near-goal distances also certify a lower bound for states outside it.
  progress('Preparing the exact near-goal search table...');
  const near = new Map(targets.map(t => [stateKey(t), 0])), buckets = [[...targets]];
  const radius = 4;
  for (let cost = 0; cost <= radius; cost++) for (const state of buckets[cost] || []) {
    if (near.get(stateKey(state)) !== cost) continue;
    for (let g = 0; g < moveCount; g++) {
      const candidate = cost + moves[g].cost;
      if (candidate > radius) continue;
      const next = advance(state, g), key = stateKey(next);
      if (near.has(key) && near.get(key) <= candidate) continue;
      near.set(key, candidate);
      (buckets[candidate] ||= []).push(next);
    }
  }
  const grammar = unrestricted ? { advance: () => 1, accepts: () => true, witness: path => path.map(move => move.tokens.join(' ')) } : createSetupGrammar(blockRules);
  const solutions = [], seen = new Set(), path = [];
  let visited = 0, optimalCount = null, activeVariant = 0;
  for (let bound = Math.min(...initials.map(heuristic)); solutions.length < (nearOptimal ? 1 : resultLimit); bound++) {
    if (optimalOnly && optimalCount !== null && bound > optimalCount) break;
    if (nearOptimal && optimalCount !== null && bound > optimalCount + 2) break;
    progress(nearOptimal && optimalCount !== null
      ? `Optimal is ${optimalCount} moves. Finding a ${bound}-move setup solution...`
      : `Proving the shortest solutions: searching ${bound} moves...`);
    // Cache only subtrees with no solutions; different successful prefixes
    // must remain available when collecting the five distinct solutions.
    const failures = new Map();
    function visit(state, remaining, previousAxis, contexts) {
      visited++;
      if (visited % 100000 === 0) progress(`Searching ${bound} moves: ${visited.toLocaleString()} positions checked...`);
      const h = heuristic(state);
      if (h > remaining) return false;
      const key = stateKey(state), nearDistance = near.get(key);
      if ((nearDistance === undefined ? radius + 1 : nearDistance) > remaining) return false;
      if (remaining === 0) {
        if (!targetKeys.has(key) || !grammar.accepts(contexts)) return false;
        if (optimalCount === null) {
          optimalCount = bound;
          if (nearOptimal) return true;
        }
        const tokens = path.flatMap(g => moves[g].tokens), text = tokens.join(' ');
        const effect = solutionEffectKey(path.map(g => moves[g]));
        if (!seen.has(effect)) {
          seen.add(effect);
          solutions.push({ moves: text, count: bound, groups: grammar.witness(path.map(g => moves[g])), startVariant: activeVariant, goalVariant: targets.findIndex(t => stateKey(t) === key) });
        }
        return true;
      }
      const failureKey = key + '/' + previousAxis + '/' + remaining + '/' + contexts;
      if (failures.has(failureKey)) return false;
      let found = false;
      for (let g = 0; g < moveCount; g++) {
        const move = moves[g];
        // Every maximal x-axis run is already represented at its minimum cost.
        if (move.axis === previousAxis || move.cost > remaining) continue;
        const nextContexts = grammar.advance(contexts, move);
        if (!nextContexts) continue;
        path.push(g);
        found = visit(advance(state, g), remaining - move.cost, move.axis, nextContexts) || found;
        path.pop();
        if (nearOptimal ? optimalCount === bound || solutions.length === 1 : solutions.length === resultLimit) return true;
      }
      if (!found) failures.set(failureKey, remaining);
      return found;
    }
    for (activeVariant = 0; activeVariant < initials.length; activeVariant++) {
      visit(initials[activeVariant], bound, '', 1);
      if (nearOptimal ? optimalCount === bound || solutions.length === 1 : solutions.length === resultLimit) break;
    }
  }
  return { solutions, visited, optimalCount };
}

if (typeof module !== 'undefined') module.exports = { createExpandedSolver, searchExpandedSolutions, createSetupGrammar, randomL2CState, solutionEffectKey };
