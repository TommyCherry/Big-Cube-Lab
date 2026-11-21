function yauAdjustments(text) {
  return text.split(' ').filter(Boolean).flatMap(t => t[0] === 'F' ? ['4Rw', 'U' + t.slice(1), "4Rw'"] : [t]).join(' ');
}
// Recognize already explicit conjugates, including longer interiors.
function literalYauGroups(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean), groups = [], adjustments = [];
  const inverse = token => token.endsWith('2') ? token : token.endsWith("'") ? token.slice(0, -1) : token + "'";
  const flush = () => { if (adjustments.length) { groups.push(adjustments.join(' ')); adjustments.length = 0; } };
  for (let i = 0; i < tokens.length;) {
    let end = -1;
    if (/^(?:Rw|3Rw|4Rw|M)(?:2|')?$/.test(tokens[i]) && /^U(?:2|')?$/.test(tokens[i + 1] || '')) {
      const undo = inverse(tokens[i]);
      for (let j = i + 2; j < tokens.length; j++) {
        if (tokens[j] === undo) { end = j; break; }
      }
    }
    if (end !== -1) {
      flush(); groups.push(tokens.slice(i, end + 1).join(' ')); i = end + 1;
    } else { adjustments.push(tokens[i]); i++; }
  }
  flush();
  return groups;
}
// Recover setup boundaries hidden by axis-run combination. The DP minimizes
// unmatched axis adjustments, then expanded length. Only commuting layer turns
// may be reordered/split; U turns are never inserted, removed, or changed.
function groupYauSolution(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const bases = {Rw: [0,0,3], '3Rw': [0,3,3], '4Rw': [3,3,3], M: [0,1,0]};
  const add = (a, b) => [0,2,4].reduce((n, shift) => n | (((a >> shift & 3) + (b >> shift & 3) & 3) << shift), 0);
  const neg = a => [0,2,4].reduce((n, shift) => n | (((4 - (a >> shift & 3)) & 3) << shift), 0);
  const code = token => {
    const vector = bases[token.replace(/(?:2|')$/, '')];
    if (!vector) return null;
    const turns = token.endsWith('2') ? 2 : token.endsWith("'") ? 3 : 1;
    return vector.reduce((n, v, i) => n | ((v * turns % 4) << (i * 2)), 0);
  };
  const primitives = Object.keys(bases).flatMap(base => ['', "'", '2'].map(s => base + s));
  const words = Array(64).fill(null), queue = [0]; words[0] = [];
  for (let i = 0; i < queue.length; i++) for (const token of primitives) {
    const next = add(queue[i], code(token));
    if (words[next] === null) { words[next] = [...words[queue[i]], token]; queue.push(next); }
  }
  const runs = [0], faces = [];
  for (const token of tokens) {
    if (/^U(?:2|')?$/.test(token)) { faces.push(token); runs.push(0); }
    else { const c = code(token); if (c === null) return literalYauGroups(text); runs[runs.length - 1] = add(runs.at(-1), c); }
  }
  const better = (a, b) => !b || a.adjustments < b.adjustments || a.adjustments === b.adjustments && a.length < b.length;
  let states = new Map([[0, {adjustments: 0, length: 0, groups: []}]]);
  for (let i = 0; i < faces.length; i++) {
    const next = new Map();
    for (const [carry, path] of states) for (const setup of ['', ...primitives]) {
      const setupCode = setup ? code(setup) : 0;
      const adjustments = words[add(add(runs[i], neg(carry)), neg(setupCode))];
      const closing = neg(setupCode);
      const inverse = setup.endsWith('2') ? setup : setup.endsWith("'") ? setup.slice(0, -1) : setup + "'";
      const groups = [...path.groups];
      if (setup) {
        if (adjustments.length) groups.push(adjustments.join(' '));
        groups.push(`${setup} ${faces[i]} ${inverse}`);
      } else groups.push([...adjustments, faces[i]].join(' '));
      const candidate = {adjustments: path.adjustments + adjustments.length, length: path.length + adjustments.length + (setup ? 3 : 1), groups};
      if (better(candidate, next.get(closing))) next.set(closing, candidate);
    }
    states = next;
  }
  let best;
  for (const [carry, path] of states) {
    const tail = words[add(runs.at(-1), neg(carry))];
    const candidate = {adjustments: path.adjustments + tail.length, length: path.length + tail.length, groups: [...path.groups, ...(tail.length ? [tail.join(' ')] : [])]};
    if (better(candidate, best)) best = candidate;
  }
  const literal = literalYauGroups(text);
  const literalScore = {groups: literal, length: tokens.length, adjustments: literal.reduce((n, group) => {
    const ts = group.split(' '), first = ts[0];
    const inverse = first.endsWith('2') ? first : first.endsWith("'") ? first.slice(0, -1) : first + "'";
    const block = code(first) !== null && /^U/.test(ts[1] || '') && ts.at(-1) === inverse;
    return n + (block ? 0 : ts.filter(t => code(t) !== null).length);
  }, 0)};
  return better(literalScore, best) ? literal : best.groups;
}
if (typeof module !== 'undefined') module.exports = { yauAdjustments, groupYauSolution };
