// Spatial subclasses describe component footprints, not wing orientation or
// the order of matching wings within a component. Whole y rotations agree.
function classifyL8ESpatial(report) {
  if(!report.available)return null;
  const upper=['UF','UR','UB','UL'],equator=['FR','BR','BL','FL'];
  const adjacent=(a,b)=>{
    const ring=a.includes('U')?upper:equator;
    if(!ring.includes(b))return false;
    const distance=Math.abs(ring.indexOf(a)-ring.indexOf(b));return distance===1||distance===3;
  };
  const sharedSide=(a,b)=>a.includes('U')!==b.includes('U')&&(a.includes('U')?b.includes(a[1]):a.includes(b[1]));
  const components=report.cycles.filter(c=>c.size>1).map(c=>{
    const u=c.slots.filter(s=>s.includes('U')),e=c.slots.filter(s=>!s.includes('U'));
    let relation='';
    if(c.size===2)relation=u.length===1?(sharedSide(c.slots[0],c.slots[1])?'shared side face':'separated side faces'):(adjacent(...c.slots)?'adjacent':'opposite');
    const upperShape=u.length===2?(adjacent(...u)?'adjacent U slots':'opposite U slots'):'';
    const equatorShape=e.length===2?(adjacent(...e)?'adjacent E slots':'opposite E slots'):'';
    return {size:c.size,slots:c.slots.slice(),u:u.length,e:e.length,relation,upperShape,equatorShape};
  }).sort((a,b)=>b.size-a.size||a.u-b.u||a.slots.join(',').localeCompare(b.slots.join(',')));
  const rotated=turns=>components.map(c=>c.slots.map(slot=>{
    const ring=slot.includes('U')?upper:equator;return ring[(ring.indexOf(slot)+turns)%4];
  }).sort().join('/')).sort().join(' | ');
  const footprint=[0,1,2,3].map(rotated).sort()[0]||'paired';
  const layerKey=components.map(c=>`${c.size}:${c.u}`).sort().join('|')||'paired';
  const layerLabel=components.map(c=>`${c.size}E: ${c.e} E-layer / ${c.u} U-layer${c.relation?' ('+c.relation+')':''}`).join(' + ')||'All paired';
  const relationships=[];
  for(let i=0;i<components.length;i++)for(let j=i+1;j<components.length;j++){
    let sameLayer=0,shared=0;
    for(const a of components[i].slots)for(const b of components[j].slots){if(adjacent(a,b))sameLayer++;if(sharedSide(a,b))shared++;}
    relationships.push({a:i,b:j,sameLayer,shared});
  }
  const teachingKey=components.map(c=>`${c.size}:${c.u}:${c.relation}:${c.upperShape}:${c.equatorShape}`).sort().join('|')+';'+relationships.map(r=>{
    const a=components[r.a],b=components[r.b];return [`${a.size}:${a.u}`,`${b.size}:${b.u}`].sort().join('/')+`:${r.sameLayer}:${r.shared}`;
  }).sort().join('|');
  return {key:footprint,layerKey,layerLabel,teachingKey,components,relationships};
}

function l8eSpatialGuide(spatial) {
  if(!spatial.components.length)return 'All eight dedges are paired. Their positions do not require more L8E work.';
  const notes=spatial.components.map(c=>{
    const prefix=`${c.size}E at ${c.slots.join(', ')}: `;
    if(c.size===2&&c.e===2)return prefix+(c.relation==='adjacent'
      ?'both dedges are adjacent in E. Compare a direct slice-flip-unslice with an ordinary-insert finish; no top-to-E transfer is needed just to bring the two dedges into E.'
      :'both dedges are in E but opposite. The adjacent-E flipping pattern is not directly set up. Compare repositioning one dedge through U with a direct slice-and-insert route.');
    if(c.size===2&&c.e===1)return prefix+'one dedge is in E and one is in U. Choose an AUF and U-turn insert that bring useful wings from the top into E before using an E/E finish, or combine that transfer with the pairing slice. '+(c.relation==='shared side face'?'They share a side face.':'They are on separated side faces, so compare top alignment first.');
    if(c.size===2&&c.e===0)return prefix+'both dedges are in U ('+c.relation+'). A slice does not act on their relative wing pairing by itself. With the optional U-layer toolbox enabled, compare a direct U-layer pairing algorithm. The basic-toolbox examples here instead use top alignment and useful transfers into E; the E/E flipping pattern is not directly set up.';
    if(c.e===0)return prefix+'the entire component is in U. First compare which inserts place useful matching wings in E; a slice-first example with E-layer pieces is not directly transferable to this placement.';
    if(c.u===0)return prefix+'the entire component is in E. Inspect matches under each Uw adjustment first; use U as replacement/storage space without paying for unnecessary top-to-E setup.';
    return prefix+`${c.e} dedges are in E and ${c.u} in U. Compare the E-layer matches available under a slice with the top replacements that an insert can supply. `+([c.upperShape,c.equatorShape].filter(Boolean).length?[c.upperShape,c.equatorShape].filter(Boolean).join('; ')+'.':'');
  });
  if(spatial.components.length>1)notes.push('Plan the components together: a replacement can move a dedge from another component. The slot lists and contact list below show where those interactions occur. Shared locations do not by themselves prove that a particular insert will pair wings.');
  return notes.join(' ');
}
if(typeof module!=='undefined')module.exports={classifyL8ESpatial,l8eSpatialGuide};
