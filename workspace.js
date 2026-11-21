function mountWorkspace(root) {
  const tabs = [...root.querySelectorAll('[data-view]')];
  const panels = new Map(tabs.map(tab => [tab.dataset.view, root.querySelector('#' + tab.dataset.view)]));
  const hashes = { '#solver': 'solver-view', '#trainer': 'trainer', '#case-library': 'case-library', '#six': 'six-solver', '#four': 'four-solver' };
  function show(id, { scroll = true, updateHash = true } = {}) {
    if (!panels.has(id)) return;
    for (const tab of tabs) {
      const active = tab.dataset.view === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels.get(tab.dataset.view).hidden = !active;
    }
    root.dataset.activeView = id;
    if (updateHash) {
      const hash = Object.keys(hashes).find(key => hashes[key] === id);
      try { history.replaceState(null, '', hash); } catch { /* Embedded previews may not allow history changes. */ }
    }
    if (scroll) root.scrollIntoView({ block: 'start' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab.dataset.view));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); show(tabs[next].dataset.view); tabs[next].focus();
    });
  });
  for (const link of root.querySelectorAll('a[href^="#"]')) {
    const view = hashes[link.getAttribute('href')];
    if (view) link.addEventListener('click', event => { event.preventDefault(); show(view); tabs.find(t => t.dataset.view === view).focus(); });
  }
  window.addEventListener('hashchange', () => show(hashes[location.hash] || 'solver-view', { updateHash: false }));
  show(hashes[location.hash] || 'solver-view', { scroll: false, updateHash: false });
  return { show };
}
