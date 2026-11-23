const assert=require('node:assert/strict');
const {CubeOrientation:o}=require('../orientation');
assert.equal(o.rotations.length,24);
const schemes=new Set();
for(const up of Object.values(o.reference))for(const front of Object.values(o.reference)){
 if(front===up||front===o.opposite[up]){assert.throws(()=>o.scheme(up,front));continue;}
 const scheme=o.scheme(up,front);schemes.add(JSON.stringify(scheme));
 assert.equal(scheme.U,up);assert.equal(scheme.F,front);
 for(const [a,b]of [['U','D'],['F','B'],['L','R']])assert.equal(scheme[b],o.opposite[scheme[a]]);
 for(const edges of [false,true]){
  const map=o.colorMap(up,front,edges),source=edges?o.edgeReference:o.reference;
  assert.equal(new Set(Object.values(map)).size,6);
  for(const face of Object.keys(source))assert.equal(map[source[face]],scheme[face]);
 }
}
assert.equal(schemes.size,24);
assert.deepEqual(o.scheme('green','orange'),o.reference);
assert.deepEqual(o.scheme('red','green'),o.edgeReference);
console.log('All 24 physical color orientations preserve opposites and consistent center/edge mappings.');
