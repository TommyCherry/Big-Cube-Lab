function createFirstCenterModel() {
  const faces={U:[1,1],L:[0,-1],F:[2,1],R:[0,1],B:[2,-1],D:[1,-1]};
  const colors={U:'green',F:'orange',D:'blue',B:'red',L:'white',R:'yellow'};
  const key=s=>s.p.join(',')+'/'+s.n.join(',');
  function solved(){return CubeModel.solved().map(s=>({...s,color:colors[Object.keys(faces).find(f=>s.n[faces[f][0]]===faces[f][1])]}));}
  function parse(text){
    const tokens=text.trim().replace(/[\u2019\u2032]/g,"'").split(/\s+/).filter(Boolean);
    if(tokens.some(t=>! /^[URFDLB](w)?(2'?|')?$/.test(t)))throw Error('Use outer and two-layer wide turns, such as R, Rw, U2 or Fw\'.');
    return CubeModel.parse(tokens.join(' '));
  }
  const apply=CubeModel.apply,home=solved();
  const centers=home.filter(s=>s.p.filter(v=>Math.abs(v)===2).length===1&&s.p.some(v=>Math.abs(v)===1));
  const orbits=[centers.filter(s=>s.p.filter(v=>Math.abs(v)===1).length===2),centers.filter(s=>s.p.includes(0))];
  const indices=orbits.map(orbit=>new Map(orbit.map((s,i)=>[key(s),i])));
  const moves=Object.keys(faces).flatMap(face=>['','w'].flatMap(w=>['',"'",'2'].map(suffix=>{
    const text=face+w+suffix,move=parse(text)[0];
    return {text,base:face+w,axis:move.axis,perms:orbits.map((orbit,o)=>orbit.map(s=>indices[o].get(key(apply(structuredClone([s]),[move])[0]))))};
  })));
  function visible(state,face){
    const [axis,sign]=faces[face],out=Array(25);
    for(const s of state)if(s.n[axis]===sign){const [x,y,z]=s.p,row=(face==='U'?z:face==='D'?-z:-y)+2,col=(face==='B'?-x:face==='L'?z:face==='R'?-z:x)+2;out[row*5+col]=s;}
    return out;
  }
  const maskFor=(face,cells)=>orbits.map((orbit,o)=>orbit.reduce((mask,s,i)=>{
    if(s.n[faces[face][0]]!==faces[face][1])return mask;
    const cell=visible(home,face).findIndex(t=>key(t)===key(s));return cells.includes(cell)?mask|(1<<i):mask;
  },0));
  function plans(face,method){
    const at=(r,c)=>(r+1)*5+c+1,plans=[];
    if(method==='optimal')return [[maskFor(face,[6,7,8,11,12,13,16,17,18])]];
    if(method==='bars')for(const vertical of [false,true])for(const side of [0,2]){
      const bar=n=>[0,1,2].map(k=>vertical?at(k,n):at(n,k));
      plans.push([maskFor(face,bar(1)),maskFor(face,[...bar(1),...bar(side)]),maskFor(face,[6,7,8,11,12,13,16,17,18])]);
    }
    else for(const r of [0,1])for(const c of [0,1])for(const extendRows of [false,true]){
      const block=[at(r,c),at(r+1,c),at(r,c+1),at(r+1,c+1)];
      const rectangle=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(extendRows?(x===c||x===c+1):(y===r||y===r+1))rectangle.push(at(y,x));
      plans.push([maskFor(face,block),maskFor(face,rectangle),maskFor(face,[6,7,8,11,12,13,16,17,18])]);
    }
    return plans;
  }
  function config(state,selected,methods){
    return {moves,candidates:Object.entries(colors).filter(([,color])=>selected.includes(color)).flatMap(([face,color])=>methods.map(method=>({face,color,method,plans:plans(face,method),start:indices.map(index=>state.reduce((mask,s)=>s.color===color&&index.has(key(s))?mask|(1<<index.get(key(s))):mask,0))}))) };
  }
  return {solved,parse,apply,visible,config,colors,moves};
}
if(typeof module!=='undefined')module.exports={createFirstCenterModel};

function mountFirstCenter(root) {
  const section=root.querySelector('#first-center'),find=name=>section.querySelector(`[data-first-center="${name}"]`),model=createFirstCenterModel();
  let current=model.solved(),worker=null,url=null,serial=0;
  const status=find('status'),results=find('results'),input=find('scramble');
  function stop(){serial++;if(worker)worker.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;find('solve').disabled=false;find('cancel').hidden=true;}
  function render(state){
    for(const face of Object.keys(model.colors)){
      const grid=section.querySelector(`[data-first-face="${face}"]`);grid.replaceChildren();
      const stickers=model.visible(state,face);for(const sticker of stickers){const tile=document.createElement('span');tile.className='piece f3e-'+sticker.color;tile.setAttribute('aria-hidden','true');grid.append(tile);}
      grid.setAttribute('aria-label',`${face} face: ${stickers.map(s=>s.color).join(', ')}`);
    }
  }
  function clear(message){stop();results.replaceChildren();render(current);find('preview-status').textContent='Scrambled state.';status.textContent=message;}
  function apply(){try{const next=model.apply(model.solved(),model.parse(input.value));current=next;clear('Scramble applied. Choose colors and an approach, then find solutions.');}catch(e){status.textContent=e.message;}}
  section.querySelector('form').addEventListener('submit',event=>{event.preventDefault();apply();});
  find('random').addEventListener('click',()=>{
    const tokens=[];let axis=-1;for(let i=0;i<60;i++){const allowed=model.moves.filter(m=>m.axis!==axis),move=allowed[Math.floor(Math.random()*allowed.length)];tokens.push(move.text);axis=move.axis;}
    input.value=tokens.join(' ');apply();
  });
  find('reset').addEventListener('click',()=>{input.value='';current=model.solved();clear('Reset to solved.');});
  for(const name of ['colors','method','time'])find(name).addEventListener('change',()=>clear('Options changed. Find solutions to compare the selected routes.'));
  find('cancel').addEventListener('click',()=>{stop();status.textContent='Search cancelled. No completed comparison.';});
  const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  find('solve').addEventListener('click',()=>{
    clear('Starting first-center search...');
    const selected=find('colors').value==='all'?Object.values(model.colors):find('colors').value.split('/');
    const methods=find('method').value==='both'?['bars','block']:[find('method').value];
    const config={...model.config(current,selected,methods),timeoutMs:Number(find('time').value)*1000},start=structuredClone(current),id=serial;
    const source=searchFirstCenter.toString()+`;onmessage=e=>{try{postMessage({result:searchFirstCenter(e.data,text=>postMessage({progress:text}))});}catch(error){postMessage({error:error.message});}};`;
    try{
      url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);find('solve').disabled=true;find('cancel').hidden=false;
      worker.onmessage=event=>{
        if(id!==serial)return;
        if(event.data.progress){status.textContent=event.data.progress;return;}
        stop();if(event.data.error){status.textContent=event.data.error;return;}
        const answer=event.data.result;
        try{
          // Independently replay every stage against the full 150-sticker model.
          for(const route of answer.routes){
            let replay=structuredClone(start);const candidate=config.candidates.find(c=>c.color===route.color&&c.method===route.method);let plans=candidate.plans;
            if(route.stages.length!==candidate.plans[0].length)throw Error('Invalid solution stage count.');
            for(let i=0;i<route.stages.length;i++){
              const stage=route.stages[i];model.apply(replay,model.parse(stage.moves));
              const masks=model.config(replay,[route.color],[route.method]).candidates[0].start;
              plans=plans.filter(plan=>plan[i].every((goal,o)=>(masks[o]&goal)===goal));
              if(!plans.length||model.parse(stage.moves).length!==stage.count)throw Error('Stage replay failed.');
            }
            const face=model.visible(replay,route.face);if(![6,7,8,11,12,13,16,17,18].every(i=>face[i].color===route.color))throw Error('First-center replay failed.');
          }
          const global=methods[0]==='optimal';
          const summary=global
            ?(answer.status==='complete'&&answer.optimal?`Proven globally shortest solution among all ${selected.length} selected color${selected.length===1?'':'s'}.`:'Time limit reached before proving a globally optimal solution. Try a longer time budget or fewer colors.')
            :(answer.status==='complete'?'Comparison complete. Best completed staged route shown first.':'Time limit reached; comparison incomplete. Completed routes shown below are not a full color-neutral comparison.');
          status.textContent=`${summary} ${global?'':`${answer.routes.length}/${config.candidates.length} routes; `}${answer.visited.toLocaleString()} search visits; ${(answer.prunedUnchanged||0).toLocaleString()} unchanged-color moves pruned; ${(answer.elapsedMs/1000).toFixed(2)} seconds.`;
          for(const [rank,route] of answer.routes.entries()){
            const card=make('section','');card.className='first-center-result';
            card.append(make('h3',`${rank+1}. ${route.color} on ${route.face} - ${route.count} moves`),make('p',route.method==='optimal'?'Globally optimal - no bar or block stages required':route.method==='bars'?'Center bar -> second bar -> last bar':'2x2 block -> 2x3 block -> last bar'),make('code',route.moves||'Already solved.'));
            const reset=make('button','Preview scramble');reset.type='button';reset.addEventListener('click',()=>{render(start);find('preview-status').textContent='Scrambled state.';});card.append(reset);
            const names=route.method==='optimal'?['Solved center']:route.method==='bars'?['Center bar','Second bar','Last bar']:['2x2 block','2x3 block','Last bar'];
            route.stages.forEach((stage,i)=>{
              const row=make('div',''),button=make('button',route.method==='optimal'?'Preview solution':`Preview stage ${i+1}`);button.type='button';
              row.append(make('p',`${i+1}. ${names[i]}: ${stage.count} moves (${route.method==='optimal'?'globally optimal':'stage optimal'})`),make('code',stage.moves||'Already complete.'),button);
              button.addEventListener('click',()=>{const state=structuredClone(start);for(const s of route.stages.slice(0,i+1))model.apply(state,model.parse(s.moves));render(state);find('preview-status').textContent=`${route.color} on ${route.face}: after ${names[i].toLowerCase()}.`;});card.append(row);
            });results.append(card);
          }
        }catch(e){results.replaceChildren();status.textContent=e.message;}
      };
      worker.onerror=()=>{if(id!==serial)return;stop();status.textContent='Search worker failed. Try again.';};worker.postMessage(config);
    }catch(e){stop();status.textContent='Unable to start search: '+e.message;}
  });
  render(current);
}
