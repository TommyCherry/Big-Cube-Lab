function createSixModel() {
  const faces = {R: [0,1], L: [0,-1], U: [1,1], D: [1,-1], F: [2,1], B: [2,-1]}, coords = [-5,-3,-1,1,3,5];
  const key = s => s.p.join(',') + '/' + s.n.join(',');
  function solved() {
    const state = [];
    for (const [face, [axis, sign]] of Object.entries(faces)) for (const a of coords) for (const b of coords) {
      const p = [], n = [0,0,0]; p[axis] = sign * 5; p[(axis+1)%3] = a; p[(axis+2)%3] = b; n[axis] = sign;
      const center = Math.abs(a) < 5 && Math.abs(b) < 5;
      state.push({p, n, face, color: center && face === 'U' ? 'green' : center && face === 'F' ? 'orange' : 'gray'});
    }
    return state;
  }
  function parse(text) {
    return text.trim().replace(/[\u2019\u2032]/g, "'").split(/\s+/).filter(Boolean).map((token, i) => {
      const slice = /^([2-5])r(2'?|')?$/.exec(token);
      if(slice)return {axis:0,sign:1,width:Number(slice[1]),slice:true,turns:slice[2]?.startsWith('2')?2:slice[2]==="'"?3:1};
      const match = /^(?:([2-6])?([URFDLB])(w)?|([xyz]))(2'?|')?$/.exec(token);
      if (!match || match[1] && !match[3]) throw new Error(`Invalid move ${i+1}: ${token}. Use R, Rw, 3Rw, 4Rw, 5Rw, single slices 2r-5r, primes or doubles. M is ambiguous on 6x6; use explicit wide turns.`);
      const [, width, face, wide, rotation, suffix] = match;
      const [axis, sign] = rotation ? [{x:0,y:1,z:2}[rotation], 1] : faces[face];
      return {axis, sign, width: rotation ? 6 : wide ? Number(width || 2) : 1, turns: suffix?.startsWith('2') ? 2 : suffix === "'" ? 3 : 1};
    });
  }
  function apply(state, moves) {
    for (const move of moves) for (const s of state) if (move.slice ? s.p[move.axis] * move.sign === 7 - 2 * move.width : s.p[move.axis] * move.sign >= 7 - 2 * move.width) {
      for (let t = 0; t < move.turns; t++) for (const vector of [s.p, s.n]) {
        const a = (move.axis + 1) % 3, b = (move.axis + 2) % 3, old = vector[a];
        vector[a] = move.sign * vector[b]; vector[b] = -move.sign * old;
      }
    }
    return state;
  }
  const home = solved(), centers = home.filter(s => s.p.filter(v => Math.abs(v) === 5).length === 1);
  const centerIndex = new Map(centers.map((s, i) => [key(s), i]));
  function encode(state) {
    const result = Array(96);
    for (const s of state) { const i = centerIndex.get(key(s)); if (i !== undefined) result[i] = s.face; }
    return result.join('');
  }
  function visible(state, face) {
    const result = Array(36).fill('gray'), axis = face === 'U' ? 1 : 2;
    for (const s of state) if (s.n[axis] === 1) {
      const row = face === 'U' ? (s.p[2] + 5) / 2 : (5 - s.p[1]) / 2;
      result[row * 6 + (s.p[0] + 5) / 2] = s.color;
    }
    return result;
  }
  function searchMoves(mode, slices = false) {
    const bases = mode === 'yau' ? ['U','Rw','3Rw','4Rw','5Rw'] : ['U','F','Rw','3Rw','4Rw','5Rw','Lw','3Lw','4Lw','5Lw'];
    if(slices)bases.push('2r','3r','4r','5r');
    return bases.flatMap(base => ['', "'", '2'].map(suffix => {
      const text = base + suffix, moved = apply(solved(), parse(text)), permutation = Array(96);
      let source = 0;
      for (let i = 0; i < home.length; i++) if (centerIndex.has(key(home[i]))) permutation[centerIndex.get(key(moved[i]))] = source++;
      if (mode === 'yau' && home.some((s, i) => s.p[0] === -5 && s.p[1] !== 5 && s.p.filter(v => Math.abs(v) === 5).length === 2 && key(s) !== key(moved[i]))) throw new Error('Unsafe Yau move');
      return {text, permutation};
    }));
  }
  const exampleScramble = "Rw U Rw'";
  return {solved, parse, apply, visible, encode, searchMoves, goal: encode(home), exampleScramble};
}

const SIX_LAST_BAR_POOLS = new WeakMap();
function sixLastBarPool(model, filter) {
  let pools = SIX_LAST_BAR_POOLS.get(model);
  if (!pools) { pools = new Map(); SIX_LAST_BAR_POOLS.set(model, pools); }
  if (pools.has(filter)) return pools.get(filter);
  // Rw/U alone couples the last-bar obliques; this commutator separates them.
  const split = "Rw U 3Rw' 4Rw U' Rw' U 3Rw 4Rw'";
  const inverse = text => text.split(' ').reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0,-1) : t + "'").join(' ');
  const setups = filter === 'two' ? ['Rw', '3Rw'] : ['Rw'];
  const blocks = ['U', "U'", 'U2', ...setups.flatMap(setup => ['U', "U'", 'U2'].map(turn => `${setup} ${turn} ${setup}'`)), ...(filter === 'one' ? [split, inverse(split)] : [])];
  // All primitives preserve Yau's F3E, so both modes can share these routes.
  const moves = model.searchMoves('yau');
  const centers = model.solved().filter(s => s.p.filter(v => Math.abs(v) === 5).length === 1);
  const active = centers.flatMap((s, i) => 'UF'.includes(s.face) ? [i] : []);
  const local = new Map(active.map((index, i) => [index, i]));
  const permutations = blocks.map(text => {
    let permutation = Array.from({length:96}, (_, i) => i);
    for (const token of text.split(' ')) permutation = moves.find(move => move.text === token).permutation.map(from => permutation[from]);
    if (permutation.some((from, i) => !local.has(i) && model.goal[from] !== model.goal[i]) || active.some(i => !local.has(permutation[i]))) throw new Error('Invalid L2C generator block.');
    return active.map(i => local.get(permutation[i]));
  });
  // A 32-bit orange mask is sufficient: the remaining centers stay solved.
  let goal = 0, fixed = 0;
  active.forEach((index, i) => {
    if (centers[index].face !== 'F') return;
    goal |= 1 << i;
    if (centers[index].p[0] < (filter === 'one' ? 3 : 0)) fixed |= 1 << i;
  });
  const states = [goal >>> 0], routes = [{parent:-1, block:-1}], seen = new Map([[states[0],0]]);
  for (let i=0; i<states.length; i++) for (let b=0; b<blocks.length; b++) {
    let next = 0;
    for (let j=0; j<32; j++) if (states[i] & (1 << permutations[b][j])) next |= 1 << j;
    next >>>= 0;
    if ((next & fixed) !== fixed || seen.has(next)) continue;
    seen.set(next,states.length); states.push(next); routes.push({parent:i,block:b});
  }
  // Last two bars: each of four orbits independently chooses 2 orange slots
  // among 6 free slots: C(6,2)^4. Last bar: C(6,2)*C(5,1)^2.
  const expected = filter === 'two' ? 50625 : 375;
  if (states.length !== expected) throw new Error(`Bar generator did not cover all ${expected} layouts.`);
  const pool = {length: states.length - 1, index:seen, route(index) {
    const path = [];
    for (let i=index; routes[i].parent !== -1; i=routes[i].parent) path.push(blocks[routes[i].block]);
    return path.reverse().join(' ');
  }, scramble(index) { return this.route(index+1); }};
  pools.set(filter,pool);
  return pool;
}

const SIX_RANDOM_MODELS = new WeakMap();
function sixRandomModel(model) {
  if (SIX_RANDOM_MODELS.has(model)) return SIX_RANDOM_MODELS.get(model);
  const centers = model.solved().filter(s => s.p.filter(v => Math.abs(v) === 5).length === 1);
  const active = centers.flatMap((s,i) => 'UF'.includes(s.face) ? [i] : []);
  const local = new Map(active.map((slot,i) => [slot,i]));
  const moves = model.searchMoves('yau');
  const blocks = ['U', "U'", 'U2', ...['Rw','3Rw','4Rw','5Rw'].flatMap(setup => ['U', "U'", 'U2'].map(turn => `${setup} ${turn} ${setup}'`))];
  const permutations = blocks.map(text => {
    let p=Array.from({length:96},(_,i)=>i);
    for(const token of text.split(' ')) p=moves.find(move=>move.text===token).permutation.map(from=>p[from]);
    if(active.some(i=>!local.has(p[i])) || p.some((from,i)=>!local.has(i) && model.goal[from]!==model.goal[i])) throw new Error('Invalid random-case generator block.');
    return active.map(i=>local.get(p[i]));
  });
  const visited=new Set(), choices=[];
  let solvedRank=0, radix=1;
  for(let seed=0;seed<32;seed++) {
    if(visited.has(seed)) continue;
    const orbit=[seed];visited.add(seed);
    for(let i=0;i<orbit.length;i++) for(const p of permutations) if(!visited.has(p[orbit[i]])) {visited.add(p[orbit[i]]);orbit.push(p[orbit[i]]);}
    if(orbit.length!==8) throw new Error('Unexpected L2C center orbit.');
    const masks=[];
    for(let a=0;a<5;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<7;c++)for(let d=c+1;d<8;d++) masks.push(((1<<orbit[a])|(1<<orbit[b])|(1<<orbit[c])|(1<<orbit[d]))>>>0);
    const solved=orbit.reduce((mask,i)=>centers[active[i]].face==='F' ? mask|(1<<i) : mask,0)>>>0;
    solvedRank+=masks.indexOf(solved)*radix;radix*=70;choices.push(masks);
  }
  const data={blocks,permutations,choices,solvedRank,total:radix};
  SIX_RANDOM_MODELS.set(model,data);return data;
}

// Sample a layout first, uniformly over all non-solved raw color layouts.
// Connect it to the small last-two-bars table rather than running an optimal
// solver or sampling a short random walk (which heavily favors easy cases).
function generateSixScramble(model, mode = 'redux', random = Math.random, filter = 'all') {
  if (!['all','two','one'].includes(filter)) throw new Error('Unknown L2C filter.');
  if (filter !== 'all') { const pool = sixLastBarPool(model, filter); return pool.scramble(Math.floor(random() * pool.length)); }
  const data=sixRandomModel(model), pool=sixLastBarPool(model,'two');
  let rank=Math.floor(random()*(data.total-1));
  if(rank>=data.solvedRank) rank++;
  let target=0;
  for(const masks of data.choices) {target|=masks[rank%70];rank=Math.floor(rank/70);}
  target>>>=0;
  const queue=[target], parents=[-1], via=[-1], seen=new Set(queue);
  const inverse=text=>text.split(' ').reverse().map(t=>t.endsWith('2')?t:t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
  function finish(index,entry) {
    // The parent path goes target -> table entry. Invert it after the
    // known solved -> entry route to obtain the exact sampled target.
    const path=[];
    for(let j=index;parents[j]!==-1;j=parents[j])path.push(inverse(data.blocks[via[j]]));
    return [pool.route(entry),...path].filter(Boolean).join(' ');
  }
  if(pool.index.has(target))return finish(0,pool.index.get(target));
  for(let i=0;i<queue.length;i++) {
    for(let b=0;b<data.blocks.length;b++) {
      let next=0;
      for(let j=0;j<32;j++)if(queue[i]&(1<<data.permutations[b][j]))next|=1<<j;
      next>>>=0;
      if(seen.has(next))continue;
      seen.add(next);queue.push(next);parents.push(i);via.push(b);
      const entry=pool.index.get(next);
      if(entry!==undefined)return finish(queue.length-1,entry);
    }
  }
  throw new Error('Could not construct the sampled L2C case.');
}

function mountSix(root) {
  const section = root.querySelector('#six-solver'), find = s => section.querySelector(s), model = createSixModel();
  let current = model.solved(), worker = null, busy = false, caseFilter = 'all';
  let background = false, pendingSearch = null;
  const status = find('.six-status'), result = find('.six-result'), input = find('textarea'), mode = find('[data-six="mode"]');
  function render(state) {
    for (const face of ['U','F']) {
      const panel = find(`[data-six-face="${face}"]`); panel.replaceChildren();
      const colors = model.visible(state, face);
      for (const color of colors) { const tile = document.createElement('div'); tile.className = 'piece ' + color; tile.setAttribute('aria-hidden','true'); panel.append(tile); }
      panel.setAttribute('aria-label', `${face === 'U' ? 'Top' : 'Front'} face, rows left to right: ${colors.join(', ')}`);
    }
  }
  function stop(terminate = true) { if (terminate) { background = false; pendingSearch = null; } if (terminate && worker) { worker.terminate(); worker = null; } busy = false; find('[data-six="cancel"]').hidden = true; find('[data-six="solve"]').disabled = false; find('[data-six="prepare"]').disabled = false; }
  function apply() {
    const next = model.apply(model.solved(), model.parse(input.value)); pendingSearch = null; stop(busy); current = next; render(current); result.replaceChildren(); input.removeAttribute('aria-invalid');
    status.textContent = 'Scramble applied. Search returns all six centers to their original faces.';
  }
  find('form').addEventListener('submit', event => { event.preventDefault(); try { apply(); } catch (error) { status.textContent = error.message; input.setAttribute('aria-invalid','true'); } });
  const filterNames = {all: 'Any L2C', two: 'Last two bars', one: 'Last bar'};
  for (const filter of ['all', 'two', 'one']) find(`[data-six-filter="${filter}"]`).addEventListener('click', () => {
    caseFilter = filter;
    for (const value of ['all', 'two', 'one']) find(`[data-six-filter="${value}"]`).setAttribute('aria-pressed', String(value === filter));
    status.textContent = `${filterNames[filter]} selected for random scrambles. Click Random L2C scramble to generate a case.`;
  });
  find('[data-six="random"]').addEventListener('click', () => {
    try {
      input.value = generateSixScramble(model, mode.value, Math.random, caseFilter); apply();
      status.textContent = `Random 6x6 L2C case applied - ${filterNames[caseFilter]} (${mode.value === 'yau' ? 'Yau, F3E preserved' : 'Redux'}). Both inner 4x4s contain only green/orange; other centers remain solved.`;
    } catch (error) { status.textContent = error.message; }
  });
  find('[data-six="example"]').addEventListener('click', () => { input.value = model.exampleScramble; apply(); });
  find('[data-six="cancel"]').addEventListener('click', () => { stop(); status.textContent = 'Search cancelled.'; });
  mode.addEventListener('change', () => { stop(busy || background); result.replaceChildren(); status.textContent = 'Same case retained. Run search with the new move set.'; schedulePreparation(); });
  function ensureWorker() {
    if (worker) return worker;
    const code = searchSixIDA.toString() + '\n' + installSixWorker.toString() + '\ninstallSixWorker();';
    const url = URL.createObjectURL(new Blob([code], {type:'text/javascript'}));
    try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
    return worker;
  }
  function schedulePreparation() {
    // Let the initial page render first; all expensive work stays in the worker.
    if (typeof setTimeout === 'function') setTimeout(prepareInBackground, 500);
  }
  function prepareInBackground() {
    if (busy) { schedulePreparation(); return; }
    if (background) return;
    let active;
    try { active = ensureWorker(); } catch { return; }
    background = true;
    let sessionOnly = false;
    const cacheStatus = find('.six-cache-status');
    cacheStatus.textContent = 'Preparing tables in the background. You can keep using the site.';
    function complete(error, answer) {
      if (worker !== active) return;
      background = false;
      const queued = pendingSearch; pendingSearch = null;
      cacheStatus.textContent = error || answer?.status !== 'prepared'
        ? 'Background preparation did not finish. Search will prepare tables when needed.'
        : 'Pattern tables are ready for this mode.' + (sessionOnly ? ' Browser storage is unavailable; tables are available for this session.' : '');
      if (error) { active.terminate(); worker = null; }
      if (queued !== null) { stop(false); runSearch(queued); }
    }
    active.onerror = event => complete(event.message);
    active.onmessage = ({data}) => {
      if (worker !== active) return;
      if (data.progress?.phase === 'patterns') cacheStatus.textContent = `Preparing tables in the background: ${data.progress.patternsBuilt}/${data.progress.totalPatterns}.`;
      if (data.cache === 'loading') cacheStatus.textContent = 'Loading saved pattern tables in the background...';
      if (data.cache === 'session-only') { sessionOnly = true; cacheStatus.textContent = 'Tables can be reused this session; browser storage is unavailable.'; }
      if (data.result || data.error) complete(data.error, data.result);
    };
    try { active.postMessage({start:model.goal, goal:model.goal, moves:model.searchMoves(mode.value, find('[data-six="algorithm"]').value === 'ergonomic'), maxDepth:0, maxMs:120000, prepareOnly:true, algorithm:'ida'}); }
    catch (error) { complete(error.message); }
  }
  function runSearch(prepareOnly = false) {
    if (background) {
      pendingSearch = prepareOnly;
      find('[data-six="solve"]').disabled = true;
      find('[data-six="prepare"]').disabled = true;
      find('[data-six="cancel"]').hidden = false;
      status.textContent = 'Finishing background preparation, then starting your request...';
      return;
    }
    stop(busy); if (!prepareOnly) result.replaceChildren(); render(current);
    const maxDepth = prepareOnly ? 0 : Number(find('[data-six="depth"]').value);
    const depthLimit = find('[data-six="algorithm"]').value === 'ergonomic' ? 30 : 16;
    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > depthLimit) { status.textContent = `Choose a depth from 0 to ${depthLimit}.`; return; }
    const maxMs = Number(find('[data-six="seconds"]').value) * 1000;
    if (![10000,30000,60000,120000].includes(maxMs)) { status.textContent = 'Choose a valid time limit.'; return; }
    const request = {start:prepareOnly ? model.goal : model.encode(current), goal:model.goal, moves:model.searchMoves(mode.value, find('[data-six="algorithm"]').value === 'ergonomic'), maxDepth, maxMs, prepareOnly, ergonomic:!prepareOnly && find('[data-six="algorithm"]').value === 'ergonomic', algorithm:prepareOnly ? 'ida' : find('[data-six="algorithm"]').value};
    try { ensureWorker(); } catch(error) { status.textContent = 'Could not start search: ' + error.message; return; }
    busy = true; find('[data-six="prepare"]').disabled = true;
    find('[data-six="cancel"]').hidden = false; find('[data-six="solve"]').disabled = true;
    status.textContent = request.ergonomic ? 'Searching ergonomic blocks by move count after cancellations...' : 'Building pattern databases, then searching with optimal lower bounds...';
    worker.onerror = event => { stop(); status.textContent = 'Search failed: ' + event.message; };
    const countLabel = 'search-node visits (including repeats)';
    worker.onmessage = ({data}) => {
      if (data.cache) {
        const messages = {'not-prepared':'Tables are prepared automatically and saved for future searches.', loading:'Loading saved pattern tables...', reused:'Reusing prepared pattern tables for this move set.', saving:'Saving completed pattern tables for future searches...', saved:'Pattern tables saved in this browser for future searches.', 'session-only':'Browser caching is unavailable. Completed tables can still be reused until this session ends.'};
        find('.six-cache-status').textContent = messages[data.cache]; return;
      }
      if (data.progress?.phase === 'patterns') { status.textContent = `Preparing paired pattern tables: ${data.progress.patternsBuilt}/${data.progress.totalPatterns}. These track color and center-orbit interactions.`; return; }
      if (data.progress) { status.textContent = `${data.progress.visited.toLocaleString()} ${countLabel}; proven through ${data.progress.depth} moves${data.progress.bound === undefined ? "" : "; searching " + data.progress.bound + " moves"}.`; return; }
      stop(false);
      if (data.error) { status.textContent = data.error; return; }
      const answer = data.result;
      if (answer.status === 'prepared') { status.textContent = 'Pattern tables are ready. Future searches in this mode can reuse them.'; return; }
      if (answer.status !== 'solved') { status.textContent = `${answer.status === 'unreachable' ? 'No solution in this move set' : 'Search limit reached (' + answer.status.replace('-limit','') + ')'}: ${answer.visited.toLocaleString()} ${countLabel}. No ${request.ergonomic ? 'ergonomic block solution' : 'solution'} through ${answer.provenThrough} moves. This does not mean the case is unsolvable.`; return; }
      if (mode.value === 'redux' && !answer.ergonomic) { answer.moves = preferSixUTurns(answer.moves); answer.count = answer.moves.split(' ').filter(Boolean).length; }
      const replay = model.apply(current.map(s => ({...s, p:[...s.p], n:[...s.n]})), model.parse(answer.moves));
      if (model.encode(replay) !== model.goal) { status.textContent = 'Solution replay failed; no algorithm displayed.'; return; }
      const heading = document.createElement('strong'); heading.textContent = `${answer.count} moves | ${answer.ergonomic ? 'ergonomic-optimal after cancellations' : 'optimal in the selected move set'}`;
      const algorithm = document.createElement('code'); algorithm.className = 'solution-moves'; algorithm.textContent = answer.moves || 'Already solved';
      const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Preview solution'; preview.addEventListener('click', () => render(replay));
      result.append(heading, algorithm, preview);
      if(answer.blocks?.length || answer.commutator){
        const details=document.createElement('details'), summary=document.createElement('summary');
        summary.textContent=answer.commutator ? 'Show blocks and final commutator' : 'Show ergonomic blocks';details.append(summary);
        if(answer.blocks?.length){const blockText=document.createElement('code');blockText.textContent=answer.blocks.join(' + ');details.append(blockText);}
        if(answer.commutator){const label=document.createElement('p'), comm=document.createElement('code');label.textContent='Finish the last exchanged oblique pair:';comm.textContent=answer.commutator;details.append(label,comm);}
        result.append(details);
      }
      status.textContent = `Verified all six centers. ${answer.visited.toLocaleString()} ${countLabel}.`;
    };
    try { worker.postMessage(request); }
    catch (error) { stop(); status.textContent = 'Could not send search request: ' + error.message; }
  }
  find('[data-six="algorithm"]').addEventListener('change', () => {
    const depth=find('[data-six="depth"]'), limit=find('[data-six="algorithm"]').value==='ergonomic' ? 30 : 16;
    depth.max=String(limit);if(Number(depth.value)>limit)depth.value=String(limit);
    stop(busy || background);status.textContent='Search type changed. Same case retained.';schedulePreparation();
  });
  find('[data-six="solve"]').addEventListener('click', () => runSearch());
  find('[data-six="prepare"]').addEventListener('click', () => runSearch(true));
  render(current);
  schedulePreparation();
}
if (typeof module !== 'undefined') module.exports = {createSixModel, generateSixScramble};
