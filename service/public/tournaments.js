function tournamentSchedule(names,kickoff,venue){
 const rotation=[...names];if(rotation.length%2)rotation.push(null);
 const matches=[];
 for(let round=1;round<rotation.length;round++){
  for(let pair=0;pair<rotation.length/2;pair++){
   const a=rotation[pair],b=rotation[rotation.length-1-pair];
   if(!a||!b)continue;
   const [home,away]=(round+pair)%2?[a,b]:[b,a];
   matches.push({id:crypto.randomUUID(),round:'Round '+round,kickoff,venue,home:home+' FC',away:away+' FC',status:'scheduled',lineups:{},events:[],stream:''});
  }
  rotation.splice(1,0,rotation.pop());
 }
 return matches;
}
function tournamentView(){
 const current=state.tournament?.name||'Season 6';
 const history=(state.tournamentHistory||[]).slice().reverse();
 return '<section class="card"><h3>'+escape(current)+'</h3><p>'+state.matches.length+' fixtures in the current programme.</p></section>'+
 '<form class="card" id="tournamentForm"><h3>Start a tournament</h3><div class="grid">'+field('Tournament name','tName','')+field('Opening date','tDate','','date')+
 select('Fixture format','tFormat',['Round robin','Enter fixtures manually'],'Round robin')+
 field('Default kickoff','tTime','13:00','time')+field('Default venue','tVenue','Pitch 1')+'</div><fieldset><legend>Participating clubs</legend>'+
 Object.keys(state.clubs).sort(collator.compare).map(n=>'<label class="check"><input type="checkbox" name="entrant" value="'+escape(n)+'" checked>'+escape(n)+' FC</label>').join('')+
 '</fieldset><p>The current programme will be archived with its scores, squads and lineups when you publish. Round robin schedules each pair once. Adjust fixture times and pitches before matchday.</p><button>Prepare new tournament</button></form>'+
 '<section class="card"><h3>Previous tournaments</h3>'+ (history.length?history.map(h=>'<p>'+escape(h.name)+' <button data-archive-rev="'+h.revision+'">Download records</button></p>').join(''):'<p>Archived tournaments will appear here.</p>')+'</section>';
}
function presentationView(){
 const p=state.presentation||defaultPresentation();
 return '<section class="card"><h3>Website appearance</h3>'+field('Site name','brand',p.brand)+field('Club showcase heading','clubHeading',p.clubHeading)+field('Footer credit','footer',p.footer)+
 ['showClubs','showEditorial'].map((key,i)=>'<label class="check"><input type="checkbox" data-presentation="'+key+'" '+(p[key]?'checked':'')+'>'+['Show homepage club showcase','Show homepage editorial section'][i]+'</label>').join('')+'</section>';
}
function defaultPresentation(){return {brand:'BOLTZ LEAGUE',clubHeading:'THE CONTENDERS',footer:'SOFTTED Football',showClubs:true,showEditorial:true}}
document.addEventListener('submit',event=>{
 if(event.target.id!=='tournamentForm'||role!=='owner')return;
 event.preventDefault();
 const name=$('tName').value.trim(),date=$('tDate').value,kickoff=$('tTime').value,venue=$('tVenue').value.trim();
 const names=[...event.target.querySelectorAll('[name=entrant]:checked')].map(el=>el.value);
 if(!name||name.length>60||!date||!kickoff||!venue||venue.length>80||names.length<2){say('Enter a name, date, kickoff, venue and at least two clubs.');return;}
 if(state.matches.some(m=>m.status==='live')){say('Finish active matches before starting another tournament.');return;}
 if(dirty){say('Publish your current changes before preparing another tournament.');return;}
 const automatic=$('tFormat').value==='Round robin';
 if(automatic&&names.length*(names.length-1)/2>150){say('This format supports up to 150 fixtures. Select fewer clubs or enter fixtures manually.');return;}
 if(!confirm('Prepare '+name+' and archive the current tournament when you publish?'))return;
 const previous=state.tournament?.name||'Season 6';
 (state.tournamentHistory??=[]).push({name:previous,revision});
 state.tournament={name,date,clubs:names};state.matches=automatic?tournamentSchedule(names,kickoff,venue):[];
 state.features[0]={...state.features[0],title:name,description:names.length+' clubs · '+date};
 matchId=state.matches[0]?.id;changed();render();say('Tournament prepared. Publish changes to open it in the match centre.');
});
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-archive-rev]');if(!b||role!=='owner')return;
 try{const response=await deskFetch('api/history?revision='+encodeURIComponent(b.dataset.archiveRev));
 if(!response.ok)throw Error('Could not load this archive.');
 const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='boltz-tournament-revision-'+b.dataset.archiveRev+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }catch(error){say(error.message)}
});
