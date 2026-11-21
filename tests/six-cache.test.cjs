const assert=require('node:assert/strict'), vm=require('node:vm');
const {createSixModel}=require('../six'),{searchSixIDA}=require('../six-ida'),{installSixWorker}=require('../six-cache');
(async()=>{
  const model=createSixModel(), records=new Map();let reads=0,writes=0;
  const storage={async read(key){reads++;return records.get(key);},async write(key,value){writes++;records.set(key,value);}};
  function worker(store=storage){
    const messages=[];
    const context=vm.createContext({searchSixIDA,storage:store,postMessage:data=>messages.push(data)});
    vm.runInContext('('+installSixWorker.toString()+')(storage)',context);
    return {async run(data){messages.length=0;await context.onmessage({data});return [...messages];}};
  }
  const request={algorithm:'ida',goal:model.goal,start:model.goal,moves:model.searchMoves('redux'),maxDepth:12,maxMs:30000,prepareOnly:true};
  const first=worker();let messages=await first.run(request);
  assert.equal(messages.at(-1).result.status,'prepared');assert.equal(writes,1);assert.ok(messages.some(m=>m.cache==='saved'));
  const prepared=records.values().next().value;assert.equal(prepared.length,28);
  const deep={...request,prepareOnly:false,start:model.encode(model.apply(model.solved(),model.parse("Rw U Rw' 4Rw U' 4Rw' 3Rw U 3Rw' Rw U2 Rw'")))};
  messages=await first.run(deep);
  assert.equal(messages.at(-1).result.count,12);assert.equal(reads,1);assert.equal(writes,1);
  assert.ok(!messages.some(m=>m.progress?.phase==='patterns'));
  // A new worker/page uses the persisted tables, not the old in-memory object.
  records.set(records.keys().next().value,structuredClone(prepared));
  messages=await worker().run(deep);
  assert.equal(messages.at(-1).result.count,12);assert.ok(messages.some(m=>m.cache==='reused'));assert.ok(!messages.some(m=>m.progress?.phase==='patterns'));
  const before=reads;
  messages=await first.run({...request,moves:model.searchMoves('yau')});
  assert.equal(reads,before+1);assert.equal(records.size,2);assert.equal(writes,2);assert.equal(messages.at(-1).result.status,'prepared');
  // No completed pair set may be saved on a timed-out preparation.
  messages=await worker().run({...request,moves:request.moves.slice().reverse(),maxMs:0});
  assert.equal(messages.at(-1).result.status,'time-limit');assert.equal(writes,2);
  // Storage failure is nonfatal, and the resident worker still reuses its tables.
  const unavailable=worker({async read(){throw Error('blocked');},async write(){throw Error('quota');}});
  messages=await unavailable.run(request);assert.equal(messages.at(-1).result.status,'prepared');assert.ok(messages.some(m=>m.cache==='session-only'));
  messages=await unavailable.run(deep);assert.equal(messages.at(-1).result.count,12);assert.ok(!messages.some(m=>m.progress?.phase==='patterns'));
  // Deep search persists its completed tables before resuming the expensive search.
  const fresh=worker({async read(){return null;},async write(key,pairs){assert.equal(pairs.length,28);}});
  messages=await fresh.run(deep);assert.equal(messages.at(-1).result.count,12);assert.ok(messages.findIndex(m=>m.cache==='saved')<messages.length-1);
  console.log('Passed: prepare-ahead, resident reuse, reload persistence, mode isolation, timeout safety, storage fallback, and save-before-search.');
})().catch(error=>{console.error(error);process.exitCode=1;});
