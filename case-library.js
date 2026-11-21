const L2CCases = (() => {
  const corners = [0, 2, 6, 8, 9, 11, 15, 17];
  const edges = [1, 3, 5, 7, 10, 12, 14, 16];
  const popcount = value => value.toString(2).replace(/0/g, '').length;
  function rotate(mask, face) {
    const offset = face * 9;
    let result = mask & ~(511 << offset);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      if (mask & (1 << (offset + row * 3 + col))) result |= 1 << (offset + col * 3 + 2 - row);
    }
    return result;
  }
  function canonical(mask) {
    let best = { key: mask, u: 0, f: 0 }, up = mask;
    for (let u = 0; u < 4; u++) {
      let front = up;
      for (let f = 0; f < 4; f++) {
        if (front < best.key) best = { key: front, u, f };
        front = rotate(front, 1);
      }
      up = rotate(up, 0);
    }
    return best;
  }
  function orient(mask, target) {
    let best = null, up = mask;
    for (let u = 0; u < 4; u++) {
      let front = up;
      for (let f = 0; f < 4; f++) {
        if (front === target && (!best || Number(u > 0) + Number(f > 0) < Number(best.u > 0) + Number(best.f > 0))) best = { u, f };
        front = rotate(front, 1);
      }
      up = rotate(up, 0);
    }
    return best;
  }
  function enumerate() {
    const choose = slots => {
      const masks = [];
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++)
        for (let c = b + 1; c < 8; c++) for (let d = c + 1; d < 8; d++) masks.push((1 << slots[a]) | (1 << slots[b]) | (1 << slots[c]) | (1 << slots[d]));
      return masks;
    };
    const classes = new Map();
    for (const c of choose(corners)) for (const e of choose(edges)) {
      const mask = c | e | (1 << 4), key = canonical(mask).key;
      if (!classes.has(key)) classes.set(key, []);
      classes.get(key).push(mask);
    }
    return [...classes].sort((a, b) => a[0] - b[0]).map(([key, members], i) => ({ id: 'L2C-' + String(i).padStart(3, '0'), key, orbitSize: members.length, members }));
  }
  function maskOf(model, state) {
    let mask = 0;
    ['U', 'F'].forEach((face, f) => {
      const colors = model.visible(state, face);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const color = colors[(r + 1) * 5 + c + 1];
        if (color === 'gray') throw new Error('The two center grids must contain all 18 colored stickers.');
        if (color === 'green') mask |= 1 << (f * 9 + r * 3 + c);
      }
    });
    return mask;
  }
  function stateOf(model, mask) {
    const state = model.solved();
    for (const s of state) {
      if (s.color === 'gray') continue;
      const face = s.n[1] === 1 ? 0 : 1;
      const row = face === 0 ? s.p[2] + 1 : 1 - s.p[1];
      const col = s.p[0] + 1;
      s.color = mask & (1 << (face * 9 + row * 3 + col)) ? 'green' : 'orange';
    }
    return state;
  }
  function pattern(mask, face, type) {
    const positions = type === 'corners' ? [0, 2, 8, 6] : [1, 5, 7, 3];
    const wrong = positions.map(i => Boolean(mask & (1 << (face * 9 + i))) === (face === 1));
    const count = wrong.filter(Boolean).length;
    if (count === 0) return 'None';
    if (count === 1) return 'Single';
    if (count === 3) return 'Three';
    if (count === 4) return 'All four';
    return wrong.some((value, i) => value && wrong[(i + 1) % 4]) ? 'Adjacent pair' : 'Opposite pair';
  }
  // Names describe the pieces matching the fixed center's color, including it.
  // Shape families ignore rotation/reflection; case IDs still distinguish cases.
  function shapeKey(cells) {
    const variants = [];
    for (const mirror of [1, -1]) for (let turns = 0; turns < 4; turns++) {
      const points = cells.map(([r, c]) => {
        let y = r, x = c * mirror;
        for (let t = 0; t < turns; t++) [y, x] = [x, -y];
        return [y, x];
      });
      const minY = Math.min(...points.map(p => p[0])), minX = Math.min(...points.map(p => p[1]));
      variants.push(points.map(([y, x]) => `${y - minY},${x - minX}`).sort().join(';'));
    }
    return variants.sort()[0];
  }
  const shapes = new Map([
    ['Dot', ['#']], ['2-piece bar', ['##']], ['3-piece bar', ['###']],
    ['L (3 pieces)', ['##', '#.']], ['2x2 block', ['##', '##']],
    ['T (4 pieces)', ['###', '.#.']], ['L (4 pieces)', ['#.', '#.', '##']],
    ['Zigzag (4 pieces)', ['.##', '##.']],
    ['2x2 block + tail', ['##', '##', '#.']], ['T', ['###', '.#.', '.#.']],
    ['U', ['#.#', '###']], ['V', ['#..', '#..', '###']],
    ['W', ['#..', '##.', '.##']], ['Cross', ['.#.', '###', '.#.']],
    ['F', ['.##', '##.', '.#.']], ['Zigzag (5 pieces)', ['##.', '.#.', '.##']],
    ['2x3 block', ['###', '###']], ['H', ['#.#', '###', '#.#']]
  ].map(([name, rows]) => [shapeKey(rows.flatMap((row, r) => [...row].flatMap((cell, c) => cell === '#' ? [[r, c]] : []))), name]));
  function componentName(cells) {
    const known = shapes.get(shapeKey(cells));
    if (known) return known;
    const remaining = new Set(cells.map(([r, c]) => r * 3 + c)), parts = [];
    while (remaining.size) {
      const queue = [remaining.values().next().value]; remaining.delete(queue[0]);
      for (let i = 0; i < queue.length; i++) {
        const r = Math.floor(queue[i] / 3), c = queue[i] % 3;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const y = r + dr, x = c + dc, key = y * 3 + x;
          if (y >= 0 && y < 3 && x >= 0 && x < 3 && remaining.has(key)) { remaining.delete(key); queue.push(key); }
        }
      }
      const points = queue.map(i => [Math.floor(i / 3), i % 3]);
      parts.push(shapes.get(shapeKey(points)) || `${points.length}-piece shape`);
    }
    const counts = new Map();
    for (const name of parts) counts.set(name, (counts.get(name) || 0) + 1);
    return [...counts].sort(([a], [b]) => a === 'Dot' ? 1 : b === 'Dot' ? -1 : a.localeCompare(b)).map(([name, n]) => n === 1 ? name : name === 'Dot' ? `${n} dots` : `${n} x ${name}`).join(' + ');
  }
  function facePatternName(mask, face) {
    const bits = face === 0 ? mask & 511 : ((mask >> 9) & 511) ^ 511;
    const cells = [], missing = [];
    for (let i = 0; i < 9; i++) (bits & (1 << i) ? cells : missing).push([Math.floor(i / 3), i % 3]);
    if (cells.length === 9) return 'Solid center';
    if (bits === 341) return 'Checkerboard'; // Four corners plus fixed center.
    if (cells.length === 3 && (bits === 273 || bits === 84)) return 'Diagonal';
    const exact = shapes.get(shapeKey(cells));
    if (exact) return exact;
    if (missing.length === 1) return missing[0].every(v => v !== 1) ? 'Missing corner' : 'Missing edge';
    if (missing.length === 2 && missing.every(([r, c]) => r !== 1 && c !== 1)) {
      return missing[0][0] !== missing[1][0] && missing[0][1] !== missing[1][1] ? 'Missing opposite corners' : 'Missing adjacent corners';
    }
    if (cells.length >= 6) return 'Missing ' + componentName(missing).replace(/Dot/g, 'dot');
    return componentName(cells).replace(/ \+ Dot/g, ' + dot');
  }
  function classify(mask) {
    return {
      exchanged: 9 - popcount(mask & 511),
      corners: pattern(mask, 0, 'corners'), edges: pattern(mask, 0, 'edges'),
      frontCorners: pattern(mask, 1, 'corners'), frontEdges: pattern(mask, 1, 'edges'),
      topName: facePatternName(mask, 0), frontName: facePatternName(mask, 1)
    };
  }
  const adjustments = ({ u, f }) => [[u, 'U'], [f, 'F']].filter(([turns]) => turns).map(([turns, face]) => face + ['', '', '2', "'"][turns]).join(' ');
  const inverse = text => text.split(/\s+/).filter(Boolean).reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'").join(' ');
  return { canonical, enumerate, maskOf, stateOf, classify, adjustments, inverse, rotate, orient, facePatternName };
})();
if (typeof module !== 'undefined') module.exports = L2CCases;
