// Strict, read-only deployment verification. Never writes league records.
import assert from 'node:assert/strict';
const expected=process.argv[2];
assert.match(expected||'',/^[a-f0-9]{40}$/,'Provide the exact GitHub backend commit');
const base='https://boltz-league-matchday.jpiyady.chatgpt.site';
const headers={Origin:'https://boltzleague.github.io'};
const health=await fetch(base+'/referee/api/health',{headers,signal:AbortSignal.timeout(15000)});
assert.equal(health.status,200);
const body=await health.json();assert.equal(body.release,'boltz-production-2026-11-23');assert.equal(body.sourceCommit,expected);assert.match(body.sourceDigest,/^[a-f0-9]{64}$/);
const feed=await fetch(base+'/api/league',{headers,signal:AbortSignal.timeout(15000)});assert.equal(feed.status,200);assert.equal(feed.headers.get('access-control-allow-origin'),headers.Origin);
const publication=await feed.json();assert.ok(Number.isInteger(publication.revision));assert.ok(Array.isArray(publication.state.matches));
console.log(JSON.stringify({verified:true,sourceCommit:body.sourceCommit,sourceDigest:body.sourceDigest,revision:publication.revision,clubs:Object.keys(publication.state.clubs).length,fixtures:publication.state.matches.length}));
