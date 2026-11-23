// Reproducible serial benchmark using the frontend's random-case generator.
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {createFourModel,generateFourScramble,searchFour}=require('../four');
const model=createFourModel(),seed=20261122,maxMs=30000;
let randomState=seed;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
const rows=[];
const output=process.argv[2]||'/tmp/four-benchmark.json';
for(let i=0;i<50;i++){
 const scramble=generateFourScramble(model,24,random);
 const start=model.encode(model.apply(model.solved(),model.parse(scramble)));
 const began=performance.now();
 const result=searchFour({start,goal:model.goal,moves:model.moves,bars:model.bars,maxMs});
 const elapsedMs=performance.now()-began;
 if(result.status==='solved'){
  const replay=model.encode(model.apply(model.apply(model.solved(),model.parse(scramble)),model.parse(result.moves)));
  if(replay!==model.goal)throw Error('Replay failed');
 }
 rows.push({case:i+1,scramble,...result,elapsedMs});
 fs.writeFileSync(output,JSON.stringify({seed,scrambleLength:24,maxMs,node:process.version,platform:process.platform,arch:process.arch,rows},null,2)+'\n');
 console.log(JSON.stringify({case:i+1,status:result.status,visits:result.visited,count:result.count,seconds:elapsedMs/1000}));
}
const solved=rows.filter(row=>row.status==='solved');
const stats=key=>{const values=solved.map(row=>row[key]);return {min:Math.min(...values),max:Math.max(...values),average:values.reduce((a,b)=>a+b,0)/values.length};};
console.log(JSON.stringify({solved:solved.length,timeouts:rows.length-solved.length,visits:stats('visited'),moves:stats('count'),elapsedMs:stats('elapsedMs')},null,2));
