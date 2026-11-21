// Runs inside the worker. Only completed, versioned tables are persisted.
function installSixWorker(storage) {
  let memory = null;
  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Storage unavailable')); return; }
      const request = indexedDB.open('l2c-six-patterns', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tables');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage blocked'));
    });
  }
  async function access(key, value, write) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('tables', write ? 'readwrite' : 'readonly');
        const request = write ? transaction.objectStore('tables').put(value, key) : transaction.objectStore('tables').get(key);
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('Storage failed'));
      });
    } finally { db.close(); }
  }
  storage ||= {read: key => access(key, null, false), write: (key, value) => access(key, value, true)};
  onmessage = async ({data}) => {
    try {
      // Exact goal + ordered permutations distinguish modes and move definitions.
      const key = 'paired-orbits-v2|' + JSON.stringify([data.goal, data.moves.map(m => [m.text,m.permutation])]);
      let pairs = memory?.key === key ? memory.pairs : null, cacheError = false;
      if (!pairs) {
        postMessage({cache:'loading'});
        try { pairs = await storage.read(key); } catch { cacheError = true; }
      }
      if (!pairs && !cacheError) postMessage({cache:'not-prepared'});
      if (pairs) { memory = {key,pairs}; postMessage({cache:'reused'}); }
      let completed = null;
      const searchBegan = Date.now();
      let result = searchSixIDA({...data,cachedPairs:pairs,pauseAfterPreparation:true}, progress => postMessage({progress}), tables => {completed=tables;});
      if (completed) {
        memory = {key,pairs:completed};
        postMessage({cache:'saving'});
        try { await storage.write(key,completed); postMessage({cache:'saved'}); }
        catch { postMessage({cache:'session-only'}); }
      } else if (cacheError) postMessage({cache:'session-only'});
      if (result.status === 'tables-ready') {
        const previous = result;
        result = searchSixIDA({...data,cachedPairs:completed,maxMs:Math.max(0,(data.maxMs ?? 30000)-(Date.now()-searchBegan))}, progress => postMessage({progress}));
        result.visited += previous.visited;
        result.provenThrough = Math.max(result.provenThrough, previous.provenThrough);
        result.elapsedMs = Date.now()-searchBegan;
      }
      postMessage({result});
    } catch (error) { postMessage({error:error.message}); }
  };
}
if (typeof module !== 'undefined') module.exports = {installSixWorker};
