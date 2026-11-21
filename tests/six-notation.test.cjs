const assert=require('node:assert/strict');
const {createSixModel}=require('../six'),{preferSixUTurns}=require('../six-notation');
const model=createSixModel(),effect=text=>JSON.stringify(model.apply(model.solved(),model.parse(text)));
const original="3Rw 4Rw' F Rw' F' Rw 3Rw' 4Rw";
const preferred="3Rw Lw' U Rw' U' Rw 3Rw' Lw";
assert.equal(preferSixUTurns(original),preferred);assert.equal(effect(original),effect(preferred));
const scramble="Rw U2 Rw' U' Rw U' Rw' 4Rw 3Rw' U' Rw U 4Rw' 3Rw U' Rw' Rw U' Rw'";
assert.equal(model.encode(model.apply(model.solved(),model.parse(scramble+' '+preferred))),model.goal);
assert.equal(preferSixUTurns('F U2'), 'F U2');
assert.equal(preferSixUTurns(''), '');
let seed=27;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const tokens=model.searchMoves('redux').map(m=>m.text);
for(let i=0;i<400;i++){
  const text=Array.from({length:12},()=>tokens[Math.floor(random()*tokens.length)]).join(' '),formatted=preferSixUTurns(text);
  assert.equal(effect(text),effect(formatted),text);
  assert.ok(formatted.split(' ').filter(Boolean).length<=12);
  assert.equal(preferSixUTurns(formatted),formatted);
}
console.log('Passed: reported eight-move rewrite, full-sticker equivalence, standalone F adjustments, and 400 mixed algorithms without increasing length.');
