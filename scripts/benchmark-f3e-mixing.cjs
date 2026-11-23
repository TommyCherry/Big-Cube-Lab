// Compare the real random-case generator with the old short walk, a long-walk
// reference, and exact one-edge uniform-orbit expectations. No solver filtering.
const {createF3EModel}=require('../f3e');
const m=createF3EModel(),request=m.searchConfig(m.solved());
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};}
const compactMoves=request.moves.map((move,i)=>({...move,axis:m.moves[i].axis}));
const byText=new Map(compactMoves.map(move=>[move.text,move]));
const advance=(state,move)=>state.map((p,i)=>move.transitions[i%2][p]);
const code=pair=>pair[0]*24+pair[1];
function orbit(moves){
 const queue=[request.start.slice(0,2)],seen=new Set([code(queue[0])]);
 for(let i=0;i<queue.length;i++)for(const move of moves){const next=advance(queue[i],move),key=code(next);if(!seen.has(key)){seen.add(key);queue.push(next);}}
 return seen;
}
const paired=orbit(compactMoves.filter(move=>!move.base.includes('w'))),allPairStates=orbit(compactMoves);
const oldPools=[-1,0,1,2].map(axis=>compactMoves.filter(move=>move.axis!==axis));
function oldWalk(length,random){
 let state=[...request.start],axis=-1;
 for(let i=0;i<length;i++){const choices=oldPools[axis+1],move=choices[Math.floor(random()*choices.length)];state=advance(state,move);axis=move.axis;}
 return state;
}
function summarize(count,getState){
 let pairs=0,targets=0,anyTarget=0,home=0;const histogram=[0,0,0,0,0];
 for(let i=0;i<count;i++){
  const state=getState();let targetCount=0,pairCount=0;
  for(let c=0;c<4;c++){
   const pair=state.slice(c*2,c*2+2);if(paired.has(code(pair)))pairCount++;
   if(request.targets.some(target=>code(target)===code(pair)))targetCount++;
  }
  pairs+=pairCount;histogram[pairCount]++;targets+=targetCount;anyTarget+=targetCount>0;
  home+=state.filter((p,j)=>p===request.start[j]).length;
 }
 return {samples:count,meanPairedWhiteEdgesAnywhere:pairs/count,meanPairedTargetEdges:targets/count,anyPairedTargetPercent:100*anyTarget/count,meanWingsInOriginalSlot:home/count,pairedEdgesHistogram:histogram};
}
function run(count=10000,seed=20261122){
 const oldRandom=rng(seed),newRandom=rng(seed),longRandom=rng(seed);
 return {
  seed,samples:count,internalMixingMoves:m.scrambleMixingLength,displayedScramble:'Short inverse of four-edge restoration, preserving all sampled white wings',
  exactSingleEdgeOrbit:{states:allPairStates.size,pairedStates:paired.size,expectedPairedWhiteEdges:4*paired.size/allPairStates.size,expectedPairedTargetEdges:4*request.targets.length/allPairStates.size},
  old24:summarize(count,()=>oldWalk(24,oldRandom)),
  current:summarize(count,()=>m.parse(m.scramble(undefined,newRandom)).reduce((state,move)=>advance(state,byText.get(move.text)),[...request.start])),
  long1024:summarize(count,()=>oldWalk(1024,longRandom))
 };
}
function solutionLengths(count=100,seed=20261122){
 const {searchF3E}=require('../f3e-search');
 const stats=values=>({min:Math.min(...values),max:Math.max(...values),average:values.reduce((a,b)=>a+b,0)/values.length});
 function measure(getState){
  const global=[],staged=[];
  for(let i=0;i<count;i++){
   const config={...request,start:getState(),maxMs:30000};
   const a=searchF3E({...config,mode:'global'}),b=searchF3E(config);
   if(a.status!=='solved'||b.status!=='solved')throw Error('Incomplete solve in difficulty comparison');
   if(a.count>b.count)throw Error('Global optimum exceeds staged solution');
   global.push(a.count);staged.push(b.count);
  }
  return {global:stats(global),staged:stats(staged)};
 }
 const oldRandom=rng(seed),newRandom=rng(seed),longRandom=rng(seed);
 return {samplesPerGenerator:count,seed,
  old24:measure(()=>oldWalk(24,oldRandom)),
  current:measure(()=>m.parse(m.scramble(undefined,newRandom)).reduce((state,move)=>advance(state,byText.get(move.text)),[...request.start])),
  long1024:measure(()=>oldWalk(1024,longRandom))};
}
if(require.main===module){const result=run();if(process.argv.includes('--solutions'))result.solutionLengths=solutionLengths();console.log(JSON.stringify(result,null,2));}
module.exports={run,solutionLengths};
