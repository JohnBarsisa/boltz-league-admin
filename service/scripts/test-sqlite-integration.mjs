import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHarness} from './sqlite-harness.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../seed.json',import.meta.url)));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'boltz-test-')),file=path.join(folder,'league.sqlite');
let h=createHarness(seed,file);
const origin='https://boltzleague.github.io',url='https://boltz-league-matchday.jpiyady.chatgpt.site';
async function call(route,method='GET',body,token,from=origin){
 const headers={'Origin':from,'X-Boltz-Client':'match-centre','Content-Type':'application/json'};
 if(token)headers['X-Boltz-Session']=token;
 const r=await h.fetch(new Request(url+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}));
 const value=r.status===204?null:await r.text();
 return {status:r.status,headers:r.headers,body:value?JSON.parse(value):null};
}
const report=s=>console.log('PASS SQLite integration: '+s);
try{
 let r=await call('/referee/api/health');assert.equal(r.body.release,'boltz-production-2026-11-23');report('gateway forwards release health');
 r=await call('/referee/api/login','POST',{password:'wrong'});assert.equal(r.status,401);
 r=await call('/referee/api/login','POST',{password:h.password},undefined,'https://evil.example');assert.equal(r.status,403);
 r=await call('/referee/api/state','PUT',{revision:0,state:seed});assert.equal(r.status,403);report('invalid credentials, hostile origins and unauthorized writes rejected');
 const a=(await call('/referee/api/login','POST',{password:h.password})).body.token;
 const b=(await call('/referee/api/login','POST',{password:h.password})).body.token;
 assert.notEqual(a,b);assert.equal((await call('/referee/api/ref-state','GET',undefined,a)).status,200);report('two independent referee sessions authenticate through gateway');
 const baseline=h.snapshot(),draft=structuredClone(baseline.state);
 const m=draft.matches[0],team=m.home,key=team.replace(/ FC$/,'');
 draft.clubs[key].players=['Captain (C)','A','B','C','D','E','F'];
 m.status='live';m.startedAt=new Date().toISOString();m.lineups={[team]:draft.clubs[key].players};m.formations={[team]:'2-3-2'};
 r=await call('/referee/api/state','PUT',{revision:baseline.revision,state:draft},a);assert.equal(r.status,200);
 assert.equal((await call('/api/league')).body.state.matches[0].status,'live');report('start timestamp, seven outfield players and eight-a-side formation persist publicly');
 const latest=h.snapshot(),other=structuredClone(baseline.state);other.matches[1].status='live';other.matches[1].startedAt=new Date().toISOString();
 r=await call('/referee/api/state','PUT',{revision:baseline.revision,state:other},b);assert.equal(r.status,409);
 const rebased=structuredClone(latest.state);rebased.matches[1]=other.matches[1];
 r=await call('/referee/api/state','PUT',{revision:latest.revision,state:rebased},b);assert.equal(r.status,200);assert.equal(h.snapshot().state.matches[0].status,'live');report('stale revision rejected; independent fixture retry preserves both referees');
 let publication=h.snapshot();let events=publication.state.matches[0].events;
 events.push({id:'goal',type:'goal',minute:3,team,player:'A',assist:'B'},{id:'own',type:'own goal',minute:4,team,player:'C',assist:''},{id:'yellow',type:'yellow card',minute:5,team,player:'D',assist:''},{id:'red',type:'red card',minute:6,team,player:'E',assist:''});
 r=await call('/referee/api/state','PUT',publication,a);assert.equal(r.status,200);
 for(const formation of ['3-2-2','2-2-3']){publication=h.snapshot();publication.state.matches[0].formations[team]=formation;r=await call('/referee/api/state','PUT',publication,a);assert.equal(r.status,200)}
 publication=h.snapshot();publication.state.matches[0].status='completed';publication.state.matches[0].finishedAt=new Date().toISOString();
 r=await call('/referee/api/state','PUT',publication,a);assert.equal(r.status,200);
 let publicRead=(await call('/api/league')).body;assert.equal(publicRead.state.matches[0].events.length,4);assert.equal(publicRead.state.matches[0].status,'completed');report('goal, assist, own goal, cards, all formations and final timestamp read back');
 publication=h.snapshot();publication.state.matches[0].events[0].minute=7;r=await call('/referee/api/state','PUT',publication,a);assert.equal(r.status,200);report('completed match corrections preserved');
 publication=h.snapshot();publication.state.presentation={...publication.state.presentation,brand:'Unauthorized'};r=await call('/referee/api/state','PUT',publication,a);assert.equal(r.status,403);report('protected admin settings rejected');
 const before=h.snapshot();h.close();h=createHarness(seed,file);assert.deepEqual(h.snapshot(),before);assert.equal((await call('/referee/api/ref-state','GET',undefined,a)).status,200);report('database and session survive worker restart');
 const roster=structuredClone(h.snapshot().state.clubs);
 r=await call('/referee/api/state','PUT',{revision:h.snapshot().revision,restoreSeasonStart:true},a);assert.equal(r.status,200);assert.deepEqual(h.snapshot().state.clubs,roster);assert.equal(h.snapshot().state.matches.length,21);assert.ok(h.snapshot().state.matches.every(m=>m.status==='scheduled'&&!m.events.length));report('isolated season reset preserves squads and restores opening fixtures');
 await call('/referee/api/logout','POST',{},a);assert.equal((await call('/referee/api/ref-state','GET',undefined,a)).status,401);assert.equal((await call('/referee/api/ref-state','GET',undefined,b)).status,200);
 h.database.prepare('UPDATE ref_sessions SET expires=0').run();assert.equal((await call('/referee/api/ref-state','GET',undefined,b)).status,401);report('logout and expiry reject sessions without affecting other active sessions');
}finally{h.close();fs.rmSync(folder,{recursive:true,force:true})}
