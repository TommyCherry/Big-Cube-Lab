// Deterministic legal training cases. Run from the repository root.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const model=vm.runInNewContext(fs.readFileSync(path.join(root,'f3e.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'l8e.js'),'utf8')+'\ncreateL8EModel()');
const {formatL8EResult,searchL8E,searchL8EOptimal}=require('../l8e-search');
const base=model.searchConfig(model.solved()),macros=base.macros;
const byPermutation=new Map(macros.map((m,i)=>[m.permutation.join(','),i]));
const inverse=macros.map(m=>{const p=[];m.permutation.forEach((from,to)=>p[from]=to);return byPermutation.get(p.join(','));});
if(inverse.some(i=>i===undefined))throw Error('Toolbox must contain inverse blocks.');
const atoms=[];
for(const i of base.sliceIndices)for(let j=0;j<macros.length;j++)if(macros[j].kind==='Insert')atoms.push({path:[i,j,inverse[i]],kind:3});
for(let j=0;j<macros.length;j++)if(macros[j].kind==='Slice-flip-slice')atoms.push({path:[j],kind:2});
const flips=atoms.filter(a=>a.kind===2),threes=atoms.filter(a=>a.kind===3),pools=new Map();
let seed=20261123;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const choose=a=>a[Math.floor(random()*a.length)];
function add(path,recipe){
 const scramble=path.map(i=>macros[i].text).join(' '),state=model.apply(model.solved(),model.parse(scramble)),report=model.classify(state);
 if(!report.available)throw Error('Construction failed stage constraints.');
 const cost=path.reduce((n,i)=>n+macros[i].count,0),key=model.encode(state);
 const entry={scramble,path,recipe,cost,key};
 const pool=pools.get(report.signature)||[];
 if(pool.some(e=>e.key===key))return;
 pool.push(entry);pool.sort((a,b)=>a.cost-b.cost||a.scramble.localeCompare(b.scramble));
 pools.set(report.signature,pool.slice(0,6));
}
add([0],[]);
for(const atom of atoms)add(atom.path,[atom.kind]);
for(let i=0;i<6500;i++){
 const count=2+Math.floor(random()*5),path=[],recipe=[];
 for(let j=0;j<count;j++){
  const atom=choose(random()<.5?flips:threes);path.push(...atom.path);recipe.push(atom.kind);
  if(random()<.25)path.push(Math.floor(random()*3));
 }
 add(path,recipe);
}
// Outer inserts park existing components in U so later cycles can be disjoint.
const inserts=macros.flatMap((m,i)=>m.kind==='Insert'?[i]:[]);
for(let i=0;i<7000;i++){
 const count=2+Math.floor(random()*4),path=[],recipe=[];
 for(let j=0;j<count;j++){
  const atom=choose(random()<.65?flips:threes);path.push(...atom.path);recipe.push(atom.kind);
  if(j+1<count)for(let k=0;k<3;k++)path.push(choose(inserts));
 }
 add(path,recipe);
}
// Number of partitions of eight, including 1E fixed pairs, is 22.
if(pools.size!==22)throw Error(`Only found ${pools.size}/22 classes: ${[...pools.keys()]}`);
console.log('Generated legal candidates for all 22 classes.');
const fullSignature=parts=>parts.concat(Array(8-parts.reduce((n,x)=>n+x,0)).fill(1)).map(n=>n+'E').join(' ');
const extra=new Set([[2],[3],[4]].map(fullSignature));
const classes=[...pools].sort((a,b)=>{
 const pa=a[0].split(' ').map(s=>parseInt(s)),pb=b[0].split(' ').map(s=>parseInt(s));
 return pa.filter(n=>n>1).reduce((s,n)=>s+n,0)-pb.filter(n=>n>1).reduce((s,n)=>s+n,0)||pa[0]-pb[0]||a[0].localeCompare(b[0]);
});
const proofMs=Number(process.env.L8E_EXAMPLE_PROOF_MS||10000);
const output={version:1,seed:20261123,toolbox:macros.map(m=>({text:m.text,count:m.count})),metric:'Additive block turn cost before inter-block cancellations; y rotations cost zero.',classes:[]};
function verify(state,answer){
 const end=model.classify(model.apply(structuredClone(state),model.parse(answer.moves)));
 if(!end.available||!end.pairs.every(p=>p.aligned))throw Error('Example solution failed replay.');
 let current=structuredClone(state);
 return answer.steps.map(step=>{
  model.apply(current,model.parse(step.moves));
  if(!model.inspect(current).crossSolved)throw Error('Example block disturbed cross.');
  const report=model.classify(current);
  return {...step,signature:report.available?report.signature:null};
 });
}
function clean(answer,state,optimal=false,lowerBound=0,label='Pairing solution'){
 return {label,moves:answer.moves,count:answer.count,rotations:answer.rotations,blockCost:answer.blockCost,optimal,lowerBound,steps:verify(state,answer)};
}
for(const [signature,pool]of classes){
 const parts=signature.split(' ').map(s=>parseInt(s)),group={signature,parts,examples:[]};
 const selected=pool.slice(0,extra.has(signature)?2:1);
 if(signature===fullSignature([3])){
  const wanted=["Uw","B U' B'","Uw'","U"],path=wanted.map(text=>macros.findIndex(m=>m.text===text));
  selected[1]={path,scramble:wanted.join(' '),recipe:[3]};
 }
 for(const [index,candidate]of selected.entries()){
  const state=model.apply(model.solved(),model.parse(candidate.scramble)),config=model.searchConfig(state);
  const constructive=formatL8EResult(config,candidate.path.slice().reverse().map(i=>inverse[i]),0,Date.now());
  let best=constructive;
  const heuristic=searchL8E({...config,timeoutMs:4000});
  if(heuristic.status==='solved'&&heuristic.blockCost<best.blockCost)best=heuristic;
  const exact=searchL8EOptimal({...config,seedMs:0,timeoutMs:proofMs});
  if(exact.status==='solved'&&exact.blockCost<=best.blockCost)best=exact;
  const proven=exact.optimal===true&&exact.blockCost===best.blockCost;
  const solutions=[clean(best,state,proven,proven?best.blockCost:exact.lowerBound)];
  if(constructive.moves!==best.moves)solutions.push(clean(constructive,state,false,0,'Constructive slice / insert finish'));
  group.examples.push({id:'l8e-example-'+output.classes.length+'-'+index,scramble:candidate.path.map(i=>macros[i].displayText||macros[i].text).join(' '),solutions,recipe:candidate.recipe.slice().reverse()});
  console.log(`${signature}, example ${index+1}: ${best.blockCost} block cost / ${best.count} moves; ${proven?'PROVEN':'verified, unproved'}; construction ${constructive.blockCost}`);
 }
 output.classes.push(group);
 fs.writeFileSync(path.join(root,'data/l8e-examples.json'),JSON.stringify(output,null,2)+'\n');
}
console.log(`Wrote ${output.classes.length} classes / ${output.classes.reduce((n,c)=>n+c.examples.length,0)} examples.`);
