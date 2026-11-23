// Exact IDA* stages. Four identical pieces in each of two independent 24-slot
// orbits give small exact abstraction tables; their maximum is admissible.
function searchFirstCenter(config,progress=()=>{}) {
  const began=Date.now(),deadline=began+(config.timeoutMs??30000),limit={},moves=config.moves;
  let visited=0,prunedUnchanged=0;const routes=[],masks=[],index=new Map(),tables=new Map();
  const check=()=>{if(Date.now()>=deadline)throw limit;};
  const fits=(mask,goal)=>(mask&goal)===goal;
  try {
    for(let a=0;a<21;a++)for(let b=a+1;b<22;b++)for(let c=b+1;c<23;c++)for(let d=c+1;d<24;d++){const mask=(1<<a)|(1<<b)|(1<<c)|(1<<d);index.set(mask,masks.length);masks.push(mask);}
    progress('Building exact single-orbit distance tables...');
    const transitions=[0,1].map(o=>moves.map(move=>{
      const out=new Uint16Array(masks.length);
      for(let i=0;i<masks.length;i++){let bits=masks[i],next=0;while(bits){const bit=bits&-bits;next|=1<<move.perms[o][31-Math.clz32(bit)];bits^=bit;}out[i]=index.get(next);}
      check();return out;
    }));
    function distances(o,goal){
      const key=o+':'+goal;if(tables.has(key))return tables.get(key);
      const dist=new Uint8Array(masks.length).fill(255),queue=new Uint16Array(masks.length);let end=0;
      for(let i=0;i<masks.length;i++)if(fits(masks[i],goal)){dist[i]=0;queue[end++]=i;}
      for(let head=0;head<end;head++){
        if((head&255)===0)check();const current=queue[head];
        for(const transition of transitions[o]){const next=transition[current];if(dist[next]===255){dist[next]=dist[current]+1;queue[end++]=next;}}
      }
      tables.set(key,dist);return dist;
    }
    function makeSearch(start,goals){
      const bounds=goals.map(g=>[distances(0,g[0]),distances(1,g[1])]);
      const h=(a,b)=>{let best=255;for(const pair of bounds)best=Math.min(best,Math.max(pair[0][a],pair[1][b]));return best;};
      const initial=start.map(mask=>index.get(mask));if(initial.some(i=>i===undefined))throw Error('Expected four centers of each orbit per color.');
      const path=[],failed=new Map();
      const bases=[...new Set(moves.map(m=>m.base))],baseIds=moves.map(m=>bases.indexOf(m.base));
      function dfs(a,b,left,previous){
        visited++;if((visited&1023)===0)check();
        if(h(a,b)>left)return null;
        if(goals.some(g=>fits(masks[a],g[0])&&fits(masks[b],g[1])))return [a,b];
        if(!left)return null;
        // Include the previous generator: canonical move pruning depends on it.
        const cacheKey=(a*masks.length+b)*(bases.length+1)+(previous<0?bases.length:baseIds[previous]);
        if((failed.get(cacheKey)??-1)>=left)return null;
        for(let m=0;m<moves.length;m++){
          // Same-generator turns combine into one. Coaxial generators commute.
          if(previous>=0&&(moves[m].base===moves[previous].base||(moves[m].axis===moves[previous].axis&&moves[m].base<moves[previous].base)))continue;
          const nextA=transitions[0][m][a],nextB=transitions[1][m][b];
          // Other colors are unconstrained. A move leaving this color's entire
          // occupancy unchanged cannot help, even if it exchanges identical pieces.
          if(nextA===a&&nextB===b){prunedUnchanged++;continue;}
          path.push(m);const end=dfs(nextA,nextB,left-1,m);if(end)return end;path.pop();
        }
        if(failed.size>=200000)failed.clear(); // Eviction only repeats work.
        failed.set(cacheKey,left);return null;
      }
      return {lowerBound:h(...initial),atDepth(depth){
        check();path.length=0;failed.clear();
        const found=dfs(...initial,depth,-1);
        return found?{state:found.map(i=>masks[i]),path:[...path]}:null;
      }};
    }
    function solveStage(start,goals){
      const search=makeSearch(start,goals);
      for(let depth=search.lowerBound;;depth++){const found=search.atDepth(depth);if(found)return found;}
    }
    if(config.candidates.every(c=>c.method==='optimal')){
      // A shared depth bound proves the shortest solution over the selected
      // colors, without needing to finish harder colors independently.
      const searches=config.candidates.map(candidate=>({candidate,search:makeSearch(candidate.start,[candidate.plans[0][0]])}));
      for(let depth=Math.min(...searches.map(s=>s.search.lowerBound));;depth++){
        for(const {candidate,search} of searches){
          check();if(search.lowerBound>depth)continue;
          progress(`Globally optimal: testing ${depth} moves for ${candidate.color}. All selected colors below this bound have been ruled out...`);
          const found=search.atDepth(depth);if(!found)continue;
          const text=found.path.map(i=>moves[i].text).join(' '),stage={moves:text,count:found.path.length,goal:candidate.plans[0][0],visited,prunedUnchanged,elapsedMs:Date.now()-began};
          routes.push({color:candidate.color,face:candidate.face,method:'optimal',optimal:true,stages:[stage],count:found.path.length,moves:text});
          return {status:'complete',optimal:true,comparedColors:searches.length,routes,visited,prunedUnchanged,elapsedMs:Date.now()-began};
        }
      }
    }
    for(const candidate of config.candidates){
      let state=candidate.start.slice(),plans=candidate.plans,stages=[];
      for(let stage=0;stage<3;stage++){
        progress(`${candidate.color} / ${candidate.method==='bars'?'bars':'2x2 block'}: stage ${stage+1} of 3 (${routes.length}/${config.candidates.length} routes complete)...`);
        const before=visited,start=Date.now(),goals=[...new Map(plans.map(p=>[p[stage].join(','),p[stage]])).values()];
        const answer=solveStage(state,goals);state=answer.state;
        plans=plans.filter(p=>fits(state[0],p[stage][0])&&fits(state[1],p[stage][1]));
        stages.push({moves:answer.path.map(i=>moves[i].text).join(' '),count:answer.path.length,goal:plans[0][stage],visited:visited-before,elapsedMs:Date.now()-start});
      }
      routes.push({color:candidate.color,face:candidate.face,method:candidate.method,stages,count:stages.reduce((n,s)=>n+s.count,0),moves:stages.map(s=>s.moves).filter(Boolean).join(' ')});
    }
    return {status:'complete',routes:routes.sort((a,b)=>a.count-b.count),visited,prunedUnchanged,elapsedMs:Date.now()-began};
  } catch(error){if(error!==limit)throw error;return {status:'timeout',routes:routes.sort((a,b)=>a.count-b.count),visited,prunedUnchanged,elapsedMs:Date.now()-began};}
}
if(typeof module!=='undefined')module.exports={searchFirstCenter};
