const assert=require('node:assert/strict');
const {createSixModel}=require('../six'),{searchSixIDA}=require('../six-ida');
const m=createSixModel(),core="Rw U Rw' 3Rw U' Rw' U Rw 3Rw'";
const inverse=text=>text.split(' ').reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
function normalize(text){const out=[];for(const t of text.split(' ').filter(Boolean)){const base=t.replace(/(?:2|')$/,''),n=t.endsWith('2')?2:t.endsWith("'")?3:1;if(out.at(-1)?.base===base){const sum=(out.pop().n+n)%4;if(sum)out.push({base,n:sum});}else out.push({base,n});}return out.map(({base,n})=>base+(n===2?'2':n===3?"'":'')).join(' ');}
for(const mode of ['redux','yau']){
  const moves=m.searchMoves(mode);let cachedPairs;
  searchSixIDA({start:m.goal,goal:m.goal,moves,prepareOnly:true,maxMs:30000},()=>{},pairs=>{cachedPairs=pairs;});
  const cases=[core,inverse(core),core.replace(/U('?)/g,(_,prime)=>prime ? 'U' : "U'"),"U2 "+core,"Rw U' Rw' "+core,"3Rw U 3Rw' "+core,"3Rw U 3Rw' Rw U' Rw' "+core];
  if(mode==='redux')cases.push("F' U "+core);
  else cases.push("5Rw U' 5Rw' U "+core);
  for(const solution of cases){
    const state=m.apply(m.solved(),m.parse(inverse(solution))),start=m.encode(state),budget=normalize(solution).split(' ').length;
    const result=searchSixIDA({start,goal:m.goal,moves,cachedPairs,ergonomic:true,maxDepth:budget,maxMs:30000});
    assert.equal(result.status,'solved',solution);assert.ok(result.count<=budget);
    assert.equal(m.encode(m.apply(structuredClone(state),m.parse(result.moves))),m.goal);
    assert.equal(normalize([...(result.blocks||[]),result.commutator||''].join(' ')),result.moves);
    if(solution===core){assert.equal(result.count,9);assert.ok(result.commutator);assert.equal(result.provenThrough,8);}
    if(result.commutator){
      const checkpoint=m.encode(m.apply(structuredClone(state),m.parse((result.blocks||[]).join(' '))));
      const wrong=[...checkpoint].flatMap((c,i)=>c!==m.goal[i]?[i]:[]);
      assert.equal(wrong.length,2,'Finisher must start with exactly one exchanged pair');
      assert.ok(wrong.every(i=>'UF'.includes(checkpoint[i])&&'UF'.includes(m.goal[i])));
    }
    if(mode==='yau'){
      assert.ok(!/\bF/.test(result.moves));const home=m.solved(),replay=m.apply(structuredClone(home),m.parse(result.moves));
      for(let i=0;i<home.length;i++){const s=home[i];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(replay[i],s);}
    }
  }
}
console.log('Passed: commutator/inverse, aligned finishes, prefix and cascading cancellations, one-pair checkpoint, full replay, and Yau F3E safety.');
