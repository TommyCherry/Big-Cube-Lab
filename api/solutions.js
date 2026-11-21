const {randomUUID,createHmac,timingSafeEqual} = require('node:crypto');
const {hash,entryFor,validate,optimalFor} = require('../server/algorithms.cjs');
const {community} = require('../server/community.cjs');
function identity(req,res) {
  const secret=process.env.VOTE_COOKIE_SECRET || process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!secret) {const e=Error('Community voting is not connected yet. Optimal solutions are still available.');e.status=503;throw e;}
  const sign=id=>createHmac('sha256',secret).update(id).digest('hex');
  const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('l2c_voter='))?.slice(10)||'';
  const [id,signature='']=value.split('.');
  if (/^[a-f0-9-]{36}$/.test(id||'') && signature.length===64 && timingSafeEqual(Buffer.from(signature),Buffer.from(sign(id)))) return id;
  const next=randomUUID();
  const secure=req.headers['x-forwarded-proto']==='https' || process.env.VERCEL;
  res.setHeader('Set-Cookie',`l2c_voter=${next}.${sign(next)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure?'; Secure':''}`);
  return next;
}
async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try {
    if (!['GET','POST'].includes(req.method)) {res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
    const url=new URL(req.url,'http://localhost');
    const mode=url.searchParams.get('mode'), caseId=url.searchParams.get('case');
    try {entryFor(mode,caseId);}catch(e){return res.status(400).json({error:e.message});}
    const voter=identity(req,res);
    let action='read',algorithm,id='',active=false;
    if(req.method==='POST') {
      const origin=req.headers.origin;
      if(!origin || new URL(origin).host!==req.headers.host || !String(req.headers['content-type']).startsWith('application/json')) return res.status(403).json({error:'Use the voting controls on this site.'});
      let body;
      try { body=typeof req.body==='string'?JSON.parse(req.body):req.body; } catch { return res.status(400).json({error:'Invalid JSON.'}); }
      if(!body || JSON.stringify(body).length>3000) return res.status(400).json({error:'Invalid request.'});
      action=body.action;
      if(action==='submit') {
        try {algorithm=validate(mode,caseId,body.algorithm);id=algorithm.id;}catch(e){return res.status(400).json({error:e.message});}
      } else if(action==='vote' && /^[a-f0-9]{64}$/.test(body.id) && typeof body.active==='boolean') {id=body.id;active=body.active;}
      else return res.status(400).json({error:'Invalid request.'});
    }
    const ip=hash(String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||voter).split(',')[0]);
    const result=await community({mode,caseId,voter,ip,action,algorithm,id,active,optimal:optimalFor(mode,caseId)});
    return res.status(200).json(result);
  }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Community voting is temporarily unavailable. Please try again.'});}
}
module.exports=handler;
module.exports.identity=identity;
