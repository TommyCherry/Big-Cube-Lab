const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\ncreateL8EModel()');
const database=require('../data/l8e-examples.json'),{l8eClassGuide}=require('../l8e-examples');
assert.equal(JSON.stringify(database.toolbox),JSON.stringify(model.searchConfig(model.solved()).macros.map(m=>({text:m.text,count:m.count}))), 'Regenerate proof labels after changing the block toolbox');
const expected=[];function partitions(left,max=left,path=[]){if(!left){expected.push(path.map(n=>n+'E').join(' '));return;}for(let n=Math.min(max,left);n>=1;n--)partitions(left-n,n,[...path,n]);}partitions(8);
assert.equal(expected.length,22);assert.deepEqual(database.classes.map(c=>c.signature).sort(),expected.sort());
const vectors={U:[1,1],D:[1,-1],F:[2,1],B:[2,-1],R:[0,1],L:[0,-1]},slots=['UF','UR','UB','UL','FR','FL','BR','BL'];
const countPairs=state=>slots.filter(slot=>slot.split('').every(face=>{
 const [axis,sign]=vectors[face];const stickers=state.filter(s=>s.n[axis]===sign&&s.p.filter(v=>Math.abs(v)===3).length===2&&slot.split('').every(f=>s.p[vectors[f][0]]===vectors[f][1]*3));
 return stickers.length===2&&stickers[0].color===stickers[1].color;
})).length;
let examples=0,solutions=0,proven=0;
for(const group of database.classes){
 assert.ok(l8eClassGuide(group.parts).text.length>50);
 assert.equal(group.parts.reduce((n,x)=>n+x,0),8);
 if([2,3,4].includes(group.parts[0])&&group.parts.filter(n=>n>1).length===1)assert.ok(group.examples.length>=2);
 for(const example of group.examples){
  assert.ok(!/\bB/.test(example.scramble),'Example scrambles must also use rotated R/L inserts');
  examples++;const start=model.apply(model.solved(),model.parse(example.scramble));assert.equal(model.classify(start).signature,group.signature);
  assert.ok(example.upperSolutions.length);
  for(const solution of [...example.solutions,...example.upperSolutions]){
   solutions++;if(solution.optimal){proven++;assert.equal(solution.lowerBound,solution.blockCost);}
   assert.ok(!/\bB/.test(solution.moves));
   assert.equal(model.parse(solution.moves).filter(m=>!m.rotation).length,solution.count);
   const end=model.classify(model.apply(structuredClone(start),model.parse(solution.moves)));assert.ok(end.available&&end.pairs.every(p=>p.aligned));
   let state=structuredClone(start),cost=0;
   for(const step of solution.steps){
    assert.ok(!/\bB/.test(step.moves),'Preview blocks must not show back-face inserts');
    assert.equal(countPairs(state),step.before);const parsed=model.parse(step.moves);cost+=parsed.filter(m=>!m.rotation).length;
    if(step.kind==='Insert')assert.equal(parsed.filter(m=>!m.rotation).length,3);
    model.apply(state,parsed);assert.equal(model.inspect(state).crossSolved,true);assert.equal(countPairs(state),step.after);
    assert.equal(model.inspect(state).centersSolved,step.centersRestored);
    const c=model.classify(state);assert.equal(c.available?c.signature:null,step.signature);
   }
   assert.equal(cost,solution.blockCost);assert.equal(countPairs(state),8);assert.ok(model.inspect(state).centersSolved);
  }
 }
}
assert.ok(examples>=109);
assert.equal(database.classes.reduce((n,c)=>n+c.examples.filter(e=>!e.spatialGenerated).length,0),25);
const threes=database.classes.find(c=>c.signature==='3E 1E 1E 1E 1E 1E').examples.filter(e=>!e.spatialGenerated).map(e=>e.solutions[0]);assert.ok(threes.every(s=>s.optimal));assert.deepEqual(threes.map(s=>s.blockCost),[5,6]);
console.log(`L8E examples: all 22 partitions, ${examples} legal scrambles, ${solutions} full/step replays, ${proven} proven labels, color-neutral setup and different-cost 3E cases passed.`);

assert.equal(JSON.stringify(database.upperToolbox),JSON.stringify(model.searchConfig(model.solved(),{allowUpper:true}).macros.map(({text,count})=>({text,count}))));
assert.ok(database.classes.some(c=>c.examples.some(e=>e.upperSolutions.some(s=>s.steps.some(t=>t.kind==='U-layer pairing')))));
