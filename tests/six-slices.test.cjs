const assert=require('node:assert/strict');
const {createSixModel}=require('../six'),{searchSixIDA}=require('../six-ida');
const m=createSixModel(),home=m.solved();
for(let width=2;width<=5;width++)for(const suffix of ['',"'",'2']) {
  const inv=t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'";
  const outer=width===2?'R':width===3?'Rw':`${width-1}Rw`;
  const inner=width===2?'Rw':`${width}Rw`;
  assert.deepEqual(m.apply(m.solved(),m.parse(`${width}r${suffix}`)),m.apply(m.solved(),m.parse(`${inv(outer+suffix)} ${inner+suffix}`)));
  assert.deepEqual(m.apply(m.solved(),m.parse(`${width}r ${width}r'`)),home);
}
const scramble="Rw U Rw' U 3Rw U' 3Rw' Rw U' Rw' 3Rw U' 3Rw' Rw U' Rw' U2";
const expected="U' 3r U 3r' U 3r U 3r' U' Rw U' Rw'";
const initial=m.apply(m.solved(),m.parse(scramble));
assert.equal(m.encode(m.apply(structuredClone(initial),m.parse(expected))),m.goal);
for(const mode of ['redux','yau']){
  const moves=m.searchMoves(mode,true);let pairs;
  searchSixIDA({start:m.goal,goal:m.goal,moves,prepareOnly:true,maxMs:30000},()=>{},value=>{pairs=value;});
  const result=searchSixIDA({start:m.encode(initial),goal:m.goal,moves,cachedPairs:pairs,ergonomic:true,maxDepth:12,maxMs:30000});
  assert.equal(result.status,'solved');assert.equal(result.count,12);assert.equal(result.provenThrough,11);
  assert.ok(result.moves.includes('3r'));assert.equal(m.encode(m.apply(structuredClone(initial),m.parse(result.moves))),m.goal);
  assert.ok(!result.commutator,'Direct slice blocks should not show a redundant finishing detour');
  assert.equal(m.encode(m.apply(structuredClone(initial),m.parse(result.blocks.join(' ')))),m.goal);
  if(mode==='yau'){const replay=m.apply(m.solved(),m.parse(result.moves));for(let i=0;i<home.length;i++){const s=home[i];if(s.p[0]===-5&&s.p[1]!==5&&s.p.filter(v=>Math.abs(v)===5).length===2)assert.deepEqual(replay[i],s);}}
}
console.log('Passed: exact full-cube slice definitions, primes/doubles/inverses, reported 12-move optimum, direct block breakdown, and Yau edge preservation.');

// Independent complete small-cost oracle: a reduced word costing <=6 has
// at most two triggers and one U adjustment (three triggers cost at least 7).
// Rank axis runs by their actual layer effects, including mixed wide/slice turns.
const primitive=m.searchMoves('yau',true), by=new Map(primitive.map(x=>[x.text,x.permutation]));
const axisTokens=primitive.filter(x=>!x.text.startsWith('U')).map(x=>x.text);
function code(t){const v=m.parse(t)[0];let c=0;[-5,-3,-1,1,3,5].forEach((x,i)=>{if(v.slice?x===7-2*v.width:x>=7-2*v.width)c|=v.turns<<(2*i);});return c;}
function plus(a,b){let c=0;for(let i=0;i<6;i++)c|=(((a>>(2*i)&3)+(b>>(2*i)&3))%4)<<(2*i);return c;}
const distances=new Map([[0,0]]), q=[0];for(let i=0;i<q.length;i++)for(const t of axisTokens){const n=plus(q[i],code(t));if(!distances.has(n)){distances.set(n,distances.get(q[i])+1);q.push(n);}}
function cost(tokens){const runs=[];for(const t of tokens){const kind=t.startsWith('U')?'U':'x',value=kind==='U'?(t.endsWith('2')?2:t.endsWith("'")?3:1):code(t);if(runs.at(-1)?.kind===kind){const p=runs.pop(),v=kind==='U'?(p.value+value)%4:plus(p.value,value);if(v)runs.push({kind,value:v});}else runs.push({kind,value});}return runs.reduce((n,r)=>n+(r.kind==='U'?1:distances.get(r.value)),0);}
const actions=[['U'],["U'"],['U2']];for(const base of ['Rw','3Rw','4Rw','5Rw','2r','3r','4r','5r'])for(const prime of [false,true])for(const u of ['U',"U'",'U2'])actions.push([base+(prime?"'":''),u,base+(prime?'':"'")]);
const perms=actions.map(ts=>ts.reduce((p,t)=>by.get(t).map(i=>p[i]),Array.from({length:96},(_,i)=>i)));
const oracle=new Map([[m.goal,0]]);
function enumerate(state,tokens,depth){if(!depth)return;actions.forEach((a,j)=>{const word=[...tokens,...a],n=cost(word);if(n>6)return;const next=perms[j].map(i=>state[i]).join('');if(!oracle.has(next)||n<oracle.get(next))oracle.set(next,n);enumerate(next,word,depth-1);});}
enumerate(m.goal,[],3);
let checked=0;const entries=[...oracle],step=Math.max(1,Math.floor(entries.length/80));
for(let i=0;i<entries.length;i+=step){const [start,n]=entries[i],r=searchSixIDA({start,goal:m.goal,moves:primitive,ergonomic:true,ergonomicFinishers:false,maxDepth:6,maxMs:5000});assert.equal(r.status,'solved');assert.equal(r.count,n);let replay=start;for(const t of r.moves.split(' ').filter(Boolean))replay=by.get(t).map(j=>replay[j]).join('');assert.equal(replay,m.goal);checked++;}
console.log(`Passed: ${checked} slice/U-adjustment optima checked against exhaustive weighted enumeration (${oracle.size} shallow states).`);
