const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {createModeTransfer} = require('../mode-transfer');
const {createExpandedSolver, searchExpandedSolutions} = require('../expanded-solver');
const script = fs.readFileSync('output/cube-centers.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const model = vm.runInNewContext(script.split('// BEGIN GENERATED SOLVER')[0] + '\nCubeModel');
const transfer = createModeTransfer(model);
const scramble = "3Lw F M' F M F' Lw' F M'";
const initial = model.apply(model.solved(), model.parse(scramble));
let state = initial;
for (const mode of ['yau', 'redux', 'yau']) {
  const url = new URL(transfer.url('http://localhost:8001/output/cube-centers.html?mode=redux#solver', mode, state, scramble + '\nU2 (unapplied draft)'));
  assert.equal(url.searchParams.get('mode'), mode);
  assert.equal(url.hash, '#solver');
  assert.equal(url.searchParams.get('draft'), scramble + '\nU2 (unapplied draft)');
  state = transfer.decode(url.searchParams.get('cube'));
  assert.equal(JSON.stringify(state), JSON.stringify(initial));
  const config = createExpandedSolver(model, {yau: mode === 'yau'});
  const result = searchExpandedSolutions({...config, start: config.encode(state), resultLimit: 1});
  assert.ok(result.solutions.length);
  const solved = model.apply(transfer.decode(transfer.encode(state)), model.parse(result.solutions[0].moves));
  assert.equal(JSON.stringify(config.encode(solved)), JSON.stringify(config.goal));
}
// Also retain off-screen stickers, rather than reconstructing only the visible grids.
const hidden = model.apply(model.solved(), model.parse("Rw M' U 4Rw2"));
assert.equal(JSON.stringify(transfer.decode(transfer.encode(hidden))), JSON.stringify(hidden));
assert.throws(() => transfer.decode('broken'));
assert.throws(() => transfer.decode('000'.repeat(150)));
console.log('Passed: repeated Redux/Yau switches retain exact sticker state and unapplied input; both solvers solve the retained case.');
