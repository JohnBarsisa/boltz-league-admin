const publicPages='https://boltzleague.github.io/';
const pagesOrigins=new Set([new URL(publicPages).origin,'https://johnbarsisa.github.io']);
const studio='https://boltz-league-studio.jpiyady.chatgpt.site';
export default {async fetch(request,env){
 const url=new URL(request.url),p=url.pathname;
 if(p==='/referee'||p==='/referee/') {
   const match=url.searchParams.get('match');
   return Response.redirect(publicPages+'#ref'+(match?'/'+encodeURIComponent(match):''),302);
 }
 if(p.startsWith('/referee/')){
  const sub=p.slice('/referee'.length);
  const methods={'/api/health':['GET'],'/api/access':['GET'],'/api/ref-state':['GET'],'/api/state':['GET','PUT'],'/api/login':['POST'],'/api/logout':['POST']};
  if(!methods[sub])return new Response(null,{status:404});
  const origin=request.headers.get('origin');
  const pages=pagesOrigins.has(origin);
  const cors=new Headers({'Cache-Control':'no-store','Vary':'Origin'});
  if(pages)cors.set('Access-Control-Allow-Origin',origin);
  if(origin&&origin!==url.origin&&!pages)return new Response(null,{status:403});
  if(request.method==='OPTIONS'&&pages){
   cors.set('Access-Control-Allow-Methods',methods[sub].join(', '));
   cors.set('Access-Control-Allow-Headers','Content-Type, Authorization, X-Boltz-Session, X-Boltz-Client');
   return new Response(null,{status:204,headers:cors});
  }
  if(!methods[sub].includes(request.method))return new Response(null,{status:405,headers:cors});
  const mutating=request.method!=='GET';
  if(mutating&&!origin)return new Response(null,{status:403,headers:cors});
  const headers=new Headers({'OAI-Sites-Authorization':'Bearer '+env.STUDIO_GATE});
  const desk=request.headers.get('x-boltz-client')==='match-centre';
  if(desk)headers.set('x-boltz-client','match-centre');
  const ticket=request.headers.get('x-boltz-session');
  if(ticket && /^[a-f0-9-]{72}$/.test(ticket))headers.set('x-boltz-session',ticket);
  else if(pages){
   const legacy=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9-]{72})$/)?.[1];
   if(legacy)headers.set('x-boltz-session',legacy);
  }else if(request.headers.has('cookie'))headers.set('cookie',request.headers.get('cookie'));
  if(request.headers.has('content-type'))headers.set('content-type',request.headers.get('content-type'));
  if(mutating)headers.set('origin',origin==='https://boltzleague.github.io'?origin:studio);
  const res=await fetch(studio+sub,{method:request.method,headers,body:mutating?request.body:undefined,redirect:'manual'});
  cors.set('Content-Type',res.headers.get('Content-Type')||'application/json');
  const cookie=res.headers.get('set-cookie');
  if(desk && sub==='/api/login' && res.ok){
   const login=await res.json();
   if(login.role!=='referee'||!/^[a-f0-9-]{72}$/.test(login.token||''))return Response.json({error:'Could not verify the referee session.'},{status:502,headers:cors});
   const verified=await fetch(studio+'/api/ref-state',{headers:{'OAI-Sites-Authorization':headers.get('OAI-Sites-Authorization'),'X-Boltz-Session':login.token},redirect:'manual'});
   if(!verified.ok)return Response.json({error:'Could not open the referee desk. Try again.'},{status:502,headers:cors});
   return Response.json({...login,desk:await verified.json()},{headers:cors});
  }
  if(!desk&&pages&&sub==='/api/login'&&res.ok){
   const token=cookie?.match(/(?:^|;\s*)boltz_ref_session=([a-f0-9-]{72})(?:;|$)/)?.[1];
   if(!token)return new Response('{"error":"Could not start referee session."}',{status:502,headers:cors});
   return Response.json({role:'referee',token},{headers:cors});
  }
  if(!pages&&cookie)cors.set('Set-Cookie',cookie);
  return new Response(res.body,{status:res.status,headers:cors});
 }
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(p==='/admin'||p.startsWith('/admin/')||p.startsWith('/editor/'))return Response.redirect(studio,302);
 if(p==='/api/league'||/^\/media\/[a-f0-9-]{36}$/.test(p)){
   const upstream=await fetch(studio+(p==='/api/league'?'/api/state':p),{headers:{'OAI-Sites-Authorization':'Bearer '+env.STUDIO_GATE},redirect:'manual'});
   if(!upstream.ok)return new Response('League service unavailable',{status:502});
   const origin=request.headers.get('origin');
   const headers=new Headers({'Content-Type':upstream.headers.get('Content-Type')||'application/octet-stream','Cache-Control':p==='/api/league'?'no-store':'public,max-age=31536000,immutable','X-Content-Type-Options':'nosniff'});
   if(p==='/api/league'){
     headers.set('Vary','Origin');
     if(pagesOrigins.has(origin))headers.set('Access-Control-Allow-Origin',origin);
   }
   return new Response(request.method==='HEAD'?null:upstream.body,{headers});
 }
 // Keep the media directory available for existing Studio artwork references.
 // The public user interface itself is served only from GitHub Pages.
 if(p.startsWith('/assets/'))return env.ASSETS.fetch(request);
 if(p==='/ref-desk'||p==='/ref-desk/'){
  const match=url.searchParams.get('match');
  const section=url.searchParams.get('section');
  return Response.redirect(publicPages+'#ref'+(match?'/'+encodeURIComponent(match):'')+(section?'?section='+encodeURIComponent(section):''),302);
 }
 if(p==='/storyboard'||p==='/storyboard/'||p==='/storyboard/index.html')return Response.redirect(publicPages+'storyboard/'+url.search,302);
 if(p==='/'||p==='/index.html')return Response.redirect(publicPages+url.search,302);
 return new Response(null,{status:404});
}};
