const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createExpandedSolver, searchExpandedSolutions, createSetupGrammar, randomL2CState, solutionEffectKey } = require('../expanded-solver.js');
const html = readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
const config = createExpandedSolver(model);
const grammar = createSetupGrammar(config.blockRules);
const run = text => model.apply(model.solved(), model.parse(text));
const snapshot = state => JSON.stringify(state);
function checkBlock(block) {
  if (/^[UF](2|')?$/.test(block)) return; // Explicit outside-block adjustment.
  const tokens = block.split(' ');
  const rule = config.blockRules.find(r => r.setup === tokens[0]);
  assert.ok(rule, block);
  const inverse = tokens[0].endsWith("'") ? tokens[0].slice(0, -1) : tokens[0] + "'";
  assert.equal(tokens.at(-1), inverse);
  assert.ok(tokens.length >= 3);
  assert.match(tokens[1], /^[UF](2|')?$/, 'Setup must immediately turn its perpendicular face');
  assert.ok(tokens.slice(1, -1).every(t => rule.inner.includes(t.replace(/(?:2|')$/, ''))), block);
  assert.ok(tokens.slice(1, -1).some(t => /^[UF]/.test(t)), 'Trivial setup block: ' + block);
}
// Converted wide triggers preserve every sticker, including gray pieces.
for (const [before, after] of [
  ["Lw F Lw'", "3Rw U 3Rw'"],
  ["Rw' F Rw", "3Lw' U 3Lw"],
  ["Lw F2 M Rw' F' M' Rw Lw'", "3Rw U2 M Rw' U' M' Rw 3Rw'"],
  ["Rw' F Lw M2 F2 Lw' Rw", "3Lw' U Lw M2 U2 Lw' 3Lw"]
]) assert.equal(snapshot(run(before)), snapshot(run(after)));
assert.equal(config.blockRules.filter(rule => rule.inner.includes('F')).map(rule => rule.setup).join(','), 'M');
assert.equal(config.moves.length, 69);
function macroPath(text) {
  return text.split(' ').filter(Boolean).map(token => {
    const move = config.moves.find(m => m.tokens.length === 1 && m.tokens[0] === token);
    assert.ok(move, token);
    return move;
  });
}
for (const text of ["Rw M Rw'", "Lw Rw Lw'", "Rw M' U M Rw'", "M' Rw U Rw' M", "Lw' M' U' Lw", 'M', 'Rw', 'Lw']) {
  assert.equal(grammar.witness(macroPath(text)), null, 'Must reject trivial shortcut: ' + text);
}
for (const text of ['U', 'F', "3Lw' U 3Lw", "3Rw U 3Rw'", "M F M'", "Rw U Rw' F U2 3Rw U 3Rw'", "Rw U Rw'", "Rw U Lw M U' M' Lw' Rw'", "3Rw U Rw M U' M' Rw' 3Rw'", "M' U M", "Rw U 3Rw' F M'"]) {
  const blocks = grammar.witness(macroPath(text));
  assert.ok(blocks, text);
  blocks.forEach(checkBlock);
  assert.equal(snapshot(run(text)), snapshot(run(blocks.join(' '))));
}
// Independent full-sticker expansion to verify compiled center permutations.
for (const scramble of ["Rw U Rw'", "Lw Rw U2 M' F Lw'", "M U Rw' F2"]) {
  const state = run(scramble), encoded = config.encode(state);
  for (const move of config.moves) {
    const predicted = encoded.map((mask, part) => {
      let result = 0;
      move.permutations[part >> 1].forEach((to, from) => { if (mask & (1 << from)) result |= 1 << to; });
      return result;
    });
    const actual = config.encode(model.apply(run(scramble), model.parse(move.tokens.join(' '))));
    assert.equal(JSON.stringify(predicted), JSON.stringify(actual));
  }
}

function solve(scramble) {
  const start = config.encode(run(scramble));
  const began = Date.now();
  const result = searchExpandedSolutions({ ...config, start }, text => {
    if (text.startsWith('Proving')) console.log(text);
  });
  assert.equal(result.solutions.length, 5);
  assert.equal(new Set(result.solutions.map(s => s.moves)).size, 5);
  // Independent oracle: include every sticker, even gray ones, in equivalence.
  assert.equal(new Set(result.solutions.map(s => snapshot(run(s.moves)))).size, 5);
  let cost = -1;
  for (const solution of result.solutions) {
    assert.ok(solution.count >= cost); cost = solution.count;
    assert.equal(solution.count, solution.moves.split(' ').filter(Boolean).length);
    const final = model.apply(run(scramble), model.parse(solution.moves));
    assert.equal(JSON.stringify(config.encode(final)), JSON.stringify(config.goal));
    solution.groups.forEach(checkBlock);
    // A witness may restore cancelled/combined axis setup turns, but must never
    // invent extra face turns merely to disguise a trivial setup as meaningful.
    const faces = text => text.split(' ').filter(t => /^[UF]/.test(t));
    assert.deepEqual(faces(solution.groups.join(' ')), faces(solution.moves));
    const expanded = model.apply(run(scramble), model.parse(solution.groups.join(' ')));
    assert.equal(snapshot(expanded), snapshot(final));
  }
  console.log(JSON.stringify(scramble), result.solutions.map(s => s.count), `${Date.now() - began}ms`);
  return result;
}
const solved = solve('');
assert.equal(solved.solutions[0].count, 0);
assert.deepEqual(solved.solutions.map(s => s.count), [0, 1, 1, 1, 1]);
const simple = solve("Rw U Rw'");
assert.equal(simple.solutions[0].count, 3);
// User-reported scramble and omitted solution. Also lock down the displayed
// orientation: top rows run back-to-front, front rows run top-to-bottom.
const reportedScramble = "Lw' U2 Lw F2 U 3Lw' U M U Lw";
const reportedSolution = "U F' Rw' F Rw2 U2 Rw'";
const equivalentSolution = "U F' 3Lw' U 3Lw2 F2 3Lw'";
assert.equal(snapshot(run(reportedSolution)), snapshot(run(equivalentSolution)));
assert.equal(solutionEffectKey(macroPath(reportedSolution)), solutionEffectKey(macroPath(equivalentSolution)));
// U and F both leave the solved center colors alone, but are distinct moves.
assert.notEqual(solutionEffectKey(macroPath('U')), solutionEffectKey(macroPath('F')));
const reportedState = run(reportedScramble);
const centerRows = face => [1, 2, 3].map(row => model.visible(reportedState, face).slice(row * 5 + 1, row * 5 + 4).map(c => c === 'green' ? 'G' : c === 'orange' ? 'O' : '.').join('')).join('/');
assert.equal(centerRows('U'), 'GOO/GGG/OOO');
assert.equal(centerRows('F'), 'OOG/OOG/GGG');
assert.equal(JSON.stringify(config.encode(run(reportedScramble + ' ' + reportedSolution))), JSON.stringify(config.goal));
// The physical regression still solves; the new notation uses U-based wide triggers.
assert.ok(grammar.witness(macroPath("U F' 3Lw' U 3Lw Rw U2 Rw'")));
const reportedResults = solve(reportedScramble);
assert.equal(reportedResults.solutions[0].count, 7);
// Independent exhaustive enumeration, without any heuristic or failed-state
// pruning, checks the complete top-five ranking through four moves.
function exhaustiveCosts(scramble, limit) {
  const start = config.encode(run(scramble)), goalKey = JSON.stringify(config.goal);
  const answers = new Map();
  function visit(state, cost, previousAxis, path) {
    if (JSON.stringify(state) === goalKey && grammar.witness(path)) {
      const key = snapshot(run(path.flatMap(m => m.tokens).join(' ')));
      answers.set(key, Math.min(cost, answers.get(key) ?? Infinity));
    }
    for (const move of config.moves) {
      if (move.axis === previousAxis || cost + move.cost > limit) continue;
      const next = state.map((mask, part) => {
        let result = 0;
        const permutation = move.permutations[part >> 1];
        while (mask) {
          const bit = mask & -mask;
          result |= 1 << permutation[31 - Math.clz32(bit)];
          mask ^= bit;
        }
        return result;
      });
      visit(next, cost + move.cost, move.axis, [...path, move]);
    }
  }
  visit(start, 0, '', []);
  return [...answers.values()].sort((a, b) => a - b).slice(0, 5);
}
const shortCosts = exhaustiveCosts("Rw U Rw'", 4);
assert.deepEqual(simple.solutions.filter(s => s.count <= 4).map(s => s.count), shortCosts);
// A longer legal block, with wide turns and middle turns in its interior.
const longBlock = "Rw U Lw M U' M' Lw' Rw'";
const longer = solve(longBlock.split(' ').reverse().map(t => t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'").join(' '));
assert.ok(longer.solutions[0].count <= 8);
solve("Rw U Rw' Lw F2 Lw' M' U M Lw' U2 Lw Rw' F Rw");
const impossible = [...config.goal];
[impossible[4], impossible[5]] = [impossible[5], impossible[4]];
assert.equal(searchExpandedSolutions({ ...config, start: impossible }).solutions.length, 0);
// Every non-solved four-corner/four-edge distribution is sampled once.
const cases = new Set();
const bits = n => n.toString(2).replace(/0/g, '').length;
for (let i = 0; i < 4899; i++) {
  const state = randomL2CState(config.goal, () => (i + 0.5) / 4899);
  assert.notEqual(JSON.stringify(state), JSON.stringify(config.goal));
  assert.deepEqual(state.slice(4), Array.from(config.goal.slice(4)));
  for (const part of [0, 2]) {
    assert.equal(bits(state[part]), 4);
    assert.equal(bits(state[part + 1]), 4);
    assert.equal(state[part] & state[part + 1], 0);
    assert.equal(state[part] | state[part + 1], config.goal[part] | config.goal[part + 1]);
  }
  cases.add(JSON.stringify(state));
}
assert.equal(cases.size, 4899);
function checkGeneration(start, expectedOptimal) {
  const result = searchExpandedSolutions({ ...config, start, nearOptimal: true });
  assert.equal(result.solutions.length, 1);
  assert.equal(result.optimalCount, expectedOptimal);
  const solution = result.solutions[0];
  assert.ok([1, 2].includes(solution.count - result.optimalCount));
  solution.groups.forEach(checkBlock);
  const inverse = solution.moves.split(' ').reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'").join(' ');
  assert.equal(JSON.stringify(config.encode(run(inverse))), JSON.stringify(start));
  assert.equal(JSON.stringify(config.encode(run(inverse + ' ' + solution.moves))), JSON.stringify(config.goal));
  return solution.count - result.optimalCount;
}
assert.equal(checkGeneration(config.encode(run("Rw U Rw'")), 3), 1);
for (const sample of [0.123, 0.617, 0.999]) {
  const start = randomL2CState(config.goal, () => sample);
  const reference = searchExpandedSolutions({ ...config, start });
  checkGeneration(start, reference.solutions[0].count);
}
console.log('Passed: all 4,899 random layouts, certified +1/+2 lengths, and inverse scramble replay.');
console.log('Passed: no trivial blocks or invented face turns, symmetric grammar, exhaustive short-case ranking, and full-sticker replay.');
