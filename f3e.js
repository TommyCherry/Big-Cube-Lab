function createF3EModel() {
  const faces={U:[1,1],L:[0,-1],F:[2,1],R:[0,1],B:[2,-1],D:[1,-1]};
  const colors={U:'red',L:'white',F:'green',R:'yellow',B:'blue',D:'orange'};
  const belt=['green','orange','blue','red'];
  const key=s=>s.p.join(',')+'/'+s.n.join(',');
  function solved(){
    const state=[];
    for(const [face,[axis,sign]] of Object.entries(faces))for(const a of [-3,-1,1,3])for(const b of [-3,-1,1,3]){
      const p=[],n=[0,0,0];p[axis]=sign*3;p[(axis+1)%3]=a;p[(axis+2)%3]=b;n[axis]=sign;
      state.push({p,n,color:colors[face]});
    }
    return state;
  }
  function parse(text){
    return text.trim().replace(/[\u2019\u2032]/g,"'").split(/\s+/).filter(Boolean).map((token,i)=>{
      const match=/^(3Rw|Rw|R|L|U|F|D|B)(2'?|')?$/.exec(token);
      if(!match)throw Error(`Invalid move ${i+1}: ${token}. Use U, F, D, B, 3Rw, Rw, R or L, with primes or doubles.`);
      const base=match[1],face=base.includes('Rw')?'R':base;
      const [axis,sign]=faces[face],turns=match[2]?.startsWith('2')?2:match[2]==="'"?3:1;
      return {text:base+(turns===2?'2':turns===3?"'":''),base,axis,sign,width:base==='3Rw'?3:base==='Rw'?2:1,turns};
    });
  }
  function apply(state,moves){
    for(const move of moves)for(const sticker of state)if(sticker.p[move.axis]*move.sign>=5-2*move.width){
      for(let turn=0;turn<move.turns;turn++)for(const vector of [sticker.p,sticker.n]){
        const a=(move.axis+1)%3,b=(move.axis+2)%3,old=vector[a];
        vector[a]=move.sign*vector[b];vector[b]=-move.sign*old;
      }
    }
    return state;
  }
  const home=solved(),slots=new Map(home.map((s,i)=>[key(s),i]));
  const colorCodes={white:'W',yellow:'Y',green:'G',orange:'O',blue:'B',red:'R'};
  function encode(state){
    const out=Array(96);
    for(const sticker of state){const i=slots.get(key(sticker));if(i===undefined||out[i]!==undefined||!colorCodes[sticker.color])throw Error('Invalid F3E sticker state.');out[i]=colorCodes[sticker.color];}
    if(out.includes(undefined))throw Error('Incomplete F3E sticker state.');
    return out.join('');
  }
  function rowCol(sticker,face){
    const [x,y,z]=sticker.p;
    return {row:(face==='U'?z:face==='D'?-z:-y)+3,
      col:(face==='B'?-x:face==='L'?z:face==='R'?-z:x)+3};
  }
  const targetPositions=new Set(['F','D','B'].flatMap(face=>[-1,1].map(offset=>{
    const p=face==='F'?[-3,offset,3]:face==='D'?[-3,-3,offset]:[-3,offset,-3];return p.join(',');
  })));
  function visible(state,face){
    const [axis,sign]=faces[face],out=Array(16);
    const whiteWings=new Set(state.filter(s=>s.color==='white'&&s.p.filter(v=>Math.abs(v)===3).length===2).map(s=>s.p.join(',')));
    for(const sticker of state)if(sticker.n[axis]===sign){
      const {row,col}=rowCol(sticker,face),boundary=sticker.p.filter(v=>Math.abs(v)===3).length;
      out[(row/2)*4+col/2]={color:sticker.color,whiteEdge:whiteWings.has(sticker.p.join(',')),
        fixedCenter:boundary===1&&(face==='L'||face==='R'),target:targetPositions.has(sticker.p.join(','))};
    }
    return out;
  }
  const targetSlots=['FL','DL','BL'];
  const goalPatterns=belt.map((_,offset)=>Object.fromEntries(targetSlots.map((slot,i)=>[slot,belt[(offset+i)%4]])));
  function inspect(state){
    const centers={};
    for(const face of ['L','R']){
      const [axis,sign]=faces[face];
      const stickers=state.filter(s=>s.n[axis]===sign&&s.p.filter(v=>Math.abs(v)===3).length===1);
      centers[face]=stickers.length===4&&stickers.every(s=>s.color===colors[face]);
    }
    const byPosition=new Map();
    for(const sticker of state){const p=sticker.p.join(',');if(!byPosition.has(p))byPosition.set(p,[]);byPosition.get(p).push(sticker);}
    const edges=targetSlots.map(slot=>{
      const positions=[-1,1].map(offset=>slot==='FL'?[-3,offset,3]:slot==='DL'?[-3,-3,offset]:[-3,offset,-3]);
      const wings=positions.map(p=>{
        const stickers=byPosition.get(p.join(','))||[];
        const left=stickers.find(s=>s.n[0]===-1),side=stickers.find(s=>s.n[0]!==-1);
        return {left:left?.color||null,side:side?.color||null};
      });
      const paired=wings.every(w=>w.left==='white'&&belt.includes(w.side))&&wings[0].side===wings[1].side;
      return {slot,wings,paired,color:paired?wings[0].side:null};
    });
    const matchingPatterns=goalPatterns.filter(pattern=>edges.every(edge=>!edge.paired||pattern[edge.slot]===edge.color));
    const pairedCount=edges.filter(edge=>edge.paired).length;
    const relativeOrder=pairedCount<3?'incomplete':matchingPatterns.length?'correct':'incorrect';
    return {centers,edges,pairedCount,matchingPatterns,relativeOrder,
      goalSatisfied:centers.L&&centers.R&&pairedCount===3&&relativeOrder==='correct'};
  }
  const moves=['U','F','D','B','3Rw','Rw','R','L'].flatMap(base=>['',"'",'2'].map(suffix=>{
    const move=parse(base+suffix)[0],moved=apply(solved(),[move]),permutation=Array(96);
    moved.forEach((sticker,i)=>{permutation[slots.get(key(sticker))]=i;});
    return {...move,permutation};
  }));
  for(const move of moves)move.inverse=moves.findIndex(m=>m.base===move.base&&m.turns===(move.turns===2?2:4-move.turns));
  // White wing stickers occupy two disjoint 24-position orbits. Track one
  // white sticker in each orbit for each of the four white-edge colors.
  const edgeIndices=home.flatMap((s,i)=>s.p.filter(v=>Math.abs(v)===3).length===2?[i]:[]);
  const forward=moves.map(move=>{const p=[];move.permutation.forEach((from,to)=>{p[from]=to;});return p;});
  const orbitOf=new Map(),orbits=[];
  for(const seed of edgeIndices)if(!orbitOf.has(seed)){
    const orbit=[seed],id=orbits.length;orbitOf.set(seed,id);
    for(let i=0;i<orbit.length;i++)for(const p of forward)if(!orbitOf.has(p[orbit[i]])){
      orbitOf.set(p[orbit[i]],id);orbit.push(p[orbit[i]]);
    }
    orbits.push(orbit);
  }
  if(orbits.length!==2||orbits.some(orbit=>orbit.length!==24))throw Error('Unexpected wing orbits.');
  const orbitPosition=new Map(orbits.flatMap(orbit=>orbit.map((slot,i)=>[slot,i])));
  const searchMoves=moves.map((move,g)=>({text:move.text,base:move.base,
    transitions:orbits.map(orbit=>orbit.map(slot=>orbitPosition.get(forward[g][slot])))}));
  const targets=targetSlots.map(slot=>{
    const pair=[];
    for(const offset of [-1,1]){
      const p=slot==='FL'?[-3,offset,3]:slot==='DL'?[-3,-3,offset]:[-3,offset,-3];
      const index=slots.get(p.join(',')+'/-1,0,0');pair[orbitOf.get(index)]=orbitPosition.get(index);
    }
    return pair;
  });
  function searchConfig(state){
    const report=inspect(state);
    if(!report.centers.L||!report.centers.R)throw Error('Solve the white L and yellow R centers before searching.');
    const positions=Array(8),byPosition=new Map();
    for(const sticker of state){const p=sticker.p.join(',');if(!byPosition.has(p))byPosition.set(p,[]);byPosition.get(p).push(sticker);}
    for(const stickers of byPosition.values())if(stickers.length===2){
      const white=stickers.find(s=>s.color==='white');if(!white)continue;
      const other=stickers.find(s=>s!==white),color=belt.indexOf(other.color),slot=slots.get(key(white));
      if(color<0||!orbitOf.has(slot))throw Error('Invalid white edge.');
      const index=color*2+orbitOf.get(slot);if(positions[index]!==undefined)throw Error('Duplicate white wing.');
      positions[index]=orbitPosition.get(slot);
    }
    if(positions.includes(undefined))throw Error('Missing white wing.');
    return {start:positions,moves:searchMoves,targets};
  }
  // Slot encoding of the eight white wings: white sticker + partner
  // sticker for each physical wing. Other pieces do not constrain the F3E goal.
  function searchKey(state){
    const whiteWings=new Set(state.filter(s=>s.color==='white'&&s.p.filter(v=>Math.abs(v)===3).length===2).map(s=>s.p.join(',')));
    const out=Array(96).fill('.');
    for(const sticker of state)if(whiteWings.has(sticker.p.join(',')))out[slots.get(key(sticker))]=colorCodes[sticker.color];
    return out.join('');
  }
  const scrambleMixingLength=96;
  function randomWalk(length,random){
    if(!Number.isInteger(length)||length<1||length>2048)throw Error('Scramble length must be between 1 and 2048 moves.');
    // Only Rw splits an edge pair across the two inner x layers. R/3Rw/L
    // commonly move both wings together. Favor Rw to mix wing identities,
    // rather than rejecting easy endpoints (which would bias the state sample).
    // Weights depend only on move type, never cube state, and treat inverses
    // equally. The long random walk approximates uniform reachable states.
    const pools=[0,1,2].map(axis=>moves.filter(move=>move.axis===axis).flatMap(move=>Array(move.base==='Rw'?8:1).fill(move)));
    for(let attempt=0;attempt<20;attempt++){
      const tokens=[];let previousAxis=null;
      for(let i=0;i<length;i++){
        const axes=[0,1,2].filter(axis=>axis!==previousAxis),axis=axes[Math.min(axes.length-1,Math.floor(random()*axes.length))];
        const choices=pools[axis],move=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
        tokens.push(move.text);previousAxis=axis;
      }
      // Exclude only a completely finished F3E case. Individual solved or
      // paired edges are legitimate and are not filtered out.
      const text=tokens.join(' ');if(!inspect(apply(solved(),parse(text))).goalSatisfied)return text;
    }
    throw Error('Could not generate an unsolved F3E case.');
  }
  // Minimize every commuting same-axis run, including wide/outer combinations.
  const axisAlgorithms=[0,1,2].map(axis=>{
    const table=new Map([[0,[]]]),queue=[0];
    const digits=value=>[0,1,2,3].map(i=>(value>>(2*i))&3);
    const encode=values=>values.reduce((out,v,i)=>out|((v&3)<<(2*i)),0);
    const turns=moves.map(move=>[-3,-1,1,3].map(p=>p*move.sign>=5-2*move.width?move.sign*move.turns:0));
    for(let i=0;i<queue.length;i++)for(let g=0;g<moves.length;g++)if(moves[g].axis===axis){
      const next=encode(digits(queue[i]).map((v,j)=>v+turns[g][j]));
      if(!table.has(next)){table.set(next,[...table.get(queue[i]),g]);queue.push(next);}
    }
    return {table,turns,digits,encode};
  });
  function simplifyScramble(indices){
    const blocks=[];
    for(const g of indices){
      const axis=moves[g].axis,{turns,digits,encode}=axisAlgorithms[axis];
      const previous=blocks.at(-1)?.axis===axis?blocks.pop().code:0;
      const code=encode(digits(previous).map((v,i)=>v+turns[g][i]));
      if(code)blocks.push({axis,code});
    }
    return blocks.flatMap(block=>axisAlgorithms[block.axis].table.get(block.code));
  }
  function scramble(length,random=Math.random){
    // Explicit lengths remain available for tests and experiments. The UI uses
    // a well-mixed state, then a short equivalent scramble of its white wings.
    if(length!==undefined)return randomWalk(length,random);
    const mixed=apply(solved(),parse(randomWalk(scrambleMixingLength,random)));
    let state=searchConfig(mixed).start;
    const homePositions=searchConfig(solved()).start,locked=[],solution=[];
    const code=(a,b)=>a*24+b;
    const transitions=searchMoves.map(move=>Uint16Array.from({length:576},(_,i)=>code(move.transitions[0][Math.floor(i/24)],move.transitions[1][i%24])));
    for(let stage=0;stage<4;stage++){
      const allowed=searchMoves.flatMap((move,g)=>locked.every(color=>[0,1].every(orbit=>move.transitions[orbit][homePositions[color*2+orbit]]===homePositions[color*2+orbit]))?[g]:[]);
      let best=null;
      for(let color=0;color<4;color++)if(!locked.includes(color)){
        const distances=new Uint16Array(576).fill(65535),queue=new Uint16Array(576);
        const goal=code(homePositions[color*2],homePositions[color*2+1]);let end=1;queue[0]=goal;distances[goal]=0;
        for(let i=0;i<end;i++)for(const g of allowed){const next=transitions[g][queue[i]];if(distances[next]===65535){distances[next]=distances[queue[i]]+1;queue[end++]=next;}}
        const distance=distances[code(state[color*2],state[color*2+1])];
        if(distance!==65535&&(!best||distance<best.distance))best={color,distance,distances};
      }
      if(!best)throw Error('Could not encode the random white-edge state as a scramble.');
      const color=best.color;
      while(state[color*2]!==homePositions[color*2]||state[color*2+1]!==homePositions[color*2+1]){
        const current=code(state[color*2],state[color*2+1]);
        const g=allowed.find(g=>best.distances[transitions[g][current]]===best.distances[current]-1);
        if(g===undefined)throw Error('Random-state scramble reconstruction failed.');
        solution.push(g);state=state.map((p,i)=>searchMoves[g].transitions[i%2][p]);
      }
      locked.push(color);
    }
    const text=simplifyScramble(solution.reverse().map(g=>moves[g].inverse)).map(g=>moves[g].text).join(' ');
    // Preserve the exact sampled positions and orientations of ALL four white
    // edges. Other pieces are irrelevant to F3E; both L/R centers stay solved.
    if(searchKey(apply(solved(),parse(text)))!==searchKey(mixed))throw Error('Random-state scramble replay failed.');
    return text;
  }
  return {solved,parse,apply,encode,visible,inspect,searchKey,searchConfig,moves,goalPatterns,colors,belt,scramble,scrambleMixingLength,example:"Rw U F' 3Rw D R U2 B' Rw'"};
}

function mountF3E(root){
  const section=root.querySelector('#f3e-solver'),find=selector=>section.querySelector(selector),model=createF3EModel();
  const input=find('[data-f3e="scramble"]'),status=find('[data-f3e="status"]');
  let current=model.solved(),displayed=current,worker=null;
  const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  function draw(state=displayed){
    displayed=state;
    const focus=find('[data-f3e="highlight"]').checked;
    for(const face of ['U','L','F','R','B','D']){
      const target=find(`[data-f3e-face="${face}"]`),stickers=model.visible(state,face);target.replaceChildren();
      for(const sticker of stickers){
        const tile=document.createElement('span');tile.className='piece f3e-'+sticker.color;
        if(focus&&!sticker.whiteEdge&&!sticker.fixedCenter)tile.className+=' f3e-muted';
        if(sticker.target)tile.className+=' f3e-target';
        tile.setAttribute('aria-hidden','true');target.append(tile);
      }
      target.setAttribute('aria-label',`${face} face, rows left to right: ${stickers.map(s=>s.color).join(', ')}`);
    }
    const result=model.inspect(state);
    find('[data-f3e="centers"]').textContent=result.centers.L&&result.centers.R?'L white / R yellow centers preserved':'L/R center constraint not satisfied';
    find('[data-f3e="paired"]').textContent=`${result.pairedCount} / 3 white edges paired in FL, DL and BL`;
    find('[data-f3e="order"]').textContent=result.relativeOrder==='correct'?'Relative edge order is correct':result.relativeOrder==='incorrect'?'Relative edge order is incorrect':'Relative edge order: waiting for three paired edges';
    find('[data-f3e="goal"]').textContent=result.goalSatisfied?'F3E goal satisfied':'F3E goal not yet satisfied';
    const edgeList=find('[data-f3e="edges"]');edgeList.replaceChildren();
    for(const edge of result.edges){
      const item=document.createElement('li');item.append(make('strong',edge.slot),make('span',edge.paired?'White-'+edge.color+' paired':edge.wings.map((w,i)=>`Wing ${i+1}: ${w.left} / ${w.side}`).join('; ')));edgeList.append(item);
    }
  }
  function stop(){worker?.terminate();worker=null;find('[data-f3e="solve"]').disabled=false;find('[data-f3e="cancel"]').hidden=true;}
  function apply(){
    try{
      const moves=model.parse(input.value),next=model.apply(model.solved(),moves);
      stop();find('[data-f3e="results"]').replaceChildren();
      current=next;input.removeAttribute('aria-invalid');draw(current);
      status.textContent=`Applied ${moves.length} moves from the solved reference. Ready to find an F3E solution.`;
    }catch(error){status.textContent=error.message;input.setAttribute('aria-invalid','true');}
  }
  find('form').addEventListener('submit',event=>{event.preventDefault();apply();});
  find('[data-f3e="example"]').addEventListener('click',()=>{input.value=model.example;apply();});
  find('[data-f3e="random"]').addEventListener('click',()=>{input.value=model.scramble();apply();});
  find('[data-f3e="reset"]').addEventListener('click',()=>{input.value='';apply();});
  find('[data-f3e="highlight"]').addEventListener('change',()=>draw());
  find('[data-f3e="mode"]').addEventListener('change',()=>{
    stop();find('[data-f3e="results"]').replaceChildren();draw(current);
    find('[data-f3e="mode-help"]').textContent=find('[data-f3e="mode"]').value==='global'
      ?'Minimize total moves to any valid F3E arrangement. Edges may be moved or unpaired along the way; only the final three edges must be solved in the correct order.'
      :'Solve the quickest first edge, then the quickest compatible second edge, then the third. Once an edge is solved, every later move must leave it solved in the same slot.';
    status.textContent='Solution approach changed. Ready to search.';
  });
  find('[data-f3e="cancel"]').addEventListener('click',()=>{stop();status.textContent='Search cancelled. No solution is claimed.';});
  find('[data-f3e="solve"]').addEventListener('click',()=>{
    stop();draw(current);
    const results=find('[data-f3e="results"]');results.replaceChildren();
    let request;
    try{request={...model.searchConfig(current),mode:find('[data-f3e="mode"]').value};}catch(error){status.textContent=error.message;return;}
    const source=searchF3EGlobal.toString()+'\n'+searchF3E.toString()+`\nonmessage=({data})=>{try{postMessage({result:searchF3E(data,text=>postMessage({progress:text}))});}catch(error){postMessage({error:error.message});}};`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{worker=new Worker(url);}catch(error){status.textContent='Could not start search: '+error.message;return;}finally{URL.revokeObjectURL(url);}
    const active=worker;
    find('[data-f3e="solve"]').disabled=true;find('[data-f3e="cancel"]').hidden=false;
    status.textContent=request.mode==='global'?'Preparing globally optimal F3E search...':'Preparing three-stage F3E search...';
    worker.onerror=event=>{if(worker!==active)return;stop();status.textContent='Search error: '+event.message;};
    worker.onmessage=({data})=>{
      if(worker!==active)return;
      if(data.progress){status.textContent=data.progress;return;}
      stop();
      if(data.error){status.textContent=data.error;return;}
      const result=data.result;
      if(result.status==='unreachable'){status.textContent='The selected earlier stages cannot be completed without disturbing a locked edge. No complete solution is claimed.';return;}
      if(result.status!=='solved'){status.textContent=result.mode==='global'?'Search limit reached. Global optimality is not established.':`Search stopped in stage ${result.stage}; no complete solution was proved.`;return;}
      let replay=structuredClone(current);const locked=[],previews=[];
      if(result.mode==='global')model.apply(replay,model.parse(result.moves));
      else for(const stage of result.stages){
        for(const move of model.parse(stage.moves)){
          model.apply(replay,[move]);
          const checkpoint=model.inspect(replay);
          if(!checkpoint.centers.L||!checkpoint.centers.R||!locked.every(lock=>checkpoint.edges.some(edge=>edge.slot===lock.slot&&edge.paired&&edge.color===lock.color))){status.textContent='A previously solved edge was disturbed. Solution rejected.';return;}
        }
        locked.push(stage);
        const report=model.inspect(replay);
        if(!report.centers.L||!report.centers.R||!locked.every(lock=>report.edges.some(edge=>edge.slot===lock.slot&&edge.paired&&edge.color===lock.color))){status.textContent='Stage verification failed.';return;}
        previews.push(structuredClone(replay));
      }
      if(!model.inspect(replay).goalSatisfied){status.textContent='Solution verification failed.';return;}
      status.textContent=result.mode==='global'
        ?`${result.count} moves, globally optimal within U/F/D/B/3Rw/Rw/R/L. ${result.visited.toLocaleString()} search visits; ${(result.elapsedMs/1000).toFixed(2)}s.`
        :`${result.count} moves (${result.stages.map(s=>s.count).join(' + ')}). Each stage is optimal while preserving earlier edges; the total is not guaranteed globally optimal. ${result.visited.toLocaleString()} visits; ${(result.elapsedMs/1000).toFixed(2)}s.`;
      results.append(make('h3','Complete solution'),make('code',result.moves||'No moves needed'));
      if(result.mode==='global'){
        const preview=make('button','Preview solved');preview.type='button';preview.addEventListener('click',()=>draw(replay));results.append(preview);
      }
      result.stages.forEach((stage,i)=>{
        results.append(make('h3',`Stage ${i+1}: white-${stage.color} at ${stage.slot} (${stage.count} moves)`),make('code',stage.moves||'Already solved'));
        const preview=make('button',`Preview stage ${i+1}`);preview.type='button';preview.addEventListener('click',()=>draw(previews[i]));results.append(preview);
      });
      results.append(make('p','Unrestricted edge: white-'+result.omittedColor+'.'));
      const original=make('button','Show scrambled case');original.type='button';original.addEventListener('click',()=>draw(current));results.append(original);
    };
    try{worker.postMessage(request);}catch(error){stop();status.textContent='Could not start search: '+error.message;}
  });
  draw();
}
if(typeof module!=='undefined')module.exports={createF3EModel,mountF3E};
