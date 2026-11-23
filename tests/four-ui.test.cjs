const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {searchFour,createFourModel}=require('../four');
function element(){return {value:'',hidden:false,disabled:false,textContent:'',children:[],style:{},attrs:{},events:{},
 addEventListener(type,callback){this.events[type]=callback;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
 append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;}};}
const selectors=['textarea','.four-status','.four-results','form',...['solve','cancel','example','random','mode','mode-help'].map(s=>`[data-four="${s}"]`),...['U','F','D','B'].map(f=>`[data-four-face="${f}"]`)];
const nodes=Object.fromEntries(selectors.map(s=>[s,element()]));
nodes['[data-four="mode"]'].value='global';
const workers=[];
class Worker{constructor(){workers.push(this);}terminate(){this.terminated=true;}postMessage(config){this.config=config;}}
const mount=vm.runInNewContext(fs.readFileSync(require.resolve('../four'),'utf8')+'\nmountFour',{
 document:{createElement:element},Worker,Blob:class {},URL:{createObjectURL:()=>'',revokeObjectURL(){}},structuredClone
});
mount({querySelector:()=>({querySelector:selector=>{assert.ok(nodes[selector],selector);return nodes[selector];}})});
for(const f of ['U','F','D','B'])assert.equal(nodes[`[data-four-face="${f}"]`].children.length,4);
nodes['[data-four="example"]'].events.click();
const displayModel=createFourModel();
const exampleState=displayModel.apply(displayModel.solved(),displayModel.parse(displayModel.example));
for(const face of ['U','F','D','B']){
 const visible=displayModel.visible(exampleState,face);
 const expected=(face==='B'?[6,5,10,9]:[5,6,9,10]).map(i=>'piece '+visible[i]);
 assert.deepEqual(nodes[`[data-four-face="${face}"]`].children.map(tile=>tile.className),expected);
}
assert.ok(nodes['[data-four-face="B"]'].attrs['aria-label'].includes('mirrored left/right'));

for(const mode of ['global','half','first-center']){
 nodes['[data-four="mode"]'].value=mode;nodes['[data-four="mode"]'].events.change();
 assert.equal(nodes['.four-results'].children.length,0);
 nodes['[data-four="solve"]'].events.click();
 const worker=workers.at(-1);assert.equal(worker.config.mode,mode);assert.equal(worker.config.firstCenter,undefined);
 assert.equal(worker.config.maxMs,undefined);assert.equal(worker.config.maxDepth,undefined);
 worker.onmessage({data:{result:searchFour(worker.config)}});
 const status=nodes['.four-status'].textContent;
 assert.ok(status.includes(mode==='global'?'globally optimal':'not a global optimality claim'));
 assert.ok(worker.terminated);
 const text=nodes['.four-results'].children.map(n=>n.textContent).join('\n');
 if(mode==='global')assert.ok(!text.includes('Stage 1'));
 else assert.ok(text.includes(mode==='half'?'Preview half centers':'Preview first center'));
}
nodes['[data-four="solve"]'].events.click();
const pending=workers.at(-1);
nodes['[data-four="mode"]'].value='half';nodes['[data-four="mode"]'].events.change();
assert.ok(pending.terminated);assert.equal(nodes['.four-results'].children.length,0);
nodes['[data-four="solve"]'].events.click();assert.equal(workers.at(-1).config.firstCenter,undefined);
nodes['[data-four="cancel"]'].events.click();assert.ok(workers.at(-1).terminated);
assert.equal(nodes['.four-status'].textContent,'Search cancelled.');
console.log('Passed: approach selection, center-only display, truthful result labels, unlimited worker config, clearing stale results, and cancellation.');
// Frontend must accept and explain a rotated finish, rather than reject its replay.
nodes.textarea.value="U' 3Rw' U 3Rw' U2 Rw2 U Rw U l' U2 Rw U l2 U' 3Rw2 U2 3Rw' U' Rw U' Rw' U Rw'";
nodes.form.events.submit({preventDefault(){}});
nodes['[data-four="mode"]'].value='half';nodes['[data-four="mode"]'].events.change();
nodes['[data-four="solve"]'].events.click();
const rotatedWorker=workers.at(-1);
rotatedWorker.onmessage({data:{result:searchFour(rotatedWorker.config)}});
assert.ok(nodes['.four-status'].textContent.includes('stage-optimal (4 + 10)'));
assert.ok(nodes['.four-results'].children.some(n=>n.textContent==='Solved orientation: U = blue, F = red, D = green, B = orange.'));
console.log('Passed: rotated solved state is replay-verified and its face colors are displayed.');
