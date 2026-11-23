const assert=require('node:assert/strict');
const {createF3EModel}=require('../f3e'),{searchF3E}=require('../f3e-search');
const m=createF3EModel();
// Independent unpruned breadth-first search to the union of all four goals.
function reference(request,maxDepth){
 const goal=state=>[0,1,2,3].some(offset=>request.targets.every((pair,slot)=>pair.every((p,orbit)=>state[((offset+slot)%4)*2+orbit]===p)));
 const queue=[[request.start,0]],seen=new Set([request.start.join(',')]);
 for(let i=0;i<queue.length;i++){
  const [state,depth]=queue[i];if(goal(state))return depth;
  if(depth===maxDepth)continue;
  for(const move of request.moves){const next=state.map((p,j)=>move.transitions[j%2][p]),key=next.join(',');if(!seen.has(key)){seen.add(key);queue.push([next,depth+1]);}}
 }
 return Infinity;
}
function solve(text){
 const state=m.apply(m.solved(),m.parse(text)),request=m.searchConfig(state);
 const result=searchF3E({...request,mode:'global',maxMs:10000});
 assert.equal(result.status,'solved');assert.equal(result.mode,'global');assert.equal(result.stages.length,0);
 assert.equal(result.count,m.parse(result.moves).length);
 assert.ok(m.inspect(m.apply(state,m.parse(result.moves))).goalSatisfied);
 return {result,request};
}
let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const cases=['','F','D B',"F B F'",'Rw R 3Rw',"L F Rw'",'F D B', ...Array.from({length:20},()=>m.scramble(3,random))];
for(const text of cases){
 const {result,request}=solve(text);
 assert.equal(result.count,reference(request,3),'Global solution must match independent BFS: '+text);
 if(result.count>0)assert.equal(searchF3E({...request,mode:'global',maxDepth:result.count-1}).status,'limit');
}
seed=20261122;
let shorter=0;
for(let i=0;i<10;i++){
 const {result,request}=solve(m.scramble(24,random)),staged=searchF3E(request);
 assert.ok(result.count<=staged.count);if(result.count<staged.count)shorter++;
}
assert.ok(shorter>0,'Global mode must improve at least one staged result');
for(let shift=0;shift<4;shift++){
 const state=m.solved().map(s=>({...s,color:m.belt.includes(s.color)?m.belt[(m.belt.indexOf(s.color)+shift)%4]:s.color}));
 assert.equal(searchF3E({...m.searchConfig(state),mode:'global'}).count,0);
}
const invalidOrder=m.solved().map(s=>({...s,color:s.color==='green'?'orange':s.color==='orange'?'green':s.color}));
assert.equal(searchF3E({...m.searchConfig(invalidOrder),mode:'global',maxDepth:0}).status,'limit');
assert.throws(()=>searchF3E({...m.searchConfig(m.solved()),mode:'invalid'}),/Invalid F3E solution mode/);
const vm=require('node:vm'),fs=require('node:fs');let now=0;
const timed=vm.runInNewContext(fs.readFileSync(require.resolve('../f3e-search'),'utf8')+'\nsearchF3E',{Date:{now:()=>++now}});
assert.equal(timed({...m.searchConfig(m.solved()),mode:'global',maxMs:1}).reason,'time');
console.log(`Passed: ${cases.length} global optima match independent BFS, all cyclic goals, bad-order rejection, depth/time limits, and 10 random comparisons against staged solutions.`);
