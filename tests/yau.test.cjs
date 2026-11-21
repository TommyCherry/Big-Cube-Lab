const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const library = require('../case-library'), database = require('../data/l2c-cases.json');
const script = fs.readFileSync('output/cube-centers.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const model = vm.runInNewContext(script.split('// BEGIN GENERATED SOLVER')[0] + '\nCubeModel');
const {yauAdjustments} = require('../yau');
const {createExpandedSolver, searchExpandedSolutions, randomL2CState} = require('../expanded-solver');
const config = createExpandedSolver(model, {yau: true}), home = model.solved();
const key = s => s.p.join(',') + '/' + s.n.join(',');
const protectedIndices = home.flatMap((s, i) => s.p[0] === -2 && s.p.filter(v => Math.abs(v) === 2).length === 2 && s.p[1] !== 2 ? [i] : []);
assert.equal(protectedIndices.length, 18);
function preserves(stickers) { for (const i of protectedIndices) assert.equal(key(stickers[i]), key(home[i])); }
for (const move of config.moves) preserves(model.apply(model.solved(), model.parse(move.tokens.join(' '))));
const yauDatabase = require('../data/yau-cases.json');
// All saved references and all 4,900 U/F orientations replay and preserve F3E.
let checked = 0;
for (const orbit of library.enumerate()) {
  const entry = yauDatabase.cases.find(e => e.id === orbit.id);
  assert.equal(entry.count, entry.algorithm.split(' ').filter(Boolean).length);
  assert.ok(!/(^| )F/.test(entry.algorithm));
  const scramble = model.apply(model.solved(), model.parse(entry.scramble));
  assert.equal(library.maskOf(model, scramble), entry.mask); preserves(scramble);
  for (const mask of orbit.members) {
    const align = yauAdjustments(library.adjustments(library.orient(mask, entry.mask)));
    const state = model.apply(library.stateOf(model, mask), model.parse([align, entry.algorithm].join(' ')));
    assert.equal(library.maskOf(model, state), 511);
    assert.equal(JSON.stringify(config.encode(state)), JSON.stringify(config.goal), entry.id + ": hidden centers"); preserves(state); checked++;
  }
}
assert.equal(checked, 4900);
const scramble = "3Rw U 3Rw' U2 M' U M Rw U' Rw' 4Rw U' 4Rw'";
const candidate = "4Rw 3Rw' U 3Rw U2 Rw' U' Rw";
const initial = model.apply(model.solved(), model.parse(scramble));
const proposed = model.apply(model.apply(model.solved(), model.parse(scramble)), model.parse(candidate));
assert.equal(JSON.stringify(config.encode(proposed)), JSON.stringify(config.rotatedGoals[1])); preserves(proposed);
for (const rotated of [true, false]) {
  const result = searchExpandedSolutions({...config, start: config.encode(initial), goalVariants: rotated ? config.rotatedGoals : undefined, resultLimit: 1});
  const solution = result.solutions[0];
  assert.equal(solution.count, rotated ? 8 : 9);
  const replay = model.apply(model.apply(model.solved(), model.parse(scramble)), model.parse(solution.moves));
  assert.equal(JSON.stringify(config.encode(replay)), JSON.stringify(rotated ? config.rotatedGoals[solution.goalVariant] : config.goal)); preserves(replay);
}
// More than the reported case: certify shallow primitive-space distances
// independently with an exhaustive forward BFS, then compare exact search.
const primitive = config.moves.filter(move => move.cost === 1);
const stateKey = stickers => JSON.stringify(config.encode(stickers));
const distances = new Map([[stateKey(model.solved()), 0]]);
let frontier = [model.solved()];
for (let depth = 1; depth <= 3; depth++) {
  const next = [];
  for (const state of frontier) for (const move of primitive) {
    const copy = state.map(s => ({...s, p: [...s.p], n: [...s.n]}));
    model.apply(copy, model.parse(move.tokens.join(' ')));
    const key = stateKey(copy);
    if (!distances.has(key)) { distances.set(key, depth); next.push(copy); }
  }
  frontier = next;
}
for (const text of ["Rw U Rw'", "3Rw U2 3Rw'", "M' U M", "4Rw U 4Rw'", "4Rw U2", "Rw 3Rw U"]) {
  const state = model.apply(model.solved(), model.parse(text));
  const solution = searchExpandedSolutions({...config, start: config.encode(state), resultLimit: 1}).solutions[0];
  assert.equal(solution.count, distances.get(stateKey(state)), text);
}
// Random-case generation also retains the hidden solved centers.
const randomState = randomL2CState(config.goal, () => .123, config.colorCount);
for (const part of [2, 3, 6, 7, 8, 9, 10, 11]) assert.equal(randomState[part], config.goal[part]);
const generated = searchExpandedSolutions({...config, start: randomState, resultLimit: 1, nearOptimal: true});
assert.ok([1, 2].includes(generated.solutions[0].count - generated.optimalCount));
const randomScramble = library.inverse(generated.solutions[0].moves);
const randomReplay = model.apply(model.solved(), model.parse(randomScramble));
assert.equal(JSON.stringify(config.encode(randomReplay)), JSON.stringify(randomState)); preserves(randomReplay);
const trainer = vm.runInNewContext(fs.readFileSync('trainer.js', 'utf8') + '\nL2CTrainer', {yauAdjustments});
for (const entry of yauDatabase.cases.filter(e => e.count)) for (const random of [0, .3, .6, .9]) {
  const practice = trainer.create(yauDatabase, {selected: [entry.id]}, () => 0, () => random);
  const state = model.apply(model.solved(), model.parse(practice.current.scramble));
  preserves(state);
  assert.equal(library.canonical(library.maskOf(model, state)).key, entry.key);
  const solved = model.apply(state, model.parse(practice.current.algorithm));
  assert.equal(library.maskOf(model, solved), 511); assert.equal(JSON.stringify(config.encode(solved)), JSON.stringify(config.goal)); preserves(solved);
}

console.log('Passed: 8/9-move regression, independent short-distance checks, all 4,900 layouts, F3E preservation, and trainer alignment replay.');
