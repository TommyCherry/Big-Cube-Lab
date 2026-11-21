// Both trainer and case panels use reference-oriented, precomputed algorithms.
function mountCommunitySolutions(target, database, entry) {
  const mode = database.mode === 'yau' ? 'yau' : 'redux';
  const defaults = OPTIMAL_ALTERNATIVES[mode][entry.id];
  const url = `/api/solutions?mode=${mode}&case=${encodeURIComponent(entry.id)}`;
  target.replaceChildren(); target.className = 'community-solutions';
  const make = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  const optimal = make('section'), voted = make('section'), submissions = make('details');
  const status = make('p', 'Loading community votes...', 'help'); status.setAttribute('role','status');
  const refresh = make('button','Refresh votes'); refresh.type = 'button';
  const form = make('form'), label = make('label','Submit your algorithm'), input = make('textarea');
  input.rows = 2; input.maxLength = 1500; input.required = true; input.setAttribute('aria-label','Your algorithm for '+entry.id);
  input.placeholder = "Rw U Rw'";
  label.append(input);
  const submit = make('button','Submit algorithm'); submit.type = 'submit'; submit.className = 'primary'; submit.disabled = true;
  const help = make('p', 'Use the displayed reference orientation: green U, orange F. Submissions are checked before sharing. One vote per algorithm per browser; click again to remove it.', 'help');
  form.append(label,help,submit);
  target.append(optimal,voted,submissions,status,refresh,form);
  let data = null, busy = false, disposed = false;
  function rows(section, title, algorithms, empty, details = false) {
    section.replaceChildren(make(details ? 'summary':'h3',title));
    if (!algorithms.length) { section.append(make('p',empty,'help')); return; }
    const list = make('ol');
    for (const alg of algorithms) {
      const row = make('li'), text = make('code',alg.algorithm || 'Already solved','case-algorithm');
      const meta = make('div',null,'algorithm-vote-row');
      meta.append(make('span',`${alg.count} moves`,'help'));
      const button = make('button',data ? `${alg.voted ? 'Voted' : 'Vote'} (${alg.votes})` : 'Votes unavailable');
      button.type = 'button'; button.disabled = busy || !data; button.setAttribute('aria-pressed',String(Boolean(alg.voted)));
      button.setAttribute('aria-label',`${alg.voted ? 'Remove vote for' : 'Vote for'} ${alg.algorithm || 'Already solved'}`);
      button.addEventListener('click',() => request({action:'vote',id:alg.id,active:!alg.voted}));
      meta.append(button); row.append(text,meta); list.append(row);
    }
    section.append(list);
  }
  function render() {
    const algs = data?.optimal || defaults.map(algorithm=>({algorithm,count:entry.count}));
    rows(optimal,'Top 5 optimal solutions',algs,'No optimal solutions available.');
    optimal.append(make('p',algs.length<5 ? `${algs.length} distinct optimal solution${algs.length===1?'':'s'} for this orientation. Initial alignment is separate.` : 'All five are tied at the minimum move count. Initial alignment is separate.','help'));
    rows(voted,'Top 5 voted solutions',data?.top || [],data ? 'No votes yet. Vote for an optimal solution or submit your own.' : 'Community rankings are unavailable until votes load.');
    rows(submissions,'Community submissions',data?.submissions || [],'No submissions yet.',true);
    refresh.disabled = busy; submit.disabled = busy || !data;
  }
  async function request(body) {
    if (busy || disposed) return;
    busy = true; render(); status.textContent = body ? 'Saving...' : 'Loading community votes...';
    try {
      const response = await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
      let result; try { result = await response.json(); } catch { throw Error('Community voting requires the site server. Optimal solutions are available offline.'); }
      if (!response.ok) throw Error(result.error || 'Could not load community votes.');
      if (disposed) return;
      data = result;
      if (body?.action === 'submit') input.value = '';
      status.textContent = body?.action === 'submit' ? 'Algorithm verified. It is now available for voting (equivalent algorithms share votes).' : body ? 'Vote saved.' : 'Community votes are shared across visitors. No account needed.';
    } catch (error) {
      if (!disposed) status.textContent = error.name === 'TimeoutError' ? 'Community request timed out. Please retry.' : error.message;
    } finally {busy = false;if(!disposed) render();}
  }
  refresh.addEventListener('click',()=>request());
  form.addEventListener('submit',event=>{event.preventDefault();request({action:'submit',algorithm:input.value});});
  render(); request();
  return () => { disposed = true; };
}
