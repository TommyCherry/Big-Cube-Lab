const {searchSix}=require('./six-bfs-reference.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const {createSixModel} = require('../six');
const model = createSixModel(), home = model.solved(), snapshot = state => JSON.stringify(state), run = text => model.apply(model.solved(), model.parse(text));
assert.equal(home.length, 216); assert.equal(model.goal.length, 96);
assert.equal(home.filter(s => s.color === 'green').length, 16);
assert.equal(home.filter(s => s.color === 'orange').length, 16);
assert.equal(model.visible(home,'U').length, 36);
// The UI example must be a genuine non-solved L2C case in both modes.
const example = run(model.exampleScramble);
assert.notEqual(model.encode(example), model.goal);
for (const face of ['U', 'F']) {
  const visible = model.visible(example, face);
  for (let row = 1; row <= 4; row++) for (let col = 1; col <= 4; col++) assert.ok(['green', 'orange'].includes(visible[row * 6 + col]));
}
const centerGoal = model.goal, exampleCenters = model.encode(example);
for (let i = 0; i < centerGoal.length; i++) if (!['U','F'].includes(centerGoal[i])) assert.equal(exampleCenters[i], centerGoal[i]);
for (const mode of ['redux', 'yau']) {
  const solution = searchSix({start: model.encode(example), goal: model.goal, moves: model.searchMoves(mode), maxDepth: 3});
  assert.equal(solution.status, 'solved'); assert.equal(solution.count, 3);
}

for (const face of ['R','L','U','D','F','B']) for (const width of [1,2,3,4,5,6]) {
  const base = width === 1 ? face : width === 2 ? face+'w' : width+face+'w';
  assert.equal(snapshot(run(`${base} ${base}'`)), snapshot(home), base);
  assert.equal(snapshot(run(`${base}2 ${base}2`)), snapshot(home), base);
  assert.equal(snapshot(run(Array(4).fill(base).join(' '))), snapshot(home), base);
}
assert.equal(snapshot(run('6Rw')), snapshot(run('x')));
assert.throws(() => model.parse('M'), /ambiguous/);
assert.throws(() => model.parse('7Rw')); assert.throws(() => model.parse('3R'));
const slice = run("4Rw 3Rw'");
for (let i=0; i<home.length; i++) if (home[i].p[0] !== -1) assert.equal(snapshot(slice[i]), snapshot(home[i]));
const apply = (state, move) => move.permutation.map(from => state[from]).join('');
for (const mode of ['redux','yau']) {
  const moves = model.searchMoves(mode);
  for (const move of moves) {
    const scramble = run("Rw U 3Rw' U'");
    assert.equal(apply(model.encode(scramble), move), model.encode(model.apply(scramble, model.parse(move.text))));
    assert.equal(new Set(move.permutation).size, 96);
  }
  // Independent one-direction BFS is an oracle for every state through depth 2.
  const distance = new Map([[model.goal,0]]), queue=[model.goal];
  for (let i=0;i<queue.length;i++) {
    const state=queue[i], depth=distance.get(state); if(depth===2)continue;
    for(const move of moves) { const next=apply(state,move); if(!distance.has(next)){distance.set(next,depth+1);queue.push(next);} }
  }
  for (const [start, depth] of distance) {
    const result=searchSix({start,goal:model.goal,moves,maxDepth:2,maxMs:1000});
    assert.equal(result.status,'solved'); assert.equal(result.count,depth);
  }
  for(const text of ["Rw U Rw'", "Rw U 3Rw' U'", "3Rw U2 4Rw'", "5Rw U' Rw2"]) {
    const initial=run(text), start=model.encode(initial);
    const result=searchSix({start,goal:model.goal,moves,maxDepth:6,maxMs:10000});
    assert.equal(result.status,'solved', text); assert.ok(result.count<=text.split(' ').length);
    assert.equal(model.encode(model.apply(initial,model.parse(result.moves))),model.goal);
  }
}
const yau = model.searchMoves('yau');
const protectedSlots=home.flatMap((s,i)=>s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2?[i]:[]);
assert.equal(protectedSlots.length,24);
for(const move of yau){const state=run(move.text);for(const i of protectedSlots)assert.equal(snapshot(state[i]),snapshot(home[i]));}
const request={start:model.encode(run('Rw U')),goal:model.goal,moves:yau};
assert.equal(searchSix({...request,maxDepth:0}).status,'depth-limit');
assert.equal(searchSix({...request}).status,'solved');
assert.equal(searchSix({...request,maxMs:0}).status,'time-limit');
assert.ok(searchSix({...request}).visited > 2);
// The actual worker function serializes without external dependencies.
const workerSearch=vm.runInNewContext('('+searchSix.toString()+')');
assert.equal(workerSearch({...request,maxDepth:4}).status,'solved');
new vm.Script(fs.readFileSync('output/cube-centers.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('Passed: 6x6 moves, slice widths, all shallow BFS distances, bidirectional replay, hidden centers, Yau edge preservation, worker serialization, and search limits.');
