const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createCubeSolver, searchCubeSolutions, simplifyCubeMoves } = require('../solver.js');
const html = readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
const config = createCubeSolver(model);
const run = text => model.apply(model.solved(), model.parse(text));
for (const [input, expected] of [
  ['Lw M', '3Lw'], ['M Lw', '3Lw'], ["Lw' M'", "3Lw'"],
  ["Rw M'", '3Rw'], ["M' Rw", '3Rw'], ["Rw' M", "3Rw'"],
  ['Lw2 M2', '3Lw2'], ['Rw2 M2', '3Rw2'],
  ["Lw M'", "Lw M'"], ['Rw M', 'Rw M'],
  ["Rw U Rw' M F M'", "Rw U 3Rw' F M'"],
  ["3Lw M'", 'Lw']
]) {
  const simplified = simplifyCubeMoves(input.split(' ')).join(' ');
  assert.equal(simplified, expected);
  // Compare every sticker's position and orientation, including the gray ones.
  assert.equal(JSON.stringify(run(simplified)), JSON.stringify(run(input)));
}
// Independent boundary oracle: compare full physical sticker permutations.
const candidates = ['Rw', 'Lw', 'M', '3Rw', '3Lw'].flatMap(base => ['', "'", '2'].map(s => base + s));
const signatures = new Map(candidates.map(t => [JSON.stringify(run(t)), t]));
signatures.set(JSON.stringify(run('')), '');
const boundaries = new Map();
const starters = ['Rw', "Rw'", 'Lw', "Lw'", 'M', "M'"];
for (const a of starters) for (const b of starters) {
  const replacement = signatures.get(JSON.stringify(run(`${a} ${b}`)));
  if (replacement !== undefined) boundaries.set(`${a} ${b}`, replacement);
}
assert.throws(() => config.encode(run('Rw')));
assert.equal(config.groups.length, 18);
for (const group of config.groups) {
  assert.equal(new Set(group.permutation).size, 18);
  config.encode(run(group.text));
}
function solve(scramble) {
  const state = run(scramble);
  const result = searchCubeSolutions({ ...config, start: config.encode(state) });
  assert.equal(result.solutions.length, 5);
  assert.equal(new Set(result.solutions.map(s => s.moves)).size, 5);
  let previous = -1;
  for (const solution of result.solutions) {
    assert.ok(solution.count >= previous);
    previous = solution.count;
    assert.equal(solution.count, solution.moves.split(' ').filter(Boolean).length);
    const solved = model.apply(run(scramble), model.parse(solution.moves));
    assert.equal(config.encode(solved), config.goal);
    assert.equal(config.encode(model.apply(run(scramble), model.parse(solution.groups.join(' ')))), config.goal);
  }
  return result.solutions;
}

// Independent exhaustive enumeration of all normalized paths through 3 groups.
// A 4-group path costs at least 9, so all results <= 8 are globally covered.
function brute(scramble) {
  const results = new Map();
  const start = run(scramble);
  function walk(state, previous, moves, depth) {
    if (config.encode(state) === config.goal) results.set(moves.join(' '), moves.length);
    if (depth === 3) return;
    for (const group of config.groups) {
      if (group.starter === previous) continue;
      const tokens = [...moves];
      for (const token of group.text.split(' ')) {
        const base = token.replace(/[2']/g, '');
        const last = tokens.at(-1);
        if (last && last.replace(/[2']/g, '') === base) {
          const turns = t => t.includes('2') ? 2 : t.endsWith("'") ? 3 : 1;
          const total = (turns(tokens.pop()) + turns(token)) % 4;
          if (total) tokens.push(base + ['', '', '2', "'"][total]);
        } else if (boundaries.has(`${last} ${token}`)) {
          const replacement = boundaries.get(`${last} ${token}`);
          tokens.pop();
          if (replacement) tokens.push(replacement);
        } else tokens.push(token);
      }
      const copy = state.map(s => ({ ...s, p: [...s.p], n: [...s.n] }));
      walk(model.apply(copy, model.parse(group.text)), group.starter, tokens, depth + 1);
    }
  }
  walk(start, -1, [], 0);
  return [...results.values()].sort((a, b) => a - b).slice(0, 5);
}
for (const scramble of ['', "Rw U Rw'", "Rw U Rw' Rw' F Rw", "M F2 M'", "Rw U Rw' M F M'", "Lw' U Lw M F' M'"]) {
  const solutions = solve(scramble);
  const expected = brute(scramble);
  assert.ok(expected[4] <= 8);
  assert.deepEqual(solutions.map(s => s.count), expected);
  console.log(JSON.stringify(scramble), solutions.map(s => s.count).join(', '));
}
solve(config.groups.filter((_, i) => i % 2 === 0).map(g => g.text).join(' '));
// A valid occupied layout can still be unreachable under the restricted groups.
const impossible = model.solved();
const centers = impossible.filter(s => s.color !== 'gray' && s.p.filter(v => v === 0).length === 2);
[centers[0].color, centers[1].color] = [centers[1].color, centers[0].color];
assert.equal(searchCubeSolutions({ ...config, start: config.encode(impossible) }).solutions.length, 0);
console.log('Passed: solution verification, exact top-five costs against exhaustive search, eligibility, and unreachable states.');
