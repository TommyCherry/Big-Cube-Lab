const assert=require('node:assert/strict');
const {createFourModel,searchFour}=require('../four');
const model=createFourModel();
const advance=(state,move)=>move.permutation.map(i=>state[i]).join('');
const encoded=text=>model.encode(model.apply(model.solved(),model.parse(text)));
const replay=(state,text)=>text.split(' ').filter(Boolean).reduce((s,t)=>advance(s,model.moves.find(m=>m.text===t)),state);
const rotatedGoals=['UFDB','FDBU','DBUF','BUFD'].map(order=>[...model.goal].map(c=>order['UFDB'.indexOf(c)]).join(''));
const half=state=>rotatedGoals.some(goal=>model.bars.flat().every(i=>state[i]===goal[i]));
const full=(state,color)=>[...model.goal].every((c,i)=>c!==color||state[i]===c);
// Independent unpruned BFS to the first milestone.
function milestoneDistance(start,goal){
 const queue=[[start,0]],seen=new Set([start]);
 for(let i=0;i<queue.length;i++){
  const [state,depth]=queue[i];if(goal(state))return depth;
  for(const move of model.moves){const next=advance(state,move);if(!seen.has(next)){seen.add(next);queue.push([next,depth+1]);}}
 }
 throw Error('Unreachable milestone');
}
// Independent unpruned bidirectional BFS for the finish.
function finishDistance(start,moves,goal=model.goal){
 if(start===goal)return 0;
 let front=new Map([[start,0]]),back=new Map([[goal,0]]),a=[start],b=[goal];
 while(a.length&&b.length){
  if(a.length>b.length){[a,b]=[b,a];[front,back]=[back,front];}
  const nextLayer=[];let best=Infinity;
  for(const state of a)for(const move of moves){
   const next=advance(state,move);if(front.has(next))continue;
   const distance=front.get(state)+1;front.set(next,distance);nextLayer.push(next);
   if(back.has(next))best=Math.min(best,distance+back.get(next));
  }
  if(best!==Infinity)return best;
  a=nextLayer;
 }
 throw Error('Unreachable finish');
}
let checks=0;
for(const scramble of ['', 'Rw U', 'l U Rw 3Rw', model.example]){
 const start=encoded(scramble);
 for(const mode of ['half','first-center'])for(const firstCenter of mode==='half'?['any']:['any','U','F','D','B']){
  const result=searchFour({start,goal:model.goal,moves:model.moves,bars:model.bars,mode,firstCenter,maxMs:10000});
  assert.equal(result.status,'solved');assert.equal(result.mode,mode);
  const milestone=mode==='half'?half:state=>[...'UFDB'].some(c=>(firstCenter==='any'||firstCenter===c)&&full(state,c));
  assert.equal(result.phase1Count,milestoneDistance(start,milestone),'First stage must be shortest');
  const endpoint=replay(start,result.phase1);assert.ok(milestone(endpoint));
  const finishMoves=mode==='half'?model.moves.filter(move=>move.phase2):model.moves;
  assert.equal(result.phase2Count,finishDistance(endpoint,finishMoves,result.goal),'Finish must be shortest from chosen endpoint');
  assert.equal(replay(start,result.moves),result.goal);
  assert.ok(mode==='half'?rotatedGoals.includes(result.goal):result.goal===model.goal);
  assert.equal(result.count,result.phase1Count+result.phase2Count);
  if(mode==='half'){
   let state=endpoint;for(const token of result.phase2.split(' ').filter(Boolean)){
    const move=model.moves.find(m=>m.text===token);assert.ok(move.phase2);state=advance(state,move);assert.ok(half(state));
   }
  }else{assert.ok(full(endpoint,result.firstCenter));if(firstCenter!=='any')assert.equal(result.firstCenter,firstCenter);}
  checks++;
 }
}
const config={start:encoded(model.example),goal:model.goal,moves:model.moves,bars:model.bars};
const staged=searchFour({...config,mode:'half'}),global=searchFour({...config,mode:'global'});
assert.ok(staged.count>global.count,'Regression must distinguish first-stage optimization from total optimization');
for(const mode of ['half','first-center'])assert.equal(searchFour({...config,mode,firstCenter:'U',maxDepth:0}).status,'limit');
assert.throws(()=>searchFour({...config,mode:'unknown'}),/Invalid solution mode/);
assert.throws(()=>searchFour({...config,firstCenter:'L'}),/Invalid first center/);
console.log(`Passed: ${checks} staged searches match independent milestone/finish BFS, boundary preservation, replay, mode differences, and validation.`);

// User regression: a four-move rotated half-center solution was rejected as six.
const scramble="U' 3Rw' U 3Rw' U2 Rw2 U Rw U l' U2 Rw U l2 U' 3Rw2 U2 3Rw' U' Rw U' Rw' U Rw'";
const regressionStart=encoded(scramble);
const regression=searchFour({...config,start:regressionStart,mode:'half'});
assert.equal(regression.phase1Count,4);
assert.equal(milestoneDistance(regressionStart,half),4,'Independent BFS proves the first-stage minimum');
const suppliedEndpoint=replay(regressionStart,"Rw2 3Rw U2 3Rw'");
assert.ok(half(suppliedEndpoint));
assert.equal(replay(regressionStart,regression.phase1),suppliedEndpoint);
assert.equal(replay(regressionStart,regression.moves),regression.goal);
assert.equal(regression.phase2Count,finishDistance(suppliedEndpoint,model.moves.filter(m=>m.phase2),regression.goal));
assert.equal(regression.phase2States,75600);
for(const goal of rotatedGoals){
 const result=searchFour({...config,start:goal,mode:'half'});
 assert.equal(result.count,0);assert.equal(result.goal,goal);
}
const invalidGoal=[...model.goal].map(c=>({U:'F',F:'U',D:'D',B:'B'})[c]).join('');
assert.ok(!half(invalidGoal));
assert.equal(searchFour({...config,start:invalidGoal,mode:'half',maxDepth:0}).status,'limit','Reject arbitrary color swaps');
console.log('Passed: four-move rotated-bar regression, exact rotated finish, all four solved orientations, and invalid color-order rejection.');
