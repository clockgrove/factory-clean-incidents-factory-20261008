import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
export const fields=['id','title','description','service','severity','status','openedAt','resolvedAt','team','region','tags'];
const rank={critical:0,high:1,medium:2,low:3};
export function select(rows,p){
 const q=(p.get('q')||'').toLowerCase();
 return rows.filter(r=>[r.id,r.title,r.description].some(v=>v.toLowerCase().includes(q))&&['service','status','severity'].every(k=>!p.getAll(k).length||p.getAll(k).includes(r[k]))&&(!p.get('from')||r.openedAt.slice(0,10)>=p.get('from'))&&(!p.get('to')||r.openedAt.slice(0,10)<=p.get('to'))).sort((a,b)=>{const n=p.get('sort')==='severity'?rank[a.severity]-rank[b.severity]:a.openedAt.localeCompare(b.openedAt);return n*(p.get('direction')==='asc'?1:-1)*(p.get('sort')==='severity'?-1:1)||a.id.localeCompare(b.id);});
}
export async function app(){
 const rows=JSON.parse(await readFile(new URL('.runtime/incidents.json',root),'utf8'));
 return createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost');const p=u.searchParams;
 if(u.pathname==='/api/incidents'||u.pathname==='/api/export'){
 const all=select(rows,p);
 if(u.pathname==='/api/export'){res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="incidents.csv"'});const cell=v=>'"'+String(Array.isArray(v)?JSON.stringify(v):v??'').replaceAll('"','""')+'"';res.end([fields.map(cell).join(','),...all.map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n'));return;}
 const size=p.get('size')==='50'?50:25;const pages=Math.max(1,Math.ceil(all.length/size));const page=Math.min(pages,Math.max(1,Math.trunc(Number(p.get('page')))||1));
 const days={};for(const r of all)days[r.openedAt.slice(0,10)]=(days[r.openedAt.slice(0,10)]||0)+1;
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({rows:all.slice((page-1)*size,page*size),page,pages,total:all.length,unresolved:all.filter(r=>r.status!=='resolved').length,high:all.filter(r=>rank[r.severity]<2).length,days:Object.entries(days).sort()}));return;
 }
 if(u.pathname.startsWith('/api/incidents/')){const row=rows.find(r=>r.id===decodeURIComponent(u.pathname.split('/').pop()));res.writeHead(row?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(row||{error:'Incident not found'}));return;}
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(!files[u.pathname]){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL('public/'+files[u.pathname],root)));
 }catch{res.writeHead(500);res.end('Request failed');}});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await app();server.listen(3000,'127.0.0.1',()=>console.log('Incident explorer: http://127.0.0.1:3000'));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());}
