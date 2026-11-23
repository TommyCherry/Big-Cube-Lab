const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {classifyL8ESpatial:classify,l8eSpatialGuide}=require('../l8e-spatial');
const slots=['UF','UR','UB','UL','FR','BR','BL','FL'];
const report=blocks=>({available:true,cycles:blocks.map(b=>({size:b.length,slots:b}))});
const single=pair=>report([pair,...slots.filter(s=>!pair.includes(s)).map(s=>[s])]);
const pairs=[['FR','FL'],['FR','BL'],['UF','FR'],['UF','BR'],['UF','UR'],['UF','UB']];
const labels=pairs.map(pair=>classify(single(pair)).layerLabel);assert.equal(new Set(labels).size,6);
assert.match(labels[0],/2 E-layer.*adjacent/);assert.match(labels[1],/opposite/);assert.match(labels[2],/shared side/);assert.match(labels[3],/separated/);assert.match(labels[4],/2 U-layer.*adjacent/);
for(const pair of pairs)assert.ok(l8eSpatialGuide(classify(single(pair))).length>50);
const first=classify(report([['UF','UR'],['FR','BR'],['UB'],['UL'],['FL'],['BL']]));
const second=classify(report([['UF','UR'],['FL','BL'],['UB'],['UL'],['FR'],['BR']]));
assert.equal(first.layerKey,second.layerKey);assert.notEqual(first.teachingKey,second.teachingKey);assert.notEqual(first.key,second.key);
const turn={U:'U',F:'R',R:'B',B:'L',L:'F'};
const rotate=s=>slots.find(candidate=>candidate.split('').sort().join('')===s.split('').map(f=>turn[f]).sort().join(''));
const coverage=new Map();let checked=0;
function partition(i,blocks){if(i===slots.length){
 const r=report(blocks),spatial=classify(r),rotated=classify(report(blocks.map(b=>b.map(rotate))));
 assert.equal(spatial.key,rotated.key);assert.equal(spatial.layerKey,rotated.layerKey);assert.equal(spatial.teachingKey,rotated.teachingKey);
 const signature=blocks.map(b=>b.length).sort((a,b)=>b-a).map(n=>n+'E').join(' ');
 const layer=blocks.filter(b=>b.length>1).map(b=>`${b.length}:${b.filter(s=>s.startsWith('U')).length}`).sort().join('|')||'paired';
 assert.equal(spatial.layerKey,layer);if(!coverage.has(signature))coverage.set(signature,new Set());coverage.get(signature).add(layer);checked++;return;
}for(const block of blocks){block.push(slots[i]);partition(i+1,blocks);block.pop();}blocks.push([slots[i]]);partition(i+1,blocks);blocks.pop();}
partition(0,[]);assert.equal(checked,4140);assert.equal([...coverage.values()].reduce((n,s)=>n+s.size,0),109);
const data=require('../data/l8e-examples.json');
const model=vm.runInNewContext(fs.readFileSync('f3e.js','utf8')+'\n'+fs.readFileSync('l8e.js','utf8')+'\ncreateL8EModel()');
for(const group of data.classes){
 const present=new Set();assert.equal(group.subclasses.length,group.spatialCoverage.representedLayouts);
 for(const example of group.examples){
  const actual=classify(model.classify(model.apply(model.solved(),model.parse(example.scramble))));
  assert.equal(JSON.stringify(actual),JSON.stringify(example.spatial));present.add(actual.layerKey);
  assert.equal(group.subclasses.filter(s=>s.exampleIds.includes(example.id)).length,1);
 }
 assert.deepEqual([...present].sort(),[...coverage.get(group.signature)].sort());
 assert.equal(group.spatialCoverage.layerProfiles,present.size);
}
const two=data.classes.find(c=>c.signature==='2E 1E 1E 1E 1E 1E 1E');assert.equal(new Set(two.examples.map(e=>e.spatial.layerLabel)).size,6);
console.log('Spatial subclasses: 4,140 partitions, rotation invariance, all 109 layer profiles, six 2E relationships, inter-cycle contacts and stored examples passed.');
