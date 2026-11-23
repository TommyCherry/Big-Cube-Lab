function l8eClassGuide(parts) {
  const active=parts.filter(n=>n>1),paired=parts.filter(n=>n===1).length;
  if(!active.length)return {title:'Already paired',text:'All eight dedges are already paired. They need not be in their final 3x3 positions. No L8E moves are required; proceed to the 3x3 stage.'};
  const tips={
    2:'A slice-flip-unslice is a dependable way to finish a 2E component. Also compare two ordinary U-turn inserts inside a slice: favorable placements can make that cheaper than the flipping algorithm. A 2E class alone does not prove a flip is shortest.',
    3:'Look for a slice that pairs one set of wings in the E layer, then replace the outgoing wings with one U-turn insert and unslice. With the pieces already set up, this is a five-turn slice / insert / unslice. Other placements may need an AUF or additional setup.',
    4:'Compare a direct slice-and-replace sequence with reducing the component to a 3E finish. Flip then 3E, or 3E then flip, are useful fallback plans, but neither order is automatically shortest. Inspect which wings the next slice can pair before committing to a flip.',
    5:'Prepare several matching E-layer wings for one slice, preserve the pairs it creates by replacing them from U, and restore the slice when the replacements line up. Compare a direct finish with reducing the remaining component to a small 3E or 2E case.',
    6:'Favor a three-pair batch: set up E-layer matches, slice, replace paired dedges with useful U-layer wings, then unslice. A single 6E component is not the same case as two independent 3E components; use the previews to track how the cycle splits.',
    7:'Use a large slice-and-replace batch rather than fixing each dedge separately. Compare setting up first with a slice-first 3-2-3-style start, then choose the small-component finish that the actual wing placement leaves.',
    8:'All eight dedges participate in one connected cycle. Look for three matches under a Uw slice, replace the paired E-layer dedges from U, and restore the slice to make another batch. Compare a slice-first start; use a flip only when it gives a useful remaining finish.'
  };
  const descriptions=[...new Set(active)].map(n=>tips[n]);
  if(active.length>1)descriptions.unshift('These components are independent in the pairing graph, but do not assume their shortest solutions should be concatenated. One slice or replacement can help several components; compare shared batches with solving them separately.');
  if(paired)descriptions.push(`${paired} dedge${paired===1?' is':'s are'} already paired. Use them as storage when helpful, and avoid breaking them without a useful replacement plan.`);
  return {title:active.map(n=>n+'E').join(' + ')+(paired?` + ${paired} paired`:''),text:descriptions.join(' ')};
}

function mountL8EExamples(root,database,actions={}) {
  const section=root.querySelector('#l8e-examples'),find=s=>section.querySelector(`[data-l8e-examples="${s}"]`),model=createL8EModel();
  const classes=database.classes;
  let classIndex=Math.max(0,classes.findIndex(c=>c.signature==='3E 1E 1E 1E 1E 1E')),exampleIndex=0,solutionIndex=0,stepIndex=0,subclassIndex=Math.max(0,classes[classIndex].subclasses.findIndex(s=>s.exampleIds.includes(classes[classIndex].examples[0].id)));
  const currentExamples=()=>{const group=classes[classIndex];return group.subclasses[subclassIndex].exampleIds.map(id=>group.examples.find(e=>e.id===id));};
  const currentSolutions=()=>currentExamples()[exampleIndex][find('upper-algorithms').checked?'upperSolutions':'solutions'];
  const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  function options(select,labels,value){select.replaceChildren();labels.forEach((label,i)=>{const option=make('option',label);option.value=String(i);select.append(option);});select.value=String(value);}
  options(find('class'),classes.map(c=>l8eClassGuide(c.parts).title),classIndex);
  find('count').textContent=`${classes.length} cycle classes / ${classes.reduce((n,c)=>n+c.subclasses.length,0)} representative spatial subclasses / ${classes.reduce((n,c)=>n+c.examples.length,0)} examples. All cases start with solved centers and an aligned D cross.`;
  function render() {
    const group=classes[classIndex],visibleExamples=currentExamples(),example=visibleExamples[exampleIndex],solution=currentSolutions()[solutionIndex],guide=l8eClassGuide(group.parts);
    options(find('subclass'),group.subclasses.map(s=>s.label),subclassIndex);
    options(find('example'),visibleExamples.map((_,i)=>'Example '+(i+1)),exampleIndex);
    options(find('solution'),currentSolutions().map(s=>`${s.label} (${s.blockCost} block cost${s.optimal?', proven minimum':''})`),solutionIndex);
    find('signature').textContent=group.signature;
    find('guide-title').textContent=guide.title;
    find('guide').textContent=guide.text;
    const spatial=example.spatial;
    find('spatial-summary').textContent=spatial.layerLabel;
    find('spatial-guide').textContent=l8eSpatialGuide(spatial);
    find('coverage').textContent=`${group.subclasses.length} representative layouts covering all ${group.spatialCoverage.layerProfiles} component U/E layer splits for this class. Whole y rotations share a subclass; wing orientation and internal cycle order are not subclassified.`;
    const componentList=find('spatial-components');componentList.replaceChildren();
    spatial.components.forEach((c,i)=>componentList.append(make('li',`Cycle ${i+1} (${c.size}E): U slots ${c.slots.filter(s=>s.includes('U')).join(', ')||'none'}; E slots ${c.slots.filter(s=>!s.includes('U')).join(', ')||'none'}.`)));
    const relationships=find('spatial-relations');relationships.replaceChildren();
    spatial.relationships.forEach(r=>relationships.append(make('li',`Cycles ${r.a+1} and ${r.b+1}: ${r.sameLayer} neighboring slot pairs within the same layer; ${r.shared} U/E slot pairs sharing a side face.`)));

    find('scramble').textContent=example.scramble||'No scramble needed: already paired.';
    find('algorithm').textContent=solution.moves||'No moves needed.';
    find('proof').textContent=`${solution.count} face/wide turns${solution.rotations?` + ${solution.rotations} rotations`:''}. `+(solution.optimal
      ?`Proven minimum block cost ${solution.blockCost} for this exact scramble in the ${find('upper-algorithms').checked?'expanded toolbox (U-layer algorithms enabled)':'basic toolbox (U-layer algorithms off)' }.`
      :`Verified solution (${find('upper-algorithms').checked?'U-layer algorithms enabled':'basic toolbox'}), block cost ${solution.blockCost}; optimality not proven.`);
    const inserts=solution.steps.filter(s=>s.kind==='Insert').length,slices=solution.steps.filter(s=>s.kind==='Slice').length,flips=solution.steps.filter(s=>s.kind==='Slice-flip-slice').length;
    let lesson=solution.steps.length?`This route uses ${inserts} ordinary insert${inserts===1?'':'s'}, ${slices} Uw adjustment${slices===1?'':'s'} and ${flips} flipping block${flips===1?'':'s'}. `:'No pairing work remains. ';
    const upper=solution.steps.filter(s=>s.kind==='U-layer pairing').length;
    if(upper)lesson+=`${upper} U-layer pairing block${upper===1?'':'s'} directly re-pair top-layer wings while restoring the centers and D cross. `;
    if(group.parts[0]===4&&group.parts.filter(n=>n>1).length===1&&!flips)lesson+='It finishes the 4E component directly, rather than paying for a flip plus a separate 3E finish. ';
    if(group.parts[0]===2&&group.parts.filter(n=>n>1).length===1&&!flips&&!upper)lesson+=currentSolutions().some(s=>s.steps.some(t=>t.kind==='Slice-flip-slice'))?'Compare this ordinary-insert route with the flipping alternative in the solution selector. ':'This example uses ordinary U-turn inserts rather than a complete flipping block. ';
    if(group.parts[0]===3&&group.parts.filter(n=>n>1).length===1)lesson+='A five-turn slice/insert/unslice core requires the appropriate setup; compare spatial subclasses rather than assuming every 3E costs the same. ';
    if(group.parts.filter(n=>n>1).length>1)lesson+='Track the whole case through each slice; the class components need not be solved as separate algorithms. ';
    find('lesson').textContent=lesson;
    let state=model.apply(model.solved(),model.parse(example.scramble));
    for(let i=0;i<stepIndex;i++)model.apply(state,model.parse(solution.steps[i].moves));
    for(const face of ['U','L','F','R','B','D']) {
      const target=section.querySelector(`[data-l8e-example-face="${face}"]`),stickers=model.visible(state,face);target.replaceChildren();
      stickers.forEach(sticker=>{const tile=make('span','');tile.className='piece f3e-'+sticker.color;tile.setAttribute('aria-hidden','true');target.append(tile);});
      target.setAttribute('aria-label',`${face} face, rows left to right: ${stickers.map(s=>s.color).join(', ')}`);
    }
    const stateClass=model.classify(state),check=model.inspect(state);
    const phase=stepIndex?solution.steps[stepIndex-1]:null;
    find('preview-status').textContent=(phase?`After block ${stepIndex}: ${phase.moves}. ${phase.after}/8 paired. `:'Scrambled case. ')+(stateClass.available?`Class: ${stateClass.signature}. Centers and D cross solved.`:`Centers temporarily sliced; D cross ${check.crossSolved?'preserved':'not solved'}.`);
    find('previous').disabled=stepIndex===0;find('next').disabled=stepIndex===solution.steps.length;
    const list=find('steps');list.replaceChildren();
    solution.steps.forEach((step,i)=>{
      const item=make('li',''),button=make('button',`${i+1}. ${step.kind}: ${step.moves}`);button.type='button';button.setAttribute('aria-current',String(stepIndex===i+1));
      button.addEventListener('click',()=>{stepIndex=i+1;render();});
      item.append(button,make('p',`${step.before} -> ${step.after} paired. ${step.purpose}`));
      if(step.signature)item.append(make('p','After restoring centers: '+step.signature));
      list.append(item);
    });
    if(!solution.steps.length)list.append(make('li','All eight dedges are already paired.'));
  }
  find('upper-algorithms').addEventListener('change',()=>{solutionIndex=stepIndex=0;render();});
  find('class').addEventListener('change',()=>{classIndex=Number(find('class').value);subclassIndex=Math.max(0,classes[classIndex].subclasses.findIndex(s=>s.exampleIds.includes(classes[classIndex].examples[0].id)));exampleIndex=solutionIndex=stepIndex=0;render();});
  find('subclass').addEventListener('change',()=>{subclassIndex=Number(find('subclass').value);exampleIndex=solutionIndex=stepIndex=0;render();});
  find('example').addEventListener('change',()=>{exampleIndex=Number(find('example').value);solutionIndex=stepIndex=0;render();});
  find('solution').addEventListener('change',()=>{solutionIndex=Number(find('solution').value);stepIndex=0;render();});
  find('previous').addEventListener('click',()=>{stepIndex=Math.max(0,stepIndex-1);render();});
  find('next').addEventListener('click',()=>{stepIndex=Math.min(currentSolutions()[solutionIndex].steps.length,stepIndex+1);render();});
  find('start').addEventListener('click',()=>{stepIndex=0;render();});
  find('finish').addEventListener('click',()=>{stepIndex=currentSolutions()[solutionIndex].steps.length;render();});
  find('load').addEventListener('click',()=>actions.load?.(currentExamples()[exampleIndex].scramble,{allowUpper:!!find('upper-algorithms').checked}));
  render();
}
if(typeof module!=='undefined')module.exports={l8eClassGuide,mountL8EExamples};
