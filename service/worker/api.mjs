const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Check the text length and required fields.');return v.trim()};
const isImage=v=>typeof v==='string'&&/^\/(assets\/[A-Za-z0-9_-]+\.webp|media\/[a-f0-9-]{36})$/.test(v);
function validate(state){
 if(!state?.clubs || Array.isArray(state.clubs) || typeof state.clubs!=='object')fail('Invalid club list.');
 if(state.tournament){
  text(state.tournament.name,60,true);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(state.tournament.date)||!Array.isArray(state.tournament.clubs)||state.tournament.clubs.length<2||new Set(state.tournament.clubs).size!==state.tournament.clubs.length||!state.tournament.clubs.every(n=>Object.hasOwn(state.clubs,n)))fail('Check tournament date and participants.');
 }
 if(state.tournamentHistory!==undefined){
  if(!Array.isArray(state.tournamentHistory)||state.tournamentHistory.length>500)fail('Invalid tournament archive.');
  for(const entry of state.tournamentHistory){text(entry.name,60,true);if(!Number.isSafeInteger(entry.revision)||entry.revision<0)fail('Invalid archive revision.')}
 }
 if(state.presentation){
  for(const key of ['brand','clubHeading','footer'])text(state.presentation[key],80,true);
  for(const key of ['showClubs','showEditorial'])if(typeof state.presentation[key]!=='boolean')fail('Invalid homepage sections.');
 }
 const keys=Object.keys(state.clubs);
 if(keys.length>64 || !Object.keys(seed.clubs).every(k=>Object.hasOwn(state.clubs,k)))fail('Invalid club list.');
 const unique=new Set();
 for(const name of keys){
   if(!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .’'&-]{0,49}$/u.test(name) || name!==name.trim() || Object.hasOwn(Object.prototype,name) || / FC$/i.test(name))fail('Use a valid team name.');
   const folded=name.normalize('NFKC').toLocaleLowerCase('en');
   if(unique.has(folded))fail('Each team needs a unique name.');
   unique.add(folded);
 }
 for(const c of Object.values(state.clubs)){
   if(c.squadName!==undefined)text(c.squadName,70,true);
   text(c.title,70,true);text(c.kit,70,true);text(c.bio,1500,true);if(!isImage(c.image))fail('Choose an uploaded image.');
   if(c.scene){
    if(c.scene.player!==undefined)text(c.scene.player,70);
    if(c.scene.poster&&!isImage(c.scene.poster))fail('Choose an uploaded still.');
    if(c.scene.clip&&!/^\/media\/[a-f0-9-]{36}$/.test(c.scene.clip))fail('Choose an uploaded clip.');
    if((c.scene.poster||c.scene.clip)&&!c.scene.player)fail('Enter the selected player before publishing media.');
    if(c.scene.clip&&!c.scene.poster)fail('Upload a still for reduced motion before publishing a clip.');
   }
   if(!Array.isArray(c.players)||c.players.length>80||new Set(c.players).size!==c.players.length)fail('Use up to 80 unique squad names.');c.players.forEach(n=>text(n,70,true));
 }
 if(Object.keys(state.menu||{}).sort().join()!==Object.keys(seed.menu).sort().join())fail('Invalid navigation.');Object.values(state.menu).forEach(n=>text(n,25,true));
 if(state.features?.length!==2)fail('Both homepage features are required.');
 for(const f of state.features){text(f.title,80,true);text(f.description,240,true);if(!isImage(f.image))fail('Invalid feature image.')}
 if(!Array.isArray(state.matches)||state.matches.length>150||new Set(state.matches.map(m=>m.id)).size!==state.matches.length)fail('Invalid fixtures.');
 for(const m of state.matches){
  text(m.id,64,true);text(m.round,50,true);text(m.venue,80,true);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(m.kickoff)||!['scheduled','live','completed'].includes(m.status))fail('Check kickoff and match status.');
  const sides=[m.home,m.away];if(m.home===m.away||!sides.every(n=>keys.some(k=>k+' FC'===n)))fail('Choose two different clubs.');
  if(!m.lineups||typeof m.lineups!=='object'||Array.isArray(m.lineups))fail('Invalid starting lineups.');
  if(m.stream){let u;try{u=new URL(text(m.stream,1000))}catch{fail('Enter a valid HTTPS stream link.')}if(u.protocol!=='https:'||u.username||u.password)fail('Use an HTTPS stream link.')}
  if(!Array.isArray(m.events)||m.events.length>300||new Set(m.events.map(e=>e.id)).size!==m.events.length)fail('Invalid match events.');
  if(m.status==='scheduled'&&m.events.length)fail('Start the fixture before adding an event.');
  for(const e of m.events){if(!/^[A-Za-z0-9_-]{1,60}$/.test(e.id))fail('Invalid event identifier.');if(!sides.includes(e.team)||!['goal','own goal','yellow card','red card','clean sheet'].includes(e.type))fail('Invalid event.');text(e.player,70,true);text(e.assist,70);if(e.assist&&(e.type!=='goal'||e.assist===e.player))fail('Choose a different player for an assist.');if(e.minute!==''&&(!Number.isInteger(e.minute)||e.minute<0||e.minute>150))fail('Use a minute from 0 to 150.')}
  for(const [side,shape] of Object.entries(m.formations||{})){if(!sides.includes(side)||!['2-3-2','3-2-2','2-2-3','2-3-1','3-2-1','2-2-1','2-1-1','4-3-3','4-4-2','3-5-2','4-2-3-1'].includes(shape))fail('Choose an available formation.')}
  for(const [side,points] of Object.entries(m.positions||{})){
   const starters=m.lineups?.[side]||[];
   if(!sides.includes(side)||!Array.isArray(points)||points.length>11||new Set(points.map(p=>p.name)).size!==points.length)fail('Invalid pitch positions.');
   for(const p of points)if(!starters.includes(p.name)||![p.x,p.y].every(v=>Number.isFinite(v)&&v>=5&&v<=95))fail('Position a named starter inside the pitch.');
  }
  for(const [side,names] of Object.entries(m.lineups||{})){if(!sides.includes(side)||!Array.isArray(names)||names.length>11||new Set(names).size!==names.length)fail('Choose up to eleven distinct starters.');names.forEach(n=>text(n,70,true))}
 }
 return state;
}
function publishedState(row){
  const state=JSON.parse(row.content);
  // Earlier publications used the initial shirt colours. Future editor choices take precedence.
  if(Date.parse(row.updated_at)<Date.UTC(2026,10,14,3,40)){
    if(state.clubs.Stacey.kit==='White & black')state.clubs.Stacey.kit=seed.clubs.Stacey.kit;
    if(state.clubs.Angels.kit==='Sky blue & silver')state.clubs.Angels.kit=seed.clubs.Angels.kit;
  }
  return state;
}
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 try{
 const ownerEmail=request.headers.get('oai-authenticated-user-email');
 const isOwner=Boolean(ownerEmail && ownerEmail.toLowerCase()===env.EDITOR_EMAIL?.toLowerCase());
 if(path==='/api/health'&&request.method==='GET')return json({ok:true,release:'boltz-ref-publish-2026-11-22'});
 if((request.headers.has('x-boltz-owner')||path==='/api/history')&&!isOwner)return json({error:'League owner access required.'},403);
 if(path==='/api/history'&&request.method==='GET'){
  const value=new URL(request.url).searchParams.get('revision');
  if(!value||!/^\d{1,12}$/.test(value))return json({error:'Choose an archive revision.'},400);
  const row=await env.DB.prepare('SELECT revision,content,updated_at FROM league_publications WHERE revision=?').bind(Number(value)).first();
  return row?json({revision:row.revision,state:publishedState(row)}):json({error:'Archive unavailable.'},404);
 }
 if(['/api/login','/api/logout','/api/access'].includes(path))return await authRoute(request,env,path);
 if((path==='/api/state'||path==='/api/ref-state')&&request.method==='GET'){
  if(path==='/api/ref-state' && !await referee(request,env))return json({error:'Your referee session has expired.'},401);
  let row=await env.DB.prepare('SELECT revision,content,updated_at FROM league_publications ORDER BY revision DESC LIMIT 1').first();
  if(!row){
   await env.DB.prepare('INSERT OR IGNORE INTO league_publications(revision,content,updated_at) VALUES(0,?,?)').bind(JSON.stringify(seed),new Date().toISOString()).run();
   row=await env.DB.prepare('SELECT revision,content,updated_at FROM league_publications ORDER BY revision DESC LIMIT 1').first();
  }
  const state=publishedState(row);
  return json({revision:row.revision,state,updated:row.updated_at,...(path==='/api/ref-state'?{role:'referee'}:{})});
 }
 if(request.method==='GET'&&/^\/media\/[a-f0-9-]{36}$/.test(path)){const f=await env.BUCKET.get(path.slice(7));return f?new Response(f.body,{headers:{'Content-Type':f.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=31536000,immutable'}}):new Response(null,{status:404})}
 if(path==='/api/state'||path==='/api/upload'||path==='/api/clip'){
  const email=request.headers.get('oai-authenticated-user-email');const owner=!!email&&email.toLowerCase()===env.EDITOR_EMAIL?.toLowerCase();if(!owner&&(path!=='/api/state'||!await referee(request,env)))return json({error:'Sign in to edit.'},403);
  if(!trustedRefereeOrigin(request))return json({error:'Invalid origin.'},403);
  if(path==='/api/clip'&&request.method==='POST'){
   const limit=16*1024*1024;
   if(Number(request.headers.get('Content-Length'))>limit)fail('Choose an MP4 under 16 MB.');
   const bytes=new Uint8Array(await request.arrayBuffer());
   if(bytes.length>limit||bytes.length<16||String.fromCharCode(...bytes.slice(4,8))!=='ftyp')fail('Choose an MP4 under 16 MB.');
   const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:'video/mp4'}});return json({path:'/media/'+id},201);
  }
  if(path==='/api/upload'&&request.method==='POST'){
   const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>3*1024*1024)fail('Choose an image under 3 MB.');let type;
   if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';
   if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)type='image/png';
   if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';
   if(!type)fail('Choose a JPEG, PNG or WebP image.');const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:type}});return json({path:'/media/'+id},201);
  }
  if(path==='/api/state'&&request.method==='PUT'){
   const raw=await request.text();if(raw.length>900000)fail('Season data is too large.');const {revision,state}=JSON.parse(raw);if(!Number.isSafeInteger(revision)||revision<0)fail('Invalid revision.');
   const content=JSON.stringify(validate(state));
   if(!owner){const row=await env.DB.prepare('SELECT content,revision,updated_at FROM league_publications ORDER BY revision DESC LIMIT 1').first();if(!row||row.revision!==revision)return json({error:'Reload to get the latest revision.'},409);enforceRefScope(publishedState(row),state)}
   const result=await env.DB.prepare('INSERT INTO league_publications(revision,content,updated_at) SELECT ?,?,? WHERE COALESCE((SELECT MAX(revision) FROM league_publications),0)=?').bind(revision+1,content,new Date().toISOString(),revision).run();
   return result.meta.changes?json({revision:revision+1}):json({error:'Another session published changes. Reload before editing again.'},409);
  }
  return json({error:'Unsupported method.'},405);
 }
 return serveStudio(path);
 }catch(e){return json({error:e.status?e.message:e instanceof SyntaxError?'Invalid request.':'The studio could not complete this request.'},e.status||500)}
}};
