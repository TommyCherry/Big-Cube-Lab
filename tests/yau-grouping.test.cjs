const assert = require('node:assert/strict');
const {groupYauSolution} = require('../yau');
assert.deepEqual(groupYauSolution("4Rw U M U M' U' 3Rw' U' 3Rw"), ["4Rw U", "M U M'", "U'", "3Rw' U' 3Rw"]);
assert.deepEqual(groupYauSolution("U2 Rw U M U' M' Rw' U'"), ['U2', "Rw U M U' M' Rw'", "U'"]);
assert.deepEqual(groupYauSolution('3Rw2 U2 3Rw2'), ['3Rw2 U2 3Rw2']);
assert.deepEqual(groupYauSolution(''), []);
assert.deepEqual(groupYauSolution("4Rw M' U"), ["4Rw M' U"]);
assert.deepEqual(groupYauSolution("U2 Rw U' Rw2 4Rw U' Rw U 3Rw' U 3Rw"), ["U2", "Rw U' Rw'", "4Rw", "Rw' U' Rw", "U", "3Rw' U 3Rw"]);
const fs = require('node:fs'), vm = require('node:vm');
const script = fs.readFileSync('output/cube-centers.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.split('// BEGIN GENERATED SOLVER')[0] + '\nCubeModel');
const effect = text => JSON.stringify(model.apply(model.solved(), model.parse(text)));
for (const entry of require('../data/yau-cases.json').cases) {
  const expanded = groupYauSolution(entry.algorithm).join(' ');
  assert.equal(effect(expanded), effect(entry.algorithm), entry.id);
  assert.deepEqual(expanded.split(' ').filter(t => /^U/.test(t)), entry.algorithm.split(' ').filter(t => /^U/.test(t)), entry.id);
}
console.log('Passed: requested grouping, nested interiors, half turns, unpaired adjustments, and identical full-sticker effects and U turns for all 336 Yau algorithms.');
