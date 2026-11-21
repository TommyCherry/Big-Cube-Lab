const assert=require('node:assert/strict');
const {createSixModel}=require('../six'),{searchSixIDA}=require('../six-ida');
const model=createSixModel(),moves=model.searchMoves('yau');
const blocks=[];
for(const base of ['Rw','3Rw','4Rw','5Rw'])for(const prime of [false,true])for(const turn of ['U',"U'",'U2'])blocks.push([base+(prime?"'":''),turn,base+(prime?'':"'")]);
const apply=(state,tokens)=>tokens.reduce((s,t)=>moves.find(m=>m.text===t).permutation.map(i=>s[i]).join(''),state);
function simplify(tokens){const stack=[];for(const text of tokens){const base=text.replace(/(?:2|')$/,''),n=text.endsWith('2')?2:text.endsWith("'")?3:1;if(stack.at(-1)?.base===base){const turns=(stack.pop().turns+n)%4;if(turns)stack.push({base,turns});}else stack.push({base,turns:n});}return stack.map(({base,turns})=>base+(turns===2?'2':turns===3?"'":''));}
// Exhaust all one/two-block words, including cancellations. Any reduced word
// of three or more blocks costs at least seven moves, so this is an exact
// independent oracle for every state at cost <=6.
const oracle=new Map([[model.goal,0]]);
for(const a of [[],...blocks])for(const b of [[],...blocks]){
  const tokens=[...a,...b],state=apply(model.goal,tokens),cost=simplify(tokens).length;
  if(!oracle.has(state)||cost<oracle.get(state))oracle.set(state,cost);
}
let checked=0;
for(const [start,cost] of oracle){
  const result=searchSixIDA({start,goal:model.goal,moves,ergonomic:true,ergonomicFinishers:false,maxDepth:6,maxMs:5000});
  assert.equal(result.status,'solved');assert.equal(result.count,cost);
  assert.equal(apply(start,result.moves.split(' ').filter(Boolean)),model.goal);
  if(result.blocks){assert.ok(result.blocks.every(b=>blocks.some(tokens=>tokens.join(' ')===b)));assert.deepEqual(simplify(result.blocks.flatMap(b=>b.split(' '))),result.moves.split(' ').filter(Boolean));}
  checked++;
}
const cancellation=apply(model.goal,[...blocks[0],...blocks[3]]);
assert.equal(oracle.get(cancellation),5);
assert.equal(searchSixIDA({start:cancellation,goal:model.goal,moves,ergonomic:true,ergonomicFinishers:false,maxDepth:4}).status,'depth-limit');
for(const mode of ['redux','yau']){
  const state=model.apply(model.solved(),model.parse("3Rw U 3Rw' Rw U2 Rw'"));
  const result=searchSixIDA({start:model.encode(state),goal:model.goal,moves:model.searchMoves(mode),ergonomic:true,ergonomicFinishers:false,maxDepth:6});
  assert.equal(result.count,6);assert.equal(result.blocks.length,2);
  assert.equal(model.encode(model.apply(state,model.parse(result.moves))),model.goal);
}
console.log(`Passed: ergonomic search matches ${checked} exhaustive weighted block optima; cancellation costs, depth limits, block replay, and both modes verified.`);
