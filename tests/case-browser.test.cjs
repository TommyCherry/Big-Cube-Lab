const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const library = require('../case-library'), database = require('../data/l2c-cases.json');
const html = fs.readFileSync(`${__dirname}/../output/cube-centers.html`, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
// A minimal DOM fixture exercises component behavior without a browser dependency.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.events = {}; this.dataset = {}; this.value = ''; this.textContent = ''; this.attrs = {}; this.selectors = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  querySelector(selector) { assert.ok(this.selectors[selector], selector); return this.selectors[selector]; }
  querySelectorAll(selector) {
    if (selector === '[data-filter]') return this.filters;
    const key = selector === '[data-practice-id]' ? 'practiceId' : 'practiceToggle';
    const matches = [];
    function walk(node) { for (const child of node.children) { if (child.dataset[key]) matches.push(child); walk(child); } }
    walk(this); return matches;
  }
  scrollIntoView() {}
  focus() { this.focused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  trigger(name) { this.events[name](); }
}
const root = new Element(), section = new Element(); root.selectors['#case-library'] = section;
for (const selector of ['.move-count-options', '.case-grid', '.case-detail', '.case-status', '.case-page-label', '.case-total', '.case-result-count', '[data-page="previous"]', '[data-page="next"]', '[data-action="clear"]', '[data-action="match"]']) section.selectors[selector] = new Element();
section.filters = ['search', 'topName', 'frontName', 'exchanged', 'corners', 'edges', 'frontCorners', 'frontEdges', 'sort'].map(name => {
  assert.ok(html.includes(`data-filter="${name}"`));
  const field = new Element(); field.dataset.filter = name;
  field.value = name === 'sort' ? 'id' : '';
  section.selectors[`[data-filter="${name}"]`] = field;
  return field;
});
const mount = vm.runInNewContext(fs.readFileSync(`${__dirname}/../case-browser.js`, 'utf8') + '\nmountCaseBrowser', { simplifyCubeMoves: require('../solver').simplifyCubeMoves, L2CCases: library, document: { createElement: tag => new Element(tag) } });
let current = model.solved(), loaded;
const browser = mount(root, database, model, { getState: () => current, load(entry) { loaded = entry.id; current = model.apply(model.solved(), model.parse(entry.scramble)); } });
const get = selector => section.querySelector(selector);
assert.equal(get('.case-grid').children.length, 24);
assert.equal(get('.case-result-count').textContent, '336 matching cases');
get('[data-page="next"]').trigger('click');
assert.equal(get('.case-page-label').textContent, 'Page 2 of 14');
get('[data-filter="corners"]').value = 'Opposite pair'; get('[data-filter="corners"]').trigger('change');
const expected = database.cases.filter(c => c.corners === 'Opposite pair').length;
assert.equal(get('.case-result-count').textContent, `${expected} matching cases`);
get('[data-filter="search"]').value = 'no-such-case'; get('[data-filter="search"]').trigger('input');
assert.equal(get('.case-result-count').textContent, '0 matching cases');
get('[data-action="clear"]').trigger('click');
assert.equal(get('.case-result-count').textContent, '336 matching cases');
const countButton = count => get('.move-count-options').children.find(button => button.textContent === String(count));
countButton(7).trigger('click');
assert.equal(get('.case-result-count').textContent, `${database.cases.filter(c => c.count === 7).length} matching cases`);
countButton(8).trigger('click');
assert.equal(get('.case-result-count').textContent, `${database.cases.filter(c => [7, 8].includes(c.count)).length} matching cases`);
assert.equal(countButton(7).attrs['aria-pressed'], 'true');
get('[data-filter="corners"]').value = 'Opposite pair'; get('[data-filter="corners"]').trigger('change');
assert.equal(get('.case-result-count').textContent, `${database.cases.filter(c => [7, 8].includes(c.count) && c.corners === 'Opposite pair').length} matching cases`);
get('[data-action="clear"]').trigger('click');
assert.equal(countButton(7).attrs['aria-pressed'], 'false');
countButton(0).trigger('click');
assert.equal(get('.case-result-count').textContent, '1 matching case');
countButton(0).trigger('click');
assert.equal(get('.case-result-count').textContent, '336 matching cases');
countButton(7).trigger('click'); countButton('Any').trigger('click');
assert.equal(get('.case-result-count').textContent, '336 matching cases');
get('[data-filter="topName"]').value = '2x2 block'; get('[data-filter="topName"]').trigger('change');
assert.equal(get('.case-result-count').textContent, `${database.cases.filter(c => c.topName === '2x2 block').length} matching cases`);
get('[data-action="clear"]').trigger('click');
get('[data-filter="search"]').value = '2x2 block'; get('[data-filter="search"]').trigger('input');
assert.equal(get('.case-result-count').textContent, `${database.cases.filter(c => (c.topName + ' ' + c.frontName).includes('2x2 block')).length} matching cases`);
get('[data-action="clear"]').trigger('click');
for (const [sort, property, direction] of [['top-name', 'topName', 1], ['top-name-desc', 'topName', -1], ['front-name', 'frontName', 1], ['front-name-desc', 'frontName', -1]]) {
  get('[data-filter="sort"]').value = sort; get('[data-filter="sort"]').trigger('change');
  const expected = [...database.cases].sort((a, b) => direction * a[property].localeCompare(b[property]) || a.id.localeCompare(b.id)).slice(0, 24).map(c => c.id);
  assert.deepEqual(get('.case-grid').children.map(card => card.children[0].textContent.split(' | ')[0]), expected);
}
countButton(0).trigger('click');
assert.equal(browser.openCase('L2C-166'), true);
assert.equal(get('.case-grid').children.length, 1);
assert.equal(get('.case-detail').children[0].textContent, 'L2C-166');
assert.equal(get('.case-detail').focused, true);
assert.equal(browser.openCase('invalid'), false);
const previousSearch = get('[data-filter="search"]').value;
assert.equal(browser.openCasePopup('L2C-215'), true);
const popup = root.children.at(-1);
assert.equal(popup.tag, 'dialog'); assert.equal(popup.open, true);
assert.equal(popup.children[1].children[0].textContent, 'L2C-215');
assert.equal(get('[data-filter="search"]').value, previousSearch);
popup.children[0].trigger('click'); assert.equal(popup.open, false);
const entry = database.cases[166];
current = model.apply(library.stateOf(model, entry.mask), model.parse("U2 F'"));
get('[data-action="match"]').trigger('click');
assert.equal(get('.case-grid').children.length, 1);
assert.equal(get('[data-filter="search"]').value, entry.id);
assert.ok(get('.case-detail').children.some(child => child.textContent.startsWith('From your current cube')));
get('.case-detail').children.at(-1).trigger('click');
assert.equal(loaded, entry.id);
assert.equal(library.maskOf(model, current), entry.mask);
current = model.apply(model.solved(), model.parse('Rw')); browser.currentChanged();
get('[data-action="match"]').trigger('click');
assert.match(get('.case-status').textContent, /18 colored stickers/);
// Practice controls remain separate from opening a case or loading its diagram.
for (const selector of ['[data-action="practice-add"]', '[data-action="practice-remove"]']) section.selectors[selector] = new Element();
get('[data-action="clear"]').trigger('click');
const selectedCases = new Set();
let practiceBrowser;
const practice = {
  has: id => selectedCases.has(id),
  allowed: id => database.cases.find(c => c.id === id)?.count > 0,
  set(ids, enabled) { for (const id of ids) if (this.allowed(id)) enabled ? selectedCases.add(id) : selectedCases.delete(id); practiceBrowser.practiceChanged(); }
};
practiceBrowser = mount(root, database, model, { getState: () => current, load() {}, practice });
const firstShell = get('.case-grid').children[0], secondShell = get('.case-grid').children[1];
assert.equal(firstShell.children[1].children[0].disabled, true);
const checkbox = secondShell.children[1].children[0]; checkbox.checked = true; checkbox.trigger('change');
assert.ok(selectedCases.has('L2C-001'));
get('[data-action="practice-add"]').trigger('click'); assert.equal(selectedCases.size, 335);
get('[data-action="practice-remove"]').trigger('click'); assert.equal(selectedCases.size, 0);
console.log('Passed: pagination, pattern filters, empty results, U/F case matching, reference loading, and invalid-case feedback.');
