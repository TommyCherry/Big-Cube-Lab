const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.textContent='';this.value='';}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,v){this.events[k]=v;}
}
const nodes=root=>[root,...root.children.flatMap(nodes)];
let response,requests=[];
const context=vm.createContext({document:{createElement:tag=>new Element(tag)},OPTIMAL_ALTERNATIVES:{redux:{'L2C-001':["Rw U Rw'"]}},AbortSignal,fetch:async(url,options)=>{requests.push({url,options});return response;}});
vm.runInContext(fs.readFileSync('community-solutions.js','utf8')+'\nthis.mount=mountCommunitySolutions;',context);
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  response={ok:true,json:async()=>({optimal:[{algorithm:"Rw U Rw'",count:3,id:'id',votes:0,voted:false}],top:[],submissions:[]})};
  const target=new Element('div');context.mount(target,{}, {id:'L2C-001',count:3});await tick();
  assert.ok(nodes(target).some(n=>n.textContent==='Top 5 optimal solutions'));
  assert.ok(nodes(target).some(n=>n.textContent.startsWith('No votes yet.')));
  const vote=nodes(target).find(n=>n.textContent==='Vote (0)');assert.equal(vote.disabled,false);
  response={ok:true,json:async()=>({optimal:[{algorithm:"Rw U Rw'",count:3,id:'id',votes:1,voted:true}],top:[{algorithm:"Rw U Rw'",count:3,id:'id',votes:1,voted:true}],submissions:[]})};
  await vote.events.click();await tick();assert.equal(JSON.parse(requests.at(-1).options.body).active,true);
  assert.ok(nodes(target).some(n=>n.textContent==='Voted (1)'));
  const input=nodes(target).find(n=>n.tag==='textarea');input.value='bad';
  response={ok:false,json:async()=>({error:'Invalid move'})};
  nodes(target).find(n=>n.tag==='form').events.submit({preventDefault(){}});await tick();
  assert.equal(input.value,'bad');assert.ok(nodes(target).some(n=>n.textContent==='Invalid move'));
  response={ok:false,json:async()=>({error:'Community voting is not connected yet.'})};
  const offline=new Element('div');context.mount(offline,{}, {id:'L2C-001',count:3});await tick();
  assert.ok(nodes(offline).some(n=>n.textContent==="Rw U Rw'"));
  assert.ok(!nodes(offline).some(n=>n.textContent.startsWith('No votes yet.')));
  assert.equal(nodes(offline).find(n=>n.textContent==='Submit algorithm').disabled,true);
  console.log('Passed: solution sections, honest empty/offline states, vote action, submitted-input preservation on errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});
