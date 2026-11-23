const assert=require('node:assert/strict');
const {createFourModel,searchFour,generateFourScramble}=require('../four');
const model=createFourModel(),home=model.solved(),run=text=>model.apply(model.solved(),model.parse(text));
const slot=s=>s.p.join(',')+'/'+s.n.join(',');
assert.equal(home.length,96);assert.equal(model.goal.length,16);
for(const base of ['Rw','3Rw','U']) {
  assert.deepEqual(run(base+' '+base+"'"),home);
  assert.deepEqual(run(Array(4).fill(base).join(' ')),home);
}
for(const text of ['R','F','Lw','M','4Rw','Rw3','x'])assert.throws(()=>model.parse(text),/Invalid move/);
assert.deepEqual(run("l"),run("3Rw' Rw"));
assert.deepEqual(run("l'"),run("Rw' 3Rw"));
assert.deepEqual(run("l2"),run("Rw2 3Rw2"));
assert.deepEqual(run("l l'"),home);
for(const move of model.moves){
 const state=run(move.text);
 for(let i=0;i<home.length;i++) {
  const s=home[i];
  if(s.color==='gray'&&s.p.filter(v=>Math.abs(v)===3).length===1)assert.equal(String(state[i].n),String(s.n),'L/R centers');
  if(s.p[0]===-3&&s.p[1]!==3&&s.p.filter(v=>Math.abs(v)===3).length===2)assert.equal(slot(state[i]),slot(s),'F3E');
 }
 const viaPermutation=move.permutation.map(i=>model.goal[i]).join('');assert.equal(viaPermutation,model.encode(state));
}
const search=(state,depth=10)=>searchFour({start:state,goal:model.goal,moves:model.moves,bars:model.bars,maxDepth:depth,maxMs:10000});
// Independent shallow BFS oracle: shortest distances using Rw, 3Rw, l and U moves.
const distances=new Map([[model.goal,0]]),queue=[model.goal];
for(let i=0;i<queue.length;i++){
 const state=queue[i],distance=distances.get(state);
 if(distance===3)continue;
 for(const move of model.moves){
  const next=move.permutation.map(index=>state[index]).join('');
  if(!distances.has(next)){distances.set(next,distance+1);queue.push(next);}
 }
}
// Exhaust every state through depth two, plus deterministic depth-three samples.
let deeper=0,checked=0;
for(const [state,distance] of distances){
 if(distance===3 && deeper++%17!==0)continue;
 const actual=search(state,distance);
 assert.equal(actual.status,'solved',`BFS distance ${distance} must be reachable`);
 assert.equal(actual.count,distance,'Search must match unpruned BFS');
 assert.equal(model.encode(run(actual.moves.split(' ').filter(Boolean).reverse().map(token=>{
  const move=model.moves.find(move=>move.text===token);
  return model.moves[move.inverse].text;
 }).join(' '))),state,'Inverse solution must reconstruct the input');
 checked++;
}
// Exercise mixed generators and bounded-search reporting.
for(const scramble of ['Rw 3Rw', "Rw2 3Rw", 'l U 3Rw']){
 const state=model.encode(run(scramble)),distance=distances.get(state);
 const actual=search(state,distance);
 assert.equal(actual.status,'solved');assert.equal(actual.count,distance);
 assert.equal(search(state,distance-1).status,'limit');
}
// The old same-axis pruning misses this four-move solution entirely at depth 4.
const regressionState=model.encode(run('l U Rw 3Rw'));
assert.equal(distances.has(regressionState),false,'Unpruned BFS proves no solution through depth 3');
const regression=search(regressionState,4);
assert.equal(regression.status,'solved');assert.equal(regression.count,4);
assert.equal(model.encode(model.apply(run('l U Rw 3Rw'),model.parse(regression.moves))),model.goal);
console.log(`Checked ${checked} states against independent unpruned BFS.`);
const start=run(model.example),result=search(model.encode(start));
assert.equal(result.status,'solved');assert.ok(result.phase1);assert.ok(result.phase2);assert.ok(result.phase2States>0);
const half=model.encode(model.apply(structuredClone(start),model.parse(result.phase1)));
for(const bar of model.bars)for(const i of bar)assert.equal(half[i],model.goal[i]);
assert.equal(model.encode(model.apply(start,model.parse(result.moves))),model.goal);
assert.ok(result.phase2.split(' ').every(t=>/^(Rw|U)/.test(t)));
const limited=search(model.encode(run(model.example)),0);assert.equal(limited.status,'limit');
// Frontend searches without hidden time or depth limits.
const timeOnly=searchFour({start:regressionState,goal:model.goal,moves:model.moves,bars:model.bars});
assert.equal(timeOnly.status,'solved');assert.equal(timeOnly.count,4);
let fakeNow=0;
const unboundedSearch=require('node:vm').runInNewContext('('+searchFour.toString()+')', {Date:{now:()=>{fakeNow+=60000;return fakeNow;}}});
assert.equal(unboundedSearch({start:regressionState,goal:model.goal,moves:model.moves,bars:model.bars}).status,'solved','Default search must continue beyond the old time limit');

const layout=require('node:fs').readFileSync(require('node:path').join(__dirname,'../layout.html'),'utf8');
assert.ok(!layout.includes('data-four="depth"'));
assert.ok(!layout.includes('data-four="seconds"'));
for(const face of ['U','F','D','B'])assert.ok(layout.includes(`data-four-face="${face}"`));
const timeout=searchFour({start:model.encode(run(model.example)),goal:model.goal,moves:model.moves,bars:model.bars,maxDepth:24,maxMs:1});assert.equal(timeout.status,'limit');assert.equal(timeout.reason,'time');
for(let i=0;i<100;i++){
 let draw=i*37+73;
 const scramble=generateFourScramble(model,24,()=>((draw++*37+73)%101)/101);
 const tokens=scramble.split(' ');
 assert.equal(tokens.length,24);
 assert.equal(model.encode(run(scramble))===model.goal,false);
 for(let j=1;j<tokens.length;j++){
  const previous=model.moves.find(move=>move.text===tokens[j-1]);
  const next=model.moves.find(move=>move.text===tokens[j]);
  assert.notEqual(previous.axis,next.axis);
 }
}
assert.throws(()=>generateFourScramble(model,0));
console.log('Passed: 4x4 move permutations/inverses, L/R and F3E preservation, independent BFS optimality checks, phase boundary, full replay, limit reporting, and random scrambles.');
