const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\ncreateL8EModel()');
const {searchL8E,searchL8EOptimal}=require('../l8e-search');
const home=model.solved(),basic=model.searchConfig(home),extended=model.searchConfig(home,{allowUpper:true});
assert.equal(basic.allowUpper,false);assert.equal(basic.macros.filter(m=>m.kind==='U-layer pairing').length,0);
assert.equal(extended.macros.filter(m=>m.kind==='U-layer pairing').length,16);
assert.equal(JSON.stringify(basic.macros),JSON.stringify(extended.macros.slice(0,basic.macros.length)));
for(const rotation of ['x','y','z'])assert.equal(JSON.stringify(model.apply(model.solved(),model.parse(`${rotation} ${rotation}'`))),JSON.stringify(home));
assert.equal(JSON.stringify(model.apply(model.solved(),model.parse("x Rw2'"))),JSON.stringify(model.apply(model.solved(),model.parse('x Rw2'))));
for(const macro of extended.macros.filter(m=>m.kind==='U-layer pairing')){
 assert.equal(macro.count,9);assert.ok(!/\bB/.test(macro.displayText));
 const state=model.apply(model.solved(),model.parse(macro.displayText)),check=model.inspect(state);
 assert.ok(check.centersSolved&&check.crossSolved);
 home.forEach((s,i)=>{if(s.p.filter(v=>Math.abs(v)===3).length===2&&s.p[1]!==3)assert.equal(JSON.stringify(state[i]),JSON.stringify(s),'Non-U wing identity must be preserved');});
 const report=model.classify(state);assert.equal(report.signature,'2E 1E 1E 1E 1E 1E 1E');assert.ok(report.cycles.find(c=>c.size===2).slots.every(s=>s.startsWith('U')));
}
for(const algorithm of ["Rw2 D Rw' U2 Rw D' Rw' U2 Rw'","x Rw2' D2 Rw U2 Rw' D2 Rw U2 Lw"]){
 const state=model.apply(model.solved(),model.parse(algorithm));
 for(const solve of [searchL8E,searchL8EOptimal]){
  const answer=solve({...model.searchConfig(state,{allowUpper:true}),seedMs:0,timeoutMs:5000});
  assert.equal(answer.status,'solved');assert.equal(answer.toolbox,'upper');assert.equal(answer.blockCost,9);
  assert.equal(answer.count,model.parse(answer.moves).filter(m=>!m.rotation).length);
  assert.equal(answer.rotations,model.parse(answer.moves).filter(m=>m.rotation).length);
  if(solve===searchL8EOptimal)assert.equal(answer.optimal,true);
  assert.ok(answer.steps.some(s=>s.kind==='U-layer pairing'));
  const end=model.classify(model.apply(structuredClone(state),model.parse(answer.moves)));assert.ok(end.available&&end.pairs.every(p=>p.aligned));
 }
}
console.log('Optional U-layer toolbox: 16 variants, exact non-U wing preservation, centers/cross, rotation syntax/counts, and proven 9-cost adjacent/opposite finishes passed.');
