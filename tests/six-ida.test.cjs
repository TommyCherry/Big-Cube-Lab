const {searchSix}=require('./six-bfs-reference.cjs');
const assert=require('node:assert/strict'),vm=require('node:vm');
const {createSixModel}=require('../six'),{searchSixIDA}=require('../six-ida');
const model=createSixModel(), apply=(state,move)=>move.permutation.map(from=>state[from]).join('');
let checked=0;
for(const mode of ['redux','yau']){
  const moves=model.searchMoves(mode), distance=new Map([[model.goal,0]]),queue=[model.goal];
  // An independent exhaustive BFS, without heuristic or move-order pruning.
  for(let i=0;i<queue.length;i++){
    const state=queue[i],depth=distance.get(state);if(depth===2)continue;
    for(const move of moves){const next=apply(state,move);if(!distance.has(next)){distance.set(next,depth+1);queue.push(next);}}
  }
  for(const [start,depth]of distance){
    const result=searchSixIDA({start,goal:model.goal,moves,maxDepth:2,maxMs:5000});
    assert.equal(result.status,'solved');assert.equal(result.count,depth);checked++;
    let replay=start;for(const token of result.moves.split(' ').filter(Boolean))replay=apply(replay,moves.find(m=>m.text===token));assert.equal(replay,model.goal);
  }
  for(const scramble of ["Rw U Rw'", "Rw U Rw' 3Rw U' 3Rw'", "Rw U Rw' 3Rw U2 3Rw' 4Rw U' 4Rw'"]){
    const initial=model.apply(model.solved(),model.parse(scramble));
    const request={start:model.encode(initial),goal:model.goal,moves,maxDepth:10,maxMs:10000};
    const baseline=searchSix(request),result=searchSixIDA(request);
    assert.equal(result.status,'solved');assert.equal(baseline.status,'solved');assert.equal(result.count,baseline.count);
    assert.equal(model.encode(model.apply(initial,model.parse(result.moves))),model.goal);
  }
}
const req={start:model.encode(model.apply(model.solved(),model.parse('Rw U'))),goal:model.goal,moves:model.searchMoves('yau')};
assert.equal(searchSixIDA({...req,maxMs:0}).status,'time-limit');
assert.equal(searchSixIDA({...req,maxDepth:0}).status,'depth-limit');
const worker=vm.runInNewContext('('+searchSixIDA.toString()+')');assert.equal(worker(req).status,'solved');
console.log(`Passed: IDA* matches ${checked} independent shallow distances and deeper BFS optima; replay, bounds, and serialized worker verified.`);

// Reported slow case: paired orbit heuristics must avoid the old 200M-node timeout.
const regression="Rw U Rw' 4Rw U' 4Rw' 3Rw U 3Rw' Rw U2 Rw'";
const input=model.apply(model.solved(),model.parse(regression));
let preparedPatterns;
const improved=searchSixIDA({start:model.encode(input),goal:model.goal,moves:model.searchMoves('redux'),maxDepth:12,maxMs:30000},()=>{},pairs=>{preparedPatterns=pairs;});
assert.equal(improved.status,'solved'); assert.equal(improved.count,12); assert.equal(improved.provenThrough,11);
assert.ok(improved.visited<1000000, `Search regression: ${improved.visited} visits`);
assert.equal(model.encode(model.apply(input,model.parse(improved.moves))),model.goal);
console.log(`Reported scramble: optimal 12 moves, ${improved.visited} node visits, ${improved.elapsedMs} ms.`);

// Last-two-bars regression: mixed-color cross-orbit patterns must prune the
// conflicts missed by same-color tables (previously 26.8M node visits).
const bars="Rw U' Rw' 3Rw U' 3Rw' Rw U2 Rw' 3Rw U' 3Rw' U' Rw U' Rw' U'";
const barsState=model.apply(model.solved(),model.parse(bars));
const barsResult=searchSixIDA({start:model.encode(barsState),goal:model.goal,moves:model.searchMoves('redux'),maxDepth:14,maxMs:60000});
assert.equal(barsResult.status,'solved');
assert.equal(barsResult.count,14); assert.equal(barsResult.provenThrough,13);
assert.ok(barsResult.visited<15000000, `Last-two-bars regression: ${barsResult.visited} visits`);
assert.equal(model.encode(model.apply(barsState,model.parse(barsResult.moves))),model.goal);
console.log(`Last-two-bars scramble: optimal 14 moves, ${barsResult.visited} node visits, ${barsResult.elapsedMs} ms.`);

// Exercise the strengthened heuristic directly on shallow states with an
// independent BFS oracle, including temporary states outside U/F centers.
assert.equal(preparedPatterns.length,28);
for(const scramble of ["Rw U F", "3Rw F Rw' U", "4Rw U2 3Lw'", "F Rw 3Rw U'", "Lw F' 4Rw2 U", "3Lw U F' 3Rw'"]) {
  const state=model.apply(model.solved(),model.parse(scramble));
  const request={start:model.encode(state),goal:model.goal,moves:model.searchMoves('redux'),maxDepth:4,maxMs:10000};
  const oracle=searchSix(request), actual=searchSixIDA({...request,cachedPairs:preparedPatterns});
  assert.equal(oracle.status,'solved');assert.equal(actual.status,'solved');
  assert.equal(actual.count,oracle.count);
  assert.equal(model.encode(model.apply(state,model.parse(actual.moves))),model.goal);
}
console.log('Passed: all 28 prepared patterns preserve independent BFS optima on additional mixed-orbit states.');

// Force every cache key into one slot: collisions and eviction must never
// discard a real shortest path. This also exercises U/F commutation and aliases.
for(const scramble of ["Rw U F 3Rw'", "5Lw U' 3Rw F", "Rw U Rw' 3Rw U'"]) {
  const state=model.apply(model.solved(),model.parse(scramble));
  const request={start:model.encode(state),goal:model.goal,moves:model.searchMoves('redux'),maxDepth:5,maxMs:10000};
  const oracle=searchSix(request), actual=searchSixIDA({...request,cachedPairs:preparedPatterns,cacheBits:0});
  assert.equal(oracle.status,'solved');assert.equal(actual.status,'solved');
  assert.equal(actual.count,oracle.count);
  assert.equal(model.encode(model.apply(state,model.parse(actual.moves))),model.goal);
}
console.log('Passed: a one-slot transposition cache preserves BFS optima despite forced hash collisions and eviction.');

const hardScramble="Rw U' Rw' 3Rw U 3Rw' Rw U2 Rw' 3Rw U' 3Rw' U' Rw U' Rw' U' 5Rw U' 5Rw' Rw U' Rw' 4Rw U 4Rw' 3Rw U' 3Rw'";
const hardState=model.apply(model.solved(),model.parse(hardScramble));
let proofVisits, hardProgress=0;
const hardResult=searchSixIDA({start:model.encode(hardState),goal:model.goal,moves:model.searchMoves('redux'),cachedPairs:preparedPatterns,maxDepth:15,maxMs:60000},progress=>{
  hardProgress++;
  if(progress.bound===15 && proofVisits===undefined)proofVisits=progress.visited;
});
assert.equal(hardResult.status,'solved');assert.equal(hardResult.count,15);assert.equal(hardResult.provenThrough,14);
assert.ok(proofVisits<40000000,`Proof through 14 moves regressed: ${proofVisits} visits`);
assert.ok(hardProgress<=Math.ceil(hardResult.elapsedMs/100)+25,'Progress messages should be throttled');
assert.ok(hardResult.visited<300000000,`Hard-case regression: ${hardResult.visited} visits`);
assert.equal(model.encode(model.apply(hardState,model.parse(hardResult.moves))),model.goal);
console.log(`Hard Redux case: optimal 15 moves, ${hardResult.visited} visits, ${hardResult.elapsedMs} ms; proof through 14 took ${proofVisits} visits.`);
