const fs = require('node:fs');
const model = require('../cube-model');
const library = require('../case-library');
const {createExpandedSolver, searchExpandedSolutions} = require('../expanded-solver');
const output = {}, began = Date.now();
for (const mode of ['redux', 'yau']) {
  const database = require(mode === 'redux' ? '../data/l2c-cases.json' : '../data/yau-cases.json');
  const config = createExpandedSolver(model, {yau: mode === 'yau'});
  output[mode] = {};
  for (const [index, entry] of database.cases.entries()) {
    const result = searchExpandedSolutions({...config, start:config.encode(library.stateOf(model, entry.mask)), optimalOnly:true, resultLimit:5});
    if (result.optimalCount !== entry.count) throw Error('Optimal count mismatch: '+mode+' '+entry.id);
    for (const solution of result.solutions) {
      if (solution.count !== entry.count) throw Error('Nonoptimal alternative');
      const final = model.apply(library.stateOf(model,entry.mask),model.parse(solution.moves));
      if (String(config.encode(final)) !== String(config.goal)) throw Error('Replay failed');
    }
    output[mode][entry.id] = result.solutions.map(s => s.moves);
    if (index % 24 === 0) console.log(mode, index+1, ((Date.now()-began)/1000).toFixed(1)+'s');
  }
}
fs.writeFileSync('data/optimal-alternatives.json',JSON.stringify(output)+'\n');
console.log('Saved optimal alternatives, replay verified.');
