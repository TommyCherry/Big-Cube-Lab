// Classify the pairing relation, not the permutation relative to solved slots.
// Each edge type occurs twice and joins the slots holding its two wings.
// Every slot has degree two, so each component is a cycle (including loops).
function classifyL8EPairs(pairs) {
  if (pairs.length !== 8 || new Set(pairs.map(p => p.slot)).size !== 8) throw Error('Expected eight distinct dedge slots.');
  const locations = new Map();
  for (const pair of pairs) {
    if (pair.types.length !== 2) throw Error('Expected two wings per dedge.');
    for (const type of pair.types) {
      if (!locations.has(type)) locations.set(type, []);
      locations.get(type).push(pair.slot);
    }
  }
  if (locations.size !== 8 || [...locations.values()].some(slots => slots.length !== 2)) throw Error('Expected two wings of each of eight edge types.');
  const bySlot = new Map(pairs.map(pair => [pair.slot, pair])), visited = new Set(), cycles = [];
  for (const start of pairs) {
    if (visited.has(start.slot)) continue;
    const pending = [start.slot], slots = [], types = new Set();
    while (pending.length) {
      const slot = pending.pop();
      if (visited.has(slot)) continue;
      visited.add(slot); slots.push(slot);
      for (const type of bySlot.get(slot).types) {
        types.add(type);
        pending.push(...locations.get(type));
      }
    }
    cycles.push({size: slots.length, slots: slots.sort(), types: [...types].sort()});
  }
  cycles.sort((a,b) => b.size-a.size || a.slots.join(',').localeCompare(b.slots.join(',')));
  return {cycles, signature: cycles.map(c => c.size+'E').join(' '), pairedCount: cycles.filter(c => c.size===1).length};
}

// L8E drawing, verified csTimer scramble adapter and pairing-search interface.
function createL8EModel() {
  const cube = createF3EModel();
  const faces = { U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1], R: [0, 1], L: [0, -1] };
  function parse(text) {
    return text.trim().replace(/[\u2019\u2032]/g, "'").split(/\s+/).filter(Boolean).map((token, i) => {
      const rotation=/^([xyz])(2'?|')?$/.exec(token);
      if(rotation)return {axis:{x:0,y:1,z:2}[rotation[1]],sign:1,width:4,turns:rotation[2]?.startsWith('2')?2:rotation[2]==="'"?3:1,rotation:true};
      const match = /^(?:(2|3)?([UDFBRL])w|([UDFBRL]))(2'?|')?$/.exec(token);
      if (!match) throw Error(`Invalid move ${i + 1}: ${token}. Use face turns, wide turns (Rw, 3Rw), or x/y/z rotations, with primes or doubles.`);
      const face = match[2] || match[3], width = match[2] ? Number(match[1] || 2) : 1;
      const [axis, sign] = faces[face], turns = match[4]?.startsWith('2') ? 2 : match[4] === "'" ? 3 : 1;
      return { axis, sign, width, turns };
    });
  }
  const home = cube.solved(), positionKey = s => s.p.join(',') + '/' + s.n.join(',');
  const homeColors = new Map(home.map(s => [positionKey(s), s.color]));
  function inspect(state) {
    const boundary = s => s.p.filter(v => Math.abs(v) === 3).length;
    const correct = s => homeColors.get(positionKey(s)) === s.color;
    return {
      centersSolved: state.filter(s => boundary(s) === 1).every(correct),
      crossSolved: state.filter(s => boundary(s) === 2 && s.p[1] === -3).every(correct)
    };
  }
  function classify(state) {
    const validity = inspect(state);
    if (!validity.centersSolved || !validity.crossSolved) return {available:false, reason:'Classification requires all six centers and the four aligned D-cross edges solved.'};
    const slots = ['UF','UR','UB','UL','FR','FL','BR','BL'];
    const wings = new Map();
    for (const sticker of state) {
      if (sticker.p.filter(v => Math.abs(v)===3).length!==2 || sticker.p[1]===-3) continue;
      const key=sticker.p.join(',');
      if(!wings.has(key))wings.set(key,[]);
      wings.get(key).push(sticker);
    }
    const pairs=slots.map(slot=>{
      const pieces=[...wings.values()].filter(piece=>slot.split('').every(face=>{
        const [axis,sign]=faces[face];return piece[0].p[axis]===sign*3;
      }));
      if(pieces.length!==2 || pieces.some(piece=>piece.length!==2))throw Error('Incomplete L8E wing state.');
      const types=pieces.map(piece=>piece.map(s=>s.color).sort().join('-'));
      const aligned=types[0]===types[1] && slot.split('').every(face=>{
        const [axis,sign]=faces[face];
        return pieces[0].find(s=>s.n[axis]===sign)?.color===pieces[1].find(s=>s.n[axis]===sign)?.color;
      });
      return {slot,types,aligned};
    });
    return {available:true, ...classifyL8EPairs(pairs), pairs};
  }
  function searchConfig(state, {allowUpper=false}={}) {
    const report=inspect(state);
    if(!report.centersSolved||!report.crossSolved)throw Error('Solve all six centers and the aligned D cross before searching.');
    const relevant=home.map((s,i)=>({s,i})).filter(({s})=>s.p.filter(v=>Math.abs(v)===3).length===1 || (s.p.filter(v=>Math.abs(v)===3).length===2&&s.p[1]!==-3));
    const indices=new Map(relevant.map(({s},i)=>[positionKey(s),i]));
    const encode=state=>{const out=Array(relevant.length);for(const s of state){const i=indices.get(positionKey(s));if(i!==undefined)out[i]=s.color[0]==='b'?'b':s.color[0];}return out.join('');};
    const centers=relevant.flatMap(({s},i)=>s.p.filter(v=>Math.abs(v)===3).length===1?[i]:[]);
    const pairs=['UF','UR','UB','UL','FR','FL','BR','BL'].map(slot=>slot.split('').flatMap(face=>{
      const [axis,sign]=faces[face];return relevant.flatMap(({s},i)=>s.n[axis]===sign&&slot.split('').every(f=>s.p[faces[f][0]]===faces[f][1]*3)&&s.p.filter(v=>Math.abs(v)===3).length===2?[i]:[]);
    }));
    const macros=[],seen=new Set();
    function add(text,kind){
      const moved=cube.apply(cube.solved(),parse(text));
      if(!inspect(moved).crossSolved)return;
      const permutation=Array(relevant.length);
      for(let from=0;from<relevant.length;from++){const to=indices.get(positionKey(moved[relevant[from].i]));if(to===undefined)return;permutation[to]=from;}
      const key=permutation.join(',');if(seen.has(key))return;seen.add(key);
      let displayText=text;
      if(/\bB/.test(text)) {
        // y sends the old B face to R; y' sends it to L.
        const maps=[{rotation:'y',undo:"y'",faces:{F:'L',R:'F',B:'R',L:'B'}},{rotation:"y'",undo:'y',faces:{F:'R',R:'B',B:'L',L:'F'}}];
        for(const grip of maps){const body=text.replace(/[FRBL]/g,face=>grip.faces[face]);if(!/\bB/.test(body)){displayText=grip.rotation+' '+body+' '+grip.undo;break;}}
      }
      macros.push({text,displayText,kind,count:parse(text).filter(move=>!move.rotation).length,permutation});
    }
    for(const suffix of ['',"'",'2'])add('U'+suffix,'AUF');
    const sliceIndices=[];
    for(const suffix of ['', '2',"'"]){sliceIndices.push(macros.length);add('Uw'+suffix,'Slice');}
    const inverse=text=>text.split(' ').reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
    const belt=['F','R','B','L'];
    const seeds=["R U R'","R U2 R'","R U' R'","R' U R","R' U2 R","R' U' R","Uw' R' F R F' R U' R' Uw"];
    for(let rotation=0;rotation<4;rotation++)for(const seed of seeds){
      const text=seed.replace(/[FRBL]/g,f=>belt[(belt.indexOf(f)+rotation)%4]);
      const kind=seed.startsWith('Uw')?'Slice-flip-slice':'Insert';add(text,kind);add(inverse(text),kind);
    }
    if(allowUpper){
      const upperSeeds=["Rw2 D Rw' U2 Rw D' Rw' U2 Rw'", "x Rw2 D2 Rw U2 Rw' D2 Rw U2 Lw"];
      // Conjugate the complete algorithm so x rotations and Rw/Lw notation
      // remain correct. Every block returns to the original center frame.
      for(const seed of upperSeeds)for(const rotation of ['', 'y', 'y2', "y'"]){
        const text=[rotation,seed,rotation?inverse(rotation):''].filter(Boolean).join(' ');
        add(text,'U-layer pairing');add(inverse(text),'U-layer pairing');
      }
    }
    // Track one same-color sticker on each wing of an edge type. Both stickers
    // must occupy the same face of a dedge to count as paired and aligned.
    const wingStickers=new Map();
    for(const s of state)if(s.p.filter(v=>Math.abs(v)===3).length===2&&s.p[1]!==-3){
      const key=s.p.join(',');if(!wingStickers.has(key))wingStickers.set(key,[]);wingStickers.get(key).push(s);
    }
    const typePositions=new Map();
    for(const wing of wingStickers.values()){
      const sorted=wing.slice().sort((a,b)=>a.color.localeCompare(b.color)),type=sorted.map(s=>s.color).join('-');
      if(!typePositions.has(type))typePositions.set(type,[]);
      typePositions.get(type).push(indices.get(positionKey(sorted[0])));
    }
    const trackedPairs=[...typePositions.values()];
    return {initial:encode(state),goal:encode(home),macros,pairs,centers,sliceIndices,trackedPairs,allowUpper};
  }
  function adaptScramble(raw) {
    // Pinned csTimer 0.1.5 protects the U cross. Its result can have a global
    // center rotation, so restore the reference frame before mapping U to D.
    const queue = [{ state: cube.apply(cube.solved(), parse(raw)), suffix: '' }], seen = new Set();
    let fixed;
    while (queue.length) {
      const candidate = queue.shift();
      const key = cube.encode(candidate.state);
      if (seen.has(key)) continue;
      seen.add(key);
      if (inspect(candidate.state).centersSolved) { fixed = candidate; break; }
      for (const rotation of ["Rw Lw'", "Uw Dw'", "Fw Bw'"]) {
        const copy = candidate.state.map(s => ({ p: s.p.slice(), n: s.n.slice(), color: s.color }));
        queue.push({ state: cube.apply(copy, parse(rotation)), suffix: candidate.suffix + ' ' + rotation });
      }
    }
    if (!fixed) throw Error('Generated scramble does not have solved centers.');
    const faceMap = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' };
    const text = (raw + fixed.suffix).trim().split(/\s+/).map(token => token.replace(/[UDFBRL]/, face => faceMap[face])).join(' ');
    const result = inspect(cube.apply(cube.solved(), parse(text)));
    if (!result.centersSolved || !result.crossSolved) throw Error('Generated scramble failed the centers / D-cross check.');
    return text;
  }
  return { inspect, classify, searchConfig, adaptScramble, solved: cube.solved, apply: cube.apply, visible: cube.visible, encode: cube.encode, parse };
}

function mountL8E(root) {
  const section = root.querySelector('#l8e-solver'), model = createL8EModel();
  const input = section.querySelector('[data-l8e="scramble"]');
  const status = section.querySelector('[data-l8e="status"]');
  let worker = null, searchWorker = null, current = model.solved(), requestId = 0;
  const results=section.querySelector('[data-l8e="results"]');
  const solveButton=section.querySelector('[data-l8e="solve"]');
  const upperAlgorithms=section.querySelector('[data-l8e="upper-algorithms"]');
  const searchMode=section.querySelector('[data-l8e="search-mode"]');
  const searchCancel=section.querySelector('[data-l8e="search-cancel"]');
  const randomButton = section.querySelector('[data-l8e="random"]');
  const cancelButton = section.querySelector('[data-l8e="cancel"]');
  function stopGeneration() {
    requestId++;
    worker?.terminate(); worker = null;
    searchWorker?.terminate(); searchWorker=null;
    solveButton.disabled=false;searchCancel.hidden=true;
    randomButton.disabled = false; cancelButton.hidden = true;
  }
  function draw(state) {
    const check = model.inspect(state);
    section.querySelector('[data-l8e="constraints"]').textContent =
      `Centers: ${check.centersSolved ? 'solved' : 'not solved'}. Orange cross on D: ${check.crossSolved ? 'all four edges solved and aligned' : 'not solved'}.`;
    const classification=model.classify(state);
    const classLabel=section.querySelector('[data-l8e="class"]');
    const classSummary=section.querySelector('[data-l8e="class-summary"]');
    const groups=section.querySelector('[data-l8e="cycles"]');
    const wingRows=section.querySelector('[data-l8e="wing-rows"]');
    groups.replaceChildren();wingRows.replaceChildren();
    const make=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
    if(!classification.available) {
      classLabel.textContent='Not an L8E state';classSummary.textContent=classification.reason;
    } else {
      classLabel.textContent=classification.signature;
      classSummary.textContent=`${classification.cycles.length} independent pairing groups; ${classification.pairedCount} of 8 dedges have matching wing types.`;
      for(const cycle of classification.cycles) {
        const item=make('li',`${cycle.size}E: ${cycle.slots.join(', ')}. Edge types: ${cycle.types.join(', ')}.`);
        groups.append(item);
      }
      for(const pair of classification.pairs) {
        const row=make('tr','');
        row.append(make('th',pair.slot),make('td',pair.types[0]),make('td',pair.types[1]),make('td',pair.types[0]!==pair.types[1]?'Unpaired':pair.aligned?'Paired':'Matching types, opposite orientation'));
        wingRows.append(row);
      }
    }
    for (const face of ['U', 'L', 'F', 'R', 'B', 'D']) {
      const target = section.querySelector(`[data-l8e-face="${face}"]`), stickers = model.visible(state, face);
      target.replaceChildren();
      for (const sticker of stickers) {
        const tile = document.createElement('span');
        tile.className = 'piece f3e-' + sticker.color;
        tile.setAttribute('aria-hidden', 'true');
        target.append(tile);
      }
      target.setAttribute('aria-label', `${face} face, rows left to right: ${stickers.map(s => s.color).join(', ')}`);
    }
  }
  section.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    stopGeneration();
    try {
      const moves = model.parse(input.value);
      current=model.apply(model.solved(), moves);results.replaceChildren();draw(current);
      input.removeAttribute('aria-invalid');
      status.textContent = moves.length ? `Applied ${moves.length} moves from solved. Ready to find a pairing solution.` : 'Showing the solved reference cube.';
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      status.textContent = error.message;
    }
  });
  section.querySelector('[data-l8e="reset"]').addEventListener('click', () => {
    stopGeneration();
    input.value = '';
    input.removeAttribute('aria-invalid');
    current=model.solved();results.replaceChildren();draw(current);
    status.textContent = 'Showing the solved reference cube.';
  });
  randomButton.addEventListener('click', () => {
    stopGeneration();
    const id = requestId;
    randomButton.disabled = true; cancelButton.hidden = false;
    status.textContent = 'Generating an L8E case with csTimer. First use prepares its tables...';
    try {
      worker = new Worker(new URL('vendor/cstimer/cstimer_module.js', document.baseURI));
      worker.onmessage = event => {
        if (id !== requestId || event.data[0] !== id) return;
        try {
          const text = model.adaptScramble(event.data[2]);
          input.value = text; input.removeAttribute('aria-invalid');
          current=model.apply(model.solved(), model.parse(text));results.replaceChildren();draw(current);
          status.textContent = `Generated L8E case (${model.parse(text).length} moves). All six centers and four orange cross edges on D verified solved.`;
        } catch (error) { status.textContent = error.message; }
        stopGeneration();
      };
      worker.onerror = () => { if (id !== requestId) return; stopGeneration(); status.textContent = 'Could not generate a case. Please try again.'; };
      worker.postMessage([id, 'scramble', ['444l8e']]);
    } catch (error) { stopGeneration(); status.textContent = 'Could not start the scramble generator: ' + error.message; }
  });
  cancelButton.addEventListener('click', () => { stopGeneration(); status.textContent = 'Generation cancelled. Current cube unchanged.'; });
  solveButton.addEventListener('click',()=>{
    stopGeneration();results.replaceChildren();draw(current);
    let config;
    try{config={...model.searchConfig(current,{allowUpper:Boolean(upperAlgorithms.checked)}),mode:searchMode.value||'heuristic'};}catch(error){status.textContent=error.message;return;}
    const source=[formatL8EResult,searchL8E,searchL8EOptimal].map(fn=>fn.toString()).join('\n')+'\nonmessage=({data})=>{try{const solve=data.mode==="optimal"?searchL8EOptimal:searchL8E;postMessage({result:solve(data,text=>postMessage({progress:text}))});}catch(error){postMessage({error:error.message});}};';
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    try{searchWorker=new Worker(url);}catch(error){status.textContent='Could not start pairing search: '+error.message;return;}finally{URL.revokeObjectURL(url);}
    const active=searchWorker;
    solveButton.disabled=true;searchCancel.hidden=false;
    status.textContent=config.mode==='optimal'?'Searching for minimum block cost (30-second limit)...':'Searching inserts and slices for a short pairing solution...';
    searchWorker.onerror=event=>{if(searchWorker!==active)return;stopGeneration();status.textContent='Pairing search error: '+event.message;};
    searchWorker.onmessage=({data})=>{
      if(searchWorker!==active)return;
      if(data.progress){status.textContent=data.progress;return;}
      stopGeneration();
      if(data.error){status.textContent=data.error;return;}
      const answer=data.result;
      if(answer.status!=='solved'){status.textContent=answer.mode==='optimal'?`Exact search stopped without a complete solution or optimality proof (${answer.visited.toLocaleString()} visits).`:`Search budget reached (${answer.visited.toLocaleString()} visits). No complete solution found; try again with a different case. This does not prove the case is unsolvable.`;return;}
      try{
        const replay=model.apply(structuredClone(current),model.parse(answer.moves));
        const verified=model.classify(replay);
        if(!verified.available||!verified.pairs.every(p=>p.aligned))throw Error('Final centers, D cross or edge-pair verification failed.');
        let stepState=structuredClone(current);const previews=[];
        for(const step of answer.steps){
          model.apply(stepState,model.parse(step.moves));
          if(!model.inspect(stepState).crossSolved)throw Error('A pairing block disturbed the D cross.');
          previews.push(structuredClone(stepState));
        }
        const finish=model.classify(stepState);
        if(!finish.available||!finish.pairs.every(p=>p.aligned))throw Error('Step-by-step replay failed.');
        const make=(tag,text)=>{const element=document.createElement(tag);element.textContent=text;return element;};
        const preview=(label,state)=>{const button=make('button',label);button.type='button';button.addEventListener('click',()=>draw(state));return button;};
        const toolbox=answer.toolbox==='upper'?'U-layer algorithms enabled':'basic toolbox';
        const claim=answer.mode==='optimal'
          ?(answer.optimal?`Proven minimum block cost: ${answer.blockCost} (${toolbox}).`:`Best found block cost: ${answer.blockCost} (${toolbox}); optimality not proven. Lower bound: ${answer.lowerBound}.`)
          :`Heuristic pairing solution (${toolbox}), not guaranteed optimal.`;
        status.textContent=`${answer.count} moves${answer.rotations?` + ${answer.rotations} cube rotations`: ''}; ${claim} ${answer.visited.toLocaleString()} visits; ${(answer.elapsedMs/1000).toFixed(2)}s.`;
        results.append(make('h4','Complete solution'),make('code',answer.moves||'Already paired; no moves needed.'),preview('Preview paired cube',replay));
        answer.steps.forEach((step,i)=>{
          results.append(make('h4',`${i+1}. ${step.kind}: ${step.before} -> ${step.after} paired`),make('code',step.moves),make('p',step.purpose+' '+(step.centersRestored?'Centers restored.':'Centers temporarily sliced.')),preview(`Preview block ${i+1}`,previews[i]));
        });
        results.append(preview('Show scrambled case',current));
      }catch(error){results.replaceChildren();status.textContent='Solution rejected: '+error.message;}
    };
    try{searchWorker.postMessage(config);}catch(error){stopGeneration();status.textContent='Could not start pairing search: '+error.message;}
  });
  upperAlgorithms.addEventListener('change',()=>{stopGeneration();results.replaceChildren();draw(current);status.textContent='Algorithm toolbox changed. Ready to find a pairing solution.';});
  searchMode.addEventListener('change',()=>{stopGeneration();results.replaceChildren();draw(current);status.textContent='Search mode changed. Ready to find a pairing solution.';});
  searchCancel.addEventListener('click',()=>{stopGeneration();status.textContent='Pairing search cancelled. Current case unchanged.';});
  draw(current);
  return {loadScramble(text,options={}){if(options.allowUpper!==undefined)upperAlgorithms.checked=options.allowUpper;input.value=text;section.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}};
}
if (typeof module !== 'undefined') module.exports = { classifyL8EPairs, createL8EModel, mountL8E };
