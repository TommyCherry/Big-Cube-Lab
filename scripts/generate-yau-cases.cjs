const fs = require('node:fs'), vm = require('node:vm');
const library = require('../case-library'), redux = require('../data/l2c-cases.json');
const {createExpandedSolver, searchExpandedSolutions} = require('../expanded-solver');
const script = fs.readFileSync('output/cube-centers.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.split('// BEGIN GENERATED SOLVER')[0] + '\nCubeModel');
const config = createExpandedSolver(model, {yau: true}), began = Date.now();
const cases = redux.cases.map((entry, index) => {
  const solution = searchExpandedSolutions({...config, start: config.encode(library.stateOf(model, entry.mask)), resultLimit: 1}).solutions[0];
  if (!solution) throw new Error(entry.id);
  const final = model.apply(library.stateOf(model, entry.mask), model.parse(solution.moves));
  if (JSON.stringify(config.encode(final)) !== JSON.stringify(config.goal)) throw new Error('Replay failed: ' + entry.id);
  if (index % 24 === 0) console.log(`${index + 1}/336 (${((Date.now() - began)/1000).toFixed(1)}s)`);
  return {...entry, count: solution.count, algorithm: solution.moves, blocks: solution.groups, scramble: library.inverse(solution.moves)};
});
fs.writeFileSync('data/yau-cases.json', JSON.stringify({...redux, mode: 'yau', version: 2, metric: 'Minimum U/Rw/3Rw/4Rw/M turns, original orientation, fixed reference layout', optimality: 'Exact for the displayed reference orientation in the Yau move set', generationSeconds: (Date.now()-began)/1000, cases}, null, 2) + '\n');
console.log('Saved verified Yau library');
