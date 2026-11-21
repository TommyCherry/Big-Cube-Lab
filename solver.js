// Pure solver factory, also serialized into a browser worker by the build script.
function createCubeSolver(model) {
  const starters = ['Rw', "Rw'", 'Lw', "Lw'", 'M', "M'"];
  const inverse = move => move.endsWith("'") ? move.slice(0, -1) : move + "'";
  const key = s => s.p.join(',') + '/' + s.n.join(',');
  const home = model.solved().filter(s => s.color !== 'gray');
  // Use the model's stable sticker order; the goal need not be nine contiguous bits.
  const slots = new Map(home.map((s, i) => [key(s), i]));
  const goal = home.reduce((mask, s, i) => mask | (s.color === 'green' ? 1 << i : 0), 0);
  function encode(stickers) {
    let mask = 0, occupied = 0;
    for (const s of stickers) {
      if (s.color === 'gray') continue;
      const index = slots.get(key(s));
      if (index === undefined) throw new Error('All 18 colored stickers must be in the top and front 3x3 centers before solving.');
      occupied |= 1 << index;
      if (s.color === 'green') mask |= 1 << index;
    }
    if (occupied !== (1 << 18) - 1) throw new Error('The 18 center slots must all contain colored stickers.');
    return mask;
  }
  const groups = starters.flatMap((a, starter) => ['', "'", '2'].map(suffix => {
    const face = [0, 3, 5].includes(starter) ? 'U' : 'F';
    const text = `${a} ${face}${suffix} ${inverse(a)}`;
    const moved = model.apply(home.map(s => ({ ...s, p: [...s.p], n: [...s.n] })), model.parse(text));
    const permutation = moved.map(s => slots.get(key(s)));
    if (permutation.some(i => i === undefined)) throw new Error('Group does not preserve center slots.');
    return { text, starter, permutation };
  }));
  return { encode, goal, groups };
}

// Merge adjacent turns when their complete five-layer rotation is one move.
// Signs are physical rotations around +x, so Lw/M agree and Rw/M' agree.
function simplifyCubeMoves(tokens) {
  const layers = {
    R: [0, 0, 0, 0, -1], L: [1, 0, 0, 0, 0],
    Rw: [0, 0, 0, -1, -1], Lw: [1, 1, 0, 0, 0], M: [0, 0, 1, 0, 0],
    '3Rw': [0, 0, -1, -1, -1], '3Lw': [1, 1, 1, 0, 0],
    '4Rw': [0, -1, -1, -1, -1], '4Lw': [1, 1, 1, 1, 0],
    Mw: [0, 1, 1, 1, 0], x: [-1, -1, -1, -1, -1]
  };
  const suffix = ['', '', '2', "'"];
  const parse = token => ({ base: token.replace(/(?:2'?|')$/, ''), turns: /2'?$/.test(token) ? 2 : token.endsWith("'") ? 3 : 1 });
  const vector = ({ base, turns }) => layers[base]?.map(v => (v * turns + 4) % 4);
  const single = new Map([['0,0,0,0,0', '']]);
  for (const base of Object.keys(layers)) for (const turns of [1, 2, 3]) {
    single.set(vector({ base, turns }).join(','), base + suffix[turns]);
  }
  const stack = [];
  for (const token of tokens) {
    stack.push(token);
    while (stack.length > 1) {
      const a = parse(stack.at(-2)), b = parse(stack.at(-1));
      let merged;
      if (a.base === b.base) {
        const turns = (a.turns + b.turns) % 4;
        merged = turns ? a.base + suffix[turns] : '';
      } else {
        const av = vector(a), bv = vector(b);
        if (av && bv) merged = single.get(av.map((v, i) => (v + bv[i]) % 4).join(','));
      }
      if (merged === undefined) break;
      stack.splice(-2);
      if (merged) stack.push(merged);
    }
  }
  return stack;
}

function searchCubeSolutions({ goal, groups, start }, progress = () => {}) {
  const size = 1 << 18;
  const tables = groups.map(({ permutation }) => {
    const low = new Uint32Array(512), high = new Uint32Array(512);
    for (let value = 1; value < 512; value++) {
      const bit = value & -value, index = 31 - Math.clz32(bit);
      low[value] = low[value ^ bit] | (1 << permutation[index]);
      high[value] = high[value ^ bit] | (1 << permutation[index + 9]);
    }
    return [low, high];
  });
  const next = (mask, g) => tables[g][0][mask & 511] | tables[g][1][mask >>> 9];
  const inverseGroup = g => g - g % 3 + [1, 0, 2][g % 3];
  const boundaryCosts = Array.from({ length: 6 }, (_, a) =>
    Array.from({ length: 6 }, (_, b) => 1 + simplifyCubeMoves([
      groups[a * 3].text.split(' ')[2], groups[b * 3].text.split(' ')[0]
    ]).length));
  const edgeCost = (a, b) => boundaryCosts[a][b];
  // Exact cost-to-go for (color layout, previous group's starter).
  // Equal consecutive starters reduce to one group (or disappear), so normalize
  // them out. A boundary merging into a half or wider turn costs 2; others 3.
  const distance = new Int16Array(size * 6).fill(-1);
  const buckets = [[]];
  for (let last = 0; last < 6; last++) {
    const id = goal * 6 + last;
    distance[id] = 0;
    buckets[0].push(id);
  }
  let visited = 0;
  for (let cost = 0; cost < buckets.length; cost++) {
    const bucket = buckets[cost] || [];
    for (let i = 0; i < bucket.length; i++) {
      const id = bucket[i];
      if (distance[id] !== cost) continue;
      visited++;
      const last = id % 6, mask = Math.floor(id / 6);
      for (let turn = 0; turn < 3; turn++) {
        const previousMask = next(mask, inverseGroup(last * 3 + turn));
        for (let previous = 0; previous < 6; previous++) {
          if (previous === last) continue;
          const previousId = previousMask * 6 + previous;
          const candidate = cost + edgeCost(previous, last);
          if (distance[previousId] !== -1 && distance[previousId] <= candidate) continue;
          distance[previousId] = candidate;
          (buckets[candidate] ||= []).push(previousId);
        }
      }
    }
    if (cost % 4 === 0) progress(`Building exact distances: ${visited.toLocaleString()} states checked...`);
  }
  // A* enumerates distinct normalized group sequences in nondecreasing move cost.
  // Exact distances provide a bound; no beam, depth limit, or timeout approximation.
  const heap = [];
  let serial = 0;
  const less = (a, b) => a.bound < b.bound || (a.bound === b.bound && a.serial < b.serial);
  function push(node) {
    node.serial = serial++;
    let i = heap.length;
    heap.push(node);
    while (i) {
      const p = (i - 1) >> 1;
      if (!less(node, heap[p])) break;
      heap[i] = heap[p]; i = p;
    }
    heap[i] = node;
  }
  function pop() {
    const first = heap[0], end = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && less(heap[child + 1], heap[child])) child++;
        if (!less(heap[child], end)) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = end;
    }
    return first;
  }
  function simplify(path) {
    return simplifyCubeMoves(path.flatMap(g => groups[g].text.split(' ')));
  }
  const solutions = [], seen = new Set();
  if (start === goal) { solutions.push({ moves: '', count: 0, groups: [] }); seen.add(''); }
  for (let g = 0; g < groups.length; g++) {
    const mask = next(start, g), last = groups[g].starter, remaining = distance[mask * 6 + last];
    if (remaining >= 0) push({ mask, last, cost: 3, bound: 3 + remaining, path: [g] });
  }
  while (heap.length && solutions.length < 5) {
    const node = pop();
    if (node.mask === goal) {
      const tokens = simplify(node.path), moves = tokens.join(' ');
      if (!seen.has(moves)) {
        seen.add(moves);
        solutions.push({ moves, count: tokens.length, groups: node.path.map(g => groups[g].text) });
      }
    }
    for (let g = 0; g < groups.length; g++) {
      const last = groups[g].starter;
      if (last === node.last) continue;
      const mask = next(node.mask, g), remaining = distance[mask * 6 + last];
      if (remaining < 0) continue;
      const cost = node.cost + edgeCost(node.last, last);
      push({ mask, last, cost, bound: cost + remaining, path: [...node.path, g] });
    }
  }
  return { solutions, visited };
}

if (typeof module !== 'undefined') module.exports = { createCubeSolver, searchCubeSolutions, simplifyCubeMoves };
