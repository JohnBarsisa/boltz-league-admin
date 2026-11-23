// Isolated integration harness: executes the real gateway and Studio worker
// against SQLite. It never connects to a production database or service.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
export function createHarness(initial,filename=':memory:'){
 const database=new DatabaseSync(filename);
 database.exec('CREATE TABLE IF NOT EXISTS league_publications(revision INTEGER PRIMARY KEY,content TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS ref_sessions(key TEXT PRIMARY KEY,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ref_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);');
 const seed=structuredClone(initial);
 seed.matchdayRosterImports??=['season26-2026-11-20-squads'];
 database.prepare('INSERT OR IGNORE INTO league_publications VALUES(0,?,?)').run(JSON.stringify(seed),new Date().toISOString());
 const DB={prepare(sql){const query=(args=[])=>({bind(...a){return query(a)},async first(){return database.prepare(sql).get(...args)||null},async run(){const r=database.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}});return query()},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
 const code=fs.readFileSync(new URL('worker/referee.mjs',root),'utf8')+'\n'+fs.readFileSync(new URL('worker/api.mjs',root),'utf8').replace('export default','const worker=');
 const worker=new Function('seed','serveStudio',code+'\nreturn worker;')(seed,()=>new Response('Not found',{status:404}));
 const password='isolated-test-password';
 const env={DB,REF_PASSWORD:password,EDITOR_EMAIL:'owner@example.invalid',BUCKET:{}};
 const studio='https://boltz-league-studio.jpiyady.chatgpt.site';
 const gatewayCode=fs.readFileSync(new URL('../gateway/worker/index.mjs',root),'utf8').replace('export default','const gateway=');
 const upstream=async(url,options)=>{if(!url.startsWith(studio+'/'))throw Error('External request forbidden in harness');return worker.fetch(new Request(url,{...options,duplex:"half"}),env)};
 const gateway=new Function('fetch',gatewayCode+'\nreturn gateway;')(upstream);
 return {database,password,env,worker,async fetch(request){return gateway.fetch(request,{STUDIO_GATE:'isolated-gate',ASSETS:{fetch:()=>new Response(null,{status:404})}})},snapshot(){const r=database.prepare('SELECT * FROM league_publications ORDER BY revision DESC LIMIT 1').get();return {revision:r.revision,state:JSON.parse(r.content)}},close(){database.close()}};
}
