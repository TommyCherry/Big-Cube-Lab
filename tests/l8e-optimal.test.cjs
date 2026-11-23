const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\ncreateL8EModel()');
const {searchL8EOptimal}=require('../l8e-search');
const stateFor=alg=>model.apply(model.solved(),model.parse(alg));
function oracle(c,limit){
 const done=s=>c.centers.every(i=>s[i]===c.goal[i])&&c.pairs.every(p=>s[p[0]]===s[p[1]]&&s[p[2]]===s[p[3]]);
 const buckets=Array.from({length:limit+1},()=>[]),seen=new Map([[c.initial,0]]);buckets[0].push(c.initial);
 for(let cost=0;cost<=limit;cost++)for(const state of buckets[cost]){
  if(seen.get(state)!==cost)continue;if(done(state))return cost;
  for(const macro of c.macros){const nextCost=cost+macro.count;if(nextCost>limit)continue;
   const next=macro.permutation.map(i=>state[i]).join('');
   if((seen.get(next)??Infinity)<=nextCost)continue;seen.set(next,nextCost);buckets[nextCost].push(next);
  }
 }
 return Infinity;
}
for(const alg of ['', 'U', "Uw R U R' Uw'", "Uw L' U2 L Uw'", "Uw' F U F' Uw", "Uw B U' B' Uw' U"]){
 const state=stateFor(alg),c=model.searchConfig(state),answer=searchL8EOptimal({...c,seedMs:0,timeoutMs:10000});
 assert.equal(answer.status,'solved');assert.equal(answer.optimal,true);
 assert.equal(answer.blockCost,oracle(c,answer.blockCost));
 assert.equal(answer.blockCost,answer.macroIndices.reduce((n,i)=>n+c.macros[i].count,0));
 assert.equal(answer.lowerBound,answer.blockCost);
 const final=model.classify(model.apply(structuredClone(state),model.parse(answer.moves)));
 assert.ok(final.available&&final.pairs.every(p=>p.aligned));
 console.log(`Proven block cost ${answer.blockCost}: ${alg||'solved'}`);
}
const unsolved=model.searchConfig(stateFor("Uw R U R' Uw'"));
const timed=searchL8EOptimal({...unsolved,timeoutMs:0});assert.equal(timed.status,'limit');assert.equal(timed.optimal,false);
const limited=searchL8EOptimal({...unsolved,seedMs:0,maxVisits:0});assert.equal(limited.optimal,false);assert.equal(limited.status,'limit');
const cstimer=require('../vendor/cstimer/cstimer_module');cstimer.setSeed('l8e-exact-timeout');
const state=stateFor(model.adaptScramble(cstimer.getScramble('444l8e')));
const candidate=searchL8EOptimal({...model.searchConfig(state),seedMs:5000,maxVisits:0});
assert.equal(candidate.status,'solved');assert.equal(candidate.optimal,false);assert.ok(candidate.lowerBound<=candidate.blockCost);
const replay=model.classify(model.apply(structuredClone(state),model.parse(candidate.moves)));assert.ok(replay.available&&replay.pairs.every(p=>p.aligned));
console.log('Exact L8E: independent weighted-cost oracle, full replay, zero budget, visit interruption and verified unproved incumbent passed.');
