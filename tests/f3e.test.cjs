const assert=require('node:assert/strict');
const {createF3EModel}=require('../f3e');
const m=createF3EModel(),home=m.solved(),run=text=>m.apply(m.solved(),m.parse(text));
assert.equal(home.length,96);assert.equal(m.moves.length,24);
assert.ok(m.inspect(home).goalSatisfied);
assert.equal(m.searchKey(home).replace(/\./g,'').length,16);
for(const token of ['Lw','Uw','Fw','x','M','l','4Rw','r','R3'])assert.throws(()=>m.parse(token),/Invalid move/);
assert.equal(m.parse(" R2' U\u2019 ").map(t=>t.text).join(' '),"R2 U'");
const inverse=text=>m.parse(text).reverse().map(t=>t.base+(t.turns===2?'2':t.turns===1?"'":'')).join(' ');
for(const move of m.moves){
 const state=run(move.text),report=m.inspect(state);
 assert.ok(report.centers.L&&report.centers.R,move.text);
 assert.deepEqual(run(move.text+' '+m.moves[move.inverse].text),home);
 assert.equal(move.permutation.map(i=>m.encode(home)[i]).join(''),m.encode(state));
 assert.equal(move.permutation.map(i=>m.searchKey(home)[i]).join(''),m.searchKey(state));
 assert.deepEqual(run(Array(4).fill(move.base).join(' ')),home);
}
// Independent clockwise face-grid check for each outer face, with unique stickers.
for(const face of ['U','F','D','B','R','L']){
 const state=m.solved();state.forEach((s,i)=>{s.color=String(i);});
 const before=m.visible(state,face).map(s=>s.color);
 m.apply(state,m.parse(face));
 const after=m.visible(state,face).map(s=>s.color);
 for(let r=0;r<4;r++)for(let c=0;c<4;c++)assert.equal(after[r*4+c],before[(3-c)*4+r],face+' clockwise view');
}
// Relabel side colors to exercise all cyclic target arrangements and reject swaps.
const omittedColors=new Set();
for(let shift=0;shift<4;shift++){
 const state=m.solved().map(s=>({...s,color:m.belt.includes(s.color)?m.belt[(m.belt.indexOf(s.color)+shift)%4]:s.color}));
 const report=m.inspect(state);assert.ok(report.goalSatisfied);
 const omitted=m.belt.filter(color=>!report.edges.some(edge=>edge.color===color));
 assert.equal(omitted.length,1);omittedColors.add(omitted[0]);
}
assert.deepEqual([...omittedColors].sort(),[...m.belt].sort(),'Any white edge may be omitted');
const wrongOrder=m.solved().map(s=>({...s,color:s.color==='orange'?'blue':s.color==='blue'?'orange':s.color}));
assert.equal(m.inspect(wrongOrder).pairedCount,3);
assert.equal(m.inspect(wrongOrder).relativeOrder,'incorrect');
assert.equal(m.inspect(wrongOrder).goalSatisfied,false);
const orangeAtUL=m.solved().map(s=>({...s,color:s.color==='orange'?'red':s.color==='red'?'orange':s.color}));
assert.equal(m.inspect(orangeAtUL).goalSatisfied,false,'White-orange at UL does not replace DL');
const unpaired=m.solved();unpaired.find(s=>s.p.join(',')==='-3,-1,3'&&s.n[2]===1).color='blue';
assert.equal(m.inspect(unpaired).edges[0].paired,false);
const flipped=m.solved(),wing=flipped.filter(s=>s.p.join(',')==='-3,-1,3');
[wing[0].color,wing[1].color]=[wing[1].color,wing[0].color];
assert.equal(m.inspect(flipped).goalSatisfied,false,'White must face L');
const centerBroken=m.solved();centerBroken.find(s=>s.n[0]===-1&&s.p[1]===1&&s.p[2]===1).color='green';
assert.equal(m.inspect(centerBroken).goalSatisfied,false);
const ulUnconstrained=m.solved();for(const s of ulUnconstrained)if(s.p[0]===-3&&s.p[1]===3&&Math.abs(s.p[2])===1)s.color='yellow';
assert.ok(m.inspect(ulUnconstrained).goalSatisfied,'UL is outside the goal predicate');
let seed=193;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<100;i++){
 const text=m.scramble(24,random),state=run(text),report=m.inspect(state);
 const parsed=m.parse(text);
 assert.equal(parsed.length,24);assert.ok(!report.goalSatisfied);
 for(let j=1;j<parsed.length;j++)assert.notEqual(parsed[j].axis,parsed[j-1].axis,`Adjacent same-axis moves in generated scramble: ${text}`);
 assert.ok(report.centers.L&&report.centers.R);
 assert.deepEqual(m.apply(state,m.parse(inverse(text))),home);
 const scrambled=run(text),key=m.searchKey(scrambled);
 const compact=m.searchConfig(scrambled);
 for(const [g,move] of m.moves.entries()){
  const advanced=m.searchConfig(m.apply(structuredClone(scrambled),[move])).start;
  assert.deepEqual(compact.start.map((p,i)=>compact.moves[g].transitions[i%2][p]),advanced);
 }

 const highlighted=['U','L','F','R','B','D'].flatMap(face=>m.visible(scrambled,face)).filter(s=>s.whiteEdge);
 assert.equal(highlighted.length,16,'Highlight both stickers of all eight white wings');
 assert.equal(highlighted.filter(s=>s.color==='white').length,8);
 for(const color of m.belt)assert.equal(highlighted.filter(s=>s.color===color).length,2,`Both white-${color} wings stay highlighted`);
 assert.equal(key.replace(/\./g,'').length,16);
 for(const face of ['U','L','F','R','B','D']){
  const grid=m.visible(scrambled,face);assert.equal(grid.length,16);assert.ok(grid.every(Boolean));
 }
 for(const move of m.moves)assert.equal(move.permutation.map(j=>key[j]).join(''),m.searchKey(m.apply(structuredClone(scrambled),[move])));
}
console.log('Passed: F3E notation, 24 move permutations/inverses, clockwise face views, L/R preservation, cyclic edge order, wing pairing/orientation, UL exclusion, and 100 random cases with future-search transitions.');
