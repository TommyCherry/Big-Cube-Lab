const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const modelCode = script.slice(0, script.indexOf("    (() => {\n      const root"));
const model = vm.runInNewContext(`${modelCode}\nCubeModel`);
const run = text => model.apply(model.solved(), model.parse(text));
const snapshot = stickers => JSON.stringify(stickers);
const solved = snapshot(model.solved());
for (const face of ['U', 'D', 'R', 'L', 'F', 'B']) {
  for (const width of ['', 'w', '2w', '3w', '4w']) {
    const move = width.length === 2 ? width[0] + face + 'w' : face + width;
    assert.equal(snapshot(run(`${move} ${move}'`)), solved, `${move} inverse`);
    assert.equal(snapshot(run(Array(4).fill(move).join(' '))), solved, `${move} four turns`);
    assert.equal(snapshot(run(`${move}2`)), snapshot(run(`${move} ${move}`)));
  }
}
for (const invalid of ['5Rw', '1Rw', '3R', 'R3', 'Q', 'Rwfoo', 'R U nope', '3Mw', 'M3', 'Mww']) {
  assert.throws(() => model.parse(invalid));
}
assert.equal(snapshot(run('Rw')), snapshot(run('2Rw')));
assert.equal(snapshot(run('Rw\u2019')), snapshot(run("Rw'")));
const counts = (state, face, color) => model.visible(state, face).filter(c => c === color).length;
for (const move of ['M', 'Mw']) {
  assert.equal(snapshot(run(`${move} ${move}'`)), solved);
  assert.equal(snapshot(run(Array(4).fill(move).join(' '))), solved);
  assert.equal(snapshot(run(`${move}2`)), snapshot(run(`${move} ${move}`)));
  const before = model.solved(), after = run(move);
  const radius = move === 'M' ? 0 : 1;
  before.forEach((sticker, i) => {
    if (Math.abs(sticker.p[0]) > radius) assert.equal(snapshot(after[i]), snapshot(sticker));
  });
}
assert.equal(snapshot(run("M'")), snapshot(run("x Rw' Lw")));
assert.equal(snapshot(run("Mw'")), snapshot(run("x R' L")));
assert.equal(counts(run("M'"), 'U', 'orange'), 3);
assert.equal(counts(run("M'"), 'U', 'green'), 6);
assert.equal(counts(run("Mw'"), 'U', 'orange'), 9);
assert.equal(counts(run("Mw'"), 'F', 'orange'), 0);
assert.equal(counts(run('Mw'), 'F', 'green'), 9);
const rw = run('Rw');
assert.equal(counts(rw, 'U', 'green'), 6);
assert.equal(counts(rw, 'U', 'orange'), 3);
assert.equal(counts(rw, 'F', 'orange'), 6);
for (const row of [1, 2, 3]) assert.equal(model.visible(rw, 'U')[row * 5 + 3], 'orange');
const rwPrime = run("Rw'");
assert.equal(counts(rwPrime, 'F', 'green'), 3);
assert.equal(counts(run('3Rw'), 'U', 'orange'), 6);
assert.equal(counts(run('x2'), 'U', 'green'), 0);
assert.equal(counts(run('x2'), 'F', 'orange'), 0);
const sequence = "Rw U2 F' M' Lw2 D Mw' Rw' 3Fw M2 B2 4Dw' Mw2 x y2 z'";
const state = run(sequence);
assert.equal(state.length, 150);
for (const color of ['green', 'orange']) assert.equal(state.filter(s => s.color === color).length, 9);
assert.equal(new Set(state.map(s => `${s.p.join(',')}/${s.n.join(',')}`)).size, 150);
const inverse = sequence.split(' ').reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'").join(' ');
assert.equal(snapshot(run(`${sequence} ${inverse}`)), solved);
console.log('Passed: notation, turn inverses, wide-turn direction, hidden stickers, and sticker conservation.');
