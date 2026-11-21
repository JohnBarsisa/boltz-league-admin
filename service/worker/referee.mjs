// Referees work on the public GitHub Pages domain while the database runs
// on the private service origin. Allow exactly these trusted write origins,
// never arbitrary cross-site origins, and always require the server session.
function trustedRefereeOrigin(request){
 const origin=request.headers.get('origin');
 return origin===new URL(request.url).origin || origin==='https://boltzleague.github.io';
}
const cookieName='boltz_ref_session';
const sessionCookie=(v,age)=>cookieName+'='+v+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+age;
async function digest(v){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}
async function sessionKey(req){const raw=req.headers.get('x-boltz-session')?.match(/^[a-f0-9-]{72}$/)?.[0] || (req.headers.get('cookie')||'').match(/(?:^|;\s*)boltz_ref_session=([a-f0-9-]{72})(?:;|$)/)?.[1];return raw?digest(raw):''}
async function referee(req,env){const key=await sessionKey(req);return !!key&&!!(await env.DB.prepare('SELECT key FROM ref_sessions WHERE key=? AND expires>?').bind(key,Date.now()).first())}
async function authRoute(req,env,path){
 const owner=!!env.EDITOR_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.EDITOR_EMAIL.toLowerCase();
 if(path==='/api/access'&&req.method==='GET')return json({role:owner?'owner':await referee(req,env)?'referee':'guest'});
 if(req.method!=='POST'||!trustedRefereeOrigin(req))return json({error:'Sign-in request rejected.'},403);
 if(path==='/api/logout'){const key=await sessionKey(req);if(key)await env.DB.prepare('DELETE FROM ref_sessions WHERE key=?').bind(key).run();return new Response(null,{status:204,headers:{'Set-Cookie':sessionCookie('',0)}})}
 const now=Date.now(),bucket=Math.floor(now/600000);
 const key=await digest(bucket+':'+(req.headers.get('oai-authenticated-user-id')||req.headers.get('cf-connecting-ip')||'studio'));
 const result=await env.DB.prepare('INSERT INTO ref_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+600000).first();
 if(result.count>10)return json({error:'Too many attempts. Try again in ten minutes.'},429);
 const input=await req.json();
 if(!env.REF_PASSWORD||input.password!==env.REF_PASSWORD)return json({error:'Incorrect referee password.'},401);
 const token=crypto.randomUUID()+crypto.randomUUID();
 await env.DB.batch([env.DB.prepare('DELETE FROM ref_attempts WHERE key=? OR expires<?').bind(key,now),env.DB.prepare('DELETE FROM ref_sessions WHERE expires<?').bind(now),env.DB.prepare('INSERT INTO ref_sessions(key,expires) VALUES(?,?)').bind(await digest(token),now+14400000)]);
 if(req.headers.get('x-boltz-client')==='match-centre')return json({role:'referee',token});
 return new Response('{"role":"referee"}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':sessionCookie(token,14400)}});
}
function enforceRefScope(before,after){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const league=({clubs,matches,...settings})=>settings;
 if(!same(league(before),league(after)))fail('League settings require owner access.',403);
 const profile=({players,squadName,...fields})=>fields;
 for(const [name,club] of Object.entries(before.clubs)){
   if(!Object.hasOwn(after.clubs,name)||!same(profile(club),profile(after.clubs[name])))fail('Existing club profiles require owner access.',403);
 }
 for(const [name,club] of Object.entries(after.clubs)){
   if(Object.hasOwn(before.clubs,name))continue;
   const fields=profile(club);
   if(Object.keys(fields).length!==4 || fields.title!==name+' FC' || fields.bio!=='Season 6 squad.' || fields.kit!=='Unconfirmed' || fields.image!=='/assets/hero.webp')fail('New club profiles use the league defaults.',403);
 }
 const metadata=({status,startedAt,finishedAt,events,lineups,formations,positions,round,kickoff,venue,home,away,stream,...rest})=>rest;
 const existing=new Map(before.matches.map(match=>[match.id,match]));
 for(const next of after.matches){
   const old=existing.get(next.id);
   if(!old){
     const {id,...unknown}=metadata(next);
     if(Object.keys(unknown).length)fail('New referee fixtures may contain only matchday information.',403);
     continue;
   }
   if(!same(metadata(old),metadata(next)))fail('Protected fixture information requires owner access.',403);
   if((old.home!==next.home||old.away!==next.away) && (old.status!=='scheduled'||old.events.length||Object.values(old.lineups||{}).some(names=>names.length)||Object.keys(old.formations||{}).length||Object.keys(old.positions||{}).length))fail('Clubs are locked once a fixture has a lineup or starts.',403);
 }
}
