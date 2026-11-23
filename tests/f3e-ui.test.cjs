const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function element(){return {value:'',checked:false,textContent:'',children:[],attrs:{},events:{},
 addEventListener(type,fn){this.events[type]=fn;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},
 setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};}
const names=['scramble','status','highlight','centers','paired','order','goal','edges','example','random','reset','solve','cancel','results','mode','mode-help'];
const nodes=Object.fromEntries(['form',...names.map(n=>`[data-f3e="${n}"]`),...['U','L','F','R','B','D'].map(f=>`[data-f3e-face="${f}"]`)].map(s=>[s,element()]));
const node=name=>nodes[`[data-f3e="${name}"]`];node('highlight').checked=true;node('mode').value='three-stage';
const workers=[],blobs=new Map();let blobId=0;
class Worker{
 constructor(url){this.source=blobs.get(url).parts.join('');workers.push(this);}
 terminate(){this.terminated=true;}
 postMessage(config){this.config=config;}
 finish(){
  const messages=[];
  const context={postMessage:data=>messages.push(data)};vm.createContext(context);
  vm.runInContext(this.source,context);context.onmessage({data:this.config});
  for(const data of messages)this.onmessage({data});
 }
}
const mount=vm.runInNewContext(fs.readFileSync(require.resolve('../f3e-search'),'utf8')+'\n'+fs.readFileSync(require.resolve('../f3e'),'utf8')+'\nmountF3E',{
 document:{createElement:element},structuredClone,Worker,Blob:class{constructor(parts){this.parts=parts;}},
 URL:{createObjectURL:blob=>{const id=String(blobId++);blobs.set(id,blob);return id;},revokeObjectURL(){}}
});
mount({querySelector:()=>({querySelector:s=>{assert.ok(nodes[s],s);return nodes[s];}})});
const tiles=()=>['U','L','F','R','B','D'].flatMap(f=>nodes[`[data-f3e-face="${f}"]`].children);
assert.equal(tiles().length,96);
assert.equal(tiles().filter(t=>t.className.includes('f3e-muted')).length,72);
assert.equal(tiles().filter(t=>t.className.includes('f3e-target')).length,12);
for(const color of ['red','green','orange','blue'])assert.equal(tiles().filter(t=>t.className.includes('f3e-'+color)&&!t.className.includes('f3e-muted')).length,2,'Both white-'+color+' wing partners are visible');

assert.equal(node('goal').textContent,'F3E goal satisfied');
node('example').events.click();
assert.equal(node('goal').textContent,'F3E goal not yet satisfied');
assert.ok(node('status').textContent.includes('Ready to find an F3E solution'));
assert.ok(node('centers').textContent.includes('preserved'));
const picture=tiles().map(t=>t.className).join('|');
node('scramble').value='Lw U';nodes.form.events.submit({preventDefault(){}});
assert.equal(node('scramble').attrs['aria-invalid'],'true');
assert.equal(tiles().map(t=>t.className).join('|'),picture,'Invalid input must preserve displayed state');
node('highlight').checked=false;node('highlight').events.change();assert.ok(tiles().every(t=>!t.className.includes('f3e-muted')));
node('random').events.click();assert.ok(node('scramble').value.split(' ').length<=30);
assert.equal(node('goal').textContent,'F3E goal not yet satisfied');
assert.equal(node('scramble').attrs['aria-invalid'],undefined);
node('reset').events.click();assert.equal(node('scramble').value,'');assert.equal(node('goal').textContent,'F3E goal satisfied');
const layout=fs.readFileSync(`${__dirname}/../layout.html`,'utf8');
assert.ok(layout.includes('id="f3e-solver"'));
assert.ok(layout.includes('data-f3e="solve"'));
const built=fs.readFileSync(`${__dirname}/../output/cube-interface.html`,'utf8');
assert.ok(built.includes('mountF3E(root);'));assert.ok(built.includes("'#f3e': 'f3e-solver'"));
console.log('Passed: F3E page initialization, 96-sticker net, highlighting, target slots, example/random/reset, invalid-input preservation, solver controls, and build integration.');

node('example').events.click();
const original=tiles().map(t=>t.className).join('|');
node('solve').events.click();
assert.ok(node('solve').disabled);assert.equal(node('cancel').hidden,false);
const worker=workers.at(-1);assert.equal(worker.config.maxMs,undefined);assert.equal(worker.config.maxDepth,undefined);
worker.finish();
assert.ok(worker.terminated);assert.equal(node('solve').disabled,false);
assert.ok(node('status').textContent.includes('not guaranteed globally optimal'));
const preview=node('results').children.find(n=>n.textContent==='Preview stage 3');assert.ok(preview);preview.events.click();
assert.equal(node('goal').textContent,'F3E goal satisfied');
node('highlight').checked=true;node('highlight').events.change();assert.equal(node('goal').textContent,'F3E goal satisfied','Highlighting retains the chosen preview');
node('results').children.find(n=>n.textContent==='Show scrambled case').events.click();
assert.equal(node('goal').textContent,'F3E goal not yet satisfied');
node('solve').events.click();const cancelled=workers.at(-1);node('cancel').events.click();
assert.ok(cancelled.terminated);const cancelText=node('status').textContent;
cancelled.onmessage({data:{progress:'stale'}});assert.equal(node('status').textContent,cancelText);
node('solve').events.click();const stale=workers.at(-1);node('reset').events.click();
assert.ok(stale.terminated);assert.equal(node('results').children.length,0);
stale.finish();assert.equal(node('results').children.length,0);
node('solve').events.click();workers.at(-1).onerror({message:'test worker error'});
assert.ok(node('status').textContent.includes('test worker error'));assert.equal(node('solve').disabled,false);
console.log('Passed: actual serialized solver worker, stage previews, highlighting previews, cancellation, stale results, applying new cases, and worker errors.');

// A sequence that restores an edge at the boundary must still be rejected if
// an intermediate turn breaks it.
node('reset').events.click();node('solve').events.click();
workers.at(-1).onmessage({data:{result:{status:'solved',stages:[
 {slot:'FL',color:'green',moves:'',count:0},
 {slot:'DL',color:'orange',moves:"F F'",count:2},
 {slot:'BL',color:'blue',moves:'',count:0}
]}}});
assert.ok(node('status').textContent.includes('previously solved edge was disturbed'));
assert.equal(node('results').children.length,0);
console.log('Passed: frontend rejects solutions that break and restore a previously solved edge.');

node('example').events.click();node('solve').events.click();const prior=workers.at(-1);
node('mode').value='global';node('mode').events.change();
assert.ok(prior.terminated);assert.equal(node('results').children.length,0);
assert.ok(node('mode-help').textContent.includes('only the final three edges'));
node('solve').events.click();assert.equal(workers.at(-1).config.mode,'global');workers.at(-1).finish();
assert.ok(node('status').textContent.includes('globally optimal within'));
assert.ok(!node('results').children.some(n=>n.textContent.startsWith('Stage ')));
node('results').children.find(n=>n.textContent==='Preview solved').events.click();assert.equal(node('goal').textContent,'F3E goal satisfied');
node('mode').value='three-stage';node('mode').events.change();
assert.ok(node('mode-help').textContent.includes('every later move'));
assert.equal(node('results').children.length,0);
assert.equal(node('goal').textContent,'F3E goal not yet satisfied');
console.log('Passed: globally optimal worker mode, truthful labels, solved preview, and mode switching cancels stale searches and clears results.');
