const {createHash} = require('node:crypto');
const model = require('../cube-model');
const library = require('../case-library');
const {simplifyCubeMoves} = require('../solver');
const databases = {redux:require('../data/l2c-cases.json'), yau:require('../data/yau-cases.json')};
const alternatives = require('../data/optimal-alternatives.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const slot = s => s.p.join(',')+'/'+s.n.join(',');
const home = model.solved(), slots = new Map(home.map((s,i) => [slot(s),i]));
function entryFor(mode, caseId) {
  const entry = databases[mode]?.cases.find(c => c.id === caseId);
  if (!entry) throw Error('Unknown mode or case.');
  return entry;
}
function validate(mode, caseId, input) {
  const entry = entryFor(mode,caseId);
  if (typeof input !== 'string' || input.length > 1500) throw Error('Enter an algorithm of at most 100 moves.');
  let tokens = input.trim().replace(/[\u2019\u2032]/g,"'").split(/\s+/).filter(Boolean);
  if (tokens.length > 100) throw Error('Enter an algorithm of at most 100 moves.');
  model.parse(tokens.join(' '));
  tokens = simplifyCubeMoves(tokens.map(t => t.replace(/2'$/, '2').replace(/^2([URFDLB])w/, '$1w')));
  const algorithm = tokens.join(' '), moves = model.parse(algorithm);
  const start = library.stateOf(model,entry.mask);
  const final = model.apply(start,moves);
  for (let i=0;i<home.length;i++) {
    const s = final[i];
    if (s.color !== 'gray' && (s.color === 'green' ? s.n[1] !== 1 : s.n[2] !== 1)) throw Error('This algorithm does not solve the displayed reference case (green U, orange F).');
    // Every other center must retain its original face, even when its display is gray.
    if (mode === 'yau' && s.color === 'gray' && home[i].p.filter(v=>Math.abs(v)===2).length===1 && String(s.n)!==String(home[i].n)) throw Error('This algorithm disturbs another center.');
    if (mode === 'yau' && home[i].p[0] === -2 && home[i].p[1] !== 2 && home[i].p.filter(v=>Math.abs(v)===2).length===2 && slot(s)!==slot(home[i])) throw Error('This algorithm does not preserve the FL, DL, and BL edges.');
  }
  // Equivalent full-cube effects share a vote total; alternate spellings cannot split votes.
  const permutation = model.apply(model.solved(), moves).map(s=>slots.get(slot(s))).join(',');
  return {id:hash(permutation),algorithm,count:tokens.length};
}
const cache = new Map();
function optimalFor(mode,caseId) {
  const key=mode+'/'+caseId;
  if (!cache.has(key)) cache.set(key, alternatives[mode][entryFor(mode,caseId).id].map(algorithm=>validate(mode,caseId,algorithm)));
  return cache.get(key);
}
module.exports={hash,entryFor,validate,optimalFor};
