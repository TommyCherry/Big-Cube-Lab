const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function element(){return {value:'',textContent:'',children:[],attrs:{},events:{},addEventListener(k,fn){this.events[k]=fn;},append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(k,v){this.attrs[k]=v;}};}
const names=['scramble','status','preview-status','results','colors','method','time','solve','cancel','random','reset'];
const nodes=Object.fromEntries(['form',...names.map(n=>`[data-first-center="${n}"]`),...'ULFRBD'.split('').map(f=>`[data-first-face="${f}"]`)].map(s=>[s,element()]));
const node=n=>nodes[`[data-first-center="${n}"]`];node('colors').value='white';node('method').value='both';node('time').value='30';
const workers=[],blobs=new Map();let nextBlob=0;
class Worker{constructor(url){this.source=blobs.get(url).parts.join('');workers.push(this);}terminate(){this.terminated=true;}postMessage(config){this.config=config;}finish(){const messages=[],context={postMessage:data=>messages.push(data)};vm.createContext(context);vm.runInContext(this.source,context);context.onmessage({data:this.config});for(const data of messages)this.onmessage({data});}}
const mount=vm.runInNewContext(['cube-model.js','first-center-search.js','first-center.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+'\nmountFirstCenter',{structuredClone,document:{createElement:element},Worker,Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const id=String(nextBlob++);blobs.set(id,blob);return id;},revokeObjectURL(){}}});
mount({querySelector:()=>({querySelector:s=>{assert.ok(nodes[s],s);return nodes[s];}})});
const tiles=()=>'ULFRBD'.split('').flatMap(f=>nodes[`[data-first-face="${f}"]`].children);
assert.equal(tiles().length,150);
node('scramble').value="Rw U Fw Rw2 U' Fw2";nodes.form.events.submit({preventDefault(){}});const initial=tiles().map(t=>t.className).join(',');
for(const selection of ['white','white/yellow','green/blue','red/orange','all']){
 node('colors').value=selection;node('colors').events.change();node('solve').events.click();const worker=workers.at(-1);
 assert.equal(worker.config.candidates.length,selection==='all'?12:selection.includes('/')?4:2);worker.finish();
 assert.match(node('status').textContent,/Comparison complete/);assert.equal(node('results').children.length,worker.config.candidates.length);
 const card=node('results').children[0];const last=card.children.at(-1);last.children.at(-1).events.click();assert.match(node('preview-status').textContent,/last bar/);
 card.children.find(n=>n.textContent==='Preview scramble').events.click();assert.equal(tiles().map(t=>t.className).join(','),initial);
}
node('solve').events.click();const stale=workers.at(-1);node('cancel').events.click();stale.finish();assert.match(node('status').textContent,/cancelled/);assert.equal(node('results').children.length,0);
node('solve').events.click();const changed=workers.at(-1);node('method').value='bars';node('method').events.change();changed.finish();assert.match(node('status').textContent,/Options changed/);
node('time').value='0';node('solve').events.click();workers.at(-1).finish();assert.match(node('status').textContent,/comparison incomplete/);assert.equal(node('results').children.length,0);
node('time').value='30';node('random').events.click();assert.equal(node('scramble').value.split(' ').length,60);
node('reset').events.click();assert.equal(node('scramble').value,'');node('solve').events.click();workers.at(-1).finish();assert.equal(node('results').children.length,6);
const picture=tiles().map(t=>t.className).join(',');node('scramble').value='invalid';nodes.form.events.submit({preventDefault(){}});assert.equal(tiles().map(t=>t.className).join(','),picture);assert.match(node('status').textContent,/Use outer/);
const built=fs.readFileSync('output/cube-interface.html','utf8');assert.ok(built.includes('mountFirstCenter(root);'));assert.ok(built.includes("'#first-center': 'first-center'"));
console.log('First-center UI: serialized worker, 150-sticker net, single/dual/full CN, previews, cancellation, stale results, timeout, reset and built-page integration passed.');
node('scramble').value="Rw U Fw Rw2 U' Fw2";nodes.form.events.submit({preventDefault(){}});
node('method').value='optimal';node('method').events.change();
for(const selection of ['white','white/yellow','all']){
 node('colors').value=selection;node('colors').events.change();node('solve').events.click();const worker=workers.at(-1);worker.finish();
 assert.ok(worker.config.candidates.every(c=>c.method==='optimal'));
 assert.match(node('status').textContent,/Proven globally shortest solution/);assert.match(node('status').textContent,/unchanged-color moves pruned/);
 assert.equal(node('results').children.length,1);const card=node('results').children[0];assert.match(card.children[1].textContent,/Globally optimal/);
 const preview=card.children.at(-1).children.at(-1);assert.equal(preview.textContent,'Preview solution');preview.events.click();assert.match(node('preview-status').textContent,/solved center/);
}
node('time').value='0';node('solve').events.click();workers.at(-1).finish();assert.match(node('status').textContent,/before proving a globally optimal solution/);assert.equal(node('results').children.length,0);
node('time').value='30';node('solve').events.click();const optimalStale=workers.at(-1);node('method').value='bars';node('method').events.change();optimalStale.finish();assert.match(node('status').textContent,/Options changed/);assert.equal(node('results').children.length,0);
console.log('Global first-center UI: actual worker, color-neutral proof scope, single finish preview, timeout labels and mode-switch cancellation passed.');
