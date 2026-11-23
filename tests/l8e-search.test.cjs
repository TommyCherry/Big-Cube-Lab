const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\ncreateL8EModel()');
const {searchL8E}=require('../l8e-search');
const solved=state=>{const r=model.classify(state);return r.available&&r.pairs.every(p=>p.aligned);};
assert.equal(searchL8E(model.searchConfig(model.solved())).count,0);
assert.equal(searchL8E(model.searchConfig(model.apply(model.solved(),model.parse('U')))).count,0);
assert.throws(()=>model.searchConfig(model.apply(model.solved(),model.parse('Rw'))));
const config=model.searchConfig(model.solved());
assert.ok(config.macros.some(m=>m.text==="R U R'"));
assert.equal(config.macros.find(m=>m.text==="B U' B'").displayText,"y R U' R' y'");
assert.ok(!config.macros.some(m=>m.text==="R' F R F'"));
assert.ok(!config.macros.some(m=>m.text==="L F' L' F"));
for(const macro of config.macros.filter(m=>m.kind==='Insert')) {
 const turns=macro.text.split(' ');
 assert.equal(turns.length,3,'Standalone insert must be a three-turn U insert, not a sledge');
 assert.match(turns[1],/^U(?:2|')?$/);
}
assert.ok(config.macros.some(m=>m.text==="Uw' R' F R F' R U' R' Uw"));
for(const macro of config.macros){
 assert.ok(!/\bB/.test(macro.displayText));
 const original=model.apply(model.solved(),model.parse(macro.text));
 const ergonomic=model.apply(model.solved(),model.parse(macro.displayText));
 assert.equal(model.encode(ergonomic),model.encode(original));
 // Compare sticker identities too, including corners and same-colored centers.
 assert.equal(JSON.stringify(ergonomic),JSON.stringify(original));
assert.equal(new Set(macro.permutation).size,config.goal.length);assert.equal(model.inspect(model.apply(model.solved(),model.parse(macro.text))).crossSolved,true);}
const c=require('../vendor/cstimer/cstimer_module');c.setSeed('l8e-pairing-search-20261122');
const stats=[];
for(let i=0;i<20;i++){
 const text=model.adaptScramble(c.getScramble('444l8e'));
 const state=model.apply(model.solved(),model.parse(text));
 const request=model.searchConfig(state);
 if(i===0)assert.equal(searchL8E({...request,maxVisits:0}).status,'limit');
 const r=searchL8E(request);
 assert.equal(r.status,'solved',`case ${i}: ${JSON.stringify(r)}; scramble ${text}`);
 assert.equal(r.count,model.parse(r.moves).filter(m=>!m.rotation).length);
 assert.ok(!/\bB/.test(r.moves));
 assert.ok(solved(model.apply(structuredClone(state),model.parse(r.moves))));
 let replay=structuredClone(state);
 for(const step of r.steps){assert.ok(step.purpose);model.apply(replay,model.parse(step.moves));assert.ok(model.inspect(replay).crossSolved);}
 assert.ok(solved(replay));
 for(let skip=0;skip<r.steps.length;skip++){
  const moves=r.steps.filter((_,i)=>i!==skip).map(s=>s.moves).join(' ');
  assert.ok(!solved(model.apply(structuredClone(state),model.parse(moves))),`Dispensable block ${skip} in case ${i}`);
 }
 stats.push({moves:r.count,visits:r.visited,ms:r.elapsedMs});
 console.log(`Case ${i+1}: ${r.count} moves, ${r.visited} visits, ${r.elapsedMs} ms`);
}
for(const field of ['moves','visits','ms'])console.log(field,{min:Math.min(...stats.map(s=>s[field])),max:Math.max(...stats.map(s=>s[field])),avg:stats.reduce((n,s)=>n+s[field],0)/stats.length});
console.log('L8E search passed: macro toolbox, budgets, replay, centers/cross, pairing orientation, and necessity of every returned block.');
