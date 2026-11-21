// Optional real Redis integration: REDIS_SERVER and REDIS_CLI point to binaries.
const assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {community}=require('../server/community.cjs'),{optimalFor,validate}=require('../server/algorithms.cjs');
(async()=>{
  if(!process.env.REDIS_SERVER || !process.env.REDIS_CLI){console.log('Redis integration skipped: set REDIS_SERVER and REDIS_CLI.');return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'l2c-vote-test-')),socket=path.join(dir,'redis.sock');
  const proc=spawn(process.env.REDIS_SERVER,['--port','0','--unixsocket',socket,'--save','','--appendonly','no'],{stdio:'ignore'});
  try{
    for(let n=0;n<100 && !fs.existsSync(socket);n++)await new Promise(r=>setTimeout(r,25));
    const command=async args=>execFileSync(process.env.REDIS_CLI,['-s',socket,'--raw',...args.map(String)],{encoding:'utf8'}).trim();
    const base={mode:'redux',caseId:'L2C-001',voter:'browser-a',ip:'a',optimal:optimalFor('redux','L2C-001')};
    let result=await community(base,command);assert.deepEqual(result.top,[]);assert.ok(result.optimal.every(a=>a.votes===0));
    const id=base.optimal[0].id;
    result=await community({...base,action:'vote',id,active:true},command);assert.equal(result.top[0].votes,1);assert.equal(result.top[0].voted,true);
    result=await community({...base,action:'vote',id,active:true},command);assert.equal(result.top[0].votes,1);
    result=await community({...base,voter:'browser-b',ip:'b',action:'vote',id,active:true},command);assert.equal(result.top[0].votes,2);
    result=await community({...base,action:'vote',id,active:false},command);assert.equal(result.top[0].votes,1);assert.equal(result.top[0].voted,false);
    result=await community({...base,action:'vote',id,active:false},command);assert.equal(result.top[0].votes,1);
    const algorithm=validate('redux','L2C-001',base.optimal[0].algorithm+' R');
    result=await community({...base,action:'submit',id:algorithm.id,algorithm},command);assert.equal(result.submissions.length,1);assert.equal(result.submissions[0].votes,0);
    result=await community({...base,action:'submit',id:algorithm.id,algorithm},command);assert.equal(result.submissions.length,1);
    result=await community({...base,action:'vote',id:algorithm.id,active:true},command);assert.ok(result.top.some(a=>a.id===algorithm.id));
    result=await community({...base,mode:'yau',optimal:optimalFor('yau','L2C-001')},command);assert.deepEqual(result.top,[]);
    await assert.rejects(community({...base,action:'vote',id:'unknown',active:true},command),/not found/);
    console.log('Passed real Redis: empty rankings, idempotent voting/removal, shared totals, submissions/deduplication, mode isolation, unknown-alg rejection.');
  }finally{if(proc.exitCode===null){proc.kill();await new Promise(r=>proc.once('exit',r));}fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
