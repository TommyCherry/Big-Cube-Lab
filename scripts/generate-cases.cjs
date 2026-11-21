const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const library = require('../case-library');
const { createExpandedSolver, searchExpandedSolutions } = require('../expanded-solver');
const html = fs.readFileSync(path.join(root, 'output/cube-centers.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const model = vm.runInNewContext(script.slice(0, script.indexOf('// BEGIN GENERATED SOLVER')) + '\nCubeModel');
const config = createExpandedSolver(model), classes = library.enumerate();
const cases = [], began = Date.now();
for (const entry of classes) {
  const members = [...entry.members].sort((a, b) => a - b);
  const startVariants = members.map(mask => config.encode(library.stateOf(model, mask)));
  const result = searchExpandedSolutions({ ...config, startVariants, resultLimit: 1 });
  const solution = result.solutions[0];
  if (!solution) throw new Error('No solution for ' + entry.id);
  const mask = members[solution.startVariant];
  const scramble = library.inverse(solution.moves);
  const replay = model.apply(model.solved(), model.parse(scramble));
  if (library.maskOf(model, replay) !== mask) throw new Error('Scramble mismatch ' + entry.id);
  const solved = model.apply(library.stateOf(model, mask), model.parse(solution.moves));
  if (JSON.stringify(config.encode(solved)) !== JSON.stringify(config.goal)) throw new Error('Solution mismatch ' + entry.id);
  cases.push({ id: entry.id, key: entry.key, mask, orbitSize: entry.orbitSize, ...library.classify(mask), count: solution.count, algorithm: solution.moves, blocks: solution.groups, scramble });
  if (cases.length % 24 === 0 || cases.length === classes.length) console.log(`${cases.length}/${classes.length} cases solved and replay-verified (${((Date.now() - began) / 1000).toFixed(1)}s)`);
}
const database = {
  version: 1, equivalence: 'independent U and F rotations',
  metric: 'one move per quarter or half turn, after axis-run combination; initial orientation free',
  optimality: 'minimum across all orientations in each orbit under the configured setup-block grammar',
  orientedLayouts: 4900, caseCount: cases.length, generationSeconds: (Date.now() - began) / 1000, cases
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/l2c-cases.json'), JSON.stringify(database, null, 2) + '\n');
console.log('Saved data/l2c-cases.json');
