const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const model = vm.runInNewContext(fs.readFileSync('f3e.js', 'utf8') + '\n' + fs.readFileSync('l8e.js', 'utf8') + '\ncreateL8EModel()');
const cstimer = require('../vendor/cstimer/cstimer_module.js');
cstimer.setSeed('l8e-regression-20261122');
const home = model.solved(), key = s => s.p.join(',') + '/' + s.n.join(',');
const expected = new Map(home.map(s => [key(s), s.color]));
assert.equal(model.inspect(model.apply(model.solved(),model.parse('U'))).crossSolved,true);
assert.equal(model.inspect(model.apply(model.solved(),model.parse('D'))).crossSolved,false);
const cases = new Set(); let min=Infinity,max=0,total=0;
for(let i=0;i<100;i++) {
  const text = model.adaptScramble(cstimer.getScramble('444l8e'));
  const state = model.apply(model.solved(), model.parse(text));
  const protectedStickers = state.filter(s => {
    const n = s.p.filter(v => Math.abs(v) === 3).length;
    return n === 1 || (n === 2 && s.p[1] === -3);
  });
  assert.equal(protectedStickers.length, 40);
  for(const sticker of protectedStickers) assert.equal(sticker.color, expected.get(key(sticker)));
  const classification=model.classify(state);
  assert.equal(classification.available,true);
  assert.equal(classification.cycles.reduce((sum,c)=>sum+c.size,0),8);
  assert.equal(classification.pairs.length,8);
  const adjusted=model.apply(structuredClone(state),model.parse('U'));
  assert.equal(model.classify(adjusted).signature,classification.signature);
  cases.add(model.encode(state));
  const n=model.parse(text).length;min=Math.min(min,n);max=Math.max(max,n);total+=n;
}
assert.equal(cases.size,100);
assert.throws(()=>model.adaptScramble('Rw'));
console.log(`100 L8E cases: all 24 center stickers and 16 cross stickers correct. Length ${min}-${max}, average ${total/100}.`);
