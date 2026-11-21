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
const scheduled=[];
const workers=[], blobs=new Map(); let deferred=false, failSend=false;
class Worker {
  constructor(url) {this.source=blobs.get(url);this.terminated=false;workers.push(this);
    this.context=vm.createContext({postMessage:data=>{if(!this.terminated)this.onmessage({data});}});
    vm.runInContext(this.source,this.context);
  }
  postMessage(request) {
    if(failSend)throw new Error('test transport failure');
    this.request=request;
    return;
    this.pending=this.context.onmessage({data:request});
  }
  terminate(){this.terminated=true;}
}
const mount=vm.runInNewContext(fs.readFileSync('six.js','utf8')+'\nmountSix',{
  setTimeout:fn=>scheduled.push(fn),
  document:{createElement:()=>new Element()}, Worker, searchSixIDA:require('../six-ida').searchSixIDA, installSixWorker:require('../six-cache').installSixWorker, preferSixUTurns:require('../six-notation').preferSixUTurns,
  Blob:class {constructor(parts){this.source=parts.join('');}},
  URL:{createObjectURL(blob){const url='blob:'+blobs.size;blobs.set(url,blob.source);return url;},revokeObjectURL() {}}
});
get('[data-six="depth"]').value='10';get('[data-six="seconds"]').value='30';get('[data-six="mode"]').value='redux';
get('[data-six="algorithm"]').value='ida';
mount(root);
assert.equal(workers.length,0,'Initial rendering precedes preparation');
scheduled.shift()();
let active=workers.at(-1);
assert.equal(active.request.prepareOnly,true);
assert.equal(active.request.maxMs,120000);
assert.notEqual(get('[data-six="solve"]').disabled,true,'Preparation must not block UI');
get('[data-six="example"]').click();
assert.equal(active.terminated,false,'Applying a case keeps preparation alive');
active.onmessage({data:{progress:{phase:'patterns',patternsBuilt:2,totalPatterns:28}}});
assert.match(get('.six-cache-status').textContent,/background: 2\/28/);
assert.match(get('.six-status').textContent,/Scramble applied/);
get('[data-six="solve"]').click();
assert.equal(active.request.prepareOnly,true,'Search waits for ongoing preparation');
active.onmessage({data:{result:{status:'prepared'}}});
assert.equal(workers.length,1,'Search reuses the prepared worker');
assert.equal(active.request.prepareOnly,false);
const model=require('../six').createSixModel();
assert.equal(active.request.start,model.encode(model.apply(model.solved(),model.parse("Rw U Rw'"))));
get('[data-six="cancel"]').click();
assert.equal(active.terminated,true);
get('[data-six="mode"]').value='yau';get('[data-six="mode"]').events.change();
scheduled.shift()();active=workers.at(-1);
assert.equal(active.request.moves.length,15);
get('[data-six="solve"]').click();
get('[data-six="example"]').click();
active.onmessage({data:{result:{status:'prepared'}}});
assert.equal(active.request.prepareOnly,true,'Applying another case clears a queued solve');
assert.match(get('.six-cache-status').textContent,/ready/);
get('[data-six="mode"]').value='redux';get('[data-six="mode"]').events.change();
scheduled.shift()();active=workers.at(-1);
get('[data-six="solve"]').click();
get('[data-six="cancel"]').click();
active.onmessage({data:{result:{status:'prepared'}}});
assert.equal(active.terminated,true);
assert.equal(get('.six-status').textContent,'Search cancelled.','Late preparation messages cannot restart a cancelled solve');
get('[data-six="mode"]').events.change();scheduled.shift()();active=workers.at(-1);
get('[data-six="solve"]').click();active.onmessage({data:{error:'storage worker failed'}});
assert.equal(active.terminated,true);
assert.notEqual(workers.at(-1),active);
assert.equal(workers.at(-1).request.prepareOnly,false,'Preparation failure falls back to normal search');
console.log('Passed: automatic background preparation, nonblocking case edits, queued solve reuse, mode changes, cancellation, stale messages, and error fallback.');
})().catch(error=>{console.error(error);process.exitCode=1;});
