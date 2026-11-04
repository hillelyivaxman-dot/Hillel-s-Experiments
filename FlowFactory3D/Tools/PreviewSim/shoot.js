const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, out = process.argv[2];
const srv = http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
 const t=f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.json')?'application/json':'text/html';res.writeHead(200,{'content-type':t});fs.createReadStream(f).pipe(res);}).listen(0);
(async()=>{
 const port=srv.address().port;
 const shots=[['01_menu','screen=menu&fy=0.57'],['02_level_select','screen=select'],['03_level1_start_tutorial','screen=game&level=1&state=init'],['04_level1_run','screen=game&level=1&state=run&t=0.55'],['05_level1_fail_feedback','screen=game&level=1&state=fail'],['06_level1_success','screen=success&level=1&state=solved'],['07_level5_start','screen=game&level=5&state=init'],['08_level5_run','screen=game&level=5&state=run&t=0.6'],['09_level11_start','screen=game&level=11&state=init'],['10_level12_factory_awake','screen=game&level=12&state=solved']];
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:2});
 p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('pageerror:',e.message));
 for(const [n,qs] of shots){await p.goto(`http://localhost:${port}/index.html?${qs}`);await p.waitForFunction('window.READY===true',null,{timeout:20000});await p.waitForTimeout(300);await p.screenshot({path:`${out}/${n}.png`});console.log('ok',n);}
 await b.close();srv.close();
})();
