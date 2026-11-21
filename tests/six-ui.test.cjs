(async () => {
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
class Element {
  constructor() { this.events={}; this.children=[]; this.value=''; this.textContent=''; this.attrs={}; }
  addEventListener(name, fn) {this.events[name]=fn;}
  append(...items) {this.children.push(...items);}
  replaceChildren(...items) {this.children=items;}
  setAttribute(name,value) {this.attrs[name]=value;}
  removeAttribute(name) {delete this.attrs[name];}
  click() {this.events.click();}
}
const elements = new Map(), get = selector => {if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);};
const section = {querySelector:get}, root={querySelector:selector=>{assert.equal(selector,'#six-solver');return section;}};
const workers=[], blobs=new Map(); let deferred=false, failSend=false;
class Worker {
  constructor(url) {this.source=blobs.get(url);this.terminated=false;workers.push(this);
    this.context=vm.createContext({postMessage:data=>{if(!this.terminated)this.onmessage({data});}});
    vm.runInContext(this.source,this.context);
  }
  postMessage(request) {
    if(failSend)throw new Error('test transport failure');
    this.request=request;
    if(deferred)return;
    this.pending=this.context.onmessage({data:request});
  }
  terminate(){this.terminated=true;}
}
const mount=vm.runInNewContext(fs.readFileSync('six.js','utf8')+'\nmountSix',{
  document:{createElement:()=>new Element()}, Worker, searchSixIDA:require('../six-ida').searchSixIDA, installSixWorker:require('../six-cache').installSixWorker, preferSixUTurns:require('../six-notation').preferSixUTurns,
  Blob:class {constructor(parts){this.source=parts.join('');}},
  URL:{createObjectURL(blob){const url='blob:'+blobs.size;blobs.set(url,blob.source);return url;},revokeObjectURL() {}}
});
get('[data-six="depth"]').value='10';get('[data-six="seconds"]').value='30';get('[data-six="mode"]').value='redux';
get('[data-six="algorithm"]').value='ida';
mount(root);
for(const engine of ['ida','ergonomic']) for(const mode of ['redux','yau']){
  get('[data-six="algorithm"]').value=engine;
  get('[data-six="mode"]').value=mode;
  get('[data-six="example"]').click();
  assert.equal(get('textarea').value,"Rw U Rw'");
  get('[data-six="solve"]').click();
  await workers.at(-1).pending;
  const worker=workers.at(-1);
  assert.equal(worker.request.algorithm, engine);
  assert.equal(worker.request.ergonomic,engine==='ergonomic');
  assert.ok(worker.request,'Click must send a search request, not just create a worker');
  assert.notEqual(worker.request.start,worker.request.goal);
  assert.equal('maxStates' in worker.request, false);
  assert.equal(worker.request.maxMs, 30000);
  assert.equal(worker.request.maxDepth, 10);
  assert.equal(worker.request.moves.length,(mode==='redux'?30:15)+(engine==='ergonomic'?12:0));
  assert.match(get('.six-result').children[0].textContent,/^3 moves/);
  assert.match(get('.six-status').textContent,/Verified all six centers/);
  if(engine==='ergonomic'){assert.match(get('.six-result').children[0].textContent,/ergonomic-optimal/);assert.equal(get('.six-result').children[3].children[0].textContent,'Show ergonomic blocks');}
  assert.equal(get('[data-six="solve"]').disabled,false);
  assert.equal(get('[data-six="cancel"]').hidden,true);
  assert.equal(worker.terminated,false);
}
get('[data-six="algorithm"]').value='ergonomic';get('[data-six="algorithm"]').events.change();
assert.equal(get('[data-six="depth"]').max,'30');
get('[data-six="depth"]').value='24';
get('[data-six="algorithm"]').value='ida';get('[data-six="algorithm"]').events.change();
assert.equal(get('[data-six="depth"]').value,'16');
get('[data-six="depth"]').value='10';
const workersBeforePrepare=workers.length;
get('[data-six="prepare"]').click(); await workers.at(-1).pending;
assert.equal(workers.at(-1).request.prepareOnly,true);
assert.equal(workers.at(-1).request.algorithm,'ida');
assert.match(get('.six-status').textContent,/Pattern tables are ready/);
get('[data-six="prepare"]').click(); await workers.at(-1).pending;
assert.equal(workers.length,workersBeforePrepare);
assert.match(get('.six-cache-status').textContent,/Reusing prepared/);
get('[data-six="random"]').click();
assert.match(get('.six-status').textContent,/Random 6x6 L2C case applied/);
assert.equal(get('.six-result').children.length,0);
for(const face of ['U','F']){
  const tiles=get(`[data-six-face="${face}"]`).children;
  for(let r=1;r<5;r++)for(let c=1;c<5;c++)assert.ok(!tiles[r*6+c].className.includes('gray'));
}
for (const [filter, columns] of [['one',3],['two',2]]) {
  get(`[data-six-filter="${filter}"]`).click();
  assert.equal(get(`[data-six-filter="${filter}"]`).attrs['aria-pressed'],'true');
  get('[data-six="random"]').click();
  const tiles=get('[data-six-face="F"]').children;
  for(let row=1;row<5;row++)for(let col=1;col<=columns;col++)assert.equal(tiles[row*6+col].className,'piece orange');
}
// The terminal commutator is shown even when no ordinary prefix blocks exist.
get('[data-six="algorithm"]').value='ergonomic';get('[data-six="depth"]').value='9';
const finish="Rw U Rw' 3Rw U' Rw' U Rw 3Rw'";
get('textarea').value=finish.split(' ').reverse().map(t=>t.endsWith("'")?t.slice(0,-1):t+"'").join(' ');
get('form').events.submit({preventDefault(){}});get('[data-six="solve"]').click();await workers.at(-1).pending;
assert.equal(get('.six-result').children[3].children[0].textContent,'Show blocks and final commutator');
assert.match(get('.six-result').children[3].children[1].textContent,/last exchanged oblique pair/);
get('[data-six="depth"]').value='10';
deferred=true; get('[data-six="seconds"]').value='120'; get('[data-six="solve"]').click();
assert.equal(workers.at(-1).request.maxMs,120000);
assert.equal(get('[data-six="solve"]').disabled,true);
get('[data-six="cancel"]').click();assert.equal(workers.at(-1).terminated,true);
assert.equal(get('.six-status').textContent,'Search cancelled.');
get('[data-six="algorithm"]').value='ida'; get('[data-six="solve"]').click();
workers.at(-1).onmessage({data:{result:{status:'time-limit',visited:205558784,provenThrough:10}}});
assert.match(get('.six-status').textContent,/search-node visits \(including repeats\)/);
assert.ok(!get('.six-status').textContent.includes('205,558,784 states'));
get('[data-six="mode"]').value='redux';
get('textarea').value="Rw U2 Rw' U' Rw U' Rw' 4Rw 3Rw' U' Rw U 4Rw' 3Rw U' Rw' Rw U' Rw'";
get('form').events.submit({preventDefault(){}});
get('[data-six="solve"]').click();
workers.at(-1).onmessage({data:{result:{status:'solved',moves:"3Rw 4Rw' F Rw' F' Rw 3Rw' 4Rw",count:8,visited:1}}});
assert.equal(get('.six-result').children[1].textContent,"3Rw Lw' U Rw' U' Rw 3Rw' Lw");
assert.match(get('.six-result').children[0].textContent,/^8 moves/);
failSend=true;get('[data-six="solve"]').click();
assert.match(get('.six-status').textContent,/Could not send search request/);
assert.equal(get('[data-six="solve"]').disabled,false);
console.log('Passed: example button -> search request -> actual worker code -> verified three-move result in both modes, cancellation, and dispatch failures.');

})().catch(error => { console.error(error); process.exitCode = 1; });
