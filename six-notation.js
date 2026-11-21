// Rewrite F-based triggers with U turns without changing their full-cube effect
// or adding moves. Standalone F adjustments remain when the U spelling is longer.
let SIX_AXIS_WORDS = null;
function preferSixUTurns(text) {
  const bases = ['Rw','3Rw','4Rw','5Rw','Lw','3Lw','4Lw','5Lw'];
  const add = (a,b) => {let result=0;for(let shift=0;shift<12;shift+=2)result|=(((a>>shift&3)+(b>>shift&3))&3)<<shift;return result;};
  const neg = a => {let result=0;for(let shift=0;shift<12;shift+=2)result|=((4-(a>>shift&3))&3)<<shift;return result;};
  const axisCode = token => {
    const match=/^([3-5])?([RL])w(2|')?$/.exec(token); if(!match)return null;
    const width=Number(match[1]||2),right=match[2]==='R',turns=match[3]==='2'?2:match[3]==="'"?3:1;
    let code=0;for(let layer=0;layer<6;layer++)if(right?layer>=6-width:layer<width)code|=((right?4-turns:turns)&3)<<(layer*2);
    return code;
  };
  if(!SIX_AXIS_WORDS){
    const words=Array(4096).fill(null),queue=[0];words[0]=[];
    const tokens=bases.flatMap(base=>['',"'",'2'].map(s=>base+s));
    const codes=tokens.map(axisCode);
    for(let i=0;i<queue.length;i++)for(let j=0;j<tokens.length;j++){
      const next=add(queue[i],codes[j]);if(words[next]!==null)continue;
      words[next]=[...words[queue[i]],tokens[j]];queue.push(next);
    }
    SIX_AXIS_WORDS=words;
  }
  const words=SIX_AXIS_WORDS, tokens=text.trim().split(/\s+/).filter(Boolean), runs=[0], faces=[];
  for(const token of tokens){
    if(/^[UF](2|')?$/.test(token)){faces.push(token);runs.push(0);}
    else {const code=axisCode(token);if(code===null)return text;runs[runs.length-1]=add(runs.at(-1),code);}
  }
  // F = x U x'; the x turns merge into neighboring wide-turn runs.
  const x=4095;
  const better=(a,b)=>!b||a.tokens.length<b.tokens.length||a.tokens.length===b.tokens.length&&a.fronts<b.fronts;
  let states=new Map([[0,{tokens:[],fronts:0}]]);
  for(let i=0;i<faces.length;i++){
    const next=new Map();
    for(const [previous,path]of states)for(const frame of faces[i][0]==='F'?[x,0]:[0]){
      const run=words[add(add(runs[i],neg(previous)),frame)];if(run===null)continue;
      const face=frame?'U'+faces[i].slice(1):faces[i];
      const candidate={tokens:[...path.tokens,...run,face],fronts:path.fronts+Number(face[0]==='F')};
      if(better(candidate,next.get(frame)))next.set(frame,candidate);
    }
    states=next;
  }
  let best={tokens,fronts:faces.filter(t=>t[0]==='F').length};
  for(const [frame,path]of states){
    const tail=words[add(runs.at(-1),neg(frame))];if(tail===null)continue;
    const candidate={tokens:[...path.tokens,...tail],fronts:path.fronts};if(better(candidate,best))best=candidate;
  }
  return best.tokens.join(' ');
}
if(typeof module!=='undefined')module.exports={preferSixUTurns};
