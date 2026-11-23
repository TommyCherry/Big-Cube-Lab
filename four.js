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
      const m=/^(Rw|3Rw|l|U)(2'?|')?$/.exec(token);
      if(!m)throw Error(`Invalid move ${i+1}: ${token}. Use only Rw, 3Rw, l, U, primes and doubles.`);
      const turns=m[2]?.startsWith('2')?2:m[2]==="'"?3:1;
      if(m[1]==='l')return {axis:0,sequence:m[2]?.startsWith('2')?['Rw2','3Rw2']:m[2]==="'"?["Rw'",'3Rw']:["3Rw'",'Rw'],turns};
      return {axis:m[1]==='U'?1:0,width:m[1]==='U'?1:m[1]==='Rw'?2:3,sign:1,turns};
    });
  }
  function apply(state,moves) {
    for(const move of moves)if(move.sequence)apply(state,parse(move.sequence.join(' ')));
    else for(const s of state)if(s.p[move.axis]>=5-2*move.width)for(let t=0;t<move.turns;t++)for(const v of [s.p,s.n]) {
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
  const moves=[['Rw',0],['3Rw',0],['U',1],['l',0]].flatMap(([base,axis])=>['',"'",'2'].map((suffix,turn)=>{
    const text=base+suffix,moved=apply(solved(),parse(text)),permutation=Array(16);
    for(let i=0;i<home.length;i++)if(slots.has(key(home[i])))permutation[slots.get(key(moved[i]))]=slots.get(key(home[i]));
    return {text,base,axis,phase2:base==='Rw'||base==='U',permutation,inverse:-1};
  }));
  for(let i=0;i<moves.length;i++){
    const move=moves[i];
    const base=move.text.replace(/['2]$/,'');
    const inverseText=move.text.endsWith("'")?base:move.text.endsWith('2')?move.text:base+"'";
    move.inverse=moves.findIndex(candidate=>candidate.text===inverseText);
  }
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
  const {start,goal,moves,bars,mode='global',firstCenter='any',maxDepth=Infinity,maxMs=Infinity}=config;
  if(!['global','half','first-center'].includes(mode))throw Error('Invalid solution mode.');
  if(!['any','U','F','D','B'].includes(firstCenter))throw Error('Invalid first center.');
  const began=Date.now();let visited=0,completed=-1;
  if((maxDepth!==Infinity&&(!Number.isInteger(maxDepth)||maxDepth<0))||(maxMs!==Infinity&&(!Number.isFinite(maxMs)||maxMs<1)))throw Error('Invalid search limits.');
  if(start.length!==16 || [...'UFDB'].some(c=>[...start].filter(v=>v===c).length!==4))throw Error('Invalid L4C state.');
  const advance=(state,move)=>move.permutation.map(i=>state[i]).join('');
  const timeout={};
  function check(){if(Date.now()-began>=maxMs)throw timeout;}
  // Only cyclic rotations around the fixed L/R axis preserve the color scheme.
  const belt='UFDB';
  const goals=mode==='half'?Array.from({length:4},(_,shift)=>[...goal].map(c=>belt[(belt.indexOf(c)+shift)%4]).join('')):[goal];
  function half(state){return goals.some(target=>bars.every(bar=>bar.every(i=>state[i]===target[i])));}
  try {
    // Phase 2 is small enough to solve completely: Rw/U leave FL/DL/BL fixed.
    progress('Preparing exact phase-2 distances...');
    const finish=new Map(goals.map(target=>[target,{distance:0,next:-1}])),queue=[...goals];
    for(let i=0;i<queue.length;i++) {
      if((i&255)===0)check();
      const state=queue[i],distance=finish.get(state).distance;
      for(let g=0;g<moves.length;g++)if(moves[g].phase2){
        const next=advance(state,moves[g]);if(finish.has(next))continue;
        finish.set(next,{distance:distance+1,next:moves[g].inverse});queue.push(next);
      }
    }
    // Admissible lower bounds: exact single-color distances in the full move set.
    const masks=[];for(let a=0;a<13;a++)for(let b=a+1;b<14;b++)for(let c=b+1;c<15;c++)for(let d=c+1;d<16;d++)masks.push((1<<a)|(1<<b)|(1<<c)|(1<<d));
    const index=new Map(masks.map((m,i)=>[m,i]));
    const transitions=moves.map(move=>Uint16Array.from(masks,mask=>index.get(move.permutation.reduce((v,from,to)=>v|((mask>>from&1)<<to),0))));
    const maskOf=(state,color)=>[...state].reduce((m,c,i)=>m|(c===color?1<<i:0),0);
    function patternDistances(seeds) {
      const distances=new Uint8Array(masks.length).fill(255),q=[...seeds];
      for(const seed of seeds)distances[seed]=0;
      for(let n=0;n<q.length;n++){
        if((n&255)===0)check();
        for(const t of transitions){const next=t[q[n]];if(distances[next]===255){distances[next]=distances[q[n]]+1;q.push(next);}}
      }
      return distances;
    }
    const colors=[...'UFDB'];
    const distances=colors.map(color=>patternDistances([index.get(maskOf(goal,color))]));
    const heuristic=state=>Math.max(...[...'UFDB'].map((color,i)=>distances[i][index.get(maskOf(state,color))]));
    function suffix(state){const out=[];while(finish.get(state).distance>0){const g=finish.get(state).next;out.push(g);state=advance(state,moves[g]);}return out;}
    function resultFor(answer) {
      const all=[...answer.phase1,...answer.phase2];
      let replay=start;for(const g of all)replay=advance(replay,moves[g]);
      if(!goals.includes(replay))throw Error('Solution replay failed.');
      const format=indices=>indices.map(g=>moves[g].text).join(' ');
      const solvedFirst=colors.find(color=>(firstCenter==='any'||color===firstCenter)&&maskOf(answer.intermediate,color)===maskOf(goal,color));
      return {status:'solved',mode,goal:replay,firstCenter:mode==='first-center'?solvedFirst:null,
        count:all.length,moves:format(all),phase1:format(answer.phase1),phase2:format(answer.phase2),
        phase1Count:answer.phase1.length,phase2Count:answer.phase2.length,
        visited,phase2States:finish.size,elapsedMs:Date.now()-began};
    }
    let searchStart=start,prefix=[];
    if(mode!=='global') {
      const candidates=colors.filter(color=>firstCenter==='any'||color===firstCenter);
      const partialPatterns=new Map();
      const halfDistances=mode==='half'?goals.map(target=>colors.map(color=>{
        const required=bars.flat().reduce((mask,i)=>mask|(target[i]===color?1<<i:0),0);
        if(!partialPatterns.has(required))partialPatterns.set(required,
          patternDistances(masks.flatMap((mask,i)=>(mask&required)===required?[i]:[])));
        return partialPatterns.get(required);
      })):null;
      // Min over complete orientations; max over colors within each orientation.
      const stageHeuristic=state=>mode==='half'
        ?Math.min(...halfDistances.map(patterns=>Math.max(...colors.map((color,i)=>patterns[i][index.get(maskOf(state,color))]))))
        :Math.min(...candidates.map(color=>distances[colors.indexOf(color)][index.get(maskOf(state,color))]));
      const stageGoal=state=>mode==='half'?half(state)
        :candidates.some(color=>maskOf(state,color)===maskOf(goal,color));
      const stagePath=[];let endpoint=null;
      for(let bound=stageHeuristic(start);bound<=maxDepth;bound++){
        check();progress(`Searching ${bound} moves to ${mode==='half'?'half centers':'the first full center'}...`);
        const failures=new Set();
        function visitStage(state,remaining,previous){
          visited++;if((visited&1023)===0)check();
          if(stageHeuristic(state)>remaining)return false;
          if(stageGoal(state)){endpoint=state;return true;}
          if(remaining===0)return false;
          const key=state+'/'+remaining+'/'+previous;if(failures.has(key))return false;
          for(let g=0;g<moves.length;g++){
            if(moves[g].base===previous)continue;
            stagePath.push(g);
            if(visitStage(advance(state,moves[g]),remaining-1,moves[g].base))return true;
            stagePath.pop();
          }
          failures.add(key);return false;
        }
        if(visitStage(start,bound,null))break;
        completed=bound;
      }
      if(endpoint===null)return {status:'limit',reason:'depth',completed,visited};
      prefix=[...stagePath];searchStart=endpoint;completed=-1;
      if(mode==='half'){
        if(!finish.has(endpoint))throw Error('Half-center endpoint cannot be finished with Rw/U.');
        const phase2=suffix(endpoint);
        if(prefix.length+phase2.length>maxDepth)return {status:'limit',reason:'depth',completed,visited};
        return resultFor({phase1:prefix,phase2,intermediate:endpoint});
      }
    }
    const path=[];
    for(let bound=heuristic(searchStart);bound<=maxDepth-prefix.length;bound++) {
      check();progress(`Searching ${bound} ${mode==='global'?'total':'remaining'} moves; ${finish.size.toLocaleString()} phase-2 states ready.`);
      const failures=new Set();let answer=null;
      function visit(state,remaining,previous) {
        visited++;if((visited&1023)===0)check();
        if(heuristic(state)>remaining)return false;
        const ending=finish.get(state);
        if(ending && ending.distance<=remaining) {answer={phase1:[...path],phase2:suffix(state),intermediate:state};return true;}
        if(remaining===0)return false;
        const key=state+'/'+remaining+'/'+previous;if(failures.has(key))return false;
        for(let g=0;g<moves.length;g++) {
          // Only repeated turns of the same generator combine into one turn.
          // Different generators on the same axis must remain searchable.
          if(moves[g].base===previous)continue;
          path.push(g);if(visit(advance(state,moves[g]),remaining-1,moves[g].base))return true;path.pop();
        }
        failures.add(key);return false;
      }
      if(visit(searchStart,bound,-1)) {
        if(!half(answer.intermediate))throw Error('Phase boundary verification failed.');
        if(mode==='first-center')answer={phase1:prefix,phase2:[...answer.phase1,...answer.phase2],intermediate:searchStart};
        return resultFor(answer);
      }
      completed=bound;
    }
    return {status:'limit',reason:'depth',completed,visited};
  }catch(error){if(error!==timeout)throw error;return {status:'limit',reason:'time',completed,visited};}
}

function generateFourScramble(model, length=24, random=Math.random) {
  if(!Number.isInteger(length)||length<1||length>40)throw Error('Invalid random scramble length.');
  if(typeof random!=='function')throw Error('Invalid random source.');
  for(let attempt=0;attempt<20;attempt++){
    const tokens=[];
    let previousAxis=-1;
    for(let i=0;i<length;i++){
      const choices=model.moves.filter(move=>move.axis!==previousAxis);
      const index=Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)));
      const move=choices[index];
      tokens.push(move.text);
      previousAxis=move.axis;
    }
    const scramble=tokens.join(' ');
    if(model.encode(model.apply(model.solved(),model.parse(scramble)))!==model.goal)return scramble;
  }
  throw Error('Could not generate a nonsolved random case.');
}

function mountFour(root) {
  const section=root.querySelector('#four-solver'),find=s=>section.querySelector(s),model=createFourModel();
  const input=find('textarea'),status=find('.four-status'),results=find('.four-results');
  let current=model.solved(),worker=null;
  function draw(state){
    for(const face of ['U','F','D','B']){
      const target=find(`[data-four-face="${face}"]`);target.replaceChildren();
      const visible=model.visible(state,face);
      // Mirror B horizontally so cube-left bars align down the center strip.
      const indices=face==='B'?[6,5,10,9]:[5,6,9,10];
      const colors=indices.map(index=>visible[index]);
      for(const color of colors){const tile=document.createElement('div');tile.className='piece '+color;tile.setAttribute('aria-hidden','true');target.append(tile);}
      target.setAttribute('aria-label',face+' center'+(face==='B'?' (mirrored left/right)':'')+', rows left to right: '+colors.join(', '));
    }
  }
  function stop(){worker?.terminate();worker=null;find('[data-four="cancel"]').hidden=true;find('[data-four="solve"]').disabled=false;}
  function apply(){const next=model.apply(model.solved(),model.parse(input.value));stop();current=next;draw(current);results.replaceChildren();input.removeAttribute('aria-invalid');status.textContent='Scramble applied. L/R centers and FL/DL/BL edges are preserved.';}
  find('form').addEventListener('submit',event=>{event.preventDefault();try{apply();}catch(e){status.textContent=e.message;input.setAttribute('aria-invalid','true');}});
  find('[data-four="example"]').addEventListener('click',()=>{input.value=model.example;apply();});
  find('[data-four="random"]').addEventListener('click',()=>{
    input.value=generateFourScramble(model);
    try{apply();    status.textContent='Random 24-move 4x4 L4C case applied. Rw/3Rw/l/U moves preserve the L/R centers and F3E.';}
    catch(e){status.textContent=e.message;input.setAttribute('aria-invalid','true');}
  });
  function updateMode(){
    stop();results.replaceChildren();draw(current);
    const mode=find('[data-four="mode"]').value;
    find('[data-four="mode-help"]').textContent={
      global:'Minimize the total number of moves across the entire solution.',
      half:'Take a shortest route to FL, DL and BL half-center bars in any valid rotated color order, then the shortest Rw/U finish in that orientation. The total is not necessarily globally optimal.',
      'first-center':'Solve whichever center takes the fewest moves, then find the shortest finish from that state. The finish may temporarily disturb the first center. The total is not necessarily globally optimal.'
    }[mode];
    status.textContent='Ready to search. You can cancel at any time.';
  }
  find('[data-four="mode"]').addEventListener('change',updateMode);
  find('[data-four="cancel"]').addEventListener('click',()=>{stop();status.textContent='Search cancelled.';});
  find('[data-four="solve"]').addEventListener('click',()=>{
    stop();results.replaceChildren();
    const mode=find('[data-four="mode"]').value;
    const code=searchFour.toString()+`\nonmessage=({data})=>{try{postMessage({result:searchFour(data,text=>postMessage({progress:text}))});}catch(e){postMessage({error:e.message});}};`;
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    try{worker=new Worker(url);}catch(e){status.textContent='Could not start search: '+e.message;return;}finally{URL.revokeObjectURL(url);}
    find('[data-four="solve"]').disabled=true;find('[data-four="cancel"]').hidden=false;status.textContent='Preparing '+{global:'globally optimal',half:'half centers','first-center':'first center'}[mode]+' search...';
    worker.onerror=e=>{stop();status.textContent='Search error: '+e.message;};
    worker.onmessage=({data})=>{
      if(data.progress){status.textContent=data.progress;return;}stop();
      if(data.error){status.textContent=data.error;return;}
      const result=data.result;
      if(result.status!=='solved'){status.textContent=`Search limit reached (${result.reason}). Completed through ${result.completed<0?'no full bound':result.completed+' moves'}; ${result.visited.toLocaleString()} search visits. Optimality is not established.`;return;}
      const replay=model.apply(structuredClone(current),model.parse(result.moves));
      if(model.encode(replay)!==result.goal){status.textContent='Solution verification failed.';return;}
      status.textContent=`${result.count} moves, ${result.mode==='global'?'globally optimal within Rw/3Rw/l/U':'stage-optimal ('+result.phase1Count+' + '+result.phase2Count+'); not a global optimality claim'}. ${result.visited.toLocaleString()} search visits; ${(result.elapsedMs/1000).toFixed(2)}s.`;
      const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
      if(result.mode==='half'){
        const names={U:'green',F:'orange',D:'blue',B:'red'};
        results.append(make('p','Solved orientation: '+[...'UFDB'].map(face=>face+' = '+names[result.goal[model.goal.indexOf(face)]]).join(', ')+'.'));
      }
      const steps=[['Complete solution',result.moves]];
      if(result.mode!=='global')steps.push(
        [result.mode==='half'?'Stage 1: FL / DL / BL half centers':'Stage 1: full '+result.firstCenter+' center',result.phase1],
        [result.mode==='half'?'Stage 2: finish with Rw / U':'Stage 2: solve the remaining centers',result.phase2]);
      for(const [title,text] of steps){
        const heading=make('h3',title),algorithm=make('code',text||'No moves needed');algorithm.className='case-algorithm';results.append(heading,algorithm);
      }
      const previews=[['Preview solved',result.moves],['Show scrambled case','']];
      if(result.mode!=='global')previews.unshift([result.mode==='half'?'Preview half centers':'Preview first center',result.phase1]);
      for(const [label,moves] of previews){
        const button=make('button',label);button.type='button';button.addEventListener('click',()=>draw(model.apply(structuredClone(current),model.parse(moves))));results.append(button);
      }
    };
    worker.postMessage({start:model.encode(current),goal:model.goal,moves:model.moves,bars:model.bars,mode});
  });
  draw(current);
}
if(typeof module!=='undefined')module.exports={createFourModel,searchFour,generateFourScramble};
