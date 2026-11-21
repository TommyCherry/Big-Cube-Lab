const assert=require('node:assert/strict');
const {validate,optimalFor}=require('../server/algorithms.cjs');
const handler=require('../api/solutions');
const model=require('../cube-model');
const {createExpandedSolver,searchExpandedSolutions}=require('../expanded-solver');
const cases=require('../case-library');
for(const mode of ['redux','yau']) for(const entry of require(mode==='redux'?'../data/l2c-cases.json':'../data/yau-cases.json').cases) {
  const algs=optimalFor(mode,entry.id);
  assert.ok(algs.length>=1 && algs.length<=5);
  assert.equal(new Set(algs.map(a=>a.id)).size,algs.length);
  for(const alg of algs) assert.equal(alg.count,entry.count,mode+' '+entry.id);
}
assert.throws(()=>validate('redux','L2C-001',''),/does not solve/);
assert.throws(()=>validate('redux','L2C-001','<script>'),/Invalid move/);
assert.throws(()=>validate('yau','L2C-000','L'),/preserve/);
const solved=validate('redux','L2C-000','');
assert.equal(validate('redux','L2C-000',"Rw Rw'").id,solved.id);
const config=createExpandedSolver(model);
const result=searchExpandedSolutions({...config,start:config.encode(cases.stateOf(model,511)),optimalOnly:true,resultLimit:5});
assert.equal(result.solutions.length,1);assert.equal(result.optimalCount,0);
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(data){this.data=data;return this;}};}
(async()=>{
  delete process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.VOTE_COOKIE_SECRET;
  let res=response();await handler({url:'/api/solutions?mode=redux&case=L2C-001',method:'GET',headers:{}},res);assert.equal(res.code,503);
  process.env.VOTE_COOKIE_SECRET='test-only-secret';
  const first=response(), id=handler.identity({headers:{}},first);
  const cookie=first.headers['Set-Cookie'].split(';')[0];
  assert.equal(handler.identity({headers:{cookie}},response()),id);
  assert.notEqual(handler.identity({headers:{cookie:cookie+'tamper'}},response()),id);
  res=response();await handler({url:'/api/solutions?mode=redux&case=L2C-001',method:'POST',headers:{host:'localhost',origin:'https://evil.example','content-type':'application/json'}},res);assert.equal(res.code,403);
  console.log('Passed: all 1,625 optimal alternatives, replay validation, duplicate effects, optimal-only stopping, signed cookies, missing storage and cross-origin rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
