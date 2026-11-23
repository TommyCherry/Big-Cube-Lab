const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../data/l8e-examples.json');
const element=()=>({value:'',textContent:'',children:[],attrs:{},events:{},addEventListener(k,f){this.events[k]=f;},setAttribute(k,v){this.attrs[k]=v;},replaceChildren(){this.children=[];},append(...n){this.children.push(...n);}});
const names=['upper-algorithms','class','subclass','spatial-summary','spatial-guide','spatial-components','spatial-relations','coverage','example','solution','count','signature','guide-title','guide','scramble','algorithm','proof','lesson','preview-status','previous','next','steps','start','finish','load'];
const nodes=Object.fromEntries([...names.map(n=>`[data-l8e-examples="${n}"]`),...['U','L','F','R','B','D'].map(f=>`[data-l8e-example-face="${f}"]`)].map(s=>[s,element()]));
const node=n=>nodes[`[data-l8e-examples="${n}"]`];let loaded,loadedOptions;
const mount=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\n'+fs.readFileSync('l8e-spatial.js','utf8')+'\n'+fs.readFileSync('l8e-examples.js','utf8')+'\nmountL8EExamples',{document:{createElement:element}});
mount({querySelector:()=>({querySelector:s=>{assert.ok(nodes[s],s);return nodes[s];}})},data,{load:(text,options)=>{loaded=text;loadedOptions=options;}});
assert.equal(node('class').children.length,22);assert.match(node('guide-title').textContent,/3E/);
assert.equal(Object.entries(nodes).filter(([k])=>k.includes('-face=')).reduce((n,[,e])=>n+e.children.length,0),96);
for(const allowUpper of [false,true]){
node('upper-algorithms').checked=allowUpper;node('upper-algorithms').events.change();
for(let i=0;i<data.classes.length;i++){
 node('class').value=String(i);node('class').events.change();assert.equal(node('signature').textContent,data.classes[i].signature);
 for(let spatialIndex=0;spatialIndex<data.classes[i].subclasses.length;spatialIndex++){
 node('subclass').value=String(spatialIndex);node('subclass').events.change();
 const chosen=data.classes[i].subclasses[spatialIndex].exampleIds.map(id=>data.classes[i].examples.find(e=>e.id===id));
 for(let j=0;j<chosen.length;j++){
  node('example').value=String(j);node('example').events.change();const example=chosen[j];
  assert.equal(node('spatial-summary').textContent,example.spatial.layerLabel);assert.ok(node('spatial-guide').textContent.length>20);
  assert.equal(node('solution').children.length,example[allowUpper?'upperSolutions':'solutions'].length);
  for(let k=0;k<example[allowUpper?'upperSolutions':'solutions'].length;k++){
   node('solution').value=String(k);node('solution').events.change();const solution=example[allowUpper?'upperSolutions':'solutions'][k];
   assert.equal(node('algorithm').textContent,solution.moves||'No moves needed.');
   assert.match(node('proof').textContent,allowUpper?/U-layer algorithms enabled/:/basic toolbox/);
   assert.match(node('proof').textContent,solution.optimal?/Proven minimum/:/optimality not proven/);
   node('finish').events.click();assert.match(node('preview-status').textContent,/Class: 1E 1E 1E 1E 1E 1E 1E 1E/);assert.equal(node('next').disabled,true);
   node('start').events.click();assert.equal(node('previous').disabled,true);
   if(solution.steps.length){node('next').events.click();assert.match(node('preview-status').textContent,/After block 1/);node('previous').events.click();assert.match(node('preview-status').textContent,/Scrambled case/);}
  }
  node('load').events.click();assert.equal(loaded,example.scramble);assert.equal(loadedOptions.allowUpper,allowUpper);
 }
 }
}
}
console.log('L8E examples UI: all classes/examples/alternatives, 96 stickers, proof labels, block previews, reset and solver handoff passed.');
