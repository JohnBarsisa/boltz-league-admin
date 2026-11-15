import fs from 'node:fs';
const html=fs.readFileSync('public/index.html','utf8'),css=fs.readFileSync('public/studio.css','utf8'),js=fs.readFileSync('public/tournaments.js','utf8')+'\n'+fs.readFileSync('public/scene-briefs.js','utf8')+'\n'+fs.readFileSync('public/studio.js','utf8');
const routes={'/':[html,'text/html'],'/studio.css':[css,'text/css'],'/studio.js':[js,'text/javascript']};
for(const [route,file,type] of [['/connect','owner-connect.html','text/html'],['/owner-connect.js','owner-connect.js','text/javascript']]) routes[route]=[fs.readFileSync('public/'+file,'utf8'),type];
const seed=fs.readFileSync('seed.json','utf8');
fs.mkdirSync('dist/server',{recursive:true});
fs.writeFileSync('dist/server/index.js','const seed='+seed+';\nconst routes='+JSON.stringify(routes)+';\nfunction serveStudio(path){const r=routes[path];return r?new Response(r[0],{headers:{"Content-Type":r[1]+"; charset=utf-8","Cache-Control":"no-cache"}}):new Response("Not found",{status:404})}\n'+fs.readFileSync('worker/referee.mjs','utf8')+'\n'+fs.readFileSync('worker/api.mjs','utf8'));
