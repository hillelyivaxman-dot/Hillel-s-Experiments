const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, out = process.argv[2];
const srv = http.createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end();}
 const t=f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.json')?'application/json':'text/html';res.writeHead(200,{'content-type':t});fs.createReadStream(f).pipe(res);}).listen(0);
(async()=>{
 const port=srv.address().port;
 const shots=[['01_menu','screen=menu&fy=0.57'],['02_level_select','screen=select&page=0'],['03_level_select_world3','screen=select&page=2'],['04_hud_level1','screen=game&level=1&state=init'],['05_level1_run','screen=game&level=1&state=run&t=0.55'],['06_level1_fail_feedback','screen=game&level=1&state=fail'],['07_success_stars_coins','screen=success&level=1&state=solved&stars=3'],['08_level5','screen=game&level=5&state=init'],['09_level18_world2','screen=game&level=18&state=init'],['10_level30_world3','screen=game&level=30&state=init'],['11_level12_factory_awake','screen=game&level=12&state=solved'],['12_shop_coins','screen=shop&tab=coins'],['13_shop_themes','screen=shop&tab=themes'],['14_shop_parcels','screen=shop&tab=parcels'],['15_shop_not_enough_coins','screen=shop&tab=themes&modal=coins'],['16_shop_test_purchase','screen=shop&tab=coins&modal=buy'],['17_daily_gift','screen=daily&fy=0.57'],['18_test_ad','screen=ad'],['19_theme_candy','screen=game&level=18&state=init&theme=candy&parcel=gift'],['20_theme_midnight','screen=game&level=30&state=init&theme=midnight&parcel=ocean'],['21_theme_gold','screen=game&level=24&state=init&theme=gold&parcel=gold']];
 const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:2});
 p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('pageerror:',e.message));
 for(const [n,qs] of shots){await p.goto(`http://localhost:${port}/index.html?${qs}`);await p.waitForFunction('window.READY===true',null,{timeout:20000});await p.waitForTimeout(300);await p.screenshot({path:`${out}/${n}.png`});console.log('ok',n);}
 await b.close();srv.close();
})();
