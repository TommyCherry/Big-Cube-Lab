const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=vm.runInNewContext(fs.readFileSync('cube-model.js','utf8')+'\n'+fs.readFileSync('first-center.js','utf8')+'\ncreateFirstCenterModel()',{structuredClone});
const {searchFirstCenter}=require('../first-center-search');
const colors=Object.values(model.colors),fits=(state,goal)=>goal.every((g,o)=>(state[o]&g)===g);
const advance=(state,move)=>state.map((mask,o)=>{let out=0;for(let p=0;p<24;p++)if(mask&(1<<p))out|=1<<move.perms[o][p];return out;});
// Independent breadth-first oracle: no heuristic or move pruning.
function bfs(start,goals,max){let layer=[start],seen=new Set([start.join(',')]);for(let depth=0;depth<=max;depth++){const next=[];for(const state of layer){if(goals.some(g=>fits(state,g)))return depth;if(depth===max)continue;for(const move of model.moves){const end=advance(state,move),key=end.join(',');if(!seen.has(key)){seen.add(key);next.push(end);}}}layer=next;}return Infinity;}
const centerCells=[6,7,8,11,12,13,16,17,18];let oracleStages=0,routeCount=0;
function verify(scramble,oracle=false){
 const start=model.apply(model.solved(),model.parse(scramble)),config=model.config(start,colors,['bars','block']);
 const result=searchFirstCenter({...config,timeoutMs:30000});assert.equal(result.status,'complete');assert.equal(result.routes.length,12);
 assert.ok(result.routes.every((r,i)=>!i||r.count>=result.routes[i-1].count));
 for(const route of result.routes){routeCount++;const candidate=config.candidates.find(c=>c.color===route.color&&c.method===route.method);let plans=candidate.plans,state=structuredClone(start),masks=candidate.start;
  for(let stage=0;stage<3;stage++){
   const step=route.stages[stage];if(oracle&&step.count<=3){assert.equal(bfs(masks,plans.map(p=>p[stage]),step.count),step.count);oracleStages++;}
   model.apply(state,model.parse(step.moves));masks=model.config(state,[route.color],[route.method]).candidates[0].start;
   plans=plans.filter(p=>fits(masks,p[stage]));assert.ok(plans.length,'Each extension retains the prior shape at its boundary');assert.equal(model.parse(step.moves).length,step.count);
   const face=model.visible(state,route.face);assert.equal(face[12].color,route.color);
   if(stage===0){const match=(r,c)=>face[(r+1)*5+c+1].color===route.color;
    if(route.method==='bars')assert.ok([false,true].some(v=>[0,1,2].every(k=>v?match(k,1):match(1,k))));
    else assert.ok([0,1].some(r=>[0,1].some(c=>match(r,c)&&match(r+1,c)&&match(r,c+1)&&match(r+1,c+1))));
   }
  }
  assert.ok(centerCells.every(i=>model.visible(state,route.face)[i].color===route.color));
 }
}
for(const scramble of ['',"Rw", "Rw U Fw", "Rw2 Fw' U2"])verify(scramble,true);
let seed=41;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<8;i++)verify(Array.from({length:60},()=>model.moves[Math.floor(rand()*36)].text).join(' '));
for(const pair of [['white','yellow'],['green','blue'],['red','orange']])assert.equal(model.config(model.solved(),pair,['bars','block']).candidates.length,4);
for(const color of colors)assert.equal(model.config(model.solved(),[color],['bars']).candidates.length,1);
assert.equal(searchFirstCenter({...model.config(model.solved(),colors,['bars']),timeoutMs:0}).status,'timeout');
assert.throws(()=>model.parse('3Rw'));assert.throws(()=>model.parse('x'));
for(const move of model.moves)for(const permutation of move.perms)assert.equal(new Set(permutation).size,24);
console.log(`First center: ${routeCount} full/stage replays, ${oracleStages} independent BFS stage optima, all colors/methods, random cases, fixed centers and timeout passed.`);
