const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const trainer = require('../trainer'), library = require('../case-library'), database = require('../data/l2c-cases.json');
const html = fs.readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
let now = 0;
const state = trainer.create(database, {spaced: false}, () => now, () => 0.3);
assert.equal(state.current, null);
assert.equal(state.start(), false);
state.select(['L2C-000'], true); assert.equal(state.selected.size, 0);
state.select(['L2C-001', 'L2C-002'], true);
const first = state.current.caseId;
now = 100; assert.equal(state.start(), true); assert.equal(state.start(), false);
now = 1334; const solve = state.stop();
assert.equal(solve.ms, 1234); assert.equal(solve.caseId, first);
assert.notEqual(state.current.caseId, first);
assert.equal(state.stop(), null); assert.equal(state.session().solves.length, 1);
state.select([state.last().caseId], false);
assert.equal(state.selected.has(first), false);
assert.equal(state.session().solves.length, 1);
const remaining = state.current.caseId;
state.start(); state.select([remaining], false);
assert.equal(state.current.caseId, remaining); // Selection changes do not interrupt a solve.
now += 2000; state.stop(); assert.equal(state.current, null);
state.newSession(); assert.equal(state.session().solves.length, 0); assert.equal(state.sessions.length, 2);
assert.equal(state.switchSession('session-1'), true); assert.equal(state.session().solves.length, 2);
assert.equal(state.undo(), true); assert.equal(state.session().solves.length, 1);
const restored = trainer.create(database, JSON.parse(JSON.stringify(state.snapshot())));
assert.equal(restored.session().solves[0].ms, 1234); assert.equal(restored.running, false);
assert.equal(trainer.format(1234), '1.23'); assert.equal(trainer.format(120999), '2:00.99');
assert.equal(trainer.stats([1000, 2000, 3000, 4000, 100000].map(ms => ({ ms }))).ao5, 3000);
assert.equal(trainer.stats(Array.from({ length: 12 }, (_, i) => ({ ms: (i + 1) * 1000 }))).ao12, 6500);
assert.equal(trainer.stats([]).best, null);
// Every selectable case's practice scramble and aligned answer replay correctly.
for (const entry of database.cases.filter(c => c.count > 0)) {
  const practice = trainer.create(database, { selected: [entry.id] }, () => 0, () => 0.6);
  const stickers = model.apply(model.solved(), model.parse(practice.current.scramble));
  assert.equal(library.canonical(library.maskOf(model, stickers)).key, entry.key);
  model.apply(stickers, model.parse(practice.current.algorithm));
  assert.equal(library.maskOf(model, stickers), 511);
}

// Exercise the actual keyboard and storage controller with deterministic time.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.events = {}; this.dataset = {}; this.value = ''; this.textContent = ''; this.attrs = {}; this.checked = false; this.className = ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  trigger(name) { this.events[name](); }
  closest() { return ['input', 'textarea', 'select', 'a', 'summary'].includes(this.tag) || this.tag === 'button' && this.className !== 'trainer-clock' ? this : null; }
}
const storage = new Map();
let openedCase, solutionsCase, solutionMounts = 0, solutionDisposals = 0;
function controller() {
  const elements = {}, listeners = {}, root = new Element(), section = new Element();
  const selectors = ['.trainer-clock', '.trainer-status', '.trainer-answer', '.trainer-solutions', '.trainer-storage', '.trainer-diagram', '.trainer-pool-count', '.trainer-scramble', '.trainer-current', '.trainer-algorithm', '.trainer-alignment', '.trainer-solution-count', '.trainer-last', '.trainer-history', '.trainer-history-label', '.trainer-rating', '.trainer-rating-title', '.trainer-review-stats'];
  for (const rating of [1, 2, 3, 4]) selectors.push(`[data-rating="${rating}"]`);
  for (const name of ['spaced', 'skip-rating', 'enabled', 'session', 'remove-last', 'skip', 'new-session', 'undo', 'select-all', 'select-none']) selectors.push(`[data-trainer="${name}"]`);
  for (const name of ['count', 'best', 'mean', 'ao5', 'ao12']) selectors.push(`[data-stat="${name}"]`);
  for (const selector of selectors) elements[selector] = new Element();
  elements['.trainer-clock'].tag = 'button'; elements['.trainer-clock'].className = 'trainer-clock';
  section.querySelector = selector => { assert.ok(elements[selector], selector); return elements[selector]; };
  root.querySelector = selector => { assert.equal(selector, '#trainer'); return section; };
  const api = vm.runInNewContext(fs.readFileSync(`${__dirname}/../trainer.js`, 'utf8') + '\nmountTrainer', {
    document: { createElement: tag => new Element(tag), addEventListener: (name, fn) => { listeners[name] = fn; } },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    performance: { now: () => now }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }
  })(root, database, model, { openCase(id) { openedCase = id; }, solutions(target, entry) { assert.equal(target, elements['.trainer-solutions']); solutionsCase = entry.id; solutionMounts++; return () => solutionDisposals++; } });
  const key = (name, target = new Element(), repeat = false) => {
    let prevented = false;
    listeners[name]({ code: 'Space', target, repeat, preventDefault() { prevented = true; } });
    return prevented;
  };
  return { api, elements, key, listeners, section };
}
const ui = controller(), get = selector => ui.elements[selector];
assert.equal(get('.trainer-clock').disabled, true);
ui.api.set(['L2C-001', 'L2C-002'], true);
get('[data-trainer="spaced"]').checked = false; get('[data-trainer="spaced"]').trigger('change');
const currentCaseLink = get('.trainer-current').children[1];
assert.equal(currentCaseLink.tag, 'button');
currentCaseLink.trigger('click');
assert.equal(openedCase, currentCaseLink.textContent);
assert.equal(get('[data-stat="count"]').textContent, '0');
assert.equal(get('.trainer-answer').hidden, false);
assert.ok(get('.trainer-algorithm').textContent);
assert.match(get('.trainer-solution-count').textContent, /optimal moves/);
get('.trainer-answer').open = true;
get('.trainer-answer').trigger('toggle');
assert.equal(solutionsCase, currentCaseLink.textContent);
assert.equal(solutionMounts, 1);
get('.trainer-answer').trigger('toggle');
assert.equal(solutionMounts, 1);
get('[data-trainer="skip"]').trigger('click');
assert.equal(get('.trainer-answer').open, false);
assert.ok(solutionDisposals >= 1);
get('[data-trainer="enabled"]').checked = true;
ui.section.hidden = true;
assert.equal(ui.key('keydown'), false);
ui.section.hidden = false;
const textarea = new Element('textarea');
assert.equal(ui.key('keydown', textarea), false);
now = 10000; assert.equal(ui.key('keydown'), true);
assert.equal(get('.trainer-clock').dataset.phase, 'armed');
ui.key('keydown', undefined, true);
now = 10500; ui.key('keyup');
assert.equal(get('.trainer-clock').dataset.phase, 'running');
assert.equal(get('.trainer-answer').hidden, true);
now = 14732; ui.key('keydown'); ui.key('keyup');
assert.equal(get('[data-stat="count"]').textContent, '1');
assert.equal(get('.trainer-clock').textContent, '4.23');
assert.equal(get('.trainer-clock').dataset.phase, 'ready');
get('.trainer-history').children[0].children[2].children[0].trigger('click');
const recorded = JSON.parse(storage.get('l2c-trainer-v1')).sessions[0].solves[0];
assert.equal(openedCase, recorded.caseId);
get('[data-trainer="remove-last"]').trigger('click');
assert.equal(ui.api.has(recorded.caseId), false);
assert.equal(get('[data-stat="count"]').textContent, '1');
get('[data-trainer="new-session"]').trigger('click');
assert.equal(get('[data-stat="count"]').textContent, '0');
get('[data-trainer="session"]').value = 'session-1'; get('[data-trainer="session"]').trigger('change');
assert.equal(get('[data-stat="count"]').textContent, '1');
const reloaded = controller();
assert.equal(reloaded.elements['[data-stat="count"]'].textContent, '1');
assert.equal(reloaded.api.has(recorded.caseId), false);
assert.equal(reloaded.elements['.trainer-clock'].dataset.phase, 'ready');
// Default review mode waits on the actual finished case before advancing.
get('[data-trainer="spaced"]').checked = true; get('[data-trainer="spaced"]').trigger('change');
const ratedId = get('.trainer-current').children[1].textContent;
get('.trainer-clock').trigger('click'); now += 1200; get('.trainer-clock').trigger('click');
assert.equal(get('.trainer-clock').disabled, true);
assert.ok(get('.trainer-rating-title').textContent.includes(ratedId + ' - last solve'));
assert.equal(ui.key('keydown'), false);
get('[data-rating="4"]').trigger('click');
assert.equal(get('.trainer-clock').disabled, false);
assert.equal(JSON.parse(storage.get('l2c-trainer-v1')).cards[ratedId].rating, 4);
console.log('Passed: timer key handling, exact elapsed time, session persistence, trimmed averages, last-case deselection, and all 335 practice scrambles.');
