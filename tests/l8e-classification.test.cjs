const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {classifyL8EPairs:classify,createL8EModel}=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\n({classifyL8EPairs,createL8EModel})');
const slots=['UF','UR','UB','UL','FR','FL','BR','BL'];
const pairsFor=p=>p.map((other,i)=>({slot:slots[i],types:['edge-'+i,'edge-'+other]}));
function expected(p){const seen=new Set(),lengths=[];for(let i=0;i<8;i++){if(seen.has(i))continue;let n=0,j=i;while(!seen.has(j)){seen.add(j);n++;j=p[j];}lengths.push(n);}return lengths.sort((a,b)=>b-a).map(n=>n+'E').join(' ');}
assert.equal(classify(pairsFor([1,0,3,2,5,4,7,6])).signature,'2E 2E 2E 2E');
assert.equal(classify(pairsFor([1,2,3,4,5,6,7,0])).signature,'8E');
assert.equal(classify(pairsFor([1,2,0,4,5,3,7,6])).signature,'3E 3E 2E');
let count=0;const classes=new Set();
function permutations(a,start=0){if(start===8){
 const pairs=pairsFor(a),result=classify(pairs);assert.equal(result.signature,expected(a));
 assert.equal(result.cycles.reduce((sum,c)=>sum+c.size,0),8);classes.add(result.signature);count++;
 // Reversing local wing order, slot order, and type labels cannot change the class.
 const renamed=pairs.map((p,i)=>({slot:'slot-'+i,types:p.types.map(t=>'new-'+t).reverse()})).reverse();
 assert.equal(classify(renamed).signature,result.signature);return;
}for(let i=start;i<8;i++){[a[start],a[i]]=[a[i],a[start]];permutations(a,start+1);[a[start],a[i]]=[a[i],a[start]];}}
permutations([0,1,2,3,4,5,6,7]);assert.equal(count,40320);assert.equal(classes.size,22);
assert.throws(()=>classify([]));assert.throws(()=>classify(pairsFor([0,0,0,0,0,0,0,0])));
const model=createL8EModel();
for(const algorithm of ['', 'U', 'U2', "U'"]){
 const state=model.apply(model.solved(),model.parse(algorithm)),result=model.classify(state);
 assert.equal(result.available,true);assert.equal(result.signature,'1E 1E 1E 1E 1E 1E 1E 1E');assert.equal(result.pairedCount,8);
 assert.ok(result.pairs.every(p=>p.aligned));
}
for(const algorithm of ['Rw','D','R'])assert.equal(model.classify(model.apply(model.solved(),model.parse(algorithm))).available,false);
console.log('L8E classification: user examples, all 40,320 permutations / 22 cycle types, relabeling, misplaced paired edges, and invalid-stage gating passed.');
