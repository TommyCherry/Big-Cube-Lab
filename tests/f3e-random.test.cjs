const assert=require('node:assert/strict');
const {run}=require('../scripts/benchmark-f3e-mixing.cjs');
const {createF3EModel}=require('../f3e');
const m=createF3EModel();
assert.equal(m.scrambleMixingLength,96);
assert.throws(()=>m.scramble(0),/Scramble length/);
assert.throws(()=>m.scramble(2.5),/Scramble length/);
const results=run(2000,20261122),current=results.current,reference=results.exactSingleEdgeOrbit;
assert.equal(reference.states,552);assert.equal(reference.pairedStates,24);
// Generous deterministic sampling tolerances: catch retained paired-edge bias
// without rejecting naturally easy samples or demanding impossible exact uniformity.
assert.ok(Math.abs(current.meanPairedWhiteEdgesAnywhere-reference.expectedPairedWhiteEdges)<0.05,JSON.stringify(current));
assert.ok(Math.abs(current.meanPairedTargetEdges-reference.expectedPairedTargetEdges)<0.015,JSON.stringify(current));
assert.ok(Math.abs(current.meanWingsInOriginalSlot-8/24)<0.07,JSON.stringify(current));
assert.ok(Math.abs(current.meanPairedWhiteEdgesAnywhere-results.long1024.meanPairedWhiteEdgesAnywhere)<0.06);
assert.ok(current.anyPairedTargetPercent>0.5&&current.anyPairedTargetPercent<4,'Retain natural solved edges without the old bias');
assert.ok(results.old24.meanPairedWhiteEdgesAnywhere>1,'Reference must reproduce old bias');
assert.ok(current.meanPairedWhiteEdgesAnywhere<results.old24.meanPairedWhiteEdgesAnywhere/5);
let compactSeed=193,walkSeed=193;
const random=()=>{compactSeed=(Math.imul(compactSeed,1664525)+1013904223)>>>0;return compactSeed/2**32;};
const walkRandom=()=>{walkSeed=(Math.imul(walkSeed,1664525)+1013904223)>>>0;return walkSeed/2**32;};
let total=0;
for(let i=0;i<100;i++){
 const text=m.scramble(undefined,random),moves=m.parse(text);total+=moves.length;
 assert.ok(moves.length<=30,'Short representation of the mixed state');
 const state=m.apply(m.solved(),moves);
 const mixed=m.apply(m.solved(),m.parse(m.scramble(m.scrambleMixingLength,walkRandom)));
 assert.equal(m.searchKey(state),m.searchKey(mixed),'Preserve every sampled white wing position and orientation');
 assert.ok(m.inspect(state).centers.L&&m.inspect(state).centers.R);
 let axis=null,bases=new Set();
 for(const move of moves){
  if(move.axis!==axis){axis=move.axis;bases=new Set();}
  assert.ok(!bases.has(move.base),'Same-axis turns of a generator must be combined');bases.add(move.base);
 }
}
assert.ok(total/100<20);
console.log('Passed: short scramble reconstruction and commuting-turn reduction and 2,000-case mixing regression against exact one-edge statistics and a 1,024-move reference; naturally solved edges retained.');
