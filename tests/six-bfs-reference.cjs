// Test-only optimality oracle; not included in the application.
// Each frontier is expanded one complete BFS layer at a time. A collision is
// accepted only after that layer completes, preserving the shortest-path proof.
function searchSix({start, goal, moves, maxDepth = 10, maxMs = 30000}, progress = () => {}) {
  const began = Date.now(), inverse = t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0,-1) : t + "'";
  if (start === goal) return {status:'solved', moves:'', count:0, visited:1, provenThrough:0};
  const maps = [new Map([[start, {parent:null, move:null, depth:0}]]), new Map([[goal, {parent:null, move:null, depth:0}]])];
  const frontiers = [[start], [goal]], depths = [0,0];
  let visited = 2, expanded = 0;
  const finish = (status, extra = {}) => ({status, visited, elapsedMs:Date.now()-began, provenThrough:depths[0]+depths[1], ...extra});
  const path = (side, state) => { const result = []; for (let n = maps[side].get(state); n.parent !== null; n = maps[side].get(n.parent)) result.push(n.move); return result.reverse(); };
  while (frontiers[0].length && frontiers[1].length) {
    if (depths[0]+depths[1] >= maxDepth) return finish('depth-limit');
    const side = frontiers[0].length <= frontiers[1].length ? 0 : 1, other = 1-side, next = [];
    let meeting = null, best = Infinity;
    for (const state of frontiers[side]) {
      if (Date.now()-began >= maxMs) return finish('time-limit');
      for (const move of moves) {
        // Store flat strings: concatenation chains multiply memory use as the search grows.
        const characters = move.permutation.map(from => state[from]);
        const candidate = characters.join('');
        if (maps[side].has(candidate)) continue;
        const depth = depths[side]+1;
        maps[side].set(candidate, {parent:state, move:move.text, depth}); next.push(candidate); visited++;
        const match = maps[other].get(candidate);
        if (match && depth+match.depth < best) { best = depth+match.depth; meeting = candidate; }
      }
      if (++expanded % 1000 === 0) progress({visited, depth:depths[0]+depths[1], elapsedMs:Date.now()-began});
    }
    depths[side]++; frontiers[side] = next;
    progress({visited, depth:depths[0]+depths[1], elapsedMs:Date.now()-began});
    if (meeting !== null) {
      const tokens = [...path(0, meeting), ...path(1, meeting).reverse().map(inverse)];
      return finish('solved', {moves:tokens.join(' '), count:tokens.length});
    }
  }
  return finish('unreachable');
}

module.exports = {searchSix};
