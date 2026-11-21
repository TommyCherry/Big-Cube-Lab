const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const library = require('../case-library');
const { createExpandedSolver, searchExpandedSolutions } = require('../expanded-solver');
const database = require('../data/l2c-cases.json');
const html = fs.readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
const config = createExpandedSolver(model), classes = library.enumerate();
assert.equal(classes.length, 336);
assert.equal(database.cases.length, 336);
assert.equal(classes.reduce((n, c) => n + c.orbitSize, 0), 4900);
assert.equal(new Set(classes.flatMap(c => c.members)).size, 4900);
const keyOf = state => state.map(s => `${s.p.join(',')}/${s.n.join(',')}/${s.color}`).join(';');
for (let i = 0; i < classes.length; i++) {
  const group = classes[i], saved = database.cases[i];
  assert.equal(saved.key, group.key);
  assert.equal(saved.id, group.id);
  assert.equal(saved.orbitSize, group.orbitSize);
  assert.equal(library.canonical(saved.mask).key, group.key);
  for (const [name, value] of Object.entries(library.classify(saved.mask))) assert.equal(saved[name], value);
  assert.equal(saved.count, saved.algorithm.split(' ').filter(Boolean).length);
  const replay = model.apply(model.solved(), model.parse(saved.scramble));
  assert.equal(library.maskOf(model, replay), saved.mask);
  const solved = model.apply(library.stateOf(model, saved.mask), model.parse(saved.algorithm));
  assert.equal(JSON.stringify(config.encode(solved)), JSON.stringify(config.goal));
  for (const block of saved.blocks) {
    const tokens = block.split(' ');
    if (tokens.length > 1) {
      const rule = config.blockRules.find(rule => rule.setup === tokens[0]);
      assert.ok(rule, saved.id);
      assert.ok(/^[UF](2|')?$/.test(tokens[1]) && rule.inner.includes(tokens[1][0]), saved.id + ': ' + block);
    }
  }
  const expanded = model.apply(library.stateOf(model, saved.mask), model.parse(saved.blocks.join(' ')));
  assert.equal(keyOf(solved), keyOf(expanded));
  // Check the 2D rotation convention against physical U/F turns.
  for (const [face, index] of [['U', 0], ['F', 1]]) {
    const rotated = model.apply(library.stateOf(model, saved.mask), model.parse(face));
    assert.equal(library.maskOf(model, rotated), library.rotate(saved.mask, index));
  }
  for (const mask of group.members) {
    assert.equal(library.canonical(mask).key, saved.key);
    const alignment = library.orient(mask, saved.mask);
    assert.ok(alignment);
    const setup = library.adjustments(alignment);
    const state = model.apply(library.stateOf(model, mask), model.parse(setup));
    assert.equal(library.maskOf(model, state), saved.mask);
    const final = model.apply(state, model.parse(saved.algorithm));
    assert.equal(JSON.stringify(config.encode(final)), JSON.stringify(config.goal));
  }
}
// Independently solve every orientation of selected small/mid/large orbits,
// confirming the multi-start search selected the genuine orbit minimum.
for (const index of [0, 38, 166, 335]) {
  const group = classes[index];
  let minimum = Infinity;
  for (const mask of group.members) {
    const result = searchExpandedSolutions({ ...config, start: config.encode(library.stateOf(model, mask)), resultLimit: 1 });
    minimum = Math.min(minimum, result.solutions[0].count);
  }
  assert.equal(database.cases[index].count, minimum);
}
console.log('Passed: all 336 algorithms, 4,900 orientation matches, full-sticker block replay, face rotations, and sampled orbit optimality.');
