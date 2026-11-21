const assert=require('node:assert/strict');
const {createFourModel,searchFour}=require('../four');
const model=createFourModel(),home=model.solved(),run=text=>model.apply(model.solved(),model.parse(text));
const slot=s=>s.p.join(',')+'/'+s.n.join(',');
assert.equal(home.length,96);assert.equal(model.goal.length,16);
for(const base of ['Rw','3Rw','U']) {
  assert.deepEqual(run(base+' '+base+"'"),home);
  assert.deepEqual(run(Array(4).fill(base).join(' ')),home);
}
for(const text of ['R','F','Lw','M','4Rw','Rw3','x'])assert.throws(()=>model.parse(text),/Invalid move/);
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
// Independent shallow BFS oracle: shortest distances using all nine moves.
const distances=new Map([[model.goal,0]]),queue=[model.goal];
for(let i=0;i<queue.length;i++) {
 const state=queue[i],depth=distances.get(state);if(depth===3)continue;
 for(const move of model.moves){const next=move.permutation.map(i=>state[i]).join('');if(!distances.has(next)){distances.set(next,depth+1);queue.push(next);}}
}
const samples=queue.filter((_,i)=>i%Math.max(1,Math.floor(queue.length/30))===0);
for(const state of samples){const r=search(state,3);assert.equal(r.status,'solved');assert.equal(r.count,distances.get(state));}
const start=run(model.example),result=search(model.encode(start));
assert.equal(result.status,'solved');assert.ok(result.phase1);assert.ok(result.phase2);assert.equal(result.phase2States,18900);
const half=model.encode(model.apply(structuredClone(start),model.parse(result.phase1)));
for(const bar of model.bars)for(const i of bar)assert.equal(half[i],model.goal[i]);
assert.equal(model.encode(model.apply(start,model.parse(result.moves))),model.goal);
assert.ok(result.phase2.split(' ').every(t=>/^(Rw|U)/.test(t)));
const limited=search(model.encode(run(model.example)),0);assert.equal(limited.status,'limit');
const timeout=searchFour({start:model.encode(run(model.example)),goal:model.goal,moves:model.moves,bars:model.bars,maxDepth:24,maxMs:1});assert.equal(timeout.status,'limit');assert.equal(timeout.reason,'time');
console.log('Passed: 4x4 move permutations/inverses, L/R and F3E preservation, independent BFS optimality checks, phase boundary, full replay, and limit reporting.');
