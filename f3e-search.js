function searchF3E(config,progress=()=>{}) {
  const {start,moves,targets,mode='three-stage',maxMs=Infinity,maxDepth=Infinity}=config;
  if(!Array.isArray(start)||start.length!==8||start.some(p=>!Number.isInteger(p)||p<0||p>=24))throw Error('Invalid F3E search state.');
  if(!(maxMs>0)||(maxDepth!==Infinity&&(!Number.isInteger(maxDepth)||maxDepth<0)))throw Error('Invalid search limits.');
  if(!['three-stage','global'].includes(mode))throw Error('Invalid F3E solution mode.');
  if(mode==='global')return searchF3EGlobal(config,progress);
  const began=Date.now(),timeout={};let visited=0;
  const stages=[],locks=[],names=['FL','DL','BL'],colors=['green','orange','blue','red'];
  let state=[...start],orientation=null;
  function check(){if(Date.now()-began>=maxMs)throw timeout;}
  function advance(state,g){const t=moves[g].transitions;return state.map((p,i)=>t[i%2][p]);}
  const pairCode=(a,b)=>a*24+b;
  const pairTransitions=moves.map(move=>Uint16Array.from({length:576},(_,i)=>pairCode(move.transitions[0][Math.floor(i/24)],move.transitions[1][i%24])));
  const matches=(state,c)=>state[c.color*2]===targets[c.slot][0]&&state[c.color*2+1]===targets[c.slot][1];
  // Exact reverse BFS for one edge using ONLY moves that preserve all locks.
  // No other unsolved piece is constrained, so this is the exact stage distance,
  // not just a lower bound. The allowed moves contain their inverses.
  function distancesTo(slot,allowed){
    const distances=new Uint16Array(576).fill(65535),queue=new Uint16Array(576);
    const seed=pairCode(...targets[slot]);let end=1;queue[0]=seed;distances[seed]=0;
    for(let n=0;n<end;n++){
      visited++;if((n&127)===0)check();
      const code=queue[n],distance=distances[code]+1;
      for(const g of allowed){const next=pairTransitions[g][code];
        if(distances[next]===65535){distances[next]=distance;queue[end++]=next;}
      }
    }
    return distances;
  }
  try{
    for(let stage=1;stage<=3;stage++){
      check();progress(`Stage ${stage} / 3: finding the shortest solution without disturbing ${locks.length} solved edges...`);
      const stageBegan=Date.now(),beforeVisits=visited;
      // Lock both white-wing sticker positions. Their partner stickers move
      // with them, so the complete paired edge stays solved after every turn.
      const allowed=moves.flatMap((move,g)=>locks.every(lock=>targets[lock.slot].every((p,orbit)=>move.transitions[orbit][p]===p))?[g]:[]);
      let best=null;
      for(let slot=0;slot<3;slot++)if(!locks.some(lock=>lock.slot===slot)){
        const distances=distancesTo(slot,allowed);
        for(let color=0;color<4;color++)if(orientation===null||color===(orientation+slot)%4){
          const distance=distances[pairCode(state[color*2],state[color*2+1])];
          if(distance!==65535&&(!best||distance<best.distance))best={slot,color,distance,distances};
        }
      }
      if(!best)return {status:'unreachable',reason:'locked-edges',stage,visited};
      if(best.distance>maxDepth)return {status:'limit',reason:'depth',stage,visited};
      const path=[];
      while(!matches(state,best)){
        check();
        const code=pairCode(state[best.color*2],state[best.color*2+1]);
        const g=allowed.find(g=>best.distances[pairTransitions[g][code]]===best.distances[code]-1);
        if(g===undefined)throw Error('F3E distance-table replay failed.');
        state=advance(state,g);path.push(g);
        if(!locks.every(lock=>matches(state,lock)))throw Error('A solved edge was disturbed.');
      }
      locks.push({slot:best.slot,color:best.color});orientation=(best.color-best.slot+4)%4;
      stages.push({stage,slot:names[best.slot],color:colors[best.color],moves:path.map(g=>moves[g].text).join(' '),count:path.length,
        visited:visited-beforeVisits,elapsedMs:Date.now()-stageBegan});
    }
    if(!locks.every(c=>matches(state,c)))throw Error('F3E phase verification failed.');
    return {status:'solved',mode:'three-stage',stages,moves:stages.map(s=>s.moves).filter(Boolean).join(' '),count:stages.reduce((sum,s)=>sum+s.count,0),
      visited,elapsedMs:Date.now()-began,omittedColor:colors[(orientation+3)%4]};
  }catch(error){if(error!==timeout)throw error;return {status:'limit',reason:'time',stage:stages.length+1,visited};}
}


// Globally optimal total length: IDA* over all four white edges, using exact
// two-edge pattern distances. Min over the four valid cyclic goal orientations;
// max over the three two-edge projections within each orientation is admissible.
function searchF3EGlobal(config,progress=()=>{}) {
  const {start,moves,targets,maxMs=Infinity,maxDepth=Infinity}=config;
  const began=Date.now(),timeout={};let visited=0,preparedStates=0,completed=-1,lastProgress=0;
  const colors=['green','orange','blue','red'];
  const code=(a,b)=>a*24+b;
  const initial=[0,1,2,3].map(c=>code(start[c*2],start[c*2+1]));
  const targetCodes=targets.map(pair=>code(...pair));
  const transitions=moves.map(move=>Uint16Array.from({length:576},(_,i)=>code(move.transitions[0][Math.floor(i/24)],move.transitions[1][i%24])));
  const bases=[...new Set(moves.map(m=>m.base))],baseIds=moves.map(m=>bases.indexOf(m.base));
  function check(){if(Date.now()-began>=maxMs)throw timeout;}
  const goalOrientation=state=>[0,1,2,3].find(offset=>targetCodes.every((target,slot)=>state[(offset+slot)%4]===target));
  try{
    // Three two-edge tables suffice for every color orientation by relabeling.
    const tables=[];
    for(const [a,b] of [[0,1],[0,2],[1,2]]){
      check();progress(`Preparing optimal-search distances: table ${tables.length+1} / 3...`);
      const size=576*576,dist=new Uint8Array(size).fill(255),queue=new Uint32Array(size);
      const seed=targetCodes[a]*576+targetCodes[b];let end=1;queue[0]=seed;dist[seed]=0;
      for(let i=0;i<end;i++){
        preparedStates++;if((i&2047)===0)check();
        const key=queue[i],x=Math.floor(key/576),y=key%576,d=dist[key]+1;
        for(const t of transitions){const next=t[x]*576+t[y];if(dist[next]===255){dist[next]=d;queue[end++]=next;}}
      }
      tables.push(dist);
    }
    function heuristic(state){
      let best=255;
      for(let offset=0;offset<4;offset++){
        const a=state[offset],b=state[(offset+1)%4],c=state[(offset+2)%4];
        const d=Math.max(tables[0][a*576+b],tables[1][a*576+c],tables[2][b*576+c]);
        if(d<best)best=d;
      }
      return best;
    }
    const path=[];let orientation;
    for(let bound=heuristic(initial);bound<=maxDepth;bound++){
      check();progress(`Globally optimal: proving ${bound}-move solutions...`);
      const failures=new Map();
      function visit(state,remaining,previous){
        visited++;
        if((visited&4095)===0){check();const now=Date.now();if(now-lastProgress>=150){lastProgress=now;progress(`Globally optimal: searching ${bound} moves; ${visited.toLocaleString()} visits.`);}}
        if(heuristic(state)>remaining)return false;
        const goal=goalOrientation(state);
        if(goal!==undefined){orientation=goal;return true;}
        if(remaining===0)return false;
        let packed=0;for(const p of state)packed=packed*576+p;
        const key=packed*(bases.length+1)+previous+1;
        if((failures.get(key)??-1)>=remaining)return false;
        for(let g=0;g<moves.length;g++){
          // Only consecutive turns of the SAME generator can be discarded.
          if(baseIds[g]===previous)continue;
          const t=transitions[g],next=state.map(p=>t[p]);
          path.push(g);if(visit(next,remaining-1,baseIds[g]))return true;path.pop();
        }
        failures.set(key,remaining);return false;
      }
      if(visit(initial,bound,-1)){
        let replay=initial;for(const g of path)replay=replay.map(p=>transitions[g][p]);
        if(goalOrientation(replay)!==orientation)throw Error('Global F3E replay failed.');
        return {status:'solved',mode:'global',moves:path.map(g=>moves[g].text).join(' '),count:path.length,
          stages:[],omittedColor:colors[(orientation+3)%4],visited,preparedStates,elapsedMs:Date.now()-began};
      }
      completed=bound;
    }
    return {status:'limit',mode:'global',reason:'depth',completed,visited};
  }catch(error){if(error!==timeout)throw error;return {status:'limit',mode:'global',reason:'time',completed,visited};}
}
if(typeof module!=='undefined')module.exports={searchF3E,searchF3EGlobal};
