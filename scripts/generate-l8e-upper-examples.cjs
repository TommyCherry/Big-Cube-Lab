// Recompute gallery routes with the optional U-layer blocks; basic proofs stay separate.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'data/l8e-examples.json');
const model=vm.runInNewContext(['f3e.js','l8e.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+'\ncreateL8EModel()');
const {formatL8EResult,searchL8E,searchL8EOptimal}=require('../l8e-search');
const data=JSON.parse(fs.readFileSync(file));let improved=0,upper=0;
for(const group of data.classes){
 for(const example of group.examples){
  const state=model.apply(model.solved(),model.parse(example.scramble)),config=model.searchConfig(state,{allowUpper:true});
  const indices=new Map(config.macros.map((m,i)=>[m.displayText||m.text,i]));
  const route=example.solutions[0].steps.map(s=>indices.get(s.moves));
  if(route.includes(undefined))throw Error('Unknown block');
  let best=formatL8EResult(config,route,0,Date.now());
  const exact=searchL8EOptimal({...config,seedMs:0,timeoutMs:500});
  if(exact.status==='solved'&&exact.blockCost<=best.blockCost)best=exact;
  if(!exact.optimal){const trial=searchL8E({...config,timeoutMs:500,width:400});if(trial.status==='solved'&&trial.blockCost<best.blockCost)best=trial;}
  const current=structuredClone(state),steps=best.steps.map(step=>{model.apply(current,model.parse(step.moves));if(!model.inspect(current).crossSolved)throw Error('Cross disturbed');const report=model.classify(current);return {...step,signature:report.available?report.signature:null};});
  for(const end of [current,model.apply(structuredClone(state),model.parse(best.moves))]){const report=model.classify(end);if(!report.available||!report.pairs.every(p=>p.aligned))throw Error('Replay failed');}
  const optimal=!!exact.optimal&&exact.status==='solved'&&exact.blockCost===best.blockCost;
  example.upperSolutions=[{label:'U-layer toolbox solution',moves:best.moves,count:best.count,rotations:best.rotations,blockCost:best.blockCost,optimal,lowerBound:optimal?best.blockCost:exact.lowerBound,steps}];
  improved+=best.blockCost<example.solutions[0].blockCost;upper+=steps.some(s=>s.kind==='U-layer pairing');
 }
 console.log(group.signature);
}
data.upperToolbox=model.searchConfig(model.solved(),{allowUpper:true}).macros.map(({text,count})=>({text,count}));
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log({improved,upper});
