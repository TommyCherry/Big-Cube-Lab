const L2CTrainer = (() => {
  function format(ms) {
    if (ms === null || !Number.isFinite(ms)) return 'N/A';
    const hundredths = Math.floor(ms / 10), seconds = Math.floor(hundredths / 100);
    return (seconds >= 60 ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : String(seconds)) + '.' + String(hundredths % 100).padStart(2, '0');
  }
  function stats(solves) {
    const times = solves.map(s => s.ms);
    const average = n => {
      if (times.length < n) return null;
      const values = times.slice(-n).sort((a, b) => a - b).slice(1, -1);
      return values.reduce((a, b) => a + b, 0) / values.length;
    };
    return { count: times.length, best: times.length ? times.reduce((a, b) => Math.min(a, b), Infinity) : null, mean: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, ao5: average(5), ao12: average(12) };
  }
  function create(database, saved = {}, clock = () => performance.now(), random = Math.random, wallClock = () => Date.now()) {
    const entries = new Map(database.cases.filter(c => c.count > 0).map(c => [c.id, c]));
    const selected = new Set((Array.isArray(saved.selected) ? saved.selected : []).filter(id => entries.has(id)));
    const validSolve = s => s && entries.has(s.caseId) && Number.isFinite(s.ms) && s.ms >= 0 && typeof s.scramble === 'string';
    let sessions = (Array.isArray(saved.sessions) ? saved.sessions : []).filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.solves)).map(s => ({ id: s.id, name: s.name, solves: s.solves.filter(validSolve) }));
    if (!sessions.length) sessions = [{ id: 'session-1', name: 'Session 1', solves: [] }];
    let activeId = sessions.some(s => s.id === saved.activeId) ? saved.activeId : sessions[0].id;
    let spaced = saved.spaced !== false, reviewCount = Number.isSafeInteger(saved.reviewCount) && saved.reviewCount >= 0 ? saved.reviewCount : 0;
    const cards = {};
    for (const [id, card] of Object.entries(saved.cards || {})) {
      if (entries.has(id) && card && [card.dueAt, card.intervalMs, card.ease, card.reviews].every(Number.isFinite) && card.intervalMs >= 0 && card.dueAt >= 0 && card.ease >= 1.3 && card.ease <= 3 && card.reviews >= 0) cards[id] = {...card, dueAfter: Number.isSafeInteger(card.dueAfter) && card.dueAfter >= 0 ? card.dueAfter : null};
    }
    let current = null, running = false, started = 0, pendingReview = null;
    const labels = {1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Forgot'};
    const due = card => card && (card.dueAt <= wallClock() || card.dueAfter !== null && card.dueAfter <= reviewCount);
    function rate(rating) {
      if (running || !spaced || !labels[rating] || !current) return null;
      const id = current.caseId, previous = cards[id], day = 86400000;
      let ease = previous?.ease || 2.5, intervalMs;
      if (rating === 4) { intervalMs = 60000; ease = Math.max(1.3, ease - .2); }
      else if (rating === 3) { intervalMs = Math.max(600000, (previous?.intervalMs || 0) * 1.2); ease = Math.max(1.3, ease - .15); }
      else if (rating === 2) intervalMs = Math.max(day, (previous?.intervalMs || 0) * ease);
      else { ease = Math.min(3, ease + .15); intervalMs = Math.max(4 * day, (previous?.intervalMs || 0) * ease * 1.3); }
      intervalMs = Math.min(Math.round(intervalMs), 365 * day);
      reviewCount++;
      cards[id] = {rating, ease, intervalMs, dueAt: wallClock() + intervalMs, dueAfter: rating === 4 ? reviewCount + 2 : rating === 3 ? reviewCount + 5 : null, reviews: (previous?.reviews || 0) + 1};
      if (pendingReview) pendingReview.rating = rating;
      pendingReview = null; next();
      return {caseId: id, label: labels[rating], ...cards[id]};
    }
    function setSpaced(value) { if (running) return; spaced = Boolean(value); if (!spaced && pendingReview) { pendingReview = null; next(); } }

    const session = () => sessions.find(s => s.id === activeId);
    const last = () => session().solves.at(-1) || null;
    function next() {
      if (running) return current;
      pendingReview = null;
      let pool = [...selected];
      const avoid = current?.caseId || last()?.caseId;
      if (pool.length > 1) pool = pool.filter(id => id !== avoid);
      if (!pool.length) { current = null; return null; }
      if (spaced) {
        const ready = pool.filter(id => due(cards[id]));
        const unseen = pool.filter(id => !cards[id]);
        if (ready.length) { ready.sort((a, b) => cards[a].dueAt - cards[b].dueAt); pool = ready.filter(id => cards[id].dueAt === cards[ready[0]].dueAt); }
        else if (unseen.length) pool = unseen;
        else { pool.sort((a, b) => cards[a].dueAt - cards[b].dueAt); pool = pool.filter(id => cards[id].dueAt === cards[pool[0]].dueAt); }
      }
      const entry = entries.get(pool[Math.floor(random() * pool.length)]);
      const u = Math.floor(random() * 4), f = Math.floor(random() * 4);
      const suffix = ['', '', '2', "'"];
      let alignment = [[u, 'U'], [f, 'F']].filter(([n]) => n).map(([n, face]) => face + suffix[n]).join(' ');
      if (database.mode === 'yau') alignment = yauAdjustments(alignment);
      const scramble = [entry.scramble, alignment].filter(Boolean).join(' ');
      const undoAlignment = alignment.split(' ').filter(Boolean).reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'").join(' ');
      current = { caseId: entry.id, scramble, alignment: undoAlignment, optimalAlgorithm: entry.algorithm, optimalCount: entry.count, algorithm: [undoAlignment, entry.algorithm].filter(Boolean).join(' ') };
      return current;
    }
    function select(ids, enabled) {
      for (const id of ids) if (entries.has(id)) enabled ? selected.add(id) : selected.delete(id);
      if (!running && (!current || !selected.has(current.caseId))) next();
    }
    function start() {
      if (running || !current || pendingReview) return false;
      started = clock(); running = true; return true;
    }
    function stop() {
      if (!running) return null;
      const solve = { caseId: current.caseId, scramble: current.scramble, ms: Math.max(0, clock() - started), date: new Date().toISOString() };
      running = false; session().solves.push(solve);
      if (spaced && selected.has(current.caseId)) pendingReview = solve; else next();
      return solve;
    }
    function newSession() {
      if (running) return false;
      let n = sessions.length + 1;
      while (sessions.some(s => s.id === `session-${n}`)) n++;
      activeId = `session-${n}`; sessions.push({ id: activeId, name: `Session ${n}`, solves: [] }); next(); return true;
    }
    function switchSession(id) {
      if (running || !sessions.some(s => s.id === id)) return false;
      activeId = id; next(); return true;
    }
    function undo() { if (running) return false; const removed = session().solves.pop(); if (removed === pendingReview) pendingReview = null; return Boolean(removed); }
    next();
    return {
      selected, entries, session, last, next, select, start, stop, newSession, switchSession, undo, rate, setSpaced,
      get spaced() { return spaced; }, get pendingReview() { return pendingReview; },
      reviewStats: () => ({due: [...selected].filter(id => due(cards[id])).length, unseen: [...selected].filter(id => !cards[id]).length}),
      get current() { return current; }, get running() { return running; }, get sessions() { return sessions; },
      elapsed: () => running ? Math.max(0, clock() - started) : last()?.ms ?? 0,
      snapshot: () => ({ version: 2, selected: [...selected], sessions, activeId, spaced, cards, reviewCount })
    };
  }
  return { create, stats, format };
})();

function mountTrainer(root, database, model, actions = {}) {
  const section = root.querySelector('#trainer');
  const find = selector => section.querySelector(selector);
  const timer = find('.trainer-clock'), enabled = find('[data-trainer="enabled"]');
  const status = find('.trainer-status'), sessionSelect = find('[data-trainer="session"]');
  const lastButton = find('[data-trainer="remove-last"]');
  const answer = find('.trainer-answer');
  const storageKey = database.mode === 'yau' ? 'l2c-trainer-yau-v1' : 'l2c-trainer-v1';
  let saved = {}, storageError = false;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { storageError = true; }
  const state = L2CTrainer.create(database, saved);
  const listeners = new Set();
  let armed = false, held = false, frame = null, previousScramble = null;
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state.snapshot())); storageError = false; }
    catch { storageError = true; }
    find('.trainer-storage').textContent = storageError ? 'Browser storage is unavailable; this session will not survive a reload.' : 'Sessions, selected cases, and review schedules are saved in this browser.';
  }
  function drawDiagram() {
    const diagram = find('.trainer-diagram'); diagram.replaceChildren();
    if (!state.current) return;
    const stickers = model.apply(model.solved(), model.parse(state.current.scramble));
    for (const [face, label] of [['U', 'Top'], ['F', 'Front']]) {
      const panel = document.createElement('span'); panel.className = 'case-diagram-panel';
      const title = document.createElement('span'); title.textContent = label;
      const tiles = document.createElement('span'); tiles.className = 'case-mini-face';
      const colors = model.visible(stickers, face);
      const centerColors = [];
      for (let r = 1; r < 4; r++) for (let c = 1; c < 4; c++) {
        const color = colors[r * 5 + c]; centerColors.push(color);
        const tile = document.createElement('span'); tile.className = 'case-tile ' + color; tile.setAttribute('aria-hidden', 'true'); tiles.append(tile);
      }
      tiles.setAttribute('role', 'img'); tiles.setAttribute('aria-label', `${label} center: ${centerColors.join(', ')}`);
      panel.append(title, tiles); diagram.append(panel);
    }
  }
  function render() {
    timer.textContent = L2CTrainer.format(state.elapsed());
    timer.disabled = (!state.current && !state.running) || Boolean(state.pendingReview);
    timer.setAttribute('aria-label', state.running ? 'Stop timer' : 'Start timer');
    timer.dataset.phase = armed ? 'armed' : state.running ? 'running' : 'ready';
    find('.trainer-pool-count').textContent = `${state.selected.size} cases selected`;
    find('[data-trainer="spaced"]').checked = state.spaced;
    find('[data-trainer="spaced"]').disabled = state.running;
    find('.trainer-rating').hidden = !state.spaced;
    find('.trainer-rating-title').textContent = state.current ? `Rate ${state.current.caseId}${state.pendingReview ? ' - last solve' : ' - untimed review'}` : 'Select a case to review';
    for (const rating of [1, 2, 3, 4]) find(`[data-rating="${rating}"]`).disabled = state.running || !state.current;
    find('[data-trainer="skip-rating"]').disabled = state.running || !state.current;
    find('.trainer-review-stats').hidden = !state.spaced;
    const reviews = state.reviewStats();
    find('.trainer-review-stats').textContent = `${reviews.due} due | ${reviews.unseen} new | ${state.selected.size} selected. Due cards come first, then new cards. If none are due, practice the earliest upcoming card.`;

    find('.trainer-scramble').textContent = state.current?.scramble || 'Choose cases in the library, or select all cases below.';
    const currentHeading = find('.trainer-current');
    currentHeading.replaceChildren();
    if (state.current) {
      const label = document.createElement('span'); label.textContent = `${state.pendingReview ? 'Rate' : state.running ? 'Current' : 'Next'} case: `;
      const link = document.createElement('button'); link.type = 'button'; link.className = 'history-case-link';
      const caseId = state.current.caseId;
      link.textContent = caseId; link.setAttribute('aria-label', `View ${caseId} case panel`);
      link.disabled = !actions.openCase;
      link.addEventListener('click', () => actions.openCase?.(caseId));
      currentHeading.append(label, link);
    } else currentHeading.textContent = 'No case selected';
    if (previousScramble !== state.current?.scramble) { previousScramble = state.current?.scramble; answer.open = false; drawDiagram(); }
    answer.hidden = !state.current || state.running;
    find('.trainer-alignment').textContent = state.current ? 'First align: ' + (state.current.alignment || 'No adjustment needed') : '';
    find('.trainer-algorithm').textContent = state.current?.optimalAlgorithm || '';
    find('.trainer-solution-count').textContent = state.current ? `${state.current.optimalCount} ${database.mode === 'yau' ? 'optimal Yau' : 'optimal'} moves, excluding initial alignment.` : '';
    const last = state.last();
    find('.trainer-last').textContent = last ? `Last solve: ${L2CTrainer.format(last.ms)} | ${last.caseId}` : 'No solves yet in this session.';
    lastButton.textContent = last ? `Deselect last case (${last.caseId})` : 'Deselect last case';
    lastButton.disabled = state.running || !last || !state.selected.has(last.caseId);
    for (const name of ['skip', 'new-session', 'undo', 'select-all', 'select-none']) find(`[data-trainer="${name}"]`).disabled = state.running;
    find('[data-trainer="skip"]').disabled = state.running || !state.current;
    find('[data-trainer="undo"]').disabled = state.running || !last;
    sessionSelect.disabled = state.running;
    sessionSelect.replaceChildren();
    for (const session of state.sessions) {
      const option = document.createElement('option'); option.value = session.id; option.textContent = `${session.name} (${session.solves.length})`; sessionSelect.append(option);
    }
    sessionSelect.value = state.session().id;
    const stats = L2CTrainer.stats(state.session().solves);
    for (const metric of ['count', 'best', 'mean', 'ao5', 'ao12']) find(`[data-stat="${metric}"]`).textContent = metric === 'count' ? String(stats.count) : L2CTrainer.format(stats[metric]);
    const body = find('.trainer-history'); body.replaceChildren();
    state.session().solves.slice(-50).reverse().forEach((solve, index) => {
      const row = document.createElement('tr');
      for (const value of [String(stats.count - index), L2CTrainer.format(solve.ms), solve.caseId, solve.scramble]) {
        const cell = document.createElement('td');
        if (value === solve.caseId && actions.openCase) {
          const link = document.createElement('button'); link.type = 'button'; link.className = 'history-case-link';
          link.textContent = solve.caseId; link.setAttribute('aria-label', `View ${solve.caseId} case panel`);
          link.addEventListener('click', () => actions.openCase(solve.caseId)); cell.append(link);
        } else cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    });
    find('.trainer-history-label').textContent = `Recent solves (${Math.min(50, stats.count)} of ${stats.count})`;
  }
  function notify() { save(); render(); for (const listener of listeners) listener(); }
  function tick() { timer.textContent = L2CTrainer.format(state.elapsed()); if (state.running) frame = requestAnimationFrame(tick); }
  function start() {
    if (!state.start()) return;
    armed = false; status.textContent = 'Timing. Press Space or tap the timer to stop.'; render(); tick();
  }
  function stop() {
    const solve = state.stop(); if (!solve) return;
    cancelAnimationFrame(frame); armed = false;
    status.textContent = state.pendingReview ? `Recorded ${L2CTrainer.format(solve.ms)}. Rate this case or skip its rating to continue.` : `Recorded ${L2CTrainer.format(solve.ms)}. The next scramble is ready; reset to solved centers before applying it.`;
    notify();
  }
  timer.addEventListener('click', () => state.running ? stop() : start());
  const editable = target => target?.closest?.('input,textarea,select,[contenteditable="true"],a,summary,button:not(.trainer-clock)');
  document.addEventListener('keydown', event => {
    if (section.hidden || event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || !enabled.checked || (!state.current && !state.running) || state.pendingReview || editable(event.target)) return;
    event.preventDefault();
    if (event.repeat || held) return;
    held = true;
    if (state.running) stop();
    else if (state.current) { armed = true; timer.dataset.phase = 'armed'; status.textContent = 'Release Space to start.'; }
  });
  document.addEventListener('keyup', event => {
    if (event.code !== 'Space' || !held) return;
    event.preventDefault(); held = false;
    if (armed && !section.hidden && enabled.checked && !editable(event.target)) start();
    else { armed = false; render(); }
  });
  window.addEventListener('blur', () => { held = false; armed = false; if (!state.running) render(); });
  enabled.addEventListener('change', () => { held = false; armed = false; if (!state.running) render(); });
  find('[data-trainer="spaced"]').addEventListener('change', () => { state.setSpaced(find('[data-trainer="spaced"]').checked); notify(); });
  for (const rating of [1, 2, 3, 4]) find(`[data-rating="${rating}"]`).addEventListener('click', () => {
    const review = state.rate(rating); if (!review) return;
    status.textContent = `${review.caseId}: ${review.label}. Next review ${new Date(review.dueAt).toLocaleString()}${review.dueAfter === null ? '' : ', or sooner after more cards'}. Next case ready.`;
    notify();
  });
  find('[data-trainer="skip-rating"]').addEventListener('click', () => { state.next(); status.textContent = 'Rating skipped. Next case ready.'; notify(); });
  find('[data-trainer="select-all"]').addEventListener('click', () => { state.select([...state.entries.keys()], true); notify(); });
  find('[data-trainer="select-none"]').addEventListener('click', () => { state.select([...state.selected], false); notify(); });
  find('[data-trainer="skip"]').addEventListener('click', () => { state.next(); notify(); });
  find('[data-trainer="new-session"]').addEventListener('click', () => { state.newSession(); status.textContent = 'New session created. Previous sessions are still available.'; notify(); });
  find('[data-trainer="undo"]').addEventListener('click', () => { state.undo(); notify(); });
  sessionSelect.addEventListener('change', () => { state.switchSession(sessionSelect.value); notify(); });
  lastButton.addEventListener('click', () => {
    const last = state.last(); if (!last || state.running) return;
    state.select([last.caseId], false); status.textContent = `${last.caseId} removed from the practice pool. Its recorded times are kept.`; notify();
  });
  save(); render();
  return {
    has: id => state.selected.has(id),
    set(ids, selected) { state.select(ids, selected); notify(); },
    subscribe(listener) { listeners.add(listener); },
    allowed: id => state.entries.has(id)
  };
}
if (typeof module !== 'undefined') module.exports = L2CTrainer;
