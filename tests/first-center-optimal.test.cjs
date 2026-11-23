const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(['cube-model.js','first-center.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+'\ncreateFirstCenterModel()',{structuredClone});
const {searchFirstCenter}=require('../first-center-search'),colors=Object.values(model.colors);
const fits=(state,goal)=>goal.every((g,o)=>(state[o]&g)===g);
const advance=(state,move)=>state.map((mask,o)=>{let out=0;for(let p=0;p<24;p++)if(mask&(1<<p))out|=1<<move.perms[o][p];return out;});
// Independent uniform-cost BFS, deliberately keeping unchanged-color and
// redundant turns: these must not change the optimum reported by IDA*.
function oracle(candidate,max){let layer=[candidate.start],seen=new Set([candidate.start.join(',')]);for(let depth=0;depth<=max;depth++){const next=[];for(const state of layer){if(fits(state,candidate.plans[0][0]))return depth;if(depth===max)continue;for(const move of model.moves){const end=advance(state,move),key=end.join(',');if(!seen.has(key)){seen.add(key);next.push(end);}}}layer=next;}return Infinity;}
let checked=0,pruned=0;
function verify(scramble,selected,shallow=false){
 const state=model.apply(model.solved(),model.parse(scramble)),config=model.config(state,selected,['optimal']);
 const answer=searchFirstCenter({...config,timeoutMs:30000});assert.equal(answer.status,'complete');assert.equal(answer.optimal,true);assert.equal(answer.comparedColors,selected.length);assert.equal(answer.routes.length,1);
 const route=answer.routes[0];assert.ok(selected.includes(route.color));assert.equal(route.method,'optimal');assert.equal(route.stages.length,1);assert.equal(route.count,model.parse(route.moves).length);pruned+=answer.prunedUnchanged;
 if(shallow){const minimum=Math.min(...config.candidates.map(c=>oracle(c,3)));assert.notEqual(minimum,Infinity);assert.equal(route.count,minimum);checked++;}
 let replay=structuredClone(state),previous=model.config(replay,[route.color],['optimal']).candidates[0].start;
 for(const token of route.moves.split(' ').filter(Boolean)){model.apply(replay,model.parse(token));const next=model.config(replay,[route.color],['optimal']).candidates[0].start;assert.notEqual(next.join(','),previous.join(','),'Returned turns must affect target-color occupancy');previous=next;}
 assert.ok([6,7,8,11,12,13,16,17,18].every(i=>model.visible(replay,route.face)[i].color===route.color));
 return route.count;
}
for(const scramble of ['', 'Rw', "Rw U Fw", "Rw2 Fw' U2", "Uw Rw Fw2"]){
 for(const color of colors)verify(scramble,[color],true);
 for(const pair of [['white','yellow'],['green','blue'],['red','orange']])verify(scramble,pair,true);
 verify(scramble,colors,true);
}
// A later candidate is already solved: shared-depth CN must return zero,
// rather than the optimum for the first (unsolved) candidate.
assert.equal(verify('Rw',['green','yellow'],true),0);
let seed=9;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<6;i++){
 const scramble=Array.from({length:60},()=>model.moves[Math.floor(rand()*36)].text).join(' '),selected=i%2?['white']:colors;
 const optimal=verify(scramble,selected),state=model.apply(model.solved(),model.parse(scramble));
 const staged=searchFirstCenter({...model.config(state,selected,['bars','block']),timeoutMs:30000});assert.equal(staged.status,'complete');assert.ok(optimal<=staged.routes[0].count);
}
assert.ok(pruned>0);
const interrupted=searchFirstCenter({...model.config(model.solved(),colors,['optimal']),timeoutMs:0});assert.equal(interrupted.status,'timeout');assert.notEqual(interrupted.optimal,true);assert.equal(interrupted.routes.length,0);
// Expire after starting a real root search, not just during table generation.
const RealDate=Date;let expired=false;
const controlled=vm.runInNewContext(fs.readFileSync('first-center-search.js','utf8')+'\nsearchFirstCenter',{Date:{now:()=>expired?100000:0}});
const timeout=controlled({...model.config(model.apply(model.solved(),model.parse('Rw U Fw')),['green'],['optimal']),timeoutMs:10},message=>{if(message.startsWith('Globally optimal'))expired=true;});
assert.equal(timeout.status,'timeout');assert.equal(timeout.routes.length,0);assert.notEqual(timeout.optimal,true);
console.log(`Global first center: ${checked} independent BFS optima, single/dual/full CN, random replay and staged comparisons, inert-move pruning, and mid-search timeout passed.`);
