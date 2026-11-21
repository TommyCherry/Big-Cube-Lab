const assert = require('node:assert/strict');
const library = require('../case-library');
const database = require('../data/l2c-cases.json');
const mask = rows => rows.join('').split('').reduce((n, c, i) => n | (c === '#' ? 1 << i : 0), 0);
for (const [rows, name] of [
  [['##.', '##.', '...'], '2x2 block'],
  [['###', '###', '...'], '2x3 block'],
  [['.#.', '###', '.#.'], 'Cross'],
  [['#.#', '.#.', '#.#'], 'Checkerboard'],
  [['#.#', '###', '#.#'], 'H'],
  [['#..', '.#.', '..#'], 'Diagonal'],
  [['...', '.#.', '...'], 'Dot'],
  [['###', '###', '###'], 'Solid center'],
  [['##.', '##.', '..#'], '2x2 block + dot']
]) {
  const shape = mask(rows);
  assert.equal(library.facePatternName(shape, 0), name);
  assert.equal(library.facePatternName((shape ^ 511) << 9, 1), name);
}
for (let shape = 0; shape < 512; shape++) {
  if (!(shape & 16)) continue;
  const name = library.facePatternName(shape, 0);
  assert.ok(name && !name.includes('undefined') && !name.includes('piece shape'));
  let rotated = shape;
  for (let i = 0; i < 4; i++) {
    assert.equal(library.facePatternName(rotated, 0), name);
    assert.equal(library.facePatternName((rotated ^ 511) << 9, 1), name);
    rotated = library.rotate(rotated, 0);
  }
}
for (const entry of database.cases) {
  assert.equal(entry.topName, library.facePatternName(entry.mask, 0));
  assert.equal(entry.frontName, library.facePatternName(entry.mask, 1));
}
console.log('Passed: recognizable shapes, all 256 face layouts, rotation/color invariance, and saved pattern names.');
