function mountCaseBrowser(root, database, model, actions) {
  const section = root.querySelector('#case-library');
  const grid = section.querySelector('.case-grid');
  const detail = section.querySelector('.case-detail');
  const status = section.querySelector('.case-status');
  const search = section.querySelector('[data-filter="search"]');
  const fields = Object.fromEntries([...section.querySelectorAll('[data-filter]')].map(el => [el.dataset.filter, el]));
  const pageLabel = section.querySelector('.case-page-label');
  const previous = section.querySelector('[data-page="previous"]');
  const next = section.querySelector('[data-page="next"]');
  let page = 0, selected = null, matchingMask = null;
  const pageSize = 24;
  const selectedCounts = new Set();
  const countOptions = section.querySelector('.move-count-options');
  const countButtons = [];
  function updateCountButtons() {
    for (const { button, count } of countButtons) {
      button.setAttribute('aria-pressed', String(count === null ? selectedCounts.size === 0 : selectedCounts.has(count)));
    }
  }
  countOptions.replaceChildren();
  for (const count of [null, ...new Set(database.cases.map(entry => entry.count))].sort((a, b) => a === null ? -1 : b === null ? 1 : a - b)) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = count === null ? 'Any' : String(count);
    button.setAttribute('aria-label', count === null ? 'Any move count' : `${count} moves`);
    button.addEventListener('click', () => {
      if (count === null) selectedCounts.clear();
      else if (selectedCounts.has(count)) selectedCounts.delete(count);
      else selectedCounts.add(count);
      updateCountButtons(); page = 0; render();
    });
    countButtons.push({ button, count }); countOptions.append(button);
  }
  updateCountButtons();
  for (const field of ['topName', 'frontName']) {
    const names = [...new Set(database.cases.map(entry => entry[field]))].sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      const option = document.createElement('option'); option.value = name; option.textContent = name; fields[field].append(option);
    }
  }
  const patterns = ['None', 'Single', 'Adjacent pair', 'Opposite pair', 'Three', 'All four'];
  for (const field of ['corners', 'edges', 'frontCorners', 'frontEdges']) for (const pattern of patterns) {
    const option = document.createElement('option'); option.value = pattern; option.textContent = pattern; fields[field].append(option);
  }
  for (let n = 0; n <= 8; n++) {
    const option = document.createElement('option'); option.value = String(n); option.textContent = `${n} exchanged`; fields.exchanged.append(option);
  }
  section.querySelector('.case-total').textContent = `${database.caseCount} cases | ${database.orientedLayouts.toLocaleString()} oriented layouts`;
  function diagram(mask, large = false) {
    const pair = document.createElement('span'); pair.className = 'case-diagrams' + (large ? ' large' : '');
    for (const [face, label] of [[0, 'Top'], [1, 'Front']]) {
      const panel = document.createElement('span'); panel.className = 'case-diagram-panel';
      const title = document.createElement('span'); title.textContent = label + ' | ' + L2CCases.facePatternName(mask, face);
      const tiles = document.createElement('span'); tiles.className = 'case-mini-face';
      const colors = [];
      for (let i = 0; i < 9; i++) {
        const color = mask & (1 << (face * 9 + i)) ? 'green' : 'orange';
        const tile = document.createElement('span'); tile.className = 'case-tile ' + color; tile.setAttribute('aria-hidden', 'true'); tiles.append(tile); colors.push(color);
      }
      tiles.setAttribute('role', 'img'); tiles.setAttribute('aria-label', `${label}, rows left to right: ${colors.join(', ')}`);
      panel.append(title, tiles); pair.append(panel);
    }
    return pair;
  }
  function showDetail(entry, target = detail, popup = target !== detail) {
    const detail = target;
    if (!popup) selected = entry.id;
    detail.hidden = false;
    detail.replaceChildren();
    const title = document.createElement('h3'); title.textContent = entry.id + (entry.count === 0 ? ' | Solved' : '');
    const description = document.createElement('p');
    description.textContent = `${entry.count} moves | ${entry.exchanged} pieces exchanged per face | ${entry.orbitSize} U/F orientations`;
    const algorithm = document.createElement('code'); algorithm.className = 'case-algorithm'; algorithm.textContent = entry.algorithm || 'Already solved';
    const caption = document.createElement('p'); caption.className = 'help';
    caption.textContent = database.mode === 'yau' ? 'Preserves FL, DL, and BL. Apply to the orientation shown; initial alignment is separate. Optimal for this reference orientation with U/Rw/3Rw/4Rw/M turns.' : 'Optimal across all U/F orientations of this case. Apply this algorithm to the orientation shown; initial alignment is separate.';
    detail.append(title, diagram(entry.mask, true), description, algorithm, caption);
    if (!popup && matchingMask !== null) {
      const orientation = L2CCases.orient(matchingMask, entry.mask);
      if (orientation) {
        const setup = document.createElement('p');
        setup.textContent = 'From your current cube, first apply: ' + ((database.mode === 'yau' ? yauAdjustments(L2CCases.adjustments(orientation)) : L2CCases.adjustments(orientation)) || 'no adjustment needed') + '.';
        detail.append(setup);
      }
    }
    const labels = document.createElement('p'); labels.className = 'help';
    labels.textContent = `Top orange: corners ${entry.corners.toLowerCase()}, edges ${entry.edges.toLowerCase()}. Front green: corners ${entry.frontCorners.toLowerCase()}, edges ${entry.frontEdges.toLowerCase()}.`;
    const blocks = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Show face adjustments and setup blocks';
    const expanded = document.createElement('code'); expanded.className = 'case-algorithm'; expanded.textContent = (database.mode === 'yau' ? groupYauSolution(entry.algorithm) : entry.blocks.map(block => simplifyCubeMoves(block.split(' ')).join(' '))).join(' + ') || 'No moves'; blocks.append(summary, expanded);
    const load = document.createElement('button'); load.type = 'button'; load.textContent = 'Load this orientation into the cube';
    load.addEventListener('click', () => {
      actions.load(entry);
      matchingMask = entry.mask;
      status.textContent = `Loaded ${entry.id}. The cube now matches the reference orientation.`;
      showDetail(entry);
    });
    detail.append(labels, blocks);
    if (actions.practice && actions.practice.allowed(entry.id)) {
      const practice = document.createElement('button'); practice.type = 'button'; practice.dataset.practiceToggle = entry.id;
      practice.textContent = actions.practice.has(entry.id) ? 'Remove from practice' : 'Add to practice';
      practice.addEventListener('click', () => actions.practice.set([entry.id], !actions.practice.has(entry.id)));
      detail.append(practice);
    }
    if (!popup) detail.append(load);
  }
  let modal = null, modalContent = null;
  function openCasePopup(id) {
    const entry = database.cases.find(c => c.id === id);
    if (!entry) return false;
    if (!modal) {
      modal = document.createElement('dialog'); modal.className = 'case-popup';
      modal.setAttribute('aria-label', 'Case details');
      const close = document.createElement('button'); close.type = 'button'; close.className = 'case-popup-close'; close.textContent = 'Close';
      close.addEventListener('click', () => modal.close());
      modal.addEventListener('click', event => { if (event.target === modal) { const box = modal.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close(); } });
      modalContent = document.createElement('div'); modalContent.className = 'case-popup-content';
      modal.append(close, modalContent); root.append(modal);
    }
    showDetail(entry, modalContent);
    modal.showModal();
    return true;
  }
  function filtered() {
    const query = search.value.trim().toLowerCase();
    const result = database.cases.filter(entry => {
      if (selectedCounts.size && !selectedCounts.has(entry.count)) return false;
      const normalize = text => text.toLowerCase().replace(/\u00d7/g, 'x');
      if (query && !normalize(`${entry.id} ${entry.topName} ${entry.frontName}`).includes(normalize(query))) return false;
      for (const name of ['topName', 'frontName', 'exchanged', 'corners', 'edges', 'frontCorners', 'frontEdges']) {
        if (fields[name].value !== '' && String(entry[name]) !== fields[name].value) return false;
      }
      return true;
    });
    const sort = fields.sort.value;
    const ordering = {
      moves: ['count', 1], 'moves-desc': ['count', -1],
      exchanged: ['exchanged', 1], 'exchanged-desc': ['exchanged', -1]
    }[sort];
    const nameOrdering = { 'top-name': ['topName', 1], 'top-name-desc': ['topName', -1], 'front-name': ['frontName', 1], 'front-name-desc': ['frontName', -1] }[sort];
    result.sort((a, b) => (nameOrdering ? a[nameOrdering[0]].localeCompare(b[nameOrdering[0]]) * nameOrdering[1] : ordering ? (a[ordering[0]] - b[ordering[0]]) * ordering[1] : 0) || a.id.localeCompare(b.id));
    return result;
  }
  function render() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(page, pages - 1);
    grid.replaceChildren();
    section.querySelector('.case-result-count').textContent = `${list.length} matching ${list.length === 1 ? 'case' : 'cases'}`;
    if (!list.length) {
      const empty = document.createElement('p'); empty.textContent = 'No cases match these filters. Try clearing a filter.'; grid.append(empty);
    }
    for (const entry of list.slice(page * pageSize, (page + 1) * pageSize)) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'case-card';
      card.setAttribute('aria-pressed', String(entry.id === selected));
      const header = document.createElement('span'); header.className = 'case-card-title'; header.textContent = `${entry.id} | ${entry.count} moves`;
      const label = document.createElement('span'); label.className = 'case-card-caption'; label.textContent = `${entry.exchanged} exchanged | ${entry.corners} corners / ${entry.edges} edges`;
      card.append(header, diagram(entry.mask), label);
      card.addEventListener('click', () => { matchingMask = null; showDetail(entry); render(); detail.scrollIntoView({ block: 'nearest' }); });
      if (actions.practice) {
        const shell = document.createElement('div'); shell.className = 'case-card-shell';
        const label = document.createElement('label'); label.className = 'practice-check';
        const check = document.createElement('input'); check.type = 'checkbox'; check.dataset.practiceId = entry.id;
        check.checked = actions.practice.has(entry.id); check.disabled = !actions.practice.allowed(entry.id);
        const text = document.createElement('span'); text.textContent = check.disabled ? 'Solved case - no practice needed' : 'Practice ' + entry.id;
        check.addEventListener('change', () => actions.practice.set([entry.id], check.checked));
        label.append(check, text); shell.append(card, label); grid.append(shell);
      } else grid.append(card);
    }
    previous.disabled = page === 0; next.disabled = page === pages - 1;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
  }
  for (const field of Object.values(fields)) field.addEventListener(field === search ? 'input' : 'change', () => { page = 0; render(); });
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  section.querySelector('[data-action="clear"]').addEventListener('click', () => {
    for (const field of Object.values(fields)) field.value = field === fields.sort ? 'id' : '';
    selectedCounts.clear(); updateCountButtons();
    page = 0; render();
  });
  section.querySelector('[data-action="match"]').addEventListener('click', () => {
    try {
      const mask = L2CCases.maskOf(model, actions.getState());
      const key = L2CCases.canonical(mask).key;
      const entry = database.cases.find(c => c.key === key);
      if (!entry) throw new Error('This layout is not an L2C case with the original fixed-center colors.');
      for (const field of Object.values(fields)) field.value = field === fields.sort ? 'id' : '';
      selectedCounts.clear(); updateCountButtons();
      search.value = entry.id; matchingMask = mask; page = 0;
      showDetail(entry); render();
      status.textContent = `Matched ${entry.id}, allowing independent U/F adjustments.`;
    } catch (error) { status.textContent = error.message; }
  });
  if (actions.practice) {
    section.querySelector('[data-action="practice-add"]').addEventListener('click', () => actions.practice.set(filtered().map(c => c.id), true));
    section.querySelector('[data-action="practice-remove"]').addEventListener('click', () => actions.practice.set(filtered().map(c => c.id), false));
  }
  render();
  return {
    openCasePopup,
    openCase(id) {
      const entry = database.cases.find(c => c.id === id);
      if (!entry) return false;
      for (const field of Object.values(fields)) field.value = field === fields.sort ? 'id' : '';
      selectedCounts.clear(); updateCountButtons();
      search.value = id; matchingMask = null; page = 0;
      status.textContent = ''; showDetail(entry); render();
      detail.setAttribute('tabindex', '-1'); detail.focus();
      detail.scrollIntoView({ block: 'nearest' });
      return true;
    },
    currentChanged() { matchingMask = null; status.textContent = ''; if (selected) showDetail(database.cases.find(c => c.id === selected)); },
    practiceChanged() {
      for (const check of grid.querySelectorAll('[data-practice-id]')) check.checked = actions.practice.has(check.dataset.practiceId);
      for (const button of [...detail.querySelectorAll('[data-practice-toggle]'), ...(modalContent ? modalContent.querySelectorAll('[data-practice-toggle]') : [])]) button.textContent = actions.practice.has(button.dataset.practiceToggle) ? 'Remove from practice' : 'Add to practice';
    }
  };
}
