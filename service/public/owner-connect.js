'use strict';
// Owner credentials stay on the authenticated Studio origin. The port is issued only after an explicit owner action.
const pagesOrigin='https://johnbarsisa.github.io';
const openerWindow=window.opener;
const message=document.querySelector('#message');
const approve=document.querySelector('#connect');
const operations=new Map([['api/state',['GET','PUT']],['api/upload',['POST']],['api/clip',['POST']],['api/history',['GET']]]);
async function verifyOwner(){
 const response=await fetch('/api/access',{cache:'no-store'});
 return response.ok&&(await response.json()).role==='owner';
}
(async()=>{
 if(!await verifyOwner()){message.textContent='Sign in with the league owner account to manage this site.';return;}
 if(!openerWindow){message.textContent='Your owner account is verified. Open the editor below to continue.';return;}
 message.textContent='Allow the open Boltz League Admin dashboard on johnbarsisa.github.io to edit league records while this window stays open.';
 approve.hidden=false;
})().catch(()=>{message.textContent='Could not verify your account. Reload to try again.'});
approve.onclick=async()=>{
 approve.disabled=true;
 try{
  if(!await verifyOwner())throw Error('Owner access is required.');
  const channel=new MessageChannel();
  channel.port1.onmessage=async({data})=>{
   const {id,path,method='GET',body}=data||{};
   if(typeof id!=='string')return;
   try{
    const url=new URL(path,location.origin+'/');
    const methods=operations.get(url.pathname.slice(1));
    if(url.origin!==location.origin||!methods?.includes(method))throw Error('Unsupported admin operation.');
    const headers={'X-Boltz-Owner':'dashboard'};
    if(typeof body==='string')headers['Content-Type']='application/json';
    const result=await fetch(url.pathname+url.search,{method,headers,body,cache:'no-store'});
    channel.port1.postMessage({id,status:result.status,text:await result.text()});
   }catch(error){channel.port1.postMessage({id,status:502,text:JSON.stringify({error:error.message})})}
  };
  openerWindow.postMessage({type:'boltz-owner-connected'},pagesOrigin,[channel.port2]);
  message.textContent='Connected. Return to your admin dashboard to manage the league. Closing this window disconnects it.';
  approve.hidden=true;
 }catch(error){message.textContent=error.message;approve.disabled=false}
};
