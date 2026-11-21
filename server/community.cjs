// Atomic Redis script: votes are desired-state updates, so retrying cannot double-count.
const SCRIPT = `
local records, scores, ballots = KEYS[1], KEYS[2], KEYS[3]
local defaults = cjson.decode(ARGV[1])
local action, id = ARGV[2], ARGV[3]
local defaultsById = {}
for _, alg in ipairs(defaults) do defaultsById[alg.id] = alg end
if action ~= 'read' then
  local n = redis.call('INCR', KEYS[4])
  if n == 1 then redis.call('EXPIRE', KEYS[4], 60) end
  if n > 30 then return cjson.encode({error='Too many changes. Please wait a minute.'}) end
end
if action == 'submit' then
  if not defaultsById[id] and redis.call('HEXISTS', records, id) == 0 then
    if redis.call('HLEN', records) >= 200 then return cjson.encode({error='This case has reached its submission limit.'}) end
    redis.call('HSET', records, id, ARGV[4])
    redis.call('ZADD', scores, 0, id)
  end
elseif action == 'vote' then
  if not defaultsById[id] and redis.call('HEXISTS', records, id) == 0 then return cjson.encode({error='Algorithm not found. Refresh the solutions.'}) end
  local changed
  if ARGV[5] == '1' then
    changed = redis.call('SADD', ballots, id)
    if changed == 1 then redis.call('ZINCRBY', scores, 1, id) end
  else
    changed = redis.call('SREM', ballots, id)
    if changed == 1 then redis.call('ZINCRBY', scores, -1, id) end
  end
end
local result = {optimal={},top={},submissions={}}
local function decorate(alg)
  alg.votes = tonumber(redis.call('ZSCORE', scores, alg.id) or '0')
  alg.voted = redis.call('SISMEMBER', ballots, alg.id) == 1
  return alg
end
for _, alg in ipairs(defaults) do table.insert(result.optimal, decorate(alg)) end
local ranked = redis.call('ZREVRANGE', scores, 0, -1)
for _, algId in ipairs(ranked) do
  local raw = redis.call('HGET', records, algId)
  local alg = defaultsById[algId] or (raw and cjson.decode(raw))
  if alg then
    alg = decorate(alg)
    if alg.votes > 0 and #result.top < 5 then table.insert(result.top, alg) end
    if raw then table.insert(result.submissions, alg) end
  end
end
return cjson.encode(result)
`;
async function redis(command) {
  const url=process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token=process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) { const error=Error('Community voting is not connected yet. Optimal solutions are still available.'); error.status=503; throw error; }
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Error('Database unavailable');
  const data=await response.json(); if(data.error) throw Error('Database unavailable'); return data.result;
}
async function community({mode,caseId,voter,ip,action='read',algorithm,id='',active=false,optimal},command=redis) {
  const prefix='l2c:community:v1:'+mode+':'+caseId;
  const value=await command(['EVAL',SCRIPT,4,prefix+':algs',prefix+':scores',prefix+':votes:'+voter,'l2c:community:rate:'+ip,JSON.stringify(optimal),action,id,JSON.stringify(algorithm||{}),active?'1':'0']);
  const result=JSON.parse(value);
  if(result.error) {const e=Error(result.error);e.status=result.error.startsWith('Too many')?429:400;throw e;}
  // Redis cjson encodes an empty Lua table as {}, not [].
  for(const key of ['optimal','top','submissions']) if(!Array.isArray(result[key])) result[key]=[];
  return result;
}
module.exports={community,SCRIPT};
