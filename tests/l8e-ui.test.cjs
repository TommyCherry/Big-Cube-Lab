const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const element=()=>({value:'',children:[],attrs:{},events:{},addEventListener(k,f){this.events[k]=f;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},replaceChildren(){this.children=[];},append(...n){this.children.push(...n);}});
const nodes=Object.fromEntries(['form',...['scramble','status','constraints','class','class-summary','cycles','wing-rows','solve','search-mode','upper-algorithms','search-cancel','results','random','cancel','reset'].map(n=>`[data-l8e="${n}"]`),...['U','L','F','R','B','D'].map(f=>`[data-l8e-face="${f}"]`)].map(n=>[n,element()]));
const node=n=>nodes[`[data-l8e="${n}"]`],workers=[];
const blobs=new Map();let blobId=0;
class LocalURL extends URL {static createObjectURL(blob){const key='blob:'+ ++blobId;blobs.set(key,blob);return key;}static revokeObjectURL(){}}
class Worker {
 constructor(url){if(typeof url==='string')this.source=blobs.get(url).parts.join('');else assert.ok(url.pathname.endsWith('/vendor/cstimer/cstimer_module.js'));workers.push(this);}
 postMessage(data){this.data=data;}
 terminate(){this.terminated=true;}
 finish(){const messages=[],context={postMessage:data=>messages.push(data)};vm.createContext(context);vm.runInContext(this.source,context);context.onmessage({data:this.data});for(const data of messages)this.onmessage({data});}
}
const mount=vm.runInNewContext(fs.readFileSync('l8e-search.js','utf8')+'\n'+fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\nmountL8E',{Worker,URL:LocalURL,structuredClone,Blob:class{constructor(parts){this.parts=parts;}},document:{baseURI:'https://example.test/cube-interface.html',createElement:element}});
mount({querySelector:()=>({querySelector:s=>{assert.ok(nodes[s],s);return nodes[s];}})});
assert.equal(Object.entries(nodes).filter(([k])=>k.includes('face=')).reduce((n,[,e])=>n+e.children.length,0),96);
assert.equal(node('class').textContent,'1E 1E 1E 1E 1E 1E 1E 1E');
node('random').events.click();assert.equal(node('random').disabled,true);
let w=workers.at(-1);assert.equal(w.data[1],'scramble');assert.equal(w.data[2][0],'444l8e');
const c=require('../vendor/cstimer/cstimer_module');w.onmessage({data:[w.data[0],'scramble',c.getScramble('444l8e')]});
assert.match(node('status').textContent,/cross edges on D verified solved/);assert.match(node('constraints').textContent,/cross on D: all four edges solved and aligned/);assert.equal(node('random').disabled,false);
node('random').events.click();w=workers.at(-1);node('cancel').events.click();assert.equal(w.terminated,true);
const before=node('scramble').value;w.onmessage({data:[w.data[0],'scramble','bad']});assert.equal(node('scramble').value,before);
node('random').events.click();node('reset').events.click();assert.equal(workers.at(-1).terminated,true);assert.equal(node('scramble').value,'');
node('scramble').value='Rw';nodes.form.events.submit({preventDefault(){}});assert.match(node('constraints').textContent,/not solved/);assert.equal(node('class').textContent,'Not an L8E state');assert.equal(node('cycles').children.length,0);
node('scramble').value='bad';nodes.form.events.submit({preventDefault(){}});assert.equal(node('scramble').attrs['aria-invalid'],'true');
console.log('L8E UI: worker generation, verification, cancellation, stale results, reset and invalid input passed.');

node('scramble').value="Uw' R' F R F' R U' R' Uw";nodes.form.events.submit({preventDefault(){}});
node('solve').events.click();w=workers.at(-1);assert.equal(node('solve').disabled,true);w.finish();
assert.match(node('status').textContent,/Heuristic pairing solution/);assert.ok(node('results').children.length>0);
const preview=node('results').children.find(n=>n.textContent==='Preview paired cube');preview.events.click();assert.equal(node('class').textContent,'1E 1E 1E 1E 1E 1E 1E 1E');
node('results').children.find(n=>n.textContent==='Show scrambled case').events.click();assert.notEqual(node('class').textContent,'1E 1E 1E 1E 1E 1E 1E 1E');
node('solve').events.click();w=workers.at(-1);node('search-cancel').events.click();w.onmessage({data:{result:{status:'solved'}}});assert.equal(w.terminated,true);assert.match(node('status').textContent,/cancelled/);
node('solve').events.click();w=workers.at(-1);w.onmessage({data:{result:{status:'solved',moves:'',steps:[],count:0}}});assert.match(node('status').textContent,/Solution rejected/);assert.equal(node('results').children.length,0);
node('solve').events.click();w=workers.at(-1);node('reset').events.click();assert.equal(w.terminated,true);
node('solve').events.click();workers.at(-1).finish();assert.match(node('status').textContent,/0 moves/);
console.log('L8E search UI: actual serialized worker, replay verification, previews, cancellation, stale results, reset and already paired cases passed.');
node('scramble').value="Uw R U R' Uw'";nodes.form.events.submit({preventDefault(){}});
node('search-mode').value='optimal';node('search-mode').events.change();assert.equal(node('results').children.length,0);
node('solve').events.click();w=workers.at(-1);assert.equal(w.data.mode,'optimal');w.finish();assert.match(node('status').textContent,/Proven minimum block cost: 5/);
node('solve').events.click();w=workers.at(-1);
const exact=vm.runInNewContext(fs.readFileSync('l8e-search.js','utf8')+'\nsearchL8EOptimal');
const unproved=exact({...w.data,seedMs:0});unproved.optimal=false;unproved.lowerBound=4;
w.onmessage({data:{result:unproved}});assert.match(node('status').textContent,/optimality not proven/);assert.match(node('status').textContent,/Lower bound: 4/);
node('solve').events.click();w=workers.at(-1);node('search-mode').value='heuristic';node('search-mode').events.change();assert.equal(w.terminated,true);assert.equal(node('results').children.length,0);
w.onmessage({data:{result:unproved}});assert.match(node('status').textContent,/Search mode changed/);
console.log('L8E optimal UI: actual exact worker, metric/proof labels, unproved incumbent and mode-switch cancellation passed.');
node('scramble').value="x Rw2' D2 Rw U2 Rw' D2 Rw U2 Lw";nodes.form.events.submit({preventDefault(){}});
node('search-mode').value='optimal';node('upper-algorithms').checked=true;node('upper-algorithms').events.change();assert.match(node('status').textContent,/toolbox changed/);
node('solve').events.click();w=workers.at(-1);assert.equal(w.data.allowUpper,true);assert.ok(w.data.macros.some(m=>m.kind==='U-layer pairing'));w.finish();assert.match(node('status').textContent,/Proven minimum block cost: 9/);assert.match(node('status').textContent,/U-layer algorithms enabled/);
node('solve').events.click();w=workers.at(-1);node('upper-algorithms').checked=false;node('upper-algorithms').events.change();assert.ok(w.terminated);assert.equal(node('results').children.length,0);
w.onmessage({data:{result:{status:'solved'}}});assert.match(node('status').textContent,/toolbox changed/);
console.log('U-layer toggle: serialized exact worker uses extended toolbox; proof scope, cancellation and stale-result rejection passed.');
