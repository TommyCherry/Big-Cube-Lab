// Render and replay a canonical macro path. Cosmetic rotations cost zero.
function formatL8EResult(config,path,visited,began) {
  const {initial,goal,macros,pairs,centers}=config;
  const apply=(state,macro)=>macro.permutation.map(i=>state[i]).join('');
  const paired=state=>pairs.reduce((n,p)=>n+(state[p[0]]===state[p[1]]&&state[p[2]]===state[p[3]]),0);
  const restored=state=>centers.every(i=>state[i]===goal[i]);
  const solved=state=>restored(state)&&paired(state)===8;

    // Delete any dispensable block, then verify the final path again.
    for(let i=0;i<path.length;){let state=initial;for(let j=0;j<path.length;j++)if(j!==i)state=apply(state,macros[path[j]]);
      if(solved(state)){path=path.filter((_,j)=>j!==i);i=0;}else i++;
    }
    let state=initial;
    const slots=['UF','UR','UB','UL','FR','FL','BR','BL'];
    const steps=path.map(index=>{const macro=macros[index],before=paired(state),previous=state;state=apply(state,macro);
      const changedSlots=slots.filter((_,i)=>pairs[i].some(p=>previous[p]!==state[p]));
      return {moves:macro.displayText||macro.text,kind:macro.kind,before,after:paired(state),changedSlots,centersRestored:restored(state)};
    });
    steps.forEach((step,i)=>{
      const nextSlice=steps.slice(i+1).find(s=>s.kind==='Slice'||s.kind==='Slice-flip-slice');
      if(step.kind==='Insert')step.purpose=step.after>step.before
        ?`Pair edges while replacing wings at ${step.changedSlots.join(', ')}.`
        :`Reposition wings at ${step.changedSlots.join(', ')}${nextSlice?`; the next slice changes pairing from ${nextSlice.before} to ${nextSlice.after} of 8`: ' for the finish'}.`;
      else if(step.kind==='U-layer pairing')step.purpose=`Re-pair U-layer wings at ${step.changedSlots.join(', ')} with the E-layer wings, centers and D cross restored at the end of the block.`;
      else if(step.kind==='AUF')step.purpose='Align top-layer wings for the following pairing block.';
      else if(step.kind==='Slice-flip-slice')step.purpose='Resolve remaining pairing with a slice-flip-slice block.';
      else step.purpose=step.centersRestored?'Restore centers and pair the prepared wings.':'Slice the prepared E-layer wings into matching pairs.';
    });
    if(!solved(state))throw Error('L8E search replay failed.');
    const tokens=[];
    for(const token of steps.flatMap(s=>s.moves.split(' '))){const match=/^([A-Za-z0-9]+?)(2|')?$/.exec(token),base=match[1],turns=match[2]==='2'?2:match[2]==="'"?3:1;
      if(tokens.length&&tokens.at(-1).base===base){const last=tokens.pop(),sum=(last.turns+turns)%4;if(sum)tokens.push({base,turns:sum});}else tokens.push({base,turns});}
    return {status:'solved',mode:'heuristic',toolbox:config.allowUpper?'upper':'basic',macroIndices:path,blockCost:path.reduce((sum,i)=>sum+macros[i].count,0),steps,moves:tokens.map(t=>t.base+(t.turns===2?'2':t.turns===3?"'":'')).join(' '),count:tokens.filter(t=>!['x','y','z'].includes(t.base)).length,rotations:tokens.filter(t=>['x','y','z'].includes(t.base)).length,visited,elapsedMs:Date.now()-began};

}

// Heuristic macro search; no optimality claim. Runs unchanged in a Web Worker.
function searchL8E(config, progress=()=>{}) {
  const began=Date.now(), {initial,goal,macros,pairs,centers,sliceIndices}=config;
  const apply=(state,macro)=>macro.permutation.map(i=>state[i]).join('');
  const paired=state=>pairs.reduce((n,p)=>n+(state[p[0]]===state[p[1]]&&state[p[2]]===state[p[3]]),0);
  const restored=state=>centers.every(i=>state[i]===goal[i]);
  const solved=state=>restored(state)&&paired(state)===8;
  const sliceStates=Array.from({length:4},(_,i)=>i?apply(goal,macros[sliceIndices[i-1]]):goal);
  function offset(state){return sliceStates.findIndex(s=>centers.every(i=>s[i]===state[i]));}
  let visited=0,bestPairs=paired(initial);
  const maxVisits=config.maxVisits??2000000,timeoutMs=config.timeoutMs??30000,width=config.width??900;
  function evaluate(state) {
    const count=paired(state),o=offset(state);
    if(o<0)return null;
    const unsliced=o?apply(state,macros[sliceIndices[3-o]]):state;
    const finish=paired(unsliced);
    let potential=count,threePairSetup=false;
    for(const index of sliceIndices){const sliced=apply(state,macros[index]);potential=Math.max(potential,paired(sliced));
      const ePairs=pairs.slice(4).filter(p=>sliced[p[0]]===sliced[p[1]]&&sliced[p[2]]===sliced[p[3]]).length;
      if(ePairs>=3&&paired(sliced)>count)threePairSetup=true;
    }
    return {count,finish,potential,score:finish*18+count*8+potential*6+(threePairSetup?8:0)};
  }
  const result=path=>formatL8EResult(config,path,visited,began);

  if(solved(initial))return result([]);
  let beam=[{state:initial,path:[],cost:0,last:-1,...evaluate(initial)}];
  const seen=new Map([[initial,0]]);
  for(let depth=1;depth<=40;depth++) {
    const next=new Map();let winner=null;
    for(const node of beam)for(let index=0;index<macros.length;index++) {
      if(node.last>=0&&macros[node.last].kind===macros[index].kind&&['AUF','Slice'].includes(macros[index].kind))continue;
      if(++visited>maxVisits || (visited%512===0&&Date.now()-began>timeoutMs))return winner?result(winner.path):{status:'limit',visited,bestPairs,elapsedMs:Date.now()-began};
      const macro=macros[index],state=apply(node.state,macro),cost=node.cost+macro.count;
      if((seen.get(state)??Infinity)<=cost)continue;
      if(solved(state)){if(!winner||cost<winner.cost)winner={path:[...node.path,index],cost};continue;}
      const rating=evaluate(state);if(!rating)continue;
      bestPairs=Math.max(bestPairs,rating.finish);
      seen.set(state,cost);
      const candidate={state,path:[...node.path,index],cost,last:index,...rating};
      const old=next.get(state);if(!old||old.cost>cost)next.set(state,candidate);
    }
    if(winner)return result(winner.path);
    beam=[...next.values()].sort((a,b)=>(b.score-b.cost*.7)-(a.score-a.cost*.7)||a.cost-b.cost).slice(0,width);
    progress(`Exploring pairing blocks: ${bestPairs}/8 pairs with centers restored; ${visited.toLocaleString()} visits.`);
    if(!beam.length)break;
  }
  return {status:'limit',visited,bestPairs,elapsedMs:Date.now()-began};
}


// Exact weighted IDA* over whole blocks. Unlike the beam search, this does not
// discard non-greedy insertions or impose a sliced-center pattern restriction.
function searchL8EOptimal(config,progress=()=>{}) {
  const began=Date.now(),deadline=began+(config.timeoutMs??30000);
  const {initial,goal,macros,pairs,centers,trackedPairs}=config,n=goal.length;
  const apply=(state,macro)=>macro.permutation.map(i=>state[i]).join('');
  const solved=state=>centers.every(i=>state[i]===goal[i])&&pairs.every(p=>state[p[0]]===state[p[1]]&&state[p[2]]===state[p[3]]);
  let visited=0,incumbent=null,lowerBound=0;
  const finish=(optimal,reason)=>incumbent?{...incumbent,mode:'optimal',optimal,reason,lowerBound,visited,elapsedMs:Date.now()-began}
    :{status:'limit',mode:'optimal',optimal:false,reason,lowerBound,visited,elapsedMs:Date.now()-began};
  if(solved(initial)){incumbent=formatL8EResult(config,[],0,began);return finish(true,'proved');}
  if(!trackedPairs||trackedPairs.length!==8)throw Error('Missing L8E wing-pair coordinates.');
  // A quick verified incumbent is useful if the proof cannot finish in time.
  const seedMs=Math.min(config.seedMs??4000,Math.max(0,deadline-Date.now()));
  if(seedMs>0){
    progress('Finding a candidate before proving minimum block cost...');
    const seed=searchL8E({...config,timeoutMs:seedMs,maxVisits:config.seedVisits??500000},progress);
    visited+=seed.visited;
    if(seed.status==='solved')incumbent=seed;
  }
  if(Date.now()>=deadline)return finish(false,'timeout');
  // One shared reverse-Dijkstra table for two same-color wing stickers.
  // Projection can only make a solution easier, so max of all eight distances
  // is an admissible lower bound for the additive block-cost metric.
  const distances=new Float64Array(n*n);distances.fill(Infinity);
  const heap=[];
  function push(entry){let i=heap.length;heap.push(entry);while(i){const p=(i-1)>>1;if(heap[p][0]<=entry[0])break;heap[i]=heap[p];i=p;}heap[i]=entry;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
  for(const p of pairs)for(const [a,b]of [[p[0],p[1]],[p[1],p[0]],[p[2],p[3]],[p[3],p[2]]]){const key=a*n+b;distances[key]=0;push([0,key]);}
  while(heap.length){
    if(Date.now()>=deadline)return finish(false,'timeout');
    const [distance,key]=pop();if(distances[key]!==distance)continue;
    const a=Math.floor(key/n),b=key%n;
    for(const macro of macros){const previous=macro.permutation[a]*n+macro.permutation[b],candidate=distance+macro.count;
      if(candidate<distances[previous]){distances[previous]=candidate;push([candidate,previous]);}}
  }
  const forward=macros.map(m=>{const p=Array(n);m.permutation.forEach((from,to)=>p[from]=to);return p;});
  const initialPositions=trackedPairs.flat();
  const heuristic=positions=>{let bound=0;for(let i=0;i<positions.length;i+=2)bound=Math.max(bound,distances[positions[i]*n+positions[i+1]]);return bound;};
  lowerBound=heuristic(initialPositions);
  if(!Number.isFinite(lowerBound))return finish(false,'unreachable-projection');
  const stopped={},maxVisits=config.maxVisits??Infinity;
  try {
    while(!incumbent||lowerBound<incumbent.blockCost){
      if(Date.now()>=deadline)throw stopped;
      progress(`Proving block cost: ruling out solutions below ${lowerBound+1}; ${incumbent?`best found ${incumbent.blockCost}`:'no candidate yet'}.`);
      const seen=new Map();let nextBound=Infinity,found=null;
      function dfs(state,positions,cost,path){
        if(++visited>maxVisits||(visited%128===0&&Date.now()>=deadline))throw stopped;
        const estimate=cost+heuristic(positions);
        if(estimate>lowerBound){nextBound=Math.min(nextBound,estimate);return false;}
        if(solved(state)){found=path.slice();return true;}
        if((seen.get(state)??Infinity)<=cost)return false;
        // Eviction only loses pruning; it cannot eliminate a solution.
        if(seen.size>=200000)seen.clear();seen.set(state,cost);
        for(let i=0;i<macros.length;i++){
          const nextCost=cost+macros[i].count;
          if(nextCost>lowerBound){nextBound=Math.min(nextBound,nextCost);continue;}
          const nextPositions=positions.map(p=>forward[i][p]);
          const bound=nextCost+heuristic(nextPositions);
          if(bound>lowerBound){nextBound=Math.min(nextBound,bound);continue;}
          path.push(i);
          if(dfs(apply(state,macros[i]),nextPositions,nextCost,path))return true;
          path.pop();
        }
        return false;
      }
      if(dfs(initial,initialPositions,0,[])){
        incumbent=formatL8EResult(config,found,visited,began);lowerBound=incumbent.blockCost;return finish(true,'proved');
      }
      if(!Number.isFinite(nextBound))return finish(false,'exhausted');
      lowerBound=nextBound;
    }
    return finish(true,'proved');
  }catch(error){if(error!==stopped)throw error;return finish(false,visited>maxVisits?'visit-limit':'timeout');}
}
if(typeof module!=='undefined')module.exports={formatL8EResult,searchL8E,searchL8EOptimal};
