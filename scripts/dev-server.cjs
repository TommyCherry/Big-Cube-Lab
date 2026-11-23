// Local static app + the same serverless endpoint used in production.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const handler=require('../api/solutions');
const root=path.resolve(__dirname,'..','output');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  res.status=n=>{res.statusCode=n;return res;};
  res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  if(req.url.startsWith('/api/solutions')) {
    let body='';for await(const part of req){body+=part;if(body.length>3000){res.status(413).json({error:'Request too large.'});return;}}
    req.body=body;return handler(req,res);
  }
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/cube-interface.html':pathname.replace(/^\/output/,'')));
  if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end();}
  try{const data=fs.readFileSync(file);res.setHeader('Content-Type',contentTypes[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}
});
server.listen(Number(process.env.PORT||8001),'127.0.0.1',()=>console.log('L2C Lab: http://127.0.0.1:'+server.address().port));
