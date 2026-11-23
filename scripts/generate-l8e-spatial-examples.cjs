// Expand the checked-in base examples into representative spatial subclasses.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'data/l8e-examples.json');
const model=vm.runInNewContext(fs.readFileSync(path.join(root,'f3e.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'l8e.js'),'utf8')+'\ncreateL8EModel()');
const {classifyL8ESpatial}=require('../l8e-spatial');
const {formatL8EResult,searchL8E,searchL8EOptimal}=require('../l8e-search');
const data=JSON.parse(fs.readFileSync(file,'utf8')),base=model.searchConfig(model.solved()),macros=base.macros;
const slots=['UF','UR','UB','UL','FR','FL','BR','BL'];
const permutationIndex=new Map(macros.map((m,i)=>[m.permutation.join(','),i]));
const inverse=macros.map(m=>{const p=[];m.permutation.forEach((from,to)=>p[from]=to);return permutationIndex.get(p.join(','));});
const moveIndex=new Map(macros.flatMap((m,i)=>[[m.text,i],[m.displayText,i]]));
const setups=macros.flatMap((m,i)=>{
 if(!['AUF','Insert'].includes(m.kind))return [];
 const perm=base.pairs.map(pair=>base.pairs.findIndex(source=>source.includes(m.permutation[pair[0]])));
 base.pairs.forEach((pair,to)=>{if(!pair.every(p=>base.pairs[perm[to]].includes(m.permutation[p])))throw Error('Setup must move whole dedges.');});
 return [{index:i,cost:m.count,perm}];
});
const reportFor=roles=>{
 const groups=new Map(),cycles=[];
 roles.forEach((id,i)=>{if(!id)cycles.push({size:1,slots:[slots[i]]});else{if(!groups.has(id))groups.set(id,[]);groups.get(id).push(slots[i]);}});
 groups.forEach(group=>cycles.push({size:group.length,slots:group}));return {available:true,cycles};
};
const roleKey=roles=>reportFor(roles).cycles.filter(c=>c.size>1).map(c=>c.slots.slice().sort().join('/')).sort().join('|');
function placements(example){
 const state=model.apply(model.solved(),model.parse(example.scramble)),report=model.classify(state),roles=slots.map(()=>0);let id=1;
 for(const cycle of report.cycles)if(cycle.size>1){for(const slot of cycle.slots)roles[slots.indexOf(slot)]=id;id++;}
 const buckets=[[{roles,path:[],cost:0}]],seen=new Map([[roleKey(roles),0]]),spatial=new Map();
 for(let cost=0;cost<buckets.length;cost++)for(const node of buckets[cost]||[]){
  if(seen.get(roleKey(node.roles))!==cost)continue;
  const info=classifyL8ESpatial(reportFor(node.roles));
  if(!spatial.has(info.key))spatial.set(info.key,{...node,spatial:info});
  for(const move of setups){const nextRoles=move.perm.map(from=>node.roles[from]),key=roleKey(nextRoles),nextCost=cost+move.cost;
   if((seen.get(key)??Infinity)<=nextCost)continue;seen.set(key,nextCost);
   (buckets[nextCost]??=[]).push({roles:nextRoles,path:[...node.path,move.index],cost:nextCost});
  }
 }
 return [...spatial.values()].sort((a,b)=>a.cost-b.cost||a.spatial.key.localeCompare(b.spatial.key));
}
function decorate(solution,state,optimal,lowerBound){
 let current=structuredClone(state);
 const steps=solution.steps.map(step=>{model.apply(current,model.parse(step.moves));if(!model.inspect(current).crossSolved)throw Error('Cross disturbed');const c=model.classify(current);return {...step,signature:c.available?c.signature:null};});
 const final=model.classify(current);if(!final.available||!final.pairs.every(p=>p.aligned))throw Error('Step replay failed');
 const finalText=model.classify(model.apply(structuredClone(state),model.parse(solution.moves)));if(!finalText.available||!finalText.pairs.every(p=>p.aligned))throw Error('Solution replay failed');
 return {label:'Pairing solution',moves:solution.moves,count:solution.count,rotations:solution.rotations,blockCost:solution.blockCost,optimal,lowerBound,steps};
}
const proofMs=Number(process.env.L8E_SPATIAL_PROOF_MS||500),searchMs=Number(process.env.L8E_SPATIAL_SEARCH_MS||1000);
let generated=0;
for(const [classIndex,group]of data.classes.entries()){
 group.examples=group.examples.filter(e=>!e.spatialGenerated);
 for(const example of group.examples)example.spatial=classifyL8ESpatial(model.classify(model.apply(model.solved(),model.parse(example.scramble))));
 const original=group.examples[0],possibilities=placements(original),selected=new Map(),profiles=new Set();
 // Cover every layer split, not just a random handful of placements.
 for(const candidate of possibilities)if(!profiles.has(candidate.spatial.layerKey)){profiles.add(candidate.spatial.layerKey);selected.set(candidate.spatial.key,candidate);}
 const active=group.parts.filter(n=>n>1);
 if(active.length===1&&active[0]===2){
  const relations=new Set();for(const candidate of possibilities){const c=candidate.spatial.components[0],key=c.u+':'+c.relation;if(!relations.has(key)){relations.add(key);selected.set(candidate.spatial.key,candidate);}}
 } else {
  // One additional teachably different arrangement within a covered split.
  const alternate=possibilities.find(c=>!selected.has(c.spatial.key)&&[...selected.values()].some(s=>s.spatial.layerKey===c.spatial.layerKey&&s.spatial.teachingKey!==c.spatial.teachingKey));
  if(alternate)selected.set(alternate.spatial.key,alternate);
 }
 for(const candidate of selected.values()){
  if(group.examples.some(e=>e.spatial.key===candidate.spatial.key))continue;
  const scramble=[original.scramble,...candidate.path.map(i=>macros[i].displayText||macros[i].text)].filter(Boolean).join(' ');
  const state=model.apply(model.solved(),model.parse(scramble)),report=model.classify(state),spatial=classifyL8ESpatial(report);
  if(report.signature!==group.signature||spatial.key!==candidate.spatial.key)throw Error('Spatial setup mismatch');
  const config=model.searchConfig(state),basePath=original.solutions[0].steps.map(s=>moveIndex.get(s.moves));
  if(basePath.some(i=>i===undefined))throw Error('Unknown source block');
  let best=formatL8EResult(config,[...candidate.path.slice().reverse().map(i=>inverse[i]),...basePath],0,Date.now());
  const exact=searchL8EOptimal({...config,seedMs:0,timeoutMs:proofMs});
  let proven=exact.status==='solved'&&exact.optimal;
  if(proven)best=exact;
  else{const trial=searchL8E({...config,timeoutMs:searchMs,width:400,maxVisits:180000});if(trial.status==='solved'&&trial.blockCost<best.blockCost)best=trial;}
  const answer=decorate(best,state,proven,proven?best.blockCost:exact.lowerBound);
  group.examples.push({id:`l8e-spatial-${classIndex}-${generated++}`,scramble,spatialGenerated:true,spatial,solutions:[answer]});
 }
 const subclasses=new Map();
 for(const example of group.examples){let subclass=subclasses.get(example.spatial.key);if(!subclass){subclass={key:example.spatial.key,layerKey:example.spatial.layerKey,label:example.spatial.layerLabel,exampleIds:[]};subclasses.set(subclass.key,subclass);}subclass.exampleIds.push(example.id);}
 group.subclasses=[...subclasses.values()].sort((a,b)=>a.layerKey.localeCompare(b.layerKey)||a.key.localeCompare(b.key));
 const labels=new Map();for(const s of group.subclasses)labels.set(s.label,(labels.get(s.label)||0)+1);
 for(const s of group.subclasses)if(labels.get(s.label)>1)s.label+=' - '+s.key;
 group.spatialCoverage={layerProfiles:profiles.size,representedLayouts:group.subclasses.length,possibleFootprints:possibilities.length};
 console.log(`${group.signature}: ${profiles.size} layer splits, ${group.subclasses.length} representative layouts, ${group.examples.length} examples`);
 fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
}
data.version=2;data.spatialScope='All component U/E layer splits; all six 2E layer/adjacency relationships; representative additional same-layer-split relationships. Footprints equivalent under y rotations are grouped; wing orientation and internal cycle order are excluded.';
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(`Generated ${generated} additional spatial examples.`);
