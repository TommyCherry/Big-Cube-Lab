const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../cube-model');
const run=text=>model.apply(model.solved(),model.parse(text));
for(const text of ['',"Rw U Rw'",'U F',"M' U M",'D']) assert.doesNotThrow(()=>model.validateL2C(run(text)));
for(const text of ['',"Rw U Rw'","M' U M"]) assert.doesNotThrow(()=>model.validateL2C(run(text),{yau:true}));
assert.throws(()=>model.validateL2C(run('Rw')),/within the U and F/);
// Both visible centers are full, but the hidden centers have been disturbed.
const hidden="3Rw' F' U2 3Rw2 U2 Rw' U' 3Rw'";
for(const face of ['U','F']) {const visible=model.visible(run(hidden),face);for(let r=1;r<4;r++)for(let c=1;c<4;c++)assert.notEqual(visible[r*5+c],'gray');}
assert.throws(()=>model.validateL2C(run(hidden)),/L, R, D, and B/);
assert.doesNotThrow(()=>model.validateL2C(run('F')));
assert.throws(()=>model.validateL2C(run('F'),{yau:true}),/F3E/);
for(const mode of ['redux','yau'])for(const entry of require(mode==='redux'?'../data/l2c-cases.json':'../data/yau-cases.json').cases)assert.doesNotThrow(()=>model.validateL2C(run(entry.scramble),{yau:mode==='yau'}),entry.id);
const html=fs.readFileSync('output/cube-centers.html','utf8');
assert.ok(html.includes('placeholder="e.g. Rw U Rw\'"'));
const source=html.slice(html.lastIndexOf("root.querySelector('form').addEventListener('submit'"),html.lastIndexOf('    })();'));
function fixture(yauSolver){
 const input={value:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 const status={textContent:'',classList:{add(){},remove(){}}};let submit,stopped=0,rendered=0,cleared=0;
 const context=vm.createContext({CubeModel:model,yauSolver,current:model.solved(),root:{querySelector(s){return s==='form'?{addEventListener(type,fn){submit=fn;}}:s==='textarea'?input:status;}},solverStatus:{textContent:''},results:{replaceChildren(){cleared++;}},stopSearch(){stopped++;},render(){rendered++;}});
 vm.runInContext(source,context);
 return {input,status,context,apply(text){input.value=text;submit({preventDefault(){}});},counts(){return [stopped,rendered,cleared];}};
}
for(const yau of [false,true]){
 const f=fixture(yau);f.apply("Rw U Rw'");const before=JSON.stringify(f.context.current),counts=f.counts();
 f.apply('Rw');assert.equal(JSON.stringify(f.context.current),before);assert.deepEqual(f.counts(),counts);assert.equal(f.input.attrs['aria-invalid'],'true');
 f.apply(hidden);assert.equal(JSON.stringify(f.context.current),before);assert.match(f.status.textContent,yau?/F3E|centers must remain solved/:/centers must remain solved/);
 f.apply('F');assert.equal(f.input.attrs['aria-invalid'],yau?'true':undefined);
 if(yau)assert.equal(JSON.stringify(f.context.current),before);
 f.apply('');assert.equal(f.input.attrs['aria-invalid'],undefined);assert.equal(JSON.stringify(f.context.current),JSON.stringify(model.solved()));
}
console.log('Passed: valid examples, all 672 library scrambles, hidden-center rejection, Yau F3E, and invalid input preserves the active cube/results.');
