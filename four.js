function createFourModel() {
  const faces = {R:[0,1],L:[0,-1],U:[1,1],D:[1,-1],F:[2,1],B:[2,-1]};
  const colors = {U:'green',F:'orange',D:'blue',B:'red',L:'gray',R:'gray'};
  const key = s => s.p.join(',')+'/'+s.n.join(',');
  function solved() {
    const state=[];
    for(const [face,[axis,sign]] of Object.entries(faces))for(const a of [-3,-1,1,3])for(const b of [-3,-1,1,3]) {
      const p=[],n=[0,0,0];p[axis]=sign*3;p[(axis+1)%3]=a;p[(axis+2)%3]=b;n[axis]=sign;
      state.push({p,n,face,color:Math.abs(a)<3&&Math.abs(b)<3?colors[face]:'gray'});
    }
    return state;
  }
  function parse(text) {
    return text.trim().replace(/[\u2019\u2032]/g,"'").split(/\s+/).filter(Boolean).map((token,i)=>{
      const m=/^(Rw|3Rw|U)(2'?|')?$/.exec(token);
      if(!m)throw Error(`Invalid move ${i+1}: ${token}. Use only Rw, 3Rw, U, primes and doubles.`);
      return {axis:m[1]==='U'?1:0,width:m[1]==='U'?1:m[1]==='Rw'?2:3,turns:m[2]?.startsWith('2')?2:m[2]==="'"?3:1};
    });
  }
  function apply(state,moves) {
    for(const move of moves)for(const s of state)if(s.p[move.axis]>=5-2*move.width)for(let t=0;t<move.turns;t++)for(const v of [s.p,s.n]) {
      const a=(move.axis+1)%3,b=(move.axis+2)%3,old=v[a];v[a]=v[b];v[b]=-old;
    }
    return state;
  }
  const home=solved();
  const centers=home.filter(s=>s.color!=='gray');
  const slots=new Map(centers.map((s,i)=>[key(s),i]));
  function encode(state) {
    const out=Array(16);
    for(const s of state){const i=slots.get(key(s));if(i!==undefined)out[i]=s.face;}
    return out.join('');
  }
  const goal=encode(home);
  const moves=['Rw','3Rw','U'].flatMap((base,axis)=>['',"'",'2'].map((suffix,turn)=>{
    const text=base+suffix,moved=apply(solved(),parse(text)),permutation=Array(16);
    for(let i=0;i<home.length;i++)if(slots.has(key(home[i])))permutation[slots.get(key(moved[i]))]=slots.get(key(home[i]));
    return {text,axis,inverse:axis*3+[1,0,2][turn],permutation};
  }));
  // Cube-left columns: physical x=-1 on F, D, B (B looks reversed from outside).
  const bars=['F','D','B'].map(face=>centers.map((s,i)=>s.face===face&&s.p[0]===-1?i:-1).filter(i=>i>=0));
  function visible(state,face) {
    const [axis,sign]=faces[face],out=Array(16).fill('gray');
    for(const s of state)if(s.n[axis]===sign){
      const row=face==='U'?(s.p[2]+3)/2:face==='D'?(3-s.p[2])/2:(3-s.p[1])/2;
      const col=face==='B'?(3-s.p[0])/2:(s.p[0]+3)/2;
      out[row*4+col]=s.color;
    }
    return out;
  }
  return {solved,parse,apply,encode,visible,goal,moves,bars,example:"Rw U 3Rw U' 3Rw' Rw'"};
}

function searchFour(config, progress=()=>{}) {
  const {start,goal,moves,bars,maxDepth=14,maxMs=30000}=config;
  const began=Date.now();let visited=0,completed=-1;
  if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>24||!Number.isFinite(maxMs)||maxMs<1)throw Error('Invalid search limits.');
  if(start.length!==16 || [...'UFDB'].some(c=>[...start].filter(v=>v===c).length!==4))throw Error('Invalid L4C state.');
  const advance=(state,move)=>move.permutation.map(i=>state[i]).join('');
  const timeout={};
  function check(){if(Date.now()-began>=maxMs)throw timeout;}
  function half(state){return bars.every(bar=>bar.every(i=>state[i]===goal[i]));}
  try {
    // Phase 2 is small enough to solve completely: Rw/U leave FL/DL/BL fixed.
    progress('Preparing exact phase-2 distances...');
    const finish=new Map([[goal,{distance:0,next:-1}]]),queue=[goal];
    for(let i=0;i<queue.length;i++) {
      if((i&255)===0)check();
      const state=queue[i],distance=finish.get(state).distance;
      for(let g=0;g<moves.length;g++)if(moves[g].axis!==1){
        const next=advance(state,moves[g]);if(finish.has(next))continue;
        finish.set(next,{distance:distance+1,next:moves[g].inverse});queue.push(next);
      }
    }
    // Admissible lower bounds: exact single-color distances in the full move set.
    const masks=[];for(let a=0;a<13;a++)for(let b=a+1;b<14;b++)for(let c=b+1;c<15;c++)for(let d=c+1;d<16;d++)masks.push((1<<a)|(1<<b)|(1<<c)|(1<<d));
    const index=new Map(masks.map((m,i)=>[m,i]));
    const transitions=moves.map(move=>Uint16Array.from(masks,mask=>index.get(move.permutation.reduce((v,from,to)=>v|((mask>>from&1)<<to),0))));
    const maskOf=(state,color)=>[...state].reduce((m,c,i)=>m|(c===color?1<<i:0),0);
    const distances=[...'UFDB'].map(color=>{
      const distances=new Uint8Array(masks.length).fill(255),seed=index.get(maskOf(goal,color)),q=[seed];distances[seed]=0;
      for(let n=0;n<q.length;n++)for(const t of transitions){const next=t[q[n]];if(distances[next]===255){distances[next]=distances[q[n]]+1;q.push(next);}}
      return distances;
    });
    const heuristic=state=>Math.max(...[...'UFDB'].map((color,i)=>distances[i][index.get(maskOf(state,color))]));
    function suffix(state){const out=[];while(state!==goal){const g=finish.get(state).next;out.push(g);state=advance(state,moves[g]);}return out;}
    const path=[];
    for(let bound=heuristic(start);bound<=maxDepth;bound++) {
      check();progress(`Searching ${bound} total moves; ${finish.size.toLocaleString()} phase-2 states ready.`);
      const failures=new Set();let answer=null;
      function visit(state,remaining,previous) {
        visited++;if((visited&1023)===0)check();
        if(heuristic(state)>remaining)return false;
        const ending=finish.get(state);
        if(ending && ending.distance<=remaining) {answer={phase1:[...path],phase2:suffix(state),intermediate:state};return true;}
        if(remaining===0)return false;
        const key=state+'/'+remaining+'/'+previous;if(failures.has(key))return false;
        for(let g=0;g<moves.length;g++) {
          if(moves[g].axis===previous)continue;
          path.push(g);if(visit(advance(state,moves[g]),remaining-1,moves[g].axis))return true;path.pop();
        }
        failures.add(key);return false;
      }
      if(visit(start,bound,-1)) {
        if(!half(answer.intermediate))throw Error('Phase boundary verification failed.');
        const all=[...answer.phase1,...answer.phase2];
        let replay=start;for(const g of all)replay=advance(replay,moves[g]);if(replay!==goal)throw Error('Solution replay failed.');
        return {status:'solved',count:all.length,moves:all.map(g=>moves[g].text).join(' '),phase1:answer.phase1.map(g=>moves[g].text).join(' '),phase2:answer.phase2.map(g=>moves[g].text).join(' '),visited,phase2States:finish.size,elapsedMs:Date.now()-began};
      }
      completed=bound;
    }
    return {status:'limit',reason:'depth',completed,visited};
  }catch(error){if(error!==timeout)throw error;return {status:'limit',reason:'time',completed,visited};}
}

function mountFour(root) {
  const section=root.querySelector('#four-solver'),find=s=>section.querySelector(s),model=createFourModel();
  const input=find('textarea'),status=find('.four-status'),results=find('.four-results');
  let current=model.solved(),worker=null;
  function draw(state){
    for(const face of ['U','F','D','B']){
      const target=find(`[data-four-face="${face}"]`);target.replaceChildren();
      const colors=model.visible(state,face);
      for(const color of colors){const tile=document.createElement('div');tile.className='piece '+color;tile.setAttribute('aria-hidden','true');tile.style.background={gray:'#707985',green:'#23ad64',orange:'#ff8a26',blue:'#348bea',red:'#e25353'}[color];target.append(tile);}
      target.setAttribute('aria-label',face+' face, rows left to right: '+colors.join(', '));
    }
  }
  function stop(){worker?.terminate();worker=null;find('[data-four="cancel"]').hidden=true;find('[data-four="solve"]').disabled=false;}
  function apply(){const next=model.apply(model.solved(),model.parse(input.value));stop();current=next;draw(current);results.replaceChildren();input.removeAttribute('aria-invalid');status.textContent='Scramble applied. L/R centers and FL/DL/BL edges are preserved.';}
  find('form').addEventListener('submit',event=>{event.preventDefault();try{apply();}catch(e){status.textContent=e.message;input.setAttribute('aria-invalid','true');}});
  find('[data-four="example"]').addEventListener('click',()=>{input.value=model.example;apply();});
  find('[data-four="cancel"]').addEventListener('click',()=>{stop();status.textContent='Search cancelled.';});
  find('[data-four="solve"]').addEventListener('click',()=>{
    stop();results.replaceChildren();
    const maxDepth=Number(find('[data-four="depth"]').value),maxMs=Number(find('[data-four="seconds"]').value)*1000;
    if(!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>24||![10000,30000,60000].includes(maxMs)){status.textContent='Choose 0-24 moves and a listed time limit.';return;}
    const code=searchFour.toString()+`\nonmessage=({data})=>{try{postMessage({result:searchFour(data,text=>postMessage({progress:text}))});}catch(e){postMessage({error:e.message});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    try{worker=new Worker(url);}catch(e){status.textContent='Could not start search: '+e.message;return;}finally{URL.revokeObjectURL(url);}
    find('[data-four="solve"]').disabled=true;find('[data-four="cancel"]').hidden=false;status.textContent='Preparing two-phase search...';
    worker.onerror=e=>{stop();status.textContent='Search error: '+e.message;};
    worker.onmessage=({data})=>{
      if(data.progress){status.textContent=data.progress;return;}stop();
      if(data.error){status.textContent=data.error;return;}
      const result=data.result;
      if(result.status!=='solved'){status.textContent=`Search limit reached (${result.reason}). Completed through ${result.completed<0?'no full bound':result.completed+' moves'}; ${result.visited.toLocaleString()} search visits. Optimality is not established.`;return;}
      const replay=model.apply(structuredClone(current),model.parse(result.moves));
      if(model.encode(replay)!==model.goal){status.textContent='Solution verification failed.';return;}
      status.textContent=`${result.count} moves, optimal within Rw/3Rw/U (primes and doubles count as one). ${result.visited.toLocaleString()} search visits; ${(result.elapsedMs/1000).toFixed(2)}s.`;
      const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
      for(const [title,text] of [['Complete solution',result.moves],['Phase 1: correct FL / DL / BL bars',result.phase1],['Phase 2: finish with Rw / U',result.phase2]]){
        const heading=make('h3',title),algorithm=make('code',text||'No moves needed');algorithm.className='case-algorithm';results.append(heading,algorithm);
      }
      for(const [label,moves] of [['Preview half centers',result.phase1],['Preview solved',result.moves],['Show scrambled case','']]){
        const button=make('button',label);button.type='button';button.addEventListener('click',()=>draw(model.apply(structuredClone(current),model.parse(moves))));results.append(button);
      }
    };
    worker.postMessage({start:model.encode(current),goal:model.goal,moves:model.moves,bars:model.bars,maxDepth,maxMs});
  });
  draw(current);
}
if(typeof module!=='undefined')module.exports={createFourModel,searchFour};
