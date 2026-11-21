const assert = require('node:assert/strict'), trainer = require('../trainer'), database = require('../data/l2c-cases.json');
const ids = ['L2C-001', 'L2C-002', 'L2C-003'];
let time = 1000000, elapsed = 0;
const create = saved => trainer.create(database, saved, () => elapsed, () => 0, () => time);
const state = create({selected: ids});
assert.equal(state.spaced, true);
assert.equal(state.current.caseId, ids[0]);
state.start(); elapsed = 1500;
const solve = state.stop();
assert.equal(state.current.caseId, solve.caseId);
assert.equal(state.start(), false);
const forgot = state.rate(4);
assert.equal(forgot.caseId, ids[0]);
assert.equal(forgot.dueAt, time + 60000);
assert.equal(forgot.dueAfter, 3);
assert.equal(state.current.caseId, ids[1]);
const medium = state.rate(2);
assert.equal(medium.intervalMs, 86400000);
assert.equal(state.current.caseId, ids[2]);
const easy = state.rate(1);
assert.equal(easy.intervalMs, 4 * 86400000);
assert.equal(state.current.caseId, ids[0]); // Two reviews bring forgotten card back.
const hard = state.rate(3);
assert.equal(hard.dueAfter, 9);
assert.equal(hard.intervalMs, 600000);
assert.equal(state.snapshot().reviewCount, 4);
const before = JSON.stringify(state.snapshot().cards);
state.next(); assert.equal(JSON.stringify(state.snapshot().cards), before); // Skips aren't ratings.
state.newSession(); assert.equal(JSON.stringify(state.snapshot().cards), before);
const restored = create(JSON.parse(JSON.stringify(state.snapshot())));
assert.equal(JSON.stringify(restored.snapshot().cards), before);
restored.select([ids[0]], false); time += 86400000 * 7;
for (let i = 0; i < 4; i++) { assert.notEqual(restored.next().caseId, ids[0]); }
restored.select([ids[0]], true);
assert.equal(restored.snapshot().cards[ids[0]].reviews, 2); // Deselection preserves learning history.
// Due cards beat unseen cards; future cards wait behind unseen cards.
const cards = {[ids[0]]: {...forgot, dueAt: time - 1, dueAfter: null}};
assert.equal(create({selected: ids, cards}).current.caseId, ids[0]);
assert.equal(create({selected: ids, cards: {[ids[0]]: {...forgot, dueAt: time + 86400000, dueAfter: null}}}).current.caseId, ids[1]);
const singleton = create({selected: [ids[0]]}); singleton.rate(1);
assert.equal(singleton.current.caseId, ids[0]); // Keep practicing ahead when no other card exists.
const firstEasy = singleton.snapshot().cards[ids[0]].intervalMs;
singleton.rate(1); assert.ok(singleton.snapshot().cards[ids[0]].intervalMs > firstEasy);
singleton.start(); assert.equal(singleton.rate(4), null); singleton.stop();
singleton.setSpaced(false); assert.equal(singleton.pendingReview, null); assert.equal(singleton.spaced, false);
const empty = create({selected: []}); assert.equal(empty.rate(1), null);
assert.equal(create({selected: ids, cards: {[ids[0]]: {dueAt: -1}}}).snapshot().cards[ids[0]], undefined);
console.log('Passed: review intervals, relearning steps, due/new priority, persistence, selection scope, untimed ratings, and timer gating.');
