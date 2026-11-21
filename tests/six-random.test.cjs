const assert=require('node:assert/strict');
const {createSixModel,generateSixScramble}=require('../six');
const model=createSixModel(),home=model.solved();
// Independent orbit discovery from primitive moves, not generator macros.
const primitiveMoves=model.searchMoves('redux'), seenSlots=new Set(), colorOrbits=[];
for(let seed=0;seed<96;seed++) {
  if(seenSlots.has(seed))continue;
  const orbit=[seed];seenSlots.add(seed);
  for(let i=0;i<orbit.length;i++)for(const move of primitiveMoves)if(!seenSlots.has(move.permutation[orbit[i]])){seenSlots.add(move.permutation[orbit[i]]);orbit.push(move.permutation[orbit[i]]);}
  const visible=orbit.filter(i=>'UF'.includes(model.goal[i]));
  if(visible.length) {assert.equal(visible.length,8);colorOrbits.push(visible);}
}
assert.equal(colorOrbits.length,4);
let seed=41;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const mode of ['redux','yau']){
  const unique=new Set(); let exchangedTotal=0; const orbitLayouts=colorOrbits.map(()=>new Set());
  for(let i=0;i<300;i++){
    const text=generateSixScramble(model,mode,random),state=model.apply(model.solved(),model.parse(text)),encoded=model.encode(state);
    unique.add(encoded); assert.notEqual(encoded,model.goal);
    colorOrbits.forEach((orbit,i)=>{const colors=orbit.map(j=>encoded[j]).join('');assert.equal([...colors].filter(c=>c==='F').length,4);orbitLayouts[i].add(colors);});
    exchangedTotal += [...encoded].filter((color,j)=>model.goal[j]==='U' && color==='F').length;
    for(const face of ['U','F']){const v=model.visible(state,face);for(let r=1;r<5;r++)for(let c=1;c<5;c++)assert.ok(['green','orange'].includes(v[r*6+c]));}
    for(let j=0;j<96;j++)if(!'UF'.includes(model.goal[j]))assert.equal(encoded[j],model.goal[j]);
    if(mode==='yau')for(let j=0;j<home.length;j++){const s=home[j];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(state[j],s);}
    const inverse=text.split(' ').reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
    assert.equal(model.encode(model.apply(state,model.parse(inverse))),model.goal);
  }
  for(const layouts of orbitLayouts)assert.ok(layouts.size>=65, `Insufficient orbit coverage: ${layouts.size}/70`);
  assert.ok(exchangedTotal/300>7.4 && exchangedTotal/300<8.6, `Expected about eight exchanged pieces, got ${exchangedTotal/300}`);
  assert.ok(unique.size>290, `${mode}: ${unique.size} unique layouts`);
  for(const constant of [0,.5,.999999])assert.notEqual(model.encode(model.apply(model.solved(),model.parse(generateSixScramble(model,mode,()=>constant)))),model.goal);
}
console.log('Passed: 600 random cases, no gray U/F centers, other centers solved, Yau F3E preservation, inverse replay, and varied layouts.');

for (const mode of ['redux','yau']) for (const [filter, columns] of [['one',3],['two',2]]) {
  const layouts = new Set();
  for (let i=0;i<150;i++) {
    const text=generateSixScramble(model,mode,random,filter),state=model.apply(model.solved(),model.parse(text)),encoded=model.encode(state);
    assert.notEqual(encoded,model.goal); layouts.add(encoded);
    const front=model.visible(state,'F');
    for(let row=1;row<5;row++)for(let col=1;col<=columns;col++)assert.equal(front[row*6+col],'orange');
    for(let j=0;j<96;j++)assert.ok('UF'.includes(model.goal[j]) ? 'UF'.includes(encoded[j]) : encoded[j]===model.goal[j]);
    if(mode==='yau')for(let j=0;j<home.length;j++){const s=home[j];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(state[j],s);}
  }
  assert.ok(layouts.size>10, `${mode}/${filter}: ${layouts.size} layouts`);
}
console.log('Passed: 600 filtered last-bar/last-two-bars cases preserve the requested columns in both modes.');

// Enumerate every selectable last-bar outcome, not just a random sample.
for (const mode of ['redux','yau']) {
  const layouts = new Set(); let separated = 0;
  for (let i=0;i<374;i++) {
    const text=generateSixScramble(model,mode,()=>(i+.5)/374,'one');
    const state=model.apply(model.solved(),model.parse(text)),encoded=model.encode(state),front=model.visible(state,'F');
    layouts.add(encoded); assert.notEqual(encoded,model.goal);
    for(let row=1;row<5;row++)for(let col=1;col<4;col++)assert.equal(front[row*6+col],'orange');
    for(let j=0;j<96;j++)assert.ok('UF'.includes(model.goal[j]) ? 'UF'.includes(encoded[j]) : encoded[j]===model.goal[j]);
    if(front[2*6+4]!==front[3*6+4])separated++;
    for(let j=0;j<home.length;j++){const s=home[j];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(state[j],s);}
    const inverse=text.split(' ').reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
    assert.equal(model.encode(model.apply(state,model.parse(inverse))),model.goal);
  }
  assert.equal(layouts.size,374); assert.equal(separated,120);
}
console.log('Passed: all 374 non-solved last-bar layouts, including 120 with differently colored front obliques; F3E and inverse replay verified in both modes.');

// Exhaustive last-two-bars coverage proves the four orbits are independent:
// each has C(6,2)=15 layouts, so every one of 15^4 combinations is selectable.
const twoLayouts = new Set();
const permutations = new Map(model.searchMoves('yau').map(move => [move.text, move.permutation]));
const centers = home.filter(s=>s.p.filter(v=>Math.abs(v)===5).length===1);
for (let i=0;i<50624;i++) {
  const choose = ()=>(i+.5)/50624;
  const text = generateSixScramble(model,'redux',choose,'two');
  assert.equal(generateSixScramble(model,'yau',choose,'two'),text);
  let encoded = model.goal;
  for (const token of text.split(' ')) encoded = permutations.get(token).map(from=>encoded[from]).join('');
  assert.notEqual(encoded,model.goal); twoLayouts.add(encoded);
  for(let j=0;j<96;j++) {
    assert.ok('UF'.includes(model.goal[j]) ? 'UF'.includes(encoded[j]) : encoded[j]===model.goal[j]);
    if(centers[j].face==='F' && centers[j].p[0]<0) assert.equal(encoded[j],'F');
  }
  // Independent physical-sticker replay at regular intervals supplements the
  // exhaustive permutation replay, including preservation of all F3E stickers.
  if(i%503===0) {
    const state=model.apply(model.solved(),model.parse(text));
    assert.equal(model.encode(state),encoded);
    for(let j=0;j<home.length;j++){const s=home[j];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(state[j],s);}
  }
}
assert.equal(twoLayouts.size,50624);
console.log('Passed: all 50,624 non-solved last-two-bars layouts selectable in both modes, with independent orbits and fixed left columns.');
