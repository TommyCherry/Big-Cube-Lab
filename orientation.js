// Proper cube rotations only: opposite colors and handedness are preserved.
const CubeOrientation = (() => {
  const vectors = { R:[1,0,0], L:[-1,0,0], U:[0,1,0], D:[0,-1,0], F:[0,0,1], B:[0,0,-1] };
  const reference = { U:'green', F:'orange', D:'blue', B:'red', L:'white', R:'yellow' };
  const edgeReference = { U:'red', F:'green', D:'orange', B:'blue', L:'white', R:'yellow' };
  const opposite = { white:'yellow', yellow:'white', green:'blue', blue:'green', red:'orange', orange:'red' };
  const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const faceOf = vector => Object.keys(vectors).find(face => dot(vector,vectors[face])===1);
  const rotations = [];
  for (const up of Object.keys(vectors)) for (const front of Object.keys(vectors)) {
    if (dot(vectors[up],vectors[front])) continue;
    const right = cross(vectors[up],vectors[front]);
    const map = Object.fromEntries(Object.entries(vectors).map(([face,v]) => [face,faceOf(right.map((n,i)=>v[0]*n+v[1]*vectors[up][i]+v[2]*vectors[front][i]))]));
    rotations.push(map);
  }
  function scheme(up,front) {
    const rotation = rotations.find(map => reference[map.U]===up && reference[map.F]===front);
    if (!rotation) throw Error('Choose two adjacent colors for top and front.');
    return Object.fromEntries(Object.entries(rotation).map(([face,source])=>[face,reference[source]]));
  }
  function colorMap(up,front,edges=false) {
    const target=scheme(up,front), source=edges?edgeReference:reference;
    return Object.fromEntries(Object.keys(source).map(face=>[source[face],target[face]]));
  }
  return { reference,edgeReference,opposite,rotations,scheme,colorMap };
})();
if(typeof module!=='undefined')module.exports={CubeOrientation};

function mountColorOrientation(root) {
  const controls = root.querySelector('[data-color-orientation]');
  const up = controls.querySelector('[data-orientation="up"]');
  const front = controls.querySelector('[data-orientation="front"]');
  const summary = controls.querySelector('[data-orientation="summary"]');
  const scopeSelector = '.workspace-panel, .case-popup';
  const scopes = () => [...root.querySelectorAll(scopeSelector)];
  const storageKey = 'l2c-color-orientation-v1';
  const palette = {green:'#23ad64',orange:'#ff8a26',blue:'#348bea',red:'#e25353',white:'#f4f4f0',yellow:'#f4d838'};
  let selected = {up:'green',front:'orange'};
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored) { CubeOrientation.scheme(stored.up,stored.front); selected=stored; }
  } catch { /* Missing, invalid or unavailable preferences use the default frame. */ }
  const textRecords = new WeakMap(), attributeRecords = new WeakMap();
  const colorWords = /\b(green|orange|blue|red|white|yellow)\b/gi;
  function translate(text,map) {
    return text.replace(colorWords,word => {
      const color=map[word.toLowerCase()];
      return word[0]===word[0].toUpperCase()?color[0].toUpperCase()+color.slice(1):color;
    });
  }
  function updateText(node,map) {
    const previous=textRecords.get(node);
    const source=previous && node.data===previous.display ? previous.source : node.data;
    const display=translate(source,map);
    if(node.data!==display)node.data=display;
    textRecords.set(node,{source,display});
  }
  function updateAttributes(node,map) {
    let records=attributeRecords.get(node);
    if(!records){records={};attributeRecords.set(node,records);}
    for(const name of ['aria-label','title']) {
      const value=node.getAttribute(name);
      if(value===null)continue;
      const previous=records[name],source=previous&&value===previous.display?previous.source:value;
      const display=translate(source,map);
      if(value!==display)node.setAttribute(name,display);
      records[name]={source,display};
    }
  }
  function colorize(node,map) {
    if(node.nodeType===3){updateText(node,map);return;}
    if(node.nodeType!==1||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(node.tagName))return;
    updateAttributes(node,map);
    for(const child of node.childNodes)colorize(child,map);
  }
  function panelMap(panel) {
    return CubeOrientation.colorMap(selected.up,selected.front,['f3e-solver','l8e-solver','l8e-examples'].includes(panel.id));
  }
  // Only the view is translated: color names in model states remain stable
  // role identifiers for cached tables, workers, trainer history and sharing.
  // Retaining each text node's canonical source prevents repeated remapping.
  function invalidate(records) {
    for(const record of records) {
      if(record.type==='characterData')textRecords.delete(record.target);
      if(record.type==='attributes') {
        const saved=attributeRecords.get(record.target);
        if(saved)delete saved[record.attributeName];
      }
    }
  }
  const observer = new MutationObserver(records => {
    invalidate(records);
    observer.disconnect();
    const changed=new Set();
    for(const record of records) {
      const element=record.target.nodeType===1?record.target:record.target.parentElement;
      const panel=element?.closest(scopeSelector);
      if(panel)changed.add(panel);
      for(const added of record.addedNodes || []) {
        if(added.nodeType===1 && added.matches(scopeSelector))changed.add(added);
      }
    }
    for(const panel of changed)colorize(panel,panelMap(panel));
    observe();
  });
  function observe(){observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});}
  function refresh(save=true) {
    invalidate(observer.takeRecords());
    observer.disconnect();
    up.value=selected.up;front.value=selected.front;
    for(const option of front.options)option.disabled=option.value===selected.up||option.value===CubeOrientation.opposite[selected.up];
    const scheme=CubeOrientation.scheme(selected.up,selected.front);
    summary.textContent=Object.entries(scheme).map(([face,color])=>`${face}: ${color}`).join(' | ');
    const baseMap=CubeOrientation.colorMap(selected.up,selected.front);
    for(const [canonical,color]of Object.entries(baseMap))root.style.setProperty('--cube-'+canonical,palette[color]);
    for(const panel of scopes()) {
      const map=panelMap(panel);
      for(const [canonical,color]of Object.entries(map))panel.style.setProperty('--cube-'+canonical,palette[color]);
      colorize(panel,map);
    }
    if(save)try{localStorage.setItem(storageKey,JSON.stringify(selected));}catch{/* Session-only preferences still work. */}
    observe();
  }
  up.addEventListener('change',()=>{
    selected.up=up.value;
    if(selected.front===selected.up||selected.front===CubeOrientation.opposite[selected.up]) {
      selected.front=Object.values(CubeOrientation.reference).find(color=>color!==selected.up&&color!==CubeOrientation.opposite[selected.up]);
    }
    refresh();
  });
  front.addEventListener('change',()=>{selected.front=front.value;refresh();});
  controls.querySelector('[data-orientation="reset"]').addEventListener('click',()=>{selected={up:'green',front:'orange'};refresh();});
  refresh(false);
  return { get scheme(){return CubeOrientation.scheme(selected.up,selected.front);}, disconnect:()=>observer.disconnect() };
}
if(typeof module!=='undefined')module.exports.mountColorOrientation=mountColorOrientation;
