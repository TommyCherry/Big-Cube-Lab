const assert=require('node:assert/strict');
const {createF3EModel}=require('../f3e'),{searchF3E}=require('../f3e-search');
const m=createF3EModel();
// Independent, unpruned BFS. It uses no solver heuristic, tables or pruning.
function referenceDistance(request,accept,maxDepth){
 const key=state=>String.fromCharCode(...state);
 const queue=[[request.start,0]],seen=new Set([key(request.start)]);
 for(let i=0;i<queue.length;i++){
  const [state,depth]=queue[i];if(accept(state))return depth;
  if(depth===maxDepth)continue;
  for(const move of request.moves){
   const next=state.map((p,j)=>move.transitions[j%2][p]),code=key(next);
   if(!seen.has(code)){seen.add(code);queue.push([next,depth+1]);}
  }
 }
 return Infinity;
}
function verify(text,oracle=false){
 let full=m.apply(m.solved(),m.parse(text));
 const result=searchF3E({...m.searchConfig(full),maxMs:10000});
 assert.equal(result.status,'solved',text);assert.equal(result.stages.length,3);
 const locks=[];let offset=null;
 for(const stage of result.stages){
  const request=m.searchConfig(full);
  const matches=(state,slot,color)=>state[color*2]===request.targets[slot][0]&&state[color*2+1]===request.targets[slot][1];
  const goal=state=>locks.every(lock=>matches(state,lock.slot,lock.color))&&[0,1,2].some(slot=>!locks.some(lock=>lock.slot===slot)&&[0,1,2,3].some(color=>(offset===null||color===(offset+slot)%4)&&matches(state,slot,color)));
  const preservesLocks=state=>locks.every(lock=>matches(state,lock.slot,lock.color));
  const lockedRequest={...request,moves:request.moves.filter(move=>preservesLocks(request.start.map((p,i)=>move.transitions[i%2][p])))};
  if(oracle)assert.equal(referenceDistance(lockedRequest,goal,stage.count),stage.count,'Each stage must match independent BFS');
  assert.equal(m.parse(stage.moves).length,stage.count);
  for(const move of m.parse(stage.moves)){
   m.apply(full,[move]);const checkpoint=m.inspect(full);
   assert.ok(checkpoint.centers.L&&checkpoint.centers.R);
   for(const lock of locks){assert.ok(checkpoint.edges[lock.slot].paired,'Earlier edge must remain paired after EVERY move');assert.equal(checkpoint.edges[lock.slot].color,m.belt[lock.color]);}
  }
  const slot=['FL','DL','BL'].indexOf(stage.slot),color=m.belt.indexOf(stage.color);
  assert.ok(slot>=0&&color>=0);assert.ok(!locks.some(lock=>lock.slot===slot));
  if(offset!==null)assert.equal(color,(offset+slot)%4);
  locks.push({slot,color});offset=(color-slot+4)%4;
  const report=m.inspect(full);assert.ok(report.centers.L&&report.centers.R);
  for(const lock of locks){assert.ok(report.edges[lock.slot].paired);assert.equal(report.edges[lock.slot].color,m.belt[lock.color]);}
 }
 assert.ok(m.inspect(full).goalSatisfied);
 assert.equal(result.omittedColor,m.belt[(offset+3)%4]);
 assert.equal(result.count,result.stages.reduce((sum,s)=>sum+s.count,0));
 const complete=m.apply(m.apply(m.solved(),m.parse(text)),m.parse(result.moves));
 assert.equal(m.encode(complete),m.encode(full));
 return result;
}
for(const text of ['', 'L', 'F', 'Rw U', '3Rw F U', m.example])verify(text,true);
assert.equal(verify('').count,0);
let seed=194;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<20;i++)verify(m.scramble(24,random));
const request=m.searchConfig(m.apply(m.solved(),m.parse(m.example)));
assert.equal(searchF3E({...request,maxDepth:0}).status,'limit');
let now=0;
const timed=require('node:vm').runInNewContext('('+searchF3E.toString()+')',{Date:{now:()=>++now}});
assert.equal(timed({...request,maxMs:1}).reason,'time');
assert.throws(()=>searchF3E({...request,start:[1,2]}),/Invalid F3E search state/);
assert.throws(()=>searchF3E({...request,maxDepth:-1}),/Invalid search limits/);
console.log('Passed: three-stage shortest paths against independent BFS, zero-move stages, L support, per-move edge preservation, relative order, limits, and 20 random complete replays.');
