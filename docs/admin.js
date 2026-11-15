'use strict';
const studio='https://boltz-league-studio.jpiyady.chatgpt.site';
const $=id=>document.getElementById(id);
const sections={
 'Teams & squads':'Manage players, club profiles, artwork and kits.',
 'Fixtures':'Set rounds, kickoff times, venues and broadcast links.',
 'Live matches':'Arrange jerseys, record events and publish scores.',
 'Tournaments':'Start a competition and download previous records.',
 'Homepage':'Edit campaign headlines, descriptions and images.',
 'Appearance':'Change site branding and homepage sections.',
 'Navigation':'Rename the public navigation links.',
 'Database control':'Publish drafts, reload records and manage season data.'
};
let popup,port,selected='Teams & squads',connected=false;
const pending=new Map();
function report(text){$('status').textContent=text}
function metrics(s){$('competition').textContent=s.tournament?.name||'Season 6';$('clubs').textContent=Object.keys(s.clubs).length;$('fixtures').textContent=s.matches.length;$('live').textContent=s.matches.filter(m=>m.status==='live').length}
fetch('https://boltz-league-matchday.jpiyady.chatgpt.site/api/league',{credentials:'omit'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>metrics(d.state)).catch(()=>{$('competition').textContent='Unavailable'});
function connect(){
 if(connected){openEditor();return}
 popup=window.open(studio+'/connect','boltzOwner','popup,width=650,height=650');
 report(popup?'Approve the connection in the owner window, then return here.':'Your browser blocked the owner window. Use the secure editor link below.');popup?.focus();
}
function openEditor(){
 const frame=$('desk');
 if(frame.contentWindow?.boltzRefDirty?.()&&!confirm('Discard the unpublished draft and change sections?'))return;
 $('editor').hidden=false;frame.src='desk/index.html?embedded=1&tool='+encodeURIComponent(selected);$('editor').scrollIntoView();
}
$('connect').onclick=connect;
for(const [title,detail] of Object.entries(sections)){
 const a=document.createElement('a'),h=document.createElement('h3'),p=document.createElement('p');a.className='tile';a.href=studio+'/?tool='+encodeURIComponent(title);h.textContent=title;p.textContent=detail;a.append(h,p);$('tools').append(a);
 a.onclick=e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();selected=title;$('fallback').href=a.href;connect()};
}
window.boltzRefFetch=(path,opts={})=>new Promise((resolve,reject)=>{
 if(!connected||!port||popup?.closed){reject(Error('Reconnect your owner account to publish.'));return}
 const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Connection timed out. Reload the published records before retrying.'))},45000);
 pending.set(id,{resolve,reject,timer});port.postMessage({id,path,method:opts.method||'GET',body:opts.body});
});
window.boltzRefReady=async()=>{const r=await window.boltzRefFetch('api/state');if(!r.ok)throw Error('Owner sign-in required.');const data=await r.json();metrics(data.state);return {...data,role:'owner'}};
window.addEventListener('message',e=>{
 if(e.origin===location.origin&&e.source===$('desk').contentWindow){
  if(e.data?.type==='boltz-ref-height'&&Number.isFinite(e.data.height))$('desk').style.height=Math.max(450,Math.ceil(e.data.height)+12)+'px';
  if(e.data?.type==='boltz-ref-published')window.boltzRefReady().catch(error=>report(error.message));
  return;
 }
 if(e.origin!==studio||e.source!==popup||e.data?.type!=='boltz-owner-connected'||!e.ports[0])return;
 port=e.ports[0];connected=true;
 port.onmessage=({data})=>{const call=pending.get(data?.id);if(!call)return;pending.delete(data.id);clearTimeout(call.timer);call.resolve(new Response(data.text,{status:data.status}))};
 $('connect').textContent='Open editor';report('Owner account connected. Keep the authorisation window open while editing.');openEditor();
});
setInterval(()=>{if(connected&&popup?.closed){connected=false;port?.close();$('connect').textContent='Reconnect owner account';report('Owner window closed. Reconnect to publish your draft.')}},1000);
