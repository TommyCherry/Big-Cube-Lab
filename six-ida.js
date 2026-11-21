// Admissible single-color, two-color, and cross-orbit pattern databases.
// IDA* proves bounds in order; cache eviction never discards search branches.
function searchSixIDA({start, goal, moves, maxDepth = 10, maxMs = 30000, prepareOnly = false, cachedPairs = null, ergonomic = false, ergonomicFinishers = true, cacheBits = Math.min(22, maxDepth + 10), pauseAfterPreparation = false}, progress = () => {}, onPairs = () => {}) {
  const began = Date.now(); let visited = 0, provenThrough = 0, timedOut = false;
  const finish = (status, extra = {}) => ({status, visited, provenThrough, elapsedMs:Date.now()-began, ...extra});
  if (start === goal && !prepareOnly) return finish('solved', {moves:'', count:0,...(ergonomic ? {ergonomic:true,blocks:[]} : {})});
  const expired = () => Date.now()-began >= maxMs;
  if (expired()) return finish('time-limit');
  const seen = new Set(), patterns = [], initial = [], pairSpecs = [], pairs = [], pairOrder = [], orbitParts = [], mobileSlots=[];
  for (let seed = 0; seed < goal.length; seed++) {
    if (seen.has(seed)) continue;
    const orbit = [seed]; seen.add(seed);
    for (let i = 0; i < orbit.length; i++) for (const move of moves) {
      const next = move.permutation[orbit[i]];
      if (!seen.has(next)) { seen.add(next); orbit.push(next); }
    }
    const colors = [...new Set(orbit.map(i => goal[i]))];
    for (const color of new Set(orbit.map(i => start[i]))) if (!colors.includes(color)) return finish('unreachable');
    if (colors.length === 1) continue;
    mobileSlots.push(...orbit);
    if (orbit.length > 20) throw new Error('Pattern orbit exceeds prototype support.');
    const localIndex = new Map(orbit.map((slot,i) => [slot,i]));
    const localMoves = moves.map(move => orbit.map(slot => localIndex.get(move.permutation[slot])));
    const masksByCount = new Map(), colorParts = {};
    for (const color of colors) {
      let target = 0, current = 0, count = 0;
      orbit.forEach((slot, i) => { if (goal[slot] === color) {target |= 1<<i; count++;} if (start[slot] === color) current |= 1<<i; });
      let bits = current, currentCount = 0; while(bits) {bits &= bits-1; currentCount++;}
      if (count !== currentCount) return finish('unreachable');
      if (!masksByCount.has(count)) {
        const masks = [];
        function choose(position, left, mask) { if (!left) {masks.push(mask); return;} for(let i=position;i<=orbit.length-left;i++)choose(i+1,left-1,mask|(1<<i)); }
        choose(0,count,0);
        const indices = new Uint16Array(1<<orbit.length).fill(65535);
        masks.forEach((mask,i) => {indices[mask]=i;});
        const transitions = new Uint16Array(masks.length*moves.length);
        for(let i=0;i<masks.length;i++) {
          if ((i & 127) === 0 && expired()) return finish('time-limit');
          for(let g=0;g<moves.length;g++) {
            let result=0;const permutation=localMoves[g];
            for(let to=0;to<orbit.length;to++)if(masks[i]&(1<<permutation[to]))result|=1<<to;
            transitions[i*moves.length+g]=indices[result];
          }
        }
        masksByCount.set(count,{indices,transitions,size:masks.length});
      }
      const table=masksByCount.get(count), distance=new Uint8Array(table.size).fill(255), queue=new Uint16Array(table.size);
      let head=0,tail=1;queue[0]=table.indices[target];distance[queue[0]]=0;
      while(head<tail){const state=queue[head++], d=distance[state]+1;for(let g=0;g<moves.length;g++){const next=table.transitions[state*moves.length+g];if(distance[next]===255){distance[next]=d;queue[tail++]=next;}}}
      colorParts[color] = patterns.length;
      patterns.push({orbit,color,indices:table.indices,transitions:table.transitions,distance,target:table.indices[target],size:table.size}); initial.push(table.indices[current]);
    }
    orbitParts.push(colorParts);
    pairSpecs.push([colorParts.U,colorParts.F]);
  }
  for(let a=0;a<orbitParts.length;a++)for(let b=a+1;b<orbitParts.length;b++)for(const color of ['U','F'])pairSpecs.push([orbitParts[a][color],orbitParts[b][color]]);
  // Track every pair of visible colors across the four center orbits. Same-color
  // pairs alone miss conflicts where one orbit's green pieces and another's
  // orange pieces each look close to solved but cannot be solved together.
  for(let a=0;a<orbitParts.length;a++)for(let b=a+1;b<orbitParts.length;b++) {
    pairSpecs.push([orbitParts[a].U,orbitParts[b].F],[orbitParts[a].F,orbitParts[b].U]);
  }
  const reusable = Array.isArray(cachedPairs) && cachedPairs.length === pairSpecs.length && cachedPairs.every((p,i) => p && p.a === pairSpecs[i][0] && p.b === pairSpecs[i][1] && p.size === patterns[p.b].size && p.distance instanceof Uint8Array && p.distance.length === patterns[p.a].size * p.size);
  if (reusable) { pairs.push(...cachedPairs); pairOrder.push(...pairs.slice().reverse()); }
  function buildPairs() {
    for (const [a,b] of pairSpecs) {
      if (expired()) return false;
      progress({phase:'patterns',patternsBuilt:pairs.length,totalPatterns:pairSpecs.length,visited,depth:provenThrough,elapsedMs:Date.now()-began});
      const size=patterns[b].size, total=patterns[a].size*size;
      const distance=new Uint8Array(total).fill(255), queue=new Uint32Array(total);
      const first=patterns[a].target*size+patterns[b].target;
      let head=0,tail=1;queue[0]=first;distance[first]=0;
      const ta=patterns[a].transitions,tb=patterns[b].transitions;
      while(head<tail){
        if((head&4095)===0&&expired())return false;
        const entry=queue[head++], offsetA=Math.floor(entry/size)*moves.length,offsetB=(entry%size)*moves.length,d=distance[entry]+1;
        for(let g=0;g<moves.length;g++){const next=ta[offsetA+g]*size+tb[offsetB+g];if(distance[next]===255){distance[next]=d;queue[tail++]=next;}}
      }
      pairs.push({a,b,size,distance});
    }
    pairOrder.push(...pairs.slice().reverse());
    onPairs(pairs);
    return true;
  }
  if (prepareOnly) {
    if (!pairs.length && !buildPairs()) return finish('time-limit');
    return finish('prepared', {tablesReused: reusable});
  }
  const heuristic = (state, cutoff = Infinity) => {let h=0;for(let i=0;i<patterns.length;i++){h=Math.max(h,patterns[i].distance[state[i]]);if(h>cutoff)return h;}for(const p of pairs){h=Math.max(h,p.distance[state[p.a]*p.size+state[p.b]]);if(h>cutoff)return h;}return h;};
  const lower = heuristic(initial);
  if(lower===255)return finish('unreachable');
  provenThrough=Math.max(0,lower-1);
  progress({phase:'search',visited,depth:provenThrough,elapsedMs:Date.now()-began});
  if(expired())return finish('time-limit');
  const bases=moves.map(m=>m.text.replace(/(?:2|')$/,'')), baseOrder=[...new Set(bases)];
  const orders=bases.map(base=>baseOrder.indexOf(base));
  // On centers, U and F commute too: they turn disjoint face centers.
  // Detect commuting actions from the actual permutations, not their axes.
  const moveCommuting=moves.map(a=>moves.map(b=>a.permutation.every((from,i)=>b.permutation[from]===a.permutation[b.permutation[i]])));
  // Cache contexts use base names, so only use commutation shared by every
  // power of those bases (also safe if the move set is extended later).
  const baseCommuting=baseOrder.map(a=>baseOrder.map(b=>moves.every((_,i)=>bases[i]!==a || moves.every((_,j)=>bases[j]!==b || moveCommuting[i][j]))));
  // Remove actions identical on every mobile center; stationary monochrome
  // faces cannot distinguish them (e.g. Redux 5Lw versus 5Rw').
  const actionKeys=new Set(), actions=[];
  moves.forEach((move,g)=>{const key=mobileSlots.map(i=>move.permutation[i]).join(',');if(!actionKeys.has(key)){actionKeys.add(key);actions.push(g);}});
  // Test the strongest joint constraints as soon as their components are
  // available. Rejected children need no remaining transitions or recursion.
  const blocks=[], sliceSetups=['2r','3r','4r','5r'].filter(base=>moves.some(m=>m.text===base));
  if(ergonomic)for(const base of ['Rw','3Rw','4Rw','5Rw',...sliceSetups])for(const suffix of ['', "'"]) {
    const setup=base+suffix, undo=base+(suffix ? '' : "'");
    for(const turn of ['U', "U'", 'U2']) {
      const tokens=[setup,turn,undo], steps=tokens.map(text=>moves.findIndex(move=>move.text===text));
      if(steps.some(i=>i<0))throw new Error('Ergonomic search requires U and Rw through 5Rw, including primes and doubles.');
      blocks.push({base,setup,tokens,steps,context:Math.floor(blocks.length/3)+1});
    }
  }
  if(ergonomic && sliceSetups.length)for(const turn of ['U',"U'",'U2'])blocks.push({base:'U',setup:'U-adjustment',adjustment:true,tokens:[turn],steps:[moves.findIndex(m=>m.text===turn)],context:blocks.length+1});
  const axisCode=text=>{
    const m=/^(?:([3-5])?Rw|([2-5])r)(2|')?$/.exec(text);if(!m)return null;
    const width=Number(m[1]||m[2]||2),turns=m[3]==='2'?2:m[3]==="'"?3:1;
    let code=0;for(let layer=0;layer<6;layer++)if(m[2]?layer===6-width:layer>=6-width)code|=turns<<(layer*2);
    return code;
  };
  const addAxis=(a,b)=>{let code=0;for(let shift=0;shift<12;shift+=2)code|=(((a>>shift&3)+(b>>shift&3))&3)<<shift;return code;};
  let axisWords=null;
  if(ergonomic && sliceSetups.length) {
    axisWords=new Map([[0,[]]]);const queue=[0], turns=moves.filter(m=>axisCode(m.text)!==null).map(m=>({text:m.text,code:axisCode(m.text)}));
    for(let i=0;i<queue.length;i++)for(const move of turns){const next=addAxis(queue[i],move.code);if(!axisWords.has(next)){axisWords.set(next,[...axisWords.get(queue[i]),move.text]);queue.push(next);}}
  }
  function simplifyTokens(tokens) {
    const runs=[];
    for(const text of tokens) {
      const code=axisWords ? axisCode(text) : null;
      const base=code===null ? text.replace(/(?:2|')$/,'') : '@axis';
      const value=code===null ? (text.endsWith('2')?2:text.endsWith("'")?3:1) : code;
      if(runs.length && runs[runs.length-1].base===base) {
        const prior=runs.pop(),sum=base==='@axis'?addAxis(prior.value,value):(prior.value+value)%4;
        if(sum)runs.push({base,value:sum});
      } else runs.push({base,value});
    }
    return runs.flatMap(({base,value})=>base==='@axis' ? axisWords.get(value) : [base+(value===2?'2':value===3?"'":'')]);
  }
  const finishers=new Map();
  if(ergonomic && ergonomicFinishers) {
    const inverse=t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'";
    const invert=tokens=>tokens.slice().reverse().map(inverse);
    const byText=new Map(moves.map(move=>[move.text,move.permutation]));
    // F alignment/variants in Yau use the equivalent center action with safe
    // right-wide turns. Every primitive then preserves FL/DL/BL.
    const expand=tokens=>tokens.flatMap(t=>t.startsWith('F') && !byText.has(t) ? ['5Rw','U'+t.slice(1),"5Rw'"] : [t]);
    const apply=(state,tokens)=>tokens.reduce((state,t)=>byText.get(t).map(i=>state[i]).join(''),state);
    const singlePair=state=>{
      let wrong=0;
      for(let i=0;i<goal.length;i++)if(state[i]!==goal[i]) {
        if(!'UF'.includes(state[i]) || !'UF'.includes(goal[i]))return false;
        wrong++;
      }
      return wrong===2;
    };
    const cores=new Map();
    for(const a of ['Rw','3Rw','4Rw','5Rw'])for(const b of ['Rw','3Rw','4Rw','5Rw'])for(const sa of ['',"'"])for(const sb of ['',"'"])for(const face of ['U','F'])for(const suffix of ['',"'"]) {
      if(expired())return finish('time-limit');
      const A=a+sa,B=b+sb,u=face+suffix;
      const core=expand([A,u,inverse(A),B,inverse(u),inverse(A),u,A,inverse(B)]);
      for(const tokens of [core,invert(core)])if(singlePair(apply(goal,invert(tokens))))cores.set(tokens.join(' '),tokens);
    }
    const entries=[], seenWords=new Set();
    function add(tokens,leadBlocks,finisher) {
      tokens=simplifyTokens(tokens);
      const text=tokens.join(' ');if(seenWords.has(text))return;
      seenWords.add(text);entries.push({tokens,leadBlocks,finisher});
    }
    for(const core of cores.values())for(const u of ['', 'U',"U'",'U2'])for(const f of ['', 'F',"F'",'F2']) {
      const tokens=[...expand([u,f].filter(Boolean)),...core];
      add(tokens,[],tokens.join(' '));
    }
    // Absorb preceding blocks whose boundary cancellation costs no extra
    // moves. This finite closure represents deep/cascading cancellations;
    // remaining prefix-to-finisher boundaries can save at most two moves.
    for(let i=0;i<entries.length;i++)for(const block of blocks) {
      if(expired())return finish('time-limit');
      const entry=entries[i], tokens=simplifyTokens([...block.tokens,...entry.tokens]);
      if(tokens.length<=entry.tokens.length)add(tokens,[block.tokens.join(' '),...entry.leadBlocks],entry.finisher);
    }
    for(const entry of entries) {

      const state=apply(goal,invert(entry.tokens));
      const key=String.fromCharCode(...patterns.map(p=>{
        let mask=0;p.orbit.forEach((slot,i)=>{if(state[slot]===p.color)mask|=1<<i;});return p.indices[mask];
      }));
      if(!finishers.has(key))finishers.set(key,[]);
      finishers.get(key).push(entry);
    }
  }
  const searchStride=ergonomic ? blocks.length : moves.length;
  const compiled=new Map();
  const searchTransitions=patterns.map(p=>{
    if(!ergonomic)return p.transitions;
    if(!compiled.has(p.transitions)) {
      const table=new Uint16Array(p.size*blocks.length);
      for(let state=0;state<p.size;state++)for(let g=0;g<blocks.length;g++) {
        let next=state;for(const step of blocks[g].steps)next=p.transitions[next*moves.length+step];
        table[state*blocks.length+g]=next;
      }
      compiled.set(p.transitions,table);
    }
    return compiled.get(p.transitions);
  });
  if(ergonomic){actions.length=0;blocks.forEach((_,g)=>actions.push(g));}
  function formatAnswer(tail=[]) {
    if(!ergonomic)return path.map(g=>moves[g].text);
    return simplifyTokens([...path.flatMap(g=>blocks[g].tokens),...tail]);
  }
  function advance(state,g,cutoff,next) {
    let computed=0,h=0;
    for(let j=0;j<pairOrder.length;j++) {
      const p=pairOrder[j], a=p.a, b=p.b;
      if(!(computed&(1<<a))) {
        next[a]=searchTransitions[a][state[a]*searchStride+g];computed|=1<<a;
        h=Math.max(h,patterns[a].distance[next[a]]);if(h>cutoff)return h;
      }
      if(!(computed&(1<<b))) {
        next[b]=searchTransitions[b][state[b]*searchStride+g];computed|=1<<b;
        h=Math.max(h,patterns[b].distance[next[b]]);if(h>cutoff)return h;
      }
      h=Math.max(h,p.distance[next[a]*p.size+next[b]]);
      if(h>cutoff) {
        // Promote useful constraints locally. This changes checking order only;
        // the admissible bound and the set of pruned paths are unchanged.
        if(j){pairOrder[j]=pairOrder[j-1];pairOrder[j-1]=p;}
        return h;
      }
    }
    for(let i=0;i<patterns.length;i++)if(!(computed&(1<<i))) {
      next[i]=searchTransitions[i][state[i]*searchStride+g];
      h=Math.max(h,patterns[i].distance[next[i]]);if(h>cutoff)return h;
    }
    return h;
  }
  const path=[], stack=Array.from({length:maxDepth+3},()=>new Uint16Array(initial.length)); stack[0].set(initial);
  let answer=null, chosenFinish=null, nextTimeCheck=1024, nextProgressAt=began;
  // Exact, bounded transposition table. One color per orbit is redundant:
  // its slots are the complement of the other colors in that orbit.
  const keyParts=orbitParts.flatMap(parts=>Object.values(parts).slice(0,-1));
  if(!Number.isInteger(cacheBits) || cacheBits<0 || cacheBits>22)throw new Error('Invalid transposition-cache size.');
  const slots=1<<cacheBits, mask=slots-1;
  const keys=new Uint16Array(slots*keyParts.length), contexts=new Uint8Array(slots), depths=new Uint8Array(slots);
  function cacheSlot(state, context) {
    let hash=context+1;
    for(const i of keyParts)hash=Math.imul(hash^state[i],16777619);
    hash^=hash>>>16;
    let replacement=hash&mask;
    for(let probe=0;probe<4;probe++) {
      const slot=(hash+probe)&mask;
      if(!depths[slot])return {slot,depth:0};
      if(contexts[slot]===context) {
        let equal=true,offset=slot*keyParts.length;
        for(let i=0;i<keyParts.length;i++)if(keys[offset+i]!==state[keyParts[i]]){equal=false;break;}
        if(equal)return {slot,depth:depths[slot]};
      }
      if(depths[slot]<depths[replacement])replacement=slot;
    }
    return {slot:replacement,depth:0};
  }
  function remember(state,context,remaining) {
    const found=cacheSlot(state,context);
    if(found.depth>=remaining)return;
    const slot=found.slot,offset=slot*keyParts.length;
    for(let i=0;i<keyParts.length;i++)keys[offset+i]=state[keyParts[i]];
    contexts[slot]=context;depths[slot]=remaining;
  }
  for(let bound=lower;bound<=maxDepth;bound++) {
    if(bound>=7 && !pairs.length) {
      if (!buildPairs()) return finish('time-limit');
      if (pauseAfterPreparation) return finish('tables-ready');
    }
    const strengthened=heuristic(initial);
    if(strengthened===255)return finish('unreachable');
    if(strengthened>bound){provenThrough=strengthened-1;bound=strengthened;if(bound>maxDepth)return finish('depth-limit');}
    progress({visited,depth:provenThrough,bound,elapsedMs:Date.now()-began});
    function visit(depth, remaining, previous, knownH) {
      visited++;
      if(visited>=nextTimeCheck) {
        nextTimeCheck=visited+1024;
        const now=Date.now();
        if(now-began>=maxMs){timedOut=true;return false;}
        // Avoid hundreds of worker messages / DOM updates per second.
        if(now>=nextProgressAt){nextProgressAt=now+100;progress({visited,depth:provenThrough,bound,elapsedMs:now-began});}
      }
      const state=stack[depth], h=knownH ?? heuristic(state,remaining);
      // A future block can merge its setup with the preceding undo, saving
      // one move already charged to the prefix. Primitive-distance bounds
      // therefore need an allowance at ergonomic boundaries (two moves for
      // terminal commutators; deeper cancellations are absorbed into terminals).
      if(h>remaining+(ergonomic && previous>=0 ? (ergonomicFinishers ? 2 : 1) : 0))return false;
      if(h===0 && remaining>=0){answer=formatAnswer();return true;}
      if(ergonomic && ergonomicFinishers) {
        const candidates=finishers.get(String.fromCharCode(...state));
        if(candidates)for(const entry of candidates) {
          const tokens=formatAnswer(entry.tokens), prefixCost=bound-remaining;
          const saving=prefixCost+entry.tokens.length-tokens.length;
          // Larger cancellations are represented by an absorbed terminal at
          // an earlier prefix state, keeping cache contexts history-independent.
          if(saving>2 || tokens.length>bound)continue;
          answer=tokens;chosenFinish=entry;return true;
        }
      }
      const terminalSlack=ergonomic && ergonomicFinishers && sliceSetups.length ? 2 : 0;
      if(remaining<=-terminalSlack)return false;
      // Continuation legality depends on the previous base, not its power.
      const context=previous<0 ? 0 : ergonomic ? blocks[previous].context : orders[previous]+1;
      if(remaining>0 && cacheSlot(state,context).depth>=remaining)return false;
      for(const g of actions) {
        // Powers of one base combine; commuting center turns have a canonical order.
        let cost=1;
        if(ergonomic) {
          // Equal setups merge into one block (or cancel entirely), so an
          // optimal representation never needs consecutive identical setups.
          if(previous>=0 && blocks[g].setup===blocks[previous].setup)continue;
          if(blocks[g].adjustment)cost=1;
          else if(previous<0 || blocks[previous].adjustment)cost=3;
          else cost=1+simplifyTokens([blocks[previous].tokens[2],blocks[g].tokens[0]]).length;
        } else if(previous>=0 && (bases[g]===bases[previous] || baseCommuting[orders[g]][orders[previous]]&&orders[g]<orders[previous]))continue;
        if(cost>remaining+terminalSlack)continue;
        const next=stack[depth+1];
        const cutoff=remaining-cost+(ergonomic ? (ergonomicFinishers ? 2 : 1) : 0);
        const estimate=advance(state,g,cutoff,next);
        // Count rejected children too, keeping visit counts comparable.
        if(estimate>cutoff){visited++;continue;}
        path.push(g);if(visit(depth+1,remaining-cost,g,estimate))return true;path.pop();
        if(timedOut)return false;
      }
      if(remaining>0)remember(state,context,remaining);return false;
    }
    if(visit(0,bound,-1)) {
      let breakdown=ergonomic ? [...path.map(g=>blocks[g].tokens.join(' ')),...(chosenFinish?.leadBlocks || [])] : [];
      // Prefer a direct block explanation when cancellation removes the need
      // for the commutator in the displayed algorithm.
      if(ergonomic && sliceSetups.length) {
        const direct=[];let i=0;
        while(i<answer.length){const block=blocks.find(b=>b.tokens.every((t,j)=>answer[i+j]===t));if(!block)break;direct.push(block.tokens.join(' '));i+=block.tokens.length;}
        if(i===answer.length){breakdown=direct;chosenFinish=null;}
      }
      return finish('solved',{moves:answer.join(' '),count:answer.length,...(ergonomic ? {ergonomic:true,blocks:breakdown,...(chosenFinish ? {commutator:chosenFinish.finisher} : {})} : {})});
    }
    if(timedOut||expired())return finish('time-limit');
    provenThrough=bound;
  }
  return finish('depth-limit');
}
if(typeof module!=='undefined')module.exports={searchSixIDA};
