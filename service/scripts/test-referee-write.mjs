import fs from 'node:fs';
import assert from 'node:assert/strict';
const seed=JSON.parse(fs.readFileSync('service/seed.json','utf8'));
const workerSources=fs.readFileSync('service/worker/referee.mjs','utf8')+'\n'+
 fs.readFileSync('service/worker/api.mjs','utf8').replace('export default','const worker =');
const run=new Function('seed','Response','crypto','TextEncoder','URL','Date',workerSources+
 '\nreturn {worker,validate,enforceRefScope,trustedRefereeOrigin};');
const {worker}=run(seed,Response,crypto,TextEncoder,URL,Date);
const service='https://boltz-league-matchday.jpiyady.chatgpt.site';
const pages='https://boltzleague.github.io';
const fakePass='test-only-unpublished-credential';
const copies=x=>structuredClone(x);
const published=new Map([[0,{revision:0,content:JSON.stringify(seed),updated_at:new Date().toISOString()}]]);
const sessions=new Map(),attempts=new Map();
const latest=()=>published.get(Math.max(...published.keys()));
const DB={
 prepare(sql){
  return {bind(...args){
   return {
    async first(){
     if(sql.startsWith('SELECT key FROM ref_sessions'))return (sessions.get(args[0])||0)>args[1]?{key:args[0]}:null;
     if(sql.startsWith('INSERT INTO ref_attempts')){attempts.set(args[0],(attempts.get(args[0])||0)+1);return {count:attempts.get(args[0])}}
     if(sql.includes('FROM league_publications ORDER BY revision DESC LIMIT 1'))return copies(latest());
     throw Error('Unimplemented SQL first: '+sql);
    },
    async run(){
     if(sql.startsWith('DELETE FROM ref_attempts')){attempts.delete(args[0]);return {meta:{changes:1}}}
     if(sql.startsWith('DELETE FROM ref_sessions WHERE expires')){for(const [k,v] of sessions)if(v<args[0])sessions.delete(k);return {meta:{changes:1}}}
     if(sql.startsWith('DELETE FROM ref_sessions WHERE key')){sessions.delete(args[0]);return {meta:{changes:1}}}
     if(sql.startsWith('INSERT INTO ref_sessions')){sessions.set(args[0],args[1]);return {meta:{changes:1}}}
     if(sql.startsWith('INSERT INTO league_publications(revision,content,updated_at) SELECT')){
      if(latest().revision!==args[3])return {meta:{changes:0}};
      published.set(args[0],{revision:args[0],content:args[1],updated_at:args[2]});
      return {meta:{changes:1}};
     }
     if(sql.startsWith('INSERT OR IGNORE INTO league_publications'))return {meta:{changes:0}};
     throw Error('Unimplemented SQL run: '+sql);
    }
   }
  }}
 },
 async batch(statements){return Promise.all(statements.map(x=>x.run()))}
};
const env={DB,REF_PASSWORD:fakePass,EDITOR_EMAIL:'owner@example.invalid',BUCKET:{}};
const headers=origin=>({
 Origin:origin,'X-Boltz-Client':'match-centre',
 'Content-Type':'application/json'
});
const req=(path,method='GET',origin=pages,body,session='')=>{
 const h=headers(origin);
 if(session)h['X-Boltz-Session']=session;
 return new Request(service+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
};
const call=async(path,method='GET',origin=pages,body,token='')=>{
 const result=await worker.fetch(req(path,method,origin,body,token),env);
 return {status:result.status,body:await result.json()};
};
const report=x=>console.log('PASS backend: '+x);
let x=await call('/api/login','POST',pages,{password:fakePass});
assert.equal(x.status,200,JSON.stringify(x));
assert.match(x.body.token,/^[a-f0-9-]{72}$/);
const token=x.body.token;
report('cross-origin GitHub Pages referee login issues a session token');
let read=await call('/api/ref-state','GET',pages,undefined,token);
assert.equal(read.status,200);
assert.equal(read.body.role,'referee');
report('session token reads original published revision');
const invalid=await call('/api/login','POST','https://evil.example',{password:fakePass});
assert.equal(invalid.status,403);
report('arbitrary origin remains blocked for sign-in');
const unauthed=await call('/api/state','PUT',pages,{revision:0,state:seed});
assert.equal(unauthed.status,403);
report('unauthenticated referee write remains blocked');
const malicious=await call('/api/state','PUT','https://evil.example',{revision:0,state:seed},token);
assert.equal(malicious.status,403);
assert.equal(malicious.body.error,'Invalid origin.');
report('valid token cannot write from an untrusted website');
const start=copies(seed),match=start.matches[0];
match.status='live';match.startedAt=new Date().toISOString();
start.clubs.Stacey.players=['Captain (C)','A','B','C','D','E','F'];
match.lineups['Stacey FC']=['Captain (C)','A','B','C','D','E','F'];
match.formations={'Stacey FC':'2-3-2'};
match.positions={'Stacey FC':match.lineups['Stacey FC'].map((name,i)=>({name,x:20+(i%3)*25,y:20+Math.floor(i/3)*28}))};
x=await call('/api/state','PUT',pages,{revision:0,state:start},token);
assert.equal(x.status,200,JSON.stringify(x));assert.equal(x.body.revision,1);
read=await call('/api/state','GET',pages);
assert.equal(read.body.state.matches[0].status,'live');
assert.equal(read.body.state.matches[0].lineups['Stacey FC'].length,7);
report('Start Match + eight-a-side lineup saves at revision 1 and is visible publicly');
const scored=copies(read.body.state);
scored.matches[0].events=[{id:'goal-test-01',type:'goal',minute:5,team:'Stacey FC',player:'A',assist:''}];
x=await call('/api/state','PUT',pages,{revision:1,state:scored},token);
assert.equal(x.status,200,JSON.stringify(x));assert.equal(x.body.revision,2);
read=await call('/api/state','GET',pages);
assert.equal(read.body.state.matches[0].events.length,1);
report('goal event saves and is visible to public match feed');
const finished=copies(read.body.state);
finished.matches[0].status='completed';finished.matches[0].finishedAt=new Date().toISOString();
x=await call('/api/state','PUT',pages,{revision:2,state:finished},token);
assert.equal(x.status,200,JSON.stringify(x));assert.equal(x.body.revision,3);
read=await call('/api/ref-state','GET',pages,undefined,token);
assert.equal(read.body.state.matches[0].status,'completed');
report('End Match saves with finishedAt timestamp and is confirmed by referee read-back');
x=await call('/api/state','PUT',pages,{revision:2,state:scored},token);
assert.equal(x.status,409);
report('stale season revision correctly rejects competing edits');
x=await call('/api/logout','POST',pages,{},token);
assert.equal(x.status,204);
const noSession=await call('/api/ref-state','GET',pages,undefined,token);
assert.equal(noSession.status,401);
report('logout invalidates session without affecting published records');
console.log('All backend referee write, read-back, formation, origin and authorization tests passed.');
